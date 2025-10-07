import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface OnboardRequest {
  tenant_name?: string;
  region?: "RW" | "EU";
  location_name?: string;
  currency?: string;
  timezone?: string;
  manager_user_id?: string;
  manager_role?: string;
  admin_token?: string;
}

interface JsonResponse {
  message: string;
  tenant_id?: string;
  location_id?: string;
  menu_id?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_ONBOARDING_SECRET = Deno.env.get("ADMIN_ONBOARDING_SECRET") ?? "";

const REGION_DEFAULTS: Record<"RW" | "EU", { currency: string; timezone: string; vatRate: number }> = {
  RW: { currency: "RWF", timezone: "Africa/Kigali", vatRate: 18 },
  EU: { currency: "EUR", timezone: "Europe/Malta", vatRate: 18 },
};

function jsonResponse(body: JsonResponse | Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function authorize(req: Request): boolean {
  if (!ADMIN_ONBOARDING_SECRET) {
    console.error("ADMIN_ONBOARDING_SECRET is not configured");
    return false;
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  return token === ADMIN_ONBOARDING_SECRET;
}

function sanitizeText(value: string | undefined | null, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ message: "Only POST requests are supported" }, 405);
    }

    if (!authorize(req)) {
      return jsonResponse({ message: "Admin token required" }, 401);
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ message: "Server configuration incomplete" }, 500);
    }

    const payload = (await req.json()) as OnboardRequest;
    const tenantName = sanitizeText(payload.tenant_name, "New ICUPA Tenant");
    const region = (payload.region ?? "RW") as "RW" | "EU";
    const defaults = REGION_DEFAULTS[region];
    if (!defaults) {
      return jsonResponse({ message: "Unsupported region" }, 400);
    }

    const currency = sanitizeText(payload.currency, defaults.currency).toUpperCase().slice(0, 3);
    const timezone = sanitizeText(payload.timezone, defaults.timezone);
    const locationName = sanitizeText(payload.location_name, `${tenantName} – Main Venue`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const tenantId = crypto.randomUUID();
    const locationId = crypto.randomUUID();
    const menuId = crypto.randomUUID();
    const beverageCategoryId = crypto.randomUUID();
    const platesCategoryId = crypto.randomUUID();

    const cleanup = async () => {
      await supabase.from("tenants").delete().eq("id", tenantId);
    };

    const tenantResult = await supabase
      .from("tenants")
      .insert({
        id: tenantId,
        name: tenantName,
        region,
        settings: { currency },
      })
      .select("id")
      .single();

    if (tenantResult.error) {
      console.error("Failed to insert tenant", tenantResult.error);
      return jsonResponse({ message: "Unable to create tenant" }, 500);
    }

    const locationResult = await supabase
      .from("locations")
      .insert({
        id: locationId,
        tenant_id: tenantId,
        name: locationName,
        currency,
        timezone,
        region,
        vat_rate: defaults.vatRate,
        settings: { onboarding: true },
      })
      .select("id")
      .single();

    if (locationResult.error) {
      console.error("Failed to insert location", locationResult.error);
      await cleanup();
      return jsonResponse({ message: "Unable to create location" }, 500);
    }

    const menuResult = await supabase
      .from("menus")
      .insert({
        id: menuId,
        tenant_id: tenantId,
        location_id: locationId,
        name: `${tenantName} Core`,
        is_active: true,
        version: 1,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (menuResult.error) {
      console.error("Failed to insert menu", menuResult.error);
      await cleanup();
      return jsonResponse({ message: "Unable to create menu" }, 500);
    }

    const categoriesResult = await supabase.from("categories").insert([
      {
        id: beverageCategoryId,
        menu_id: menuId,
        name: "Beverages",
        sort_order: 1,
      },
      {
        id: platesCategoryId,
        menu_id: menuId,
        name: "Plates",
        sort_order: 2,
      },
    ]);

    if (categoriesResult.error) {
      console.error("Failed to insert categories", categoriesResult.error);
      await cleanup();
      return jsonResponse({ message: "Unable to seed categories" }, 500);
    }

    const itemsResult = await supabase.from("items").insert([
      {
        tenant_id: tenantId,
        location_id: locationId,
        menu_id: menuId,
        category_id: beverageCategoryId,
        name: `${tenantName} Signature Cold Brew`,
        description: "Single-origin cold brew with seasonal syrup.",
        price_cents: region === "EU" ? 850 : 3200,
        currency,
        allergens: ["caffeine"],
        tags: ["drink", "signature"],
        is_alcohol: false,
        is_available: true,
      },
      {
        tenant_id: tenantId,
        location_id: locationId,
        menu_id: menuId,
        category_id: platesCategoryId,
        name: `${tenantName} Market Plate`,
        description: "Rotating seasonal plate featuring local produce.",
        price_cents: region === "EU" ? 1450 : 8900,
        currency,
        allergens: ["gluten"],
        tags: ["chef_special"],
        is_alcohol: false,
        is_available: true,
      },
    ]);

    if (itemsResult.error) {
      console.error("Failed to insert items", itemsResult.error);
      await cleanup();
      return jsonResponse({ message: "Unable to seed menu items" }, 500);
    }

    const agentConfigs = [
      {
        tenant_id: tenantId,
        agent_type: "waiter",
        enabled: true,
        session_budget_usd: 0.75,
        daily_budget_usd: 45,
        instructions: "Greet guests, provide grounded answers, and cite menu sources in every suggestion.",
        tool_allowlist: ["get_menu", "check_allergens", "recommend_items", "create_order"],
        autonomy_level: "L1",
        retrieval_ttl_minutes: 5,
        experiment_flag: "onboarding",
        metadata: { disclaimer: "Always display allergen chips." },
        updated_by: payload.manager_user_id ?? null,
        sync_pending: true,
      },
      {
        tenant_id: tenantId,
        agent_type: "allergen_guardian",
        enabled: true,
        session_budget_usd: 0.5,
        daily_budget_usd: 25,
        instructions: "Screen every suggestion against declared allergens and escalate hard blocks.",
        tool_allowlist: ["check_allergens", "get_menu"],
        autonomy_level: "L0",
        retrieval_ttl_minutes: 5,
        experiment_flag: "onboarding",
        metadata: { enforcement: "strict" },
        updated_by: payload.manager_user_id ?? null,
        sync_pending: true,
      },
      {
        tenant_id: tenantId,
        agent_type: "promo_event",
        enabled: false,
        session_budget_usd: 0.35,
        daily_budget_usd: 20,
        instructions: "Draft promo ideas with clear ROI rationale and await approval before activation.",
        tool_allowlist: ["recommend_items"],
        autonomy_level: "L0",
        retrieval_ttl_minutes: 10,
        experiment_flag: null,
        metadata: { budget_cap_cents: 40000 },
        updated_by: payload.manager_user_id ?? null,
        sync_pending: true,
      },
    ];

    const agentConfigResult = await supabase.from("agent_runtime_configs").insert(agentConfigs);
    if (agentConfigResult.error) {
      console.error("Failed to seed agent configs", agentConfigResult.error);
      await cleanup();
      return jsonResponse({ message: "Unable to seed agent configuration" }, 500);
    }

    const kpiResult = await supabase.from("tenant_kpi_snapshots").insert({
      tenant_id: tenantId,
      window: "7d",
      gmv_cents: 0,
      aov_cents: 0,
      attach_rate: 0,
      prep_sla_p95_minutes: 0,
      ai_acceptance_rate: 0,
      safety_blocks: 0,
    });

    if (kpiResult.error) {
      console.error("Failed to seed KPI snapshot", kpiResult.error);
      await cleanup();
      return jsonResponse({ message: "Unable to seed KPI snapshot" }, 500);
    }

    const complianceSeed = await supabase.from("compliance_tasks").insert([
      {
        tenant_id: tenantId,
        region,
        category: "ai_disclosure",
        title: "Review AI transparency copy before launch",
        status: "pending",
        severity: "medium",
        details: { surface: "diner_chat" },
      },
      {
        tenant_id: tenantId,
        region,
        category: "fiscalisation",
        title: region === "RW" ? "Register device with RRA EBM" : "Validate fiscal receipt printer",
        status: "pending",
        severity: "high",
        details: { window: "go-live" },
      },
    ]);

    if (complianceSeed.error) {
      console.error("Failed to seed compliance tasks", complianceSeed.error);
      await cleanup();
      return jsonResponse({ message: "Unable to seed compliance tasks" }, 500);
    }

    const noticeDefaults = await supabase
      .from("compliance_notice_templates")
      .select("region, notice_type, surface, content, last_reviewed_at")
      .is("tenant_id", null)
      .eq("region", region);

    if (noticeDefaults.error) {
      console.warn("Failed to load compliance notice defaults", noticeDefaults.error);
    } else if (noticeDefaults.data && noticeDefaults.data.length > 0) {
      const noticeInsert = await supabase.from("compliance_notice_templates").insert(
        noticeDefaults.data.map((row) => ({
          tenant_id: tenantId,
          region: row.region,
          notice_type: row.notice_type,
          surface: row.surface,
          content: row.content,
          last_reviewed_at: row.last_reviewed_at ?? null,
        })),
      );

      if (noticeInsert.error) {
        console.error("Failed to seed compliance notices", noticeInsert.error);
        await cleanup();
        return jsonResponse({ message: "Unable to seed compliance notices" }, 500);
      }
    }

    const kybcDefaults =
      region === "RW"
        ? [
            {
              requirement: "Upload Rwanda trade licence",
              notes: { document: "licence.pdf" },
            },
            {
              requirement: "Provide beneficial owner list",
              notes: { owner: payload.manager_user_id ?? null },
            },
          ]
        : [
            {
              requirement: "Submit MFSA registration certificate",
              notes: { reference: "pending" },
            },
            {
              requirement: "Upload proof of bank account ownership",
              notes: { bank: payload.currency ?? "EUR" },
            },
          ];

    const kybcInsert = await supabase.from("kybc_checklist_items").insert(
      kybcDefaults.map((item) => ({
        tenant_id: tenantId,
        region,
        requirement: item.requirement,
        status: "pending",
        notes: item.notes,
      })),
    );

    if (kybcInsert.error) {
      console.error("Failed to seed KYBC checklist", kybcInsert.error);
      await cleanup();
      return jsonResponse({ message: "Unable to seed KYBC checklist" }, 500);
    }

    if (payload.manager_user_id) {
      await supabase
        .from("user_roles")
        .insert({
          user_id: payload.manager_user_id,
          tenant_id: tenantId,
          role: payload.manager_role ?? "admin",
        })
        .select("user_id")
        .single()
        .catch((error) => console.warn("Failed to assign manager role", error));
    }

    return jsonResponse(
      {
        message: "Tenant onboarding completed",
        tenant_id: tenantId,
        location_id: locationId,
        menu_id: menuId,
      },
      201,
    );
  } catch (error) {
    console.error("Unexpected error in onboard_tenant", error);
    return jsonResponse({ message: "Unexpected error" }, 500);
  }
});
