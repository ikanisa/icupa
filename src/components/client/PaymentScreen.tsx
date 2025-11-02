import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@icupa/ui/card";
import { Button } from "@icupa/ui/button";
import { Badge } from "@icupa/ui/badge";
import {
  CreditCard,
  Smartphone,
  CheckCircle,
  Waves,
  WifiOff,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  FileText,
  Printer,
  QrCode,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Separator } from "@icupa/ui/separator";
import { formatCurrency } from "@/lib/currency";
import type { RegionCode } from "@/data/menu";
import type { SplitMode } from "@/stores/cart-store";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "@icupa/ui/use-toast";
import {
  DEFAULT_FAILURE_MESSAGE,
  type PaymentStatus,
  type PaymentUiMethod,
  deriveFailureMessage,
  getPendingCopy,
  mapProviderToUiMethod,
  normalisePaymentStatus,
  resolveUiStatus,
} from "@/lib/payment-utils";

interface CartItem {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  modifiers?: Array<{ name: string; priceCents: number }>;
}

interface PaymentScreenProps {
  cartItems: CartItem[];
  currency: "EUR" | "RWF";
  locale: string;
  region: RegionCode;
  tipPercent: number;
  customTipCents?: number;
  splitMode: SplitMode;
  splitGuests: number;
  onPaymentComplete: () => void;
  isOffline?: boolean;
  taxRate: number;
}

interface PaymentDetailsSummary {
  method: PaymentUiMethod;
  orderId: string;
  paymentId: string;
  status: string;
  checkoutUrl?: string | null;
  providerRef?: string | null;
  message?: string | null;
  failureReason?: string | null;
}

interface PaymentFunctionResponse {
  order_id: string;
  payment_id: string;
  payment_status: string;
  payment_method?: string | null;
  checkout_url?: string | null;
  session_id?: string | null;
  provider_ref?: string | null;
  message?: string | null;
  total_cents?: number;
  failure_reason?: string | null;
}

interface ReceiptSummaryDetails {
  id: string;
  fiscalId: string | null;
  region: string;
  url: string | null;
  issuedAt: string | null;
  summary?: Record<string, any> | null;
  integrationNotes?: Record<string, any> | null;
}

const PAYMENT_METHODS: Array<{
  id: PaymentUiMethod;
  name: string;
  description: string;
  icon: LucideIcon;
  regions: RegionCode[];
}> = [
  {
    id: "card",
    name: "Card & digital wallets",
    description: "Visa, Mastercard, Apple Pay, Google Pay",
    icon: CreditCard,
    regions: ["EU", "RW"],
  },
  {
    id: "momo",
    name: "MTN Mobile Money",
    description: "Request to Pay via MTN MoMo",
    icon: Smartphone,
    regions: ["RW"],
  },
  {
    id: "airtel",
    name: "Airtel Money",
    description: "Collect payments from Airtel wallets",
    icon: Smartphone,
    regions: ["RW"],
  },
  {
    id: "sepa",
    name: "SEPA instant transfer",
    description: "Available for EU diners with supported banks",
    icon: Waves,
    regions: ["EU"],
  },
];

