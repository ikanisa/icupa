import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import type { ReactNode } from "react";
import { Button } from "@icupa/ui/button";
import { toast } from "@icupa/ui/use-toast";

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-lg font-semibold">Something went wrong.</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => resetErrorBoundary()}>
            Try again
          </Button>
          <Button
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload app
          </Button>
        </div>
      </div>
    </div>
  );
};

interface AppErrorBoundaryProps {
  children: ReactNode;
}

export const AppErrorBoundary = ({ children }: AppErrorBoundaryProps) => (
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error) => {
      toast({
        title: "Unexpected error",
        description: error.message,
        variant: "destructive",
      });
    }}
  >
    {children}
  </ErrorBoundary>
);
