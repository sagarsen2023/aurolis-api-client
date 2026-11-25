export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} s`;
}
