import type { ReactNode } from "react";

interface RecapEmailPreviewProps {
  subject: string;
  summary: string;
  highlights: string[];
  previewHtml: string;
  ctaUrl: string;
}

export function RecapEmailPreview({ subject, summary, highlights, previewHtml, ctaUrl }: RecapEmailPreviewProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/60">Subject</p>
        <p className="text-white">{subject}</p>
      </div>
      <p>{summary}</p>
      <BulletList>
        {highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </BulletList>
      <div className="rounded-xl border border-white/10 bg-white/10 p-3 text-xs text-white/80">
        <p className="mb-1 font-semibold text-white/90">HTML preview</p>
        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
      <a href={ctaUrl} className="text-xs text-sky-200 underline">
        View wallet recap demo
      </a>
    </div>
  );
}

function BulletList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5 text-xs text-white/60">{children}</ul>;
}
