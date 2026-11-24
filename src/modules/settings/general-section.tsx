import { useAtom, useAtomValue } from "jotai";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { REQUEST_TIMEOUTS } from "@/constants/settings";
import { workspaceIdAtom } from "@/context/workspace-context";
import {
  confirmCloseAtom,
  requestTimeoutAtom,
  workspaceNamesAtom,
} from "@/context/settings-atoms";
import { SettingRow, SettingsGroup, SettingsSection } from "./section";

const timeoutItems = REQUEST_TIMEOUTS.map((item) => ({
  value: item.value,
  label: item.label,
}));

export function GeneralSection() {
  const workspaceId = useAtomValue(workspaceIdAtom);
  const [names, setNames] = useAtom(workspaceNamesAtom);
  const [timeout, setTimeoutValue] = useAtom(requestTimeoutAtom);
  const [confirmClose, setConfirmClose] = useAtom(confirmCloseAtom);
  const name = names[workspaceId] ?? "";

  return (
    <SettingsSection id="general" title="General">
      <SettingsGroup>
        <SettingRow
          title="Workspace name"
          description="Shown in the top bar and used for the MCP workspace id."
        >
          <Input
            aria-label="Workspace name"
            value={name}
            onChange={(event) =>
              setNames((current) => ({
                ...current,
                [workspaceId]: event.target.value,
              }))
            }
            className="h-9 w-52 bg-surface-raise"
          />
        </SettingRow>
        <SettingRow
          title="Request timeout"
          description="Requests slower than this fail with a timeout."
        >
          <Select
            items={timeoutItems}
            value={timeout}
            onValueChange={(value) => value && setTimeoutValue(value)}
          >
            <SelectTrigger
              aria-label="Request timeout"
              className="w-36 bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeoutItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          title="Ask before closing unsaved tabs"
          description="Offer to save when you close a request with unsaved edits."
        >
          <Switch
            checked={confirmClose}
            onCheckedChange={setConfirmClose}
            aria-label="Ask before closing unsaved tabs"
          />
        </SettingRow>
      </SettingsGroup>
    </SettingsSection>
  );
}
