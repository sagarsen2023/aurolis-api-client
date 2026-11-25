export function formatFreeSpace(bytes: number | null) {
  if (bytes === null) return null;
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(gb >= 100 ? 0 : 1)} GB free`
    : `${Math.round(bytes / 1024 ** 2)} MB free`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}
