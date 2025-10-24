"use client";

import { useEffect } from "react";

import { QuoteOutput, useAppStore } from "../../../lib/state/appStore";

type QuoteHydratorProps = {
  quote: QuoteOutput;
};

export function QuoteHydrator({ quote }: QuoteHydratorProps) {
  const setItineraryQuote = useAppStore((state) => state.setItineraryQuote);

  useEffect(() => {
    setItineraryQuote(quote);
  }, [quote, setItineraryQuote]);

  return null;
}
