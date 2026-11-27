import { lazy, Suspense } from "react";
import { useVariableScopeContext } from "@/context/variable-scope-context";
import { cn } from "@/lib/utils";
import type { VariableInfo } from "@/types/workspace/variable.type";
import type { VariableLineEditorProps } from "./variable-line-editor";

const NO_VARIABLES: readonly VariableInfo[] = [];

const VariableLineEditor = lazy(() => import("./variable-line-editor"));

type VariableInputProps = Omit<VariableLineEditorProps, "variables"> & {
  className?: string;
};

export function VariableInput({
  className,
  ...props
}: Readonly<VariableInputProps>) {
  const variables = useVariableScopeContext() ?? NO_VARIABLES;
  return (
    <div
      data-slot="variable-input"
      className={cn(
        "flex min-w-0 items-center overflow-hidden font-mono",
        className,
      )}
    >
      <Suspense
        fallback={
          <input
            aria-label={props.ariaLabel}
            value={props.value}
            placeholder={props.placeholder}
            spellCheck={false}
            onChange={(event) => props.onChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim"
          />
        }
      >
        <VariableLineEditor variables={variables} {...props} />
      </Suspense>
    </div>
  );
}
