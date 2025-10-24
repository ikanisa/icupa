"use client";

import { useEffect } from "react";
import type { InventorySearchInput } from "@ecotrips/types";

import { SearchOutput, useAppStore } from "../../../lib/state/appStore";

type ResultsHydratorProps = {
  input: InventorySearchInput;
  results: SearchOutput;
};

export function ResultsHydrator({ input, results }: ResultsHydratorProps) {
  const setSearchInput = useAppStore((state) => state.setSearchInput);
  const setSearchResults = useAppStore((state) => state.setSearchResults);

  useEffect(() => {
    setSearchInput(input);
    setSearchResults(results);
  }, [input, results, setSearchInput, setSearchResults]);

  return null;
}
