import EventEmitter from "eventemitter3";
import type { AgentEvent } from "../models";
import { redactPii } from "../logging/redactor";

export type AuditEventHandler = (event: AgentEvent) => void | Promise<void>;

export class AuditTrail extends EventEmitter<{ event: AgentEvent }> {
  async emitEvent(event: AgentEvent) {
    const sanitized: AgentEvent = {
      ...event,
      payload: redactPii(event.payload) as Record<string, unknown>,
    };
    const listeners = this.listeners("event") as AuditEventHandler[];
    await Promise.all(listeners.map((listener) => listener(sanitized))); 
  }

  onEvent(handler: AuditEventHandler) {
    this.on("event", handler);
    return () => this.off("event", handler);
  }
}
