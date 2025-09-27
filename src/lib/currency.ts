export function formatCurrency(
  amountCents: number,
  currency: "EUR" | "RWF",
  locale: string
) {
  const value = amountCents / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: currency === "RWF" ? 0 : 2,
    maximumFractionDigits: currency === "RWF" ? 0 : 2,
  }).format(value);
}
