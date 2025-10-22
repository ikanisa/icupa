import { useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminQrTools from "./pages/AdminQrTools";
import MerchantReceipts from "./pages/MerchantReceipts";
import MerchantPortal from "./pages/MerchantPortal";
import AdminConsole from "./pages/AdminConsole";
import { createSupabaseQueryClient } from "@/lib/query-client";
import { usePerformanceMetrics, type ReportableMetric } from "@/lib/usePerformanceMetrics";

const queryClient = createSupabaseQueryClient();

const App = () => {
  const handleMetric = useCallback((metric: ReportableMetric) => {
    if (import.meta.env.DEV) {
      console.debug(`[web-vitals] ${metric.name}`, metric);
    }
  }, []);

  usePerformanceMetrics({
    sampleRate: 0.25,
    onReport: handleMetric,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<AdminConsole />} />
            <Route path="/admin/tools/qr" element={<AdminQrTools />} />
            <Route path="/merchant/receipts" element={<MerchantReceipts />} />
            <Route path="/merchant" element={<MerchantPortal />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
