import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CodeEditorProps } from "./code-editor";

const CodeEditor = lazy(() => import("./code-editor"));

export function CodeField(props: Readonly<CodeEditorProps>) {
  const height = props.height ?? props.minHeight ?? "140px";
  return (
    <Suspense
      fallback={<Skeleton className="w-full rounded-2xl" style={{ height }} />}
    >
      <CodeEditor {...props} />
    </Suspense>
  );
}
