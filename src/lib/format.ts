/** 人类可读的字节数。 */
export function humanSize(bytes: number | undefined): string {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(value / 1024))}KB`;
}
