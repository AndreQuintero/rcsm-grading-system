// Date.parse rolls over impossible days (2026-02-31), so the round trip must match the input.
export function isRealDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

// 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd"
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Display mask: "2026-11-19" -> "November 19th, 2026". A time after the date ("2026-11-19 14:30") is kept as is.
export function formatDate(value: string): string {
  const [date, time] = value.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${ordinal(d)}, ${y}${time ? ` ${time}` : ""}`;
}
