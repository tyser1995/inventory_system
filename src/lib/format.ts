/** All money is shown in Philippine pesos. */
export const CURRENCY = { code: "PHP", symbol: "₱", locale: "en-PH" } as const;

const currency = new Intl.NumberFormat(CURRENCY.locale, { style: "currency", currency: CURRENCY.code });
const currencyCompact = new Intl.NumberFormat(CURRENCY.locale, {
  style: "currency", currency: CURRENCY.code, notation: "compact", maximumFractionDigits: 1,
});
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("en-US");

export const fmtCurrency = (n: number) => currency.format(n);
/** e.g. ₱17.8K */
export const fmtCurrencyCompact = (n: number) => currencyCompact.format(n);
export const fmtCompact = (n: number) => compact.format(n);
export const fmtNumber = (n: number) => number.format(n);

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(iso);
}