export function PaymentScreen({
  cartItems,
  currency,
  locale,
  region,
  tipPercent,
  customTipCents,
  splitMode,
  splitGuests,
  onPaymentComplete,
  isOffline = false,
  taxRate,
}: PaymentScreenProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentUiMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState<ReceiptSummaryDetails | null>(null);
  const [isWaitingForReceipt, setIsWaitingForReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const statusPollRef = useRef<number | null>(null);
  const hasHydratedFromQuery = useRef(false);
  const receiptChannelRef = useRef<RealtimeChannel | null>(null);
  const receiptPollRef = useRef<number | null>(null);
  const hasAnnouncedReceipt = useRef(false);

  const currentPaymentId = paymentDetails?.paymentId ?? null;
  const currentOrderId = paymentDetails?.orderId ?? null;
  const currentCheckoutUrl = paymentDetails?.checkoutUrl ?? null;
  const currentMessage = paymentDetails?.message ?? null;
  const currentProviderRef = paymentDetails?.providerRef ?? null;
  const currentFailureReason = paymentDetails?.failureReason ?? null;
  const currentStatus = paymentDetails?.status ?? "";
  const currentMethod: PaymentUiMethod =
    paymentDetails?.method ?? selectedMethod ?? "card";

  const offlineNoticeId = useId();

  const { subtotalCents, taxCents, totalCents, tipCents, normalizedTaxRate } = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => {
      const modifierTotal = item.modifiers?.reduce((modSum, mod) => modSum + mod.priceCents, 0) ?? 0;
      return sum + (item.priceCents + modifierTotal) * item.quantity;
    }, 0);

    const boundedTaxRate = Number.isFinite(taxRate) ? Math.max(0, Math.min(taxRate, 1)) : 0;
    const tax = Math.round(subtotal * boundedTaxRate);
    const tip =
      customTipCents !== undefined
        ? customTipCents
        : Math.round(subtotal * (tipPercent / 100));
    return {
      subtotalCents: subtotal,
      taxCents: tax,
      totalCents: subtotal + tax + tip,
      normalizedTaxRate: boundedTaxRate,
      tipCents: tip,
    };
  }, [cartItems, customTipCents, taxRate, tipPercent]);

  const effectiveTaxRate = normalizedTaxRate;

  const availableMethods = useMemo(
    () => PAYMENT_METHODS.filter((method) => method.regions.includes(region)),
    [region]
  );

  const availableMethodIds = useMemo(
    () => availableMethods.map((method) => method.id),
    [availableMethods]
  );

  const parseReceiptRow = useCallback((row: any): ReceiptSummaryDetails => {
    const payload = (row?.payload ?? {}) as Record<string, any>;
    const summary =
      typeof payload?.summary === "object" && payload.summary !== null
        ? (payload.summary as Record<string, any>)
        : null;
    const integrationNotes =
      typeof payload?.integration_notes === "object" && payload.integration_notes !== null
        ? (payload.integration_notes as Record<string, any>)
        : null;

    return {
      id: String(row?.id ?? ""),
      fiscalId:
        typeof row?.fiscal_id === "string" && row.fiscal_id.length > 0
          ? row.fiscal_id
          : typeof summary?.fiscalId === "string"
          ? (summary.fiscalId as string)
          : null,
      region:
        typeof row?.region === "string" && row.region.length > 0
          ? row.region
          : typeof summary?.region === "string"
          ? (summary.region as string)
          : "",
      url:
        typeof row?.url === "string" && row.url.length > 0
          ? row.url
          : typeof summary?.url === "string"
          ? (summary.url as string)
          : null,
      issuedAt:
        typeof row?.created_at === "string"
          ? row.created_at
          : typeof summary?.issuedAtIso === "string"
          ? (summary.issuedAtIso as string)
          : null,
      summary: summary ?? null,
      integrationNotes: integrationNotes ?? null,
    } satisfies ReceiptSummaryDetails;
  }, []);

  const fetchLatestReceipt = useCallback(
    async (orderId: string): Promise<ReceiptSummaryDetails | null> => {
      const { data, error } = await supabase
        .from("receipts")
        .select("id, fiscal_id, region, url, payload, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return null;
      }

      return parseReceiptRow(data);
    },
    [parseReceiptRow]
  );

  const applyPaymentSnapshot = useCallback(
    (snapshot: PaymentDetailsSummary, overrides?: { status?: PaymentStatus; errorMessage?: string | null }) => {
      const normalizedStatus = normalisePaymentStatus(snapshot.status);
      const fallbackMethod = (availableMethodIds[0] ?? snapshot.method) as PaymentUiMethod;
      const resolvedMethod = availableMethodIds.includes(snapshot.method)
        ? snapshot.method
        : fallbackMethod;

      setSelectedMethod(resolvedMethod);

      const nextDetails: PaymentDetailsSummary = {
        ...snapshot,
        method: resolvedMethod,
        status: normalizedStatus,
      };

      setPaymentDetails(nextDetails);

      if (overrides?.status) {
        setPaymentStatus(overrides.status);
      } else {
        setPaymentStatus(resolveUiStatus(snapshot.status));
      }

      if (typeof overrides?.errorMessage !== "undefined") {
        setErrorMessage(overrides.errorMessage);
        return;
      }

      setErrorMessage(
        deriveFailureMessage({
          status: normalizedStatus,
          failureReason: snapshot.failureReason,
          message: snapshot.message,
        }),
      );
    },
    [availableMethodIds]
  );

  const pendingCopy = useMemo(() => {
    if (!paymentDetails) {
      return null;
    }
    return getPendingCopy(paymentDetails.method);
  }, [paymentDetails]);

  useEffect(() => {
    if (!selectedMethod && availableMethods.length > 0) {
      setSelectedMethod(availableMethods[0]!.id);
    }
  }, [availableMethods, selectedMethod]);

  useEffect(() => {
    if (paymentStatus === "succeeded") {
      setIsComplete(true);
      if (typeof window !== "undefined") {
        const timer = window.setTimeout(() => {
          onPaymentComplete();
        }, 1800);
        return () => window.clearTimeout(timer);
      }
      onPaymentComplete();
    }
    return undefined;
  }, [paymentStatus, onPaymentComplete]);

  const handlePayment = async () => {
    if (!selectedMethod || isOffline || cartItems.length === 0 || paymentStatus === "processing") {
      return;
    }

    if (receiptChannelRef.current) {
      supabase.removeChannel(receiptChannelRef.current);
      receiptChannelRef.current = null;
    }
    if (receiptPollRef.current) {
      window.clearInterval(receiptPollRef.current);
      receiptPollRef.current = null;
    }
    hasAnnouncedReceipt.current = false;
    setReceiptDetails(null);
    setReceiptError(null);
    setIsWaitingForReceipt(false);

    setPaymentStatus("processing");
    setPaymentDetails(null);
    setErrorMessage(null);
    setIsComplete(false);

    const itemsPayload = cartItems.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.priceCents,
      modifiers: item.modifiers?.map((modifier) => ({
        name: modifier.name,
        price_cents: modifier.priceCents,
      })),
    }));

    const basePayload = {
      currency,
      items: itemsPayload,
      tax_cents: taxCents,
      tip_cents: tipCents,
      service_cents: 0,
      expected_subtotal_cents: subtotalCents,
      expected_total_cents: totalCents,
    };

    try {
      let response: PaymentFunctionResponse | null = null;

      if (selectedMethod === "card") {
        const successUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/?payment=success`
            : undefined;
        const cancelUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/?payment=cancelled`
            : undefined;
        const { data, error } = await supabase.functions.invoke<PaymentFunctionResponse>(
          "payments/stripe/checkout",
          {
            body: {
              ...basePayload,
              success_url: successUrl,
              cancel_url: cancelUrl,
              payment_provider: "stripe",
            },
          }
        );
        if (error) {
          throw new Error(error.message ?? "Stripe checkout failed");
        }
        response = data ?? null;
      } else if (selectedMethod === "momo") {
        const { data, error } = await supabase.functions.invoke<PaymentFunctionResponse>(
          "payments/momo/request_to_pay",
          { body: basePayload }
        );
        if (error) {
          throw new Error(error.message ?? "MTN MoMo initiation failed");
        }
        response = data ?? null;
      } else if (selectedMethod === "airtel") {
        const { data, error } = await supabase.functions.invoke<PaymentFunctionResponse>(
          "payments/airtel/request_to_pay",
          { body: basePayload }
        );
        if (error) {
          throw new Error(error.message ?? "Airtel Money initiation failed");
        }
        response = data ?? null;
      } else {
        throw new Error("Selected payment method is not yet supported.");
      }

      if (!response) {
        throw new Error("The payment service returned an empty response.");
      }

      const responseMethod = mapProviderToUiMethod(response.payment_method);
      const resolvedMethod: PaymentUiMethod = selectedMethod ?? responseMethod;

      const normalized: PaymentDetailsSummary = {
        method: resolvedMethod,
        orderId: response.order_id,
        paymentId: response.payment_id,
        status: response.payment_status,
        checkoutUrl: response.checkout_url ?? null,
        providerRef: response.provider_ref ?? null,
        message: response.message ?? null,
        failureReason: response.failure_reason ?? null,
      };

      applyPaymentSnapshot(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment could not be initiated.";
      setErrorMessage(message);
      setPaymentStatus("error");
    }
  };

  useEffect(() => {
    if (hasHydratedFromQuery.current) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("payment");
    const orderId = params.get("order");

    if (!outcome || !orderId) {
      hasHydratedFromQuery.current = true;
      return;
    }

    const cleanupParams = () => {
      params.delete("payment");
      params.delete("order");
      const nextQuery = params.toString();
      const nextUrl = nextQuery
        ? `${window.location.pathname}?${nextQuery}`
        : window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
    };

    const hydrateFromOrder = async () => {
      try {
        const { data, error } = await supabase
          .from("payments")
          .select("id,status,provider_ref,method,failure_reason,order_id")
          .eq("order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (!data) {
          throw new Error("We could not find the latest payment for this order.");
        }

        const normalizedStatus = normalisePaymentStatus(data.status);
        const cancellationMessage =
          outcome === "cancelled" && normalizedStatus !== "captured"
            ? "The payment was cancelled before completion."
            : null;

        const snapshot: PaymentDetailsSummary = {
          method: mapProviderToUiMethod((data.method as string) ?? undefined),
          orderId,
          paymentId: data.id,
          status: data.status ?? "pending",
          checkoutUrl: null,
          providerRef: data.provider_ref ?? null,
          message: cancellationMessage,
          failureReason: data.failure_reason ?? cancellationMessage,
        };

        applyPaymentSnapshot(snapshot, {
          status:
            cancellationMessage && normalizedStatus !== "captured"
              ? "error"
              : undefined,
          errorMessage: cancellationMessage ?? undefined,
        });
      } catch (error) {
        const fallback =
          error instanceof Error ? error.message : DEFAULT_FAILURE_MESSAGE;
        setErrorMessage(fallback);
        setPaymentStatus(outcome === "success" ? "pending" : "error");
      } finally {
        cleanupParams();
        hasHydratedFromQuery.current = true;
      }
    };

    hydrateFromOrder();
  }, [applyPaymentSnapshot]);

  useEffect(() => {
    if (paymentStatus !== "succeeded" || !currentOrderId) {
      setIsWaitingForReceipt(false);
      setReceiptError(null);
      setReceiptDetails(null);
      if (receiptChannelRef.current) {
        supabase.removeChannel(receiptChannelRef.current);
        receiptChannelRef.current = null;
      }
      if (receiptPollRef.current) {
        window.clearInterval(receiptPollRef.current);
        receiptPollRef.current = null;
      }
      hasAnnouncedReceipt.current = false;
      return;
    }

    setIsWaitingForReceipt(true);
    setReceiptError(null);

    let cancelled = false;

    const hydrateReceipt = async () => {
      try {
        const receipt = await fetchLatestReceipt(currentOrderId);
        if (cancelled) {
          return;
        }
        if (receipt) {
          setReceiptDetails(receipt);
          setIsWaitingForReceipt(false);
          setReceiptError(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load receipt", error);
          setReceiptError("We’re still finalising your receipt. We’ll keep trying automatically.");
        }
      }
    };

    hydrateReceipt();

    if (receiptChannelRef.current) {
      supabase.removeChannel(receiptChannelRef.current);
      receiptChannelRef.current = null;
    }

    const channel = supabase
      .channel(`receipts-${currentOrderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "receipts", filter: `order_id=eq.${currentOrderId}` },
        (payload) => {
          const nextReceipt = parseReceiptRow(payload.new ?? {});
          setReceiptDetails(nextReceipt);
          setReceiptError(null);
          setIsWaitingForReceipt(false);
        }
      )
      .subscribe();

    receiptChannelRef.current = channel;

    if (receiptPollRef.current) {
      window.clearInterval(receiptPollRef.current);
      receiptPollRef.current = null;
    }

    receiptPollRef.current = window.setInterval(() => {
      hydrateReceipt();
    }, 10000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      if (receiptChannelRef.current === channel) {
        receiptChannelRef.current = null;
      }
      if (receiptPollRef.current) {
        window.clearInterval(receiptPollRef.current);
        receiptPollRef.current = null;
      }
    };
  }, [currentOrderId, fetchLatestReceipt, parseReceiptRow, paymentStatus]);

  useEffect(() => {
    if (receiptDetails && !hasAnnouncedReceipt.current) {
      toast({
        title: "Fiscal receipt ready",
        description: "Your official receipt is available to view or reprint.",
      });
      hasAnnouncedReceipt.current = true;
    }
  }, [receiptDetails]);

  useEffect(() => {
    if (!currentPaymentId || !currentOrderId || paymentStatus !== "pending" || isOffline) {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`payments-status-${currentPaymentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${currentPaymentId}` },
        (payload) => {
          const updated = (payload.new ?? {}) as {
            status?: string | null;
            provider_ref?: string | null;
            failure_reason?: string | null;
          };

          const snapshot: PaymentDetailsSummary = {
            method: currentMethod,
            orderId: currentOrderId,
            paymentId: currentPaymentId,
            status: updated.status ?? currentStatus,
            checkoutUrl: currentCheckoutUrl,
            providerRef:
              typeof updated.provider_ref === "string" && updated.provider_ref.length > 0
                ? updated.provider_ref
                : currentProviderRef,
            message: currentMessage,
            failureReason:
              typeof updated.failure_reason !== "undefined" && updated.failure_reason !== null
                ? updated.failure_reason
                : currentFailureReason,
          };

          applyPaymentSnapshot(snapshot);
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
    };
  }, [
    applyPaymentSnapshot,
    currentCheckoutUrl,
    currentFailureReason,
    currentMessage,
    currentMethod,
    currentPaymentId,
    currentProviderRef,
    currentStatus,
    currentOrderId,
    isOffline,
    paymentStatus,
  ]);

  useEffect(() => {
    if (!currentPaymentId || !currentOrderId || paymentStatus !== "pending" || isOffline) {
      if (statusPollRef.current) {
        window.clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
      return;
    }

    if (statusPollRef.current) {
      window.clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }

    let cancelled = false;

    const runCheck = async () => {
      if (cancelled) {
        return;
      }

      const { data, error } = await supabase
        .from("payments")
        .select("id,status,provider_ref,failure_reason,method")
        .eq("id", currentPaymentId)
        .maybeSingle();

      if (cancelled || error || !data) {
        return;
      }

      const snapshot: PaymentDetailsSummary = {
        method: mapProviderToUiMethod((data.method as string) ?? undefined),
        orderId: currentOrderId,
        paymentId: currentPaymentId,
        status: data.status ?? currentStatus,
        checkoutUrl: currentCheckoutUrl,
        providerRef: data.provider_ref ?? currentProviderRef,
        message: currentMessage,
        failureReason: data.failure_reason ?? currentFailureReason,
      };

      applyPaymentSnapshot(snapshot);
    };

    statusPollRef.current = window.setInterval(runCheck, 8000);
    runCheck();

    return () => {
      cancelled = true;
      if (statusPollRef.current) {
        window.clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
    };
  }, [
    applyPaymentSnapshot,
    currentCheckoutUrl,
    currentFailureReason,
    currentMessage,
    currentMethod,
    currentOrderId,
    currentPaymentId,
    currentProviderRef,
    currentStatus,
    isOffline,
    paymentStatus,
  ]);

  const disablePaymentButton =
    !selectedMethod ||
    isOffline ||
    cartItems.length === 0 ||
    paymentStatus === "processing" ||
    paymentStatus === "pending";

  const buttonLabel = isOffline
    ? "Reconnect to confirm"
    : paymentStatus === "processing"
    ? "Processing..."
    : paymentStatus === "pending"
    ? "Waiting for confirmation"
    : `Pay ${formatCurrency(totalCents, currency, locale)}`;

  if (isComplete) {
    return (
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex items-center justify-center p-8"
      >
        <Card className="glass-card border-0 text-center">
          <CardContent className="p-8 space-y-6">
            <motion.div
              initial={prefersReducedMotion ? undefined : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.2, type: "spring", bounce: 0.5 }}
              className="w-16 h-16 mx-auto bg-success/20 rounded-full flex items-center justify-center"
            >
              <CheckCircle className="w-8 h-8 text-success" />
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Payment successful</h2>
              <p className="text-muted-foreground">
                Your order is heading to the kitchen. Track progress from the dock below.
              </p>
            </div>
            <Badge variant="outline" className="bg-success/15 text-success border-success/30">
              {paymentDetails?.orderId
                ? `Order ${paymentDetails.orderId.slice(0, 8).toUpperCase()}`
                : "Order ready"}
            </Badge>
            <Separator className="opacity-30" />
            <div className="text-left space-y-3">
              {isWaitingForReceipt && (
                <div className="rounded-xl border border-muted/40 bg-muted/10 p-4 flex items-start gap-3">
                  <Loader2 className="w-4 h-4 animate-spin mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-semibold">Preparing your fiscal receipt</p>
                    <p className="text-muted-foreground text-xs">
                      We’re finalising the official receipt with the local tax authority. This usually takes just a few
                      seconds.
                    </p>
                  </div>
                </div>
              )}
              {receiptDetails && !isWaitingForReceipt && (
                <div className="rounded-xl border border-muted/40 bg-muted/10 p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Fiscal ID</p>
                      <p className="font-semibold">
                        {receiptDetails.fiscalId ?? "Pending assignment"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs uppercase">
                      {receiptDetails.region?.toUpperCase() === "RW" ? "Rwanda EBM" : "Malta Fiscal"}
                    </Badge>
                  </div>
                  {receiptDetails.summary?.qrCodeData && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <QrCode className="w-4 h-4" />
                      <span>Scan the QR on the printed receipt to validate with the authority.</span>
                    </div>
                  )}
                  {receiptDetails.summary?.signaturePlaceholder && (
                    <div className="text-xs text-muted-foreground">
                      Signature: {receiptDetails.summary.signaturePlaceholder as string}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {receiptDetails.url && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="inline-flex items-center gap-2"
                        onClick={() => {
                          if (receiptDetails.url && typeof window !== "undefined") {
                            window.open(receiptDetails.url, "_blank", "noopener");
                          }
                        }}
                      >
                        <FileText className="w-4 h-4" />
                        View receipt
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="inline-flex items-center gap-2"
                      onClick={() => {
                        toast({
                          title: "Reprint requested",
                          description: "Share this with a team member if you need a printed copy.",
                        });
                      }}
                    >
                      <Printer className="w-4 h-4" />
                      Ask staff to reprint
                    </Button>
                  </div>
                  {receiptDetails.integrationNotes?.auditLog && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Audit:</span> {String(receiptDetails.integrationNotes.auditLog)}
                    </p>
                  )}
                </div>
              )}
              {receiptError && !isWaitingForReceipt && (
                <p className="text-xs text-destructive">{receiptError}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="flex-1 p-4 pb-32 space-y-6">
      {errorMessage && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
        >
          <Card className="glass-card border border-destructive/40 bg-destructive/10 text-destructive">
            <CardContent className="p-4 flex gap-3">
              <div className="mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Payment could not start</h3>
                <p className="text-xs opacity-90">{errorMessage}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {paymentStatus === "pending" && paymentDetails && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-card border border-primary/40 bg-primary/10 text-primary-foreground">
            <CardContent className="p-4 flex gap-3">
              <div className="mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">
                    {pendingCopy?.title ?? "Awaiting confirmation"}
                  </h3>
                  <p className="opacity-90">
                    {pendingCopy?.body ??
                      "We’re waiting for the payment provider to confirm this transaction."}
                    {paymentDetails.message ? ` ${paymentDetails.message}` : ""}
                  </p>
                  {paymentDetails.providerRef && (
                    <p className="font-mono text-[11px] opacity-80">
                      Reference: {paymentDetails.providerRef}
                    </p>
                  )}
                </div>
                {paymentDetails.checkoutUrl && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="inline-flex items-center gap-2"
                    onClick={() => {
                      if (paymentDetails.checkoutUrl && typeof window !== "undefined") {
                        window.open(paymentDetails.checkoutUrl, "_blank", "noopener");
                      }
                    }}
                  >
                    {pendingCopy?.actionLabel ?? "Open secure checkout"}
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isOffline && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          aria-live="polite"
        >
          <Card
            className="glass-card border border-warning/40 bg-warning/10 text-warning-foreground"
            id={offlineNoticeId}
          >
            <CardContent className="p-4 flex gap-3">
              <div className="mt-0.5">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Payments paused offline</h3>
                <p className="text-xs opacity-90">
                  Stay on this screen and we’ll finish checkout the moment you’re back online. The Pay button is temporarily
                  disabled until we detect a stable connection.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-lg">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cartItems.map((item) => {
              const modifierTotal = item.modifiers?.reduce((modSum, mod) => modSum + mod.priceCents, 0) ?? 0;
              const lineTotal = (item.priceCents + modifierTotal) * item.quantity;

              return (
                <div key={item.id} className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(item.priceCents, currency, locale)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium whitespace-nowrap">
                    {formatCurrency(lineTotal, currency, locale)}
                  </p>
                </div>
              );
            })}

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotalCents, currency, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({Math.round(effectiveTaxRate * 100)}%)</span>
                <span>{formatCurrency(taxCents, currency, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tip {customTipCents === undefined ? `(${tipPercent}%)` : "(custom)"}</span>
                <span>{formatCurrency(tipCents, currency, locale)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatCurrency(totalCents, currency, locale)}</span>
              </div>
            </div>

            {splitMode !== "none" && (
              <div className="rounded-2xl bg-muted/10 border border-border/30 p-3 text-xs text-muted-foreground">
                {splitMode === "equal" ? (
                  <p>
                    Splitting equally between {splitGuests} guest{splitGuests > 1 ? "s" : ""}. Each share ≈
                    {" "}
                    <strong>
                      {formatCurrency(
                        splitGuests > 0 ? Math.ceil(totalCents / splitGuests) : totalCents,
                        currency,
                        locale
                      )}
                    </strong>
                  </p>
                ) : (
                  <p>Assign items per guest in the cart before finalising payment.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: prefersReducedMotion ? 0 : 0.08 }}
      >
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-lg">Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;

              return (
                <motion.button
                  key={method.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:border-border"
                  }`}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/20" : "bg-muted/20"}`}>
                      <Icon className={`${isSelected ? "text-primary" : "text-muted-foreground"} w-5 h-5`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{method.name}</p>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs uppercase">
                      {region === "RW" ? "Rwanda" : "EU"}
                    </Badge>
                  </div>
                </motion.button>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Button
          className="w-full bg-primary-gradient hover:opacity-90 transition-opacity"
          size="lg"
          disabled={disablePaymentButton}
          aria-disabled={disablePaymentButton}
          aria-describedby={isOffline ? offlineNoticeId : undefined}
          onClick={handlePayment}
        >
          {paymentStatus === "processing" && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {buttonLabel}
        </Button>
      </motion.div>
    </div>
  );
}
