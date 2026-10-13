// The API takes and returns decimals as strings, so that no amount passes through a
// float on the way. Everything here works on the string for the same reason.
const DECIMAL_INPUT = /^\d{1,12}([.,]\d{1,6})?$/;

/** Whether the text is a decimal the API accepts, written with a comma or a point. */
export function isDecimalInput(typed: string): boolean {
  return DECIMAL_INPUT.test(typed);
}

export function toApiDecimal(typed: string): string {
  return typed.replace(",", ".");
}

/** The reverse of `toApiDecimal`: what a field shows of a decimal the API already holds. */
export function toDecimalInput(value: string): string {
  return value.replace(".", ",");
}

/** Writes an API decimal the Portuguese way: `1234.5` becomes `1.234,5`. */
export function formatDecimal(value: string, minFractionDigits = 0): string {
  const [integer = "", fraction = ""] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const padded = fraction.padEnd(minFractionDigits, "0");

  return padded === "" ? grouped : `${grouped},${padded}`;
}

export function formatMoney(value: string): string {
  return `R$ ${formatDecimal(value, 2)}`;
}
