import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryProvider } from "@/modules/core/providers/QueryProvider";
import { SupabaseSessionProvider } from "@/modules/supabase";
import { AppRouter } from "@/modules/routing/AppRouter";

const App = () => (
  <QueryProvider>
    <SupabaseSessionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </TooltipProvider>
    </SupabaseSessionProvider>
  </QueryProvider>
);

export default App;
