export function toDisplayDistance(raw: number, unit: string): number {
  if (unit === 'mi') return raw / 1760;
  return raw / 1000;
}

export function toRawDistance(display: number, unit: string): number {
  if (unit === 'mi') return Math.round(display * 1760);
  return Math.round(display * 1000);
}

export function formatDistance(raw: number, unit: string): string {
  const val = toDisplayDistance(raw, unit);
  return parseFloat(val.toFixed(2)).toString();
}
