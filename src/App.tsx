import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@icupa/ui/tooltip";
import { Toaster } from "@icupa/ui/toaster";
import { Toaster as Sonner } from "@icupa/ui/sonner";
import { QueryProvider } from "@/modules/core/providers/QueryProvider";
import { SupabaseSessionProvider } from "@/modules/supabase";
import { AppRouter } from "@/modules/routing/AppRouter";
import { I18nProvider } from "@/modules/i18n";
import { AuthProvider } from "@/modules/auth";
import { usePwaNotifications } from "@/hooks/usePwaNotifications";
import { AppErrorBoundary } from "@/components/layout/AppErrorBoundary";

const AppShell = () => {
  usePwaNotifications();

  return (
    <AppErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </TooltipProvider>
    </AppErrorBoundary>
  );
};

const App = () => (
  <I18nProvider>
    <QueryProvider>
      <SupabaseSessionProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </SupabaseSessionProvider>
    </QueryProvider>
  </I18nProvider>
);

export default App;
