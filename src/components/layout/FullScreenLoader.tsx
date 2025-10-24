export const FullScreenLoader = () => {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background/80 text-muted-foreground">
      <span className="flex items-center gap-2 text-sm">
        <span className="h-2 w-2 animate-ping rounded-full bg-primary" aria-hidden />
        Loading experience…
      </span>
    </div>
  );
};
