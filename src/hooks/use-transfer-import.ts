import { useState } from "react";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { replaceCredentials } from "@/lib/transfer";
import type { ImportBundle } from "@/types/transfer/transfer.type";
import type { EnvironmentVariable } from "@/types/workspace/environment.type";

export type CredentialChoice = "replace" | "keep";

export interface ImportProgress {
  done: number;
  total: number;
}

export interface ImportOutcome {
  collectionIds: string[];
  environments: number;
  secretNames: string[];
}

function withSecretGlobals(
  current: EnvironmentVariable[],
  names: string[],
): EnvironmentVariable[] {
  const existing = new Set(current.map((variable) => variable.key.trim()));
  const added = names
    .filter((name) => !existing.has(name))
    .map((key) => ({ key, value: "", enabled: true, secret: true }));
  return [...current, ...added];
}

export function useTransferImport() {
  const { apply, data } = useCollectionActions();
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const runImport = async (
    bundle: ImportBundle,
    credentials: CredentialChoice,
  ): Promise<ImportOutcome> => {
    const replaced = replaceCredentials(bundle);
    const prepared = credentials === "replace" ? replaced.bundle : bundle;
    const secretNames =
      credentials === "replace" ? replaced.summary.variables : [];
    const total =
      prepared.collections.length +
      prepared.environments.length +
      (secretNames.length > 0 ? 1 : 0);
    let done = 0;
    const step = () => setProgress({ done: ++done, total });
    setProgress({ done, total });
    const collectionIds: string[] = [];
    try {
      for (const collection of prepared.collections) {
        const id = await apply({ op: "import-collection", collection });
        if (id) collectionIds.push(id);
        step();
      }
      for (const environment of prepared.environments) {
        await apply({ op: "import-environment", environment });
        step();
      }
      if (secretNames.length > 0) {
        await apply({
          op: "update-globals",
          variables: withSecretGlobals(
            data?.globals?.variables ?? [],
            secretNames,
          ),
        });
        step();
      }
      return {
        collectionIds,
        environments: prepared.environments.length,
        secretNames,
      };
    } finally {
      setProgress(null);
    }
  };

  return { runImport, progress };
}
