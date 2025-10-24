export interface AiSpanFixture {
  id: string;
  agent: string;
  toolKey: string;
  requestId: string;
  startedAt: number;
  durationMs: number;
  ok: boolean;
  status?: number;
  hashes: {
    request: string;
    response?: string;
    error?: string;
  };
  tokenCounts: {
    request?: number;
    response?: number;
    error?: number;
  };
}

export const aiSpanFixtures: AiSpanFixture[] = [
  {
    id: "span-quote-001",
    agent: "PlannerCoPilot",
    toolKey: "quote.search",
    requestId: "f5c1f7c2-4d28-4eb1-bb11-3f1d4eb31fb8",
    startedAt: 1733421925123,
    durationMs: 842,
    ok: true,
    status: 200,
    hashes: {
      request: "2f0380c72c2dcda0ca502f4dfbf87d62f4e4af63f4e53d20a35978d9cf0ba80c",
      response: "fb8667855d8dd23461337609ab6ad66df3c6a7f1242449fa555c0f5e6d926121",
    },
    tokenCounts: {
      request: 98,
      response: 143,
    },
  },
  {
    id: "span-quote-002",
    agent: "PlannerCoPilot",
    toolKey: "quote.search",
    requestId: "c6d0eb99-6df1-4d07-96b8-05e5526d9f1a",
    startedAt: 1733422020455,
    durationMs: 913,
    ok: false,
    status: 502,
    hashes: {
      request: "2f0380c72c2dcda0ca502f4dfbf87d62f4e4af63f4e53d20a35978d9cf0ba80c",
      error: "ab12ce7d1ffb09f251d977357c4bb73a7dc7e03bdbb8a9160f1f14f9ce702baf",
    },
    tokenCounts: {
      request: 98,
      error: 17,
    },
  },
  {
    id: "span-map-001",
    agent: "ConciergeGuide",
    toolKey: "map.route",
    requestId: "7f33e2bb-a63a-430b-aebb-18e0b7add3b1",
    startedAt: 1733422121784,
    durationMs: 602,
    ok: true,
    status: 200,
    hashes: {
      request: "5d7dc073c27714c5d8845b34b5e0c8b44d8ac0f4a0f04c4b1d79425b8fc9f81f",
      response: "6e4fd5cb1181b196767f0b1f81c0ff93b729369b9829f7d5d4142c6b2f36b01c",
    },
    tokenCounts: {
      request: 76,
      response: 52,
    },
  },
];
