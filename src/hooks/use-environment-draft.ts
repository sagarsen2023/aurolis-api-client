import { useAtom } from "jotai";
import { environmentDraftsAtom } from "@/context/environments-context";
import { stableStringify } from "@/lib/workspace-format";
import type { EnvironmentSettings } from "@/types/workspace/collection-ops.type";
import type { Environment } from "@/types/workspace/environment.type";

function withoutDraft(drafts: Record<string, EnvironmentSettings>, id: string) {
  const { [id]: _dropped, ...rest } = drafts;
  return rest;
}

export function useEnvironmentDraft(environment: Environment) {
  const [drafts, setDrafts] = useAtom(environmentDraftsAtom);
  const { id } = environment;
  const saved: EnvironmentSettings = {
    name: environment.name,
    variables: environment.variables,
  };

  const setForm = (next: EnvironmentSettings) =>
    setDrafts((current) =>
      stableStringify(next) === stableStringify(saved)
        ? withoutDraft(current, id)
        : { ...current, [id]: next },
    );

  const discard = () => setDrafts((current) => withoutDraft(current, id));

  return {
    form: drafts[id] ?? saved,
    setForm,
    isDirty: id in drafts,
    discard,
  };
}
