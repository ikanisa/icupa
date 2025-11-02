import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { agentRunSchema, type AgentEvent, type AgentRun } from "@icupa/agents";

export interface AgentRunRecord extends AgentRun {
  projectId: string;
}

export interface AgentRunRepositoryPort {
  createRun(record: AgentRunRecord): Promise<AgentRunRecord>;
  updateRun(runId: string, updates: Partial<AgentRunRecord>): Promise<AgentRunRecord>;
  appendEvent(runId: string, event: AgentEvent): Promise<void>;
  listRuns(projectId: string, limit?: number): Promise<AgentRunRecord[]>;
  getRun(runId: string): Promise<AgentRunRecord | null>;
}

export class AgentRunRepository implements AgentRunRepositoryPort {
  private readonly client: SupabaseClient;

  constructor(private readonly options: { tableName?: string } = {}) {
    const tableName = options.tableName ?? "agent_runs";
    this.options.tableName = tableName;
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  private get tableName() {
    return this.options.tableName ?? "agent_runs";
  }

  async createRun(record: AgentRunRecord): Promise<AgentRunRecord> {
    const parsed = agentRunSchema.parse(record);
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(parsed)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as AgentRunRecord;
  }

  async updateRun(runId: string, updates: Partial<AgentRunRecord>): Promise<AgentRunRecord> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(updates)
      .eq("id", runId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return agentRunSchema.parse(data) as AgentRunRecord;
  }

  async appendEvent(runId: string, event: AgentEvent): Promise<void> {
    const { error } = await this.client.from("agent_run_events").insert({
      ...event,
      run_id: runId,
    });

    if (error) {
      throw error;
    }
  }

  async listRuns(projectId: string, limit = 20): Promise<AgentRunRecord[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data?.map((run) => agentRunSchema.parse(run) as AgentRunRecord) ?? [];
  }

  async getRun(runId: string): Promise<AgentRunRecord | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("id", runId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      return null;
    }

    return agentRunSchema.parse(data) as AgentRunRecord;
  }
}
