import { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { toast } from "sonner";
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
import {
  currentWorkspaceAtom,
  registryAtom,
} from "@/context/workspace-context";
import { confirmCloseAtom, requestTimeoutAtom } from "@/context/settings-atoms";
import { usePromise } from "@/hooks/usePromise";
import { workspaceService } from "@/services/workspace.service";
import { SettingRow, SettingsGroup, SettingsSection } from "./section";

const timeoutItems = REQUEST_TIMEOUTS.map((item) => ({
  value: item.value,
  label: item.label,
}));

function WorkspaceNameInput() {
  const workspace = useAtomValue(currentWorkspaceAtom);
  const [, setRegistry] = useAtom(registryAtom);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? workspace?.name ?? "";

  const { loading, runPromise: rename } = usePromise({
    promise: () => workspaceService.rename(workspace?.id ?? "", value.trim()),
    onSuccess: (registry) => {
      setRegistry(registry);
      toast.success("Workspace renamed");
    },
    onFinally: () => setDraft(null),
  });

  const commit = () => {
    if (!workspace || draft === null || draft.trim() === workspace.name) {
      setDraft(null);
      return;
    }
    void rename();
  };

  return (
    <Input
      aria-label="Workspace name"
      value={value}
      disabled={!workspace || loading}
      maxLength={100}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
      className="h-9 w-52 bg-surface-raise"
    />
  );
}

export function GeneralSection() {
  const [timeout, setTimeoutValue] = useAtom(requestTimeoutAtom);
  const [confirmClose, setConfirmClose] = useAtom(confirmCloseAtom);

  return (
    <SettingsSection id="general" title="General">
      <SettingsGroup>
        <SettingRow
          title="Workspace name"
          description="Shown in the top bar. Renaming doesn't move the workspace folder."
        >
          <WorkspaceNameInput />
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
