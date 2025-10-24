import { CardGlass } from "@ecotrips/ui";

import { VoiceChatPanel } from "./VoiceChatPanel";

export default function ChatPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <CardGlass
        title="Voice concierge"
        subtitle="Loopback transcript playback keeps travelers in sync even offline."
      >
        <p className="text-sm text-white/80">
          ConciergeGuide routes through voice-session edge function with withObs instrumentation. Loopback audio simulates
          playback when WebRTC is unavailable in offline demos.
        </p>
        <div className="mt-4">
          <VoiceChatPanel />
        </div>
      </CardGlass>
    </div>
  );
}
