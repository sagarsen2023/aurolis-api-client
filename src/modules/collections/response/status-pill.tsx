import { Pill } from "@/components/ui/pill";

function variantFor(status: number) {
  if (status >= 500) return "err" as const;
  if (status >= 400) return "warn" as const;
  if (status >= 200 && status < 300) return "ok" as const;
  return "default" as const;
}

function StatusPill({
  status,
  statusText,
}: Readonly<{ status: number; statusText?: string }>) {
  return (
    <Pill variant={variantFor(status)} className="font-mono">
      {status}
      {statusText ? (
        <span className="font-sans font-normal">{statusText}</span>
      ) : null}
    </Pill>
  );
}

export default StatusPill;
