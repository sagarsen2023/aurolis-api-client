import { useAtomValue, useSetAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  currentEnvironmentAtom,
  environmentIdAtom,
  environmentsAtom,
} from "@/context/workspace-context";

const NO_ENVIRONMENT = "__none__";

function EnvironmentSelect() {
  const environments = useAtomValue(environmentsAtom);
  const current = useAtomValue(currentEnvironmentAtom);
  const setEnvironmentId = useSetAtom(environmentIdAtom);
  const items =
    environments.length > 0
      ? environments.map((e) => ({ value: e.id, label: e.name }))
      : [{ value: NO_ENVIRONMENT, label: "No environments" }];

  return (
    <Select
      items={items}
      value={current?.id ?? NO_ENVIRONMENT}
      disabled={environments.length === 0}
      onValueChange={(value) => {
        if (value && value !== NO_ENVIRONMENT) setEnvironmentId(value);
      }}
    >
      <SelectTrigger aria-label="Environment" className="w-40 bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default EnvironmentSelect;
