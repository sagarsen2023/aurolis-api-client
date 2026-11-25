import { useCallback } from "react";
import { useSetAtom } from "jotai";
import {
  typescriptSheetAtom,
  type TypescriptSource,
  type TypescriptSourceId,
} from "@/context/collections-context";

export function useTypescriptSheet(title: string) {
  const setSheet = useSetAtom(typescriptSheetAtom);
  return useCallback(
    (sources: Array<TypescriptSource | null>, initial: TypescriptSourceId) => {
      const available = sources.filter(
        (source): source is TypescriptSource => source !== null,
      );
      if (available.length === 0) return;
      const start = available.some((source) => source.id === initial)
        ? initial
        : available[0].id;
      setSheet({ title, sources: available, initial: start });
    },
    [setSheet, title],
  );
}
