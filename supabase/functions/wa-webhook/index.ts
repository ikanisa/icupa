import {
  getChatState,
  getLatestSession,
  messageExists,
  sendWhatsAppMessage,
  storeMessage,
  upsertChatState,
} from "../_shared/wa.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WA_VERIFY_TOKEN = Deno.env.get("WA_VERIFY_TOKEN") ?? "";
const WA_OFFLINE = Deno.env.get("WA_OFFLINE") === "1";

const TEMPLATE_LIBRARY = {
  ITIN_SUMMARY: {
    name: "ITIN_SUMMARY",
    language: "en",
    components: {
      body_text: "Here is your 7-day Rwanda plan. Ready to move forward?",
      buttons: [
        { id: "pay_now", text: "Pay" },
        { id: "group_invite", text: "Group Save" },
      ],
    },
  },
  PAYMENT_LINK: {
    name: "PAYMENT_LINK",
    language: "en",
    components: {
      body_text: "Tap below to open your secure checkout.",
      buttons: [{ id: "open_checkout", text: "Open Checkout" }],
    },
  },
  GROUP_INVITE: {
    name: "GROUP_INVITE",
    language: "en",
    components: {
      body_text: "Invite friends to split the trip. Ready to join?",
      buttons: [
        { id: "join_group", text: "Join" },
        { id: "skip_group", text: "Skip" },
      ],
    },
  },
  SUPPORT_ESCALATION: {
    name: "SUPPORT_ESCALATION",
    language: "en",
    components: {
      body_text: "Need help? Tap to reach support.",
      buttons: [{ id: "contact_support", text: "Contact Support" }],
    },
  },
} as const;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  idle: ["pay_requested", "group_invite"],
  pay_requested: ["idle"],
  group_invite: ["group_join", "idle"],
  group_join: ["idle"],
};

type InboundMessage = {
  id: string;
  from: string;
  text: string;
  name?: string;
  type: "text" | "interactive";
  buttonPayload?: string;
  buttonTitle?: string;
};

type TemplateMessagePayload = {
  name: string;
  language?: string;
  components: {
    body_text: string;
    buttons?: Array<{ id: string; text: string }>;
    vars?: Record<string, string>;
  };
};

