import { lazy, Suspense, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const MarkdownEditor = lazy(() => import("@/components/ui/markdown-editor"));

type MarkdownFieldProps = ComponentProps<typeof MarkdownEditor>;

export function MarkdownField(props: Readonly<MarkdownFieldProps>) {
  const height = props.minHeight ?? 220;
  return (
    <Suspense
      fallback={<Skeleton className="w-full rounded-2xl" style={{ height }} />}
    >
      <MarkdownEditor {...props} />
    </Suspense>
  );
}
