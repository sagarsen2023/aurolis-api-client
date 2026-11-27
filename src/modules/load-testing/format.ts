export function formatMs(ms: number) {
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} s`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export function formatRate(value: number) {
  return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
}

export function formatPercent(part: number, total: number) {
  if (total === 0) return "0%";
  const percent = (part / total) * 100;
  if (percent > 0 && percent < 0.1) return "<0.1%";
  return `${percent >= 10 || percent === 0 ? Math.round(percent) : percent.toFixed(1)}%`;
}

export function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
