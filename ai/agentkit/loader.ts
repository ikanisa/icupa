import { readFileSync } from "fs";
import { join } from "path";

interface AgentConfig {
  id: string;
  type: "realtime" | "responses";
  tools: string[];
  entry?: boolean;
  description?: string;
}

interface RouteConfig {
  from: string;
  to: string;
  when: string;
  description?: string;
}

interface GraphConfig {
  agents: AgentConfig[];
  routes: RouteConfig[];
}

interface ConnectorsConfig {
  [key: string]: any;
}

interface EvalsConfig {
  evals: any[];
  graders: any;
}

/**
 * Load and parse AgentKit configuration files
 */
export class AgentKitLoader {
  private basePath: string;

  constructor(basePath: string = join(process.cwd(), "ai", "agentkit")) {
    this.basePath = basePath;
  }

  /**
   * Load graph configuration
   */
  loadGraph(): GraphConfig {
    const path = join(this.basePath, "graph.json");
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as GraphConfig;
  }

  /**
   * Load connectors configuration
   */
  loadConnectors(): ConnectorsConfig {
    const path = join(this.basePath, "connectors.json");
    const content = readFileSync(path, "utf-8");
    const config = JSON.parse(content);
    // Replace environment variable placeholders
    return this.interpolateEnvVars(config);
  }

  /**
   * Load evals configuration
   */
  loadEvals(): EvalsConfig {
    const path = join(this.basePath, "evals.json");
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as EvalsConfig;
  }

  /**
   * Load all configurations
   */
  loadAll(): {
    graph: GraphConfig;
    connectors: ConnectorsConfig;
    evals: EvalsConfig;
  } {
    return {
      graph: this.loadGraph(),
      connectors: this.loadConnectors(),
      evals: this.loadEvals(),
    };
  }

  /**
   * Replace ${VAR} placeholders with environment variables
   */
  private interpolateEnvVars(obj: any): any {
    if (typeof obj === "string") {
      return obj.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || "");
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateEnvVars(item));
    }
    if (typeof obj === "object" && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateEnvVars(value);
      }
      return result;
    }
    return obj;
  }
}

// Export singleton instance
export const agentKitLoader = new AgentKitLoader();