type PendingSend = {
  kind: "template" | "text";
  template?: TemplateMessagePayload;
  text?: string;
  logLabel: string;
};

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for wa-webhook");
}

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("wa-webhook");
  }

  if (req.method === "GET") {
    return handleVerify(req);
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const requestId = getRequestId(req) ?? crypto.randomUUID();

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const messages = extractInboundMessages(payload);
  if (messages.length === 0) {
    return jsonResponse({ ok: true, processed: 0 });
  }

  const results = [];
  const processedIds = new Set<string>();

  for (const message of messages) {
    if (processedIds.has(message.id)) {
      continue;
    }
    processedIds.add(message.id);
    try {
      const duplicate = await messageExists(message.id);
      if (duplicate) {
        console.log(
          `AUDIT wa.webhook requestId=${requestId} from=${message.from} status=duplicate`,
        );
        continue;
      }

      const chatState = await fetchChatStateRecord(message.from);
      let currentState = chatState.state;
      let stateData = { ...chatState.data };

      const existingSession = await getLatestSession(message.from);
      let sessionId = existingSession ?? null;
      let orchestratorResult: {
        sessionId: string | null;
        response: Record<string, unknown> | null;
      } | null = null;
      let toolKeyForLog = "";

      const inboundBody: Record<string, unknown> = {
        text: message.text,
        name: message.name ?? null,
        wa_message_id: message.id,
        state_before: currentState,
      };
      if (message.buttonPayload) {
        inboundBody.button_payload = message.buttonPayload;
        inboundBody.button_title = message.buttonTitle ?? null;
      }

      const sendResults: Array<{ mode: string; messageId: string }> = [];
      const pendingSends: PendingSend[] = [];
      let nextState = currentState;
      let nextData: Record<string, unknown> | null = stateData;
      let helpReply: string | null = null;

      if (message.buttonPayload) {
        const action = message.buttonPayload.toLowerCase();
        switch (action) {
          case "pay_now": {
            const desiredState = "pay_requested";
            if (!canTransitionState(currentState, desiredState)) {
              helpReply = politeTransitionMessage(currentState, desiredState);
              nextState = currentState;
              break;
            }
            const goal = "Proceed to checkout for current itinerary";
            orchestratorResult = await callOrchestrator(
              goal,
              sessionId,
              message.text,
              message.from,
            );
            sessionId = orchestratorResult.sessionId ?? sessionId;
            toolKeyForLog = extractPlannedTool(orchestratorResult.response);
            const template = cloneTemplate("PAYMENT_LINK");
            pendingSends.push({ kind: "template", template, logLabel: action });
            nextState = desiredState;
            nextData = {
              ...stateData,
              last_action: action,
              last_template: template.name,
            };
            break;
          }
          case "group_invite": {
            const desiredState = "group_invite";
            if (!canTransitionState(currentState, desiredState)) {
              helpReply = politeTransitionMessage(currentState, desiredState);
              nextState = currentState;
              break;
            }
            const goal = "Create group and invite friends to split pay";
            orchestratorResult = await callOrchestrator(
              goal,
              sessionId,
              message.text,
              message.from,
            );
            sessionId = orchestratorResult.sessionId ?? sessionId;
            toolKeyForLog = extractPlannedTool(orchestratorResult.response);
            const template = cloneTemplate("GROUP_INVITE");
            const groupId =
              typeof stateData.group_id === "string" && stateData.group_id
                ? stateData.group_id
                : crypto.randomUUID();
            nextData = {
              ...stateData,
              last_action: action,
              last_template: template.name,
              group_id: groupId,
            };
            pendingSends.push({ kind: "template", template, logLabel: action });
            nextState = desiredState;
            break;
          }
          case "join_group": {
            const desiredState = "group_join";
            if (!canTransitionState(currentState, desiredState)) {
              helpReply = politeTransitionMessage(currentState, desiredState);
              nextState = currentState;
              break;
            }
            const groupId = typeof stateData.group_id === "string"
              ? stateData.group_id
              : null;
            if (!groupId) {
              helpReply =
                "I couldn't find an active group to join. Reply 'group' to restart.";
              nextState = "idle";
              nextData = {};
              break;
            }
            const groupJoinResult = await callGroupsJoinAction({
              groupId,
              userWa: message.from,
              requestId,
            });
            helpReply = groupJoinResult.ok
              ? "You're now part of the group. We'll share progress soon!"
              : "We couldn't join the group right now. We'll keep you posted.";
            nextState = groupJoinResult.ok ? desiredState : currentState;
            nextData = {
              ...stateData,
              last_action: action,
              group_join_mode: groupJoinResult.mode,
              join_error: groupJoinResult.error ?? null,
            };
            console.log(
              `AUDIT wa.webhook requestId=${requestId} from=${message.from} action=${action} group=${groupId} join_mode=${groupJoinResult.mode}`,
            );
            break;
          }
          case "skip_group": {
            helpReply = "No problem. You're back to browsing ideas.";
            nextState = "idle";
            nextData = {};
            console.log(
              `AUDIT wa.webhook requestId=${requestId} from=${message.from} action=skip_group state=idle`,
            );
            break;
          }
          case "open_checkout": {
            helpReply =
              "Opening checkout link shortly. Let me know if you need assistance.";
            nextState = "pay_requested";
            nextData = {
              ...stateData,
              last_action: action,
            };
            console.log(
              `AUDIT wa.webhook requestId=${requestId} from=${message.from} action=open_checkout`,
            );
            break;
          }
          case "contact_support": {
            const template = cloneTemplate("SUPPORT_ESCALATION");
            pendingSends.push({ kind: "template", template, logLabel: action });
            nextState = "idle";
            nextData = {
              ...stateData,
              last_action: action,
              last_template: template.name,
            };
            break;
          }
          default: {
            helpReply = unknownActionMessage();
            nextState = "idle";
            nextData = {
              ...stateData,
              last_action: action,
            };
            console.log(
              `AUDIT wa.webhook requestId=${requestId} from=${message.from} action=${action} status=unknown`,
            );
          }
        }
      } else {
        const goal = mapGoal(message.text);
        orchestratorResult = await callOrchestrator(
          goal,
          sessionId,
          message.text,
          message.from,
        );
        sessionId = orchestratorResult.sessionId ?? sessionId;
        toolKeyForLog = extractPlannedTool(orchestratorResult.response);

        const normalized = message.text.trim().toLowerCase();
        if (normalized === "plan trip") {
          const template = cloneTemplate("ITIN_SUMMARY");
          pendingSends.push({
            kind: "template",
            template,
            logLabel: "plan_trip",
          });
          nextState = "idle";
          nextData = {
            ...stateData,
            last_template: template.name,
            last_action: "plan_trip",
          };
        } else if (normalized === "pay") {
          if (!canTransitionState(currentState, "pay_requested")) {
            helpReply = politeTransitionMessage(currentState, "pay_requested");
          } else {
            const template = cloneTemplate("PAYMENT_LINK");
            pendingSends.push({ kind: "template", template, logLabel: "pay" });
            nextState = "pay_requested";
            nextData = {
              ...stateData,
              last_template: template.name,
              last_action: "pay",
            };
          }
        } else if (normalized === "group") {
          if (!canTransitionState(currentState, "group_invite")) {
            helpReply = politeTransitionMessage(currentState, "group_invite");
          } else {
            const template = cloneTemplate("GROUP_INVITE");
            const groupId =
              typeof stateData.group_id === "string" && stateData.group_id
                ? stateData.group_id
                : crypto.randomUUID();
            pendingSends.push({
              kind: "template",
              template,
              logLabel: "group",
            });
            nextState = "group_invite";
            nextData = {
              ...stateData,
              group_id: groupId,
              last_template: template.name,
              last_action: "group",
            };
          }
        } else {
          const reply = buildReply(goal, orchestratorResult.response);
          pendingSends.push({
            kind: "text",
            text: reply,
            logLabel: "text_reply",
          });
          nextState = "idle";
          nextData = {
            ...stateData,
            last_action: "text_reply",
          };
        }
      }

      inboundBody.state_after = nextState;
      if (nextData && Object.keys(nextData).length > 0) {
        inboundBody.state_data = nextData;
      }

      await storeMessage({
        userWa: message.from,
        direction: "in",
        sessionId,
        body: inboundBody,
        waMessageId: message.id,
      });

      if (helpReply) {
        pendingSends.push({ kind: "text", text: helpReply, logLabel: "help" });
      }

      for (const pending of pendingSends) {
        let sendResult;
        if (pending.kind === "template" && pending.template) {
          sendResult = await sendWhatsAppMessage({
            to: message.from,
            template: pending.template,
            sessionId,
            userWa: message.from,
            requestId,
          });
        } else if (pending.kind === "text" && pending.text !== undefined) {
          sendResult = await sendWhatsAppMessage({
            to: message.from,
            text: pending.text,
            sessionId,
            userWa: message.from,
            requestId,
          });
        } else {
          continue;
        }
        sendResults.push({
          mode: sendResult.mode,
          messageId: sendResult.message_id,
        });
        console.log(
          `AUDIT wa.webhook requestId=${requestId} from=${message.from} outbound=${pending.logLabel} state=${nextState} tool=${toolKeyForLog} send_mode=${sendResult.mode}`,
        );
      }

      try {
        await upsertChatState(message.from, nextState, nextData ?? {});
      } catch (stateError) {
        console.log(
          `AUDIT wa.webhook requestId=${requestId} from=${message.from} state_update_error=${
            String(stateError)
          }`,
        );
      }

      for (const result of sendResults) {
        results.push({
          message_id: result.messageId,
          session_id: sessionId,
          mode: result.mode,
        });
      }
    } catch (error) {
      console.log(
        `AUDIT wa.webhook requestId=${requestId} from=${message.from} status=error message=${
          String(error)
        }`,
      );
    }
  }

  return jsonResponse({ ok: true, processed: results.length, results });
}, { fn: "wa-webhook", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function handleVerify(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  if (mode === "subscribe" && token === WA_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("forbidden", { status: 403 });
}

function extractInboundMessages(
  payload: Record<string, unknown>,
): InboundMessage[] {
  const results: InboundMessage[] = [];
  const entries = (payload.entry as unknown[]) ?? [];
  for (const entry of entries) {
    const changes = (entry as Record<string, unknown>)?.changes as unknown[] ??
      [];
    for (const change of changes) {
      const value = (change as Record<string, unknown>)?.value as
        | Record<string, unknown>
        | undefined;
      if (!value) continue;
      const contacts = (value.contacts as unknown[]) ?? [];
      const messages = (value.messages as unknown[]) ?? [];
      let name: string | undefined;
      if (contacts[0] && typeof contacts[0] === "object") {
        const profile = (contacts[0] as Record<string, unknown>).profile as
          | Record<string, unknown>
          | undefined;
        if (profile && typeof profile.name === "string") {
          name = profile.name;
        }
      }
      for (const msg of messages) {
        if (!msg || typeof msg !== "object") continue;
        const message = msg as Record<string, unknown>;
        const from = typeof message.from === "string" ? message.from : "";
        const id = typeof message.id === "string"
          ? message.id
          : crypto.randomUUID();
        if (!from) continue;

        if (message.type === "text") {
          const textBody = (message.text as Record<string, unknown>)?.body;
          if (typeof textBody !== "string" || !textBody.trim()) continue;
          results.push({
            id,
            from,
            text: textBody.trim(),
            name,
            type: "text",
          });
          continue;
        }

        if (message.type === "interactive") {
          const interactive = message.interactive as
            | Record<string, unknown>
            | undefined;
          const buttonReply = interactive?.button_reply as
            | Record<string, unknown>
            | undefined;
          const payloadId = typeof buttonReply?.id === "string"
            ? buttonReply.id
            : undefined;
          const title = typeof buttonReply?.title === "string"
            ? buttonReply.title
            : undefined;
          if (!payloadId) continue;
          const titleText = title ?? payloadId;
          results.push({
            id,
            from,
            text: titleText,
            name,
            type: "interactive",
            buttonPayload: payloadId,
            buttonTitle: title,
          });
        }
      }
    }
  }
  return results;
}

async function fetchChatStateRecord(
  userWa: string,
): Promise<{ state: string; data: Record<string, unknown> }> {
  try {
    const record = await getChatState(userWa);
    if (!record) {
      return { state: "idle", data: {} };
    }
    return { state: record.state ?? "idle", data: record.data ?? {} };
  } catch (_error) {
    return { state: "idle", data: {} };
  }
}

function canTransitionState(current: string, next: string): boolean {
  if (current === next) return true;
  const allowed =
    ALLOWED_TRANSITIONS[current as keyof typeof ALLOWED_TRANSITIONS];
  if (!allowed) return next === "idle";
  return allowed.includes(next) || next === current;
}

function politeTransitionMessage(current: string, desired: string): string {
  if (current === desired) {
    return "You're already on that step. Let me know if you'd like to reset.";
  }
  return "Let's wrap up the previous step first—reply 'idle' or 'help' if you need to restart.";
}

function extractPlannedTool(
  response: Record<string, unknown> | null | undefined,
): string {
  if (!response) return "";
  const toolRecord = response.planned_tool as { key?: unknown } | undefined;
  return toolRecord && typeof toolRecord.key === "string" ? toolRecord.key : "";
}

function cloneTemplate(
  name: keyof typeof TEMPLATE_LIBRARY,
): TemplateMessagePayload {
  const def = TEMPLATE_LIBRARY[name];
  return {
    name: def.name,
    language: def.language,
    components: {
      body_text: def.components.body_text,
      buttons: def.components.buttons?.map((button) => ({ ...button })),
      vars: def.components.vars ? { ...def.components.vars } : undefined,
    },
  };
}

function unknownActionMessage(): string {
  return "I didn't recognise that button. Try 'plan trip', 'pay', or 'group' to continue.";
}

async function callGroupsJoinAction(
  input: { groupId: string; userWa: string; requestId: string },
): Promise<{
  ok: boolean;
  mode: "mock" | "live";
  error?: string;
}> {
  if (WA_OFFLINE) {
    console.log(
      `AUDIT wa.webhook requestId=${input.requestId} group=${input.groupId} action=groups.join mode=mock`,
    );
    return { ok: true, mode: "mock" };
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { ok: false, mode: "mock", error: "missing supabase env" };
  }

  const body = {
    group_id: input.groupId,
    user_id: crypto.randomUUID(),
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/groups-join`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, mode: "live", error: text };
    }

    await response.json().catch(() => null);
    return { ok: true, mode: "live" };
  } catch (error) {
    return { ok: false, mode: "live", error: String(error) };
  }
}

function mapGoal(text: string): string {
  const normalized = text.trim().toLowerCase();
  if (normalized === "plan trip") {
    return "Plan a 7-day Rwanda itinerary (mid budget)";
  }
  if (normalized === "pay") {
    return "Proceed to checkout for current itinerary";
  }
  if (normalized === "group") {
    return "Create group and invite friends to split pay";
  }
  return text;
}

async function callOrchestrator(
  goal: string,
  sessionId: string | null,
  originalText: string,
  userWa: string,
) {
  const payload: Record<string, unknown> = {
    agent: "PlannerCoPilot",
    goal,
    dry_run: false,
    messages: [
      {
        role: "user",
        content: originalText,
        metadata: { channel: "whatsapp", user: userWa },
      },
    ],
  };
  if (sessionId) {
    payload.session_id = sessionId;
  }
  payload.tool_call = {
    key: "agent.log_goal",
    input: {
      goal,
      user_wa: userWa,
      message: originalText,
      request_id: crypto.randomUUID(),
    },
  };

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/agent-orchestrator`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`agent-orchestrator error: ${text}`);
  }

  const data = await response.json();
  return {
    sessionId: data.session_id ? String(data.session_id) : sessionId,
    response: data as Record<string, unknown>,
  };
}

function buildReply(
  goal: string,
  orchestratorResponse: Record<string, unknown> | null,
) {
  if (!orchestratorResponse) {
    return `Thanks! Working on: ${goal}`;
  }

  const toolRecord = orchestratorResponse.planned_tool as
    | Record<string, unknown>
    | undefined;
  const toolKeyValue = (toolRecord as { key?: unknown } | undefined)?.key;
  const toolKey = typeof toolKeyValue === "string" ? toolKeyValue : null;
  if (toolKey) {
    return `On it! Triggered ${toolKey} for you.`;
  }

  const toolResult = orchestratorResponse.tool_result as
    | Record<string, unknown>
    | undefined;
  const toolStatusValue = (toolResult as { status?: unknown } | undefined)
    ?.status;
  const toolStatus = typeof toolStatusValue === "string"
    ? toolStatusValue
    : null;
  if (toolStatus) {
    return `Update: tool status ${toolStatus}. We'll keep you posted.`;
  }

  return `PlannerCoPilot is working on: ${goal}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
