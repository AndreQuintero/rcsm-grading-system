// Date.parse rolls over impossible days (2026-02-31), so the round trip must match the input.
export function isRealDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
