import { TriangleAlert } from "lucide-react";
import { useAtomValue } from "jotai";
import { currentEnvironmentAtom } from "@/context/workspace-context";

function UnresolvedNotice({ names }: Readonly<{ names: string[] }>) {
  const environment = useAtomValue(currentEnvironmentAtom);
  if (names.length === 0) return null;
  const where = environment
    ? `the “${environment.name}” environment, the collection or globals`
    : "any environment, the collection or globals";
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl bg-warn/15 px-3 py-2 text-[12.5px] text-foreground"
    >
      <TriangleAlert
        className="mt-0.5 size-3.5 shrink-0 text-warning"
        aria-hidden
      />
      <span>
        Not defined in {where}:{" "}
        {names.map((name, index) => (
          <span key={name}>
            {index > 0 ? ", " : null}
            <code className="font-mono">{`{{${name}}}`}</code>
          </span>
        ))}
        . They are sent as written.
      </span>
    </p>
  );
}

export default UnresolvedNotice;
