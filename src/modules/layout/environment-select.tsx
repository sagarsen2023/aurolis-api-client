import { useAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ENVIRONMENTS } from "@/constants/workspaces";
import { environmentIdAtom } from "@/context/workspace-context";

const items = ENVIRONMENTS.map((e) => ({ value: e.id, label: e.name }));

function EnvironmentSelect() {
  const [environmentId, setEnvironmentId] = useAtom(environmentIdAtom);

  return (
    <Select
      items={items}
      value={environmentId}
      onValueChange={(value) => value && setEnvironmentId(value)}
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
