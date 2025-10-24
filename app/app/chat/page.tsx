import type { Metadata } from "next";
import { ChatKitClient } from "./chat-kit-client";

export const metadata: Metadata = {
  title: "Chat | EcoTrips Atlas",
};

export default function ChatPage() {
  const domainKey = process.env.CHATKIT_DOMAIN_KEY;

  if (!domainKey) {
    console.error("CHATKIT_DOMAIN_KEY is not configured");
    return (
      <div className="container">
        <div className="card">
          <div className="h1">ChatKit setup incomplete</div>
          <p className="subtle">
            Set <code>CHATKIT_DOMAIN_KEY</code> in your environment to enable the concierge experience.
          </p>
        </div>
      </div>
    );
  }

  return <ChatKitClient domainKey={domainKey} />;
}
