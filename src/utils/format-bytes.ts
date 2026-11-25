export function formatFreeSpace(bytes: number | null) {
  if (bytes === null) return null;
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(gb >= 100 ? 0 : 1)} GB free`
    : `${Math.round(bytes / 1024 ** 2)} MB free`;
}
