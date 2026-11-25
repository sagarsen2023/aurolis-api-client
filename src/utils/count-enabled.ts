export function countEnabled(rows: { enabled: boolean; key: string }[]) {
  return rows.filter((row) => row.enabled && row.key).length;
}
