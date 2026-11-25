export function statusCodeError(status: string) {
  const code = Number(status);
  return Number.isInteger(code) && code >= 100 && code <= 599
    ? undefined
    : "Use a status between 100 and 599.";
}
