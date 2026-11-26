import { useAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { REQUEST_TIMEOUTS } from "@/constants/settings";
import { confirmCloseAtom, requestTimeoutAtom } from "@/context/settings-atoms";
import { SettingRow, SettingsGroup, SettingsSection } from "./section";

const timeoutItems = REQUEST_TIMEOUTS.map((item) => ({
  value: item.value,
  label: item.label,
}));

export function GeneralSection() {
  const [timeout, setTimeoutValue] = useAtom(requestTimeoutAtom);
  const [confirmClose, setConfirmClose] = useAtom(confirmCloseAtom);

  return (
    <SettingsSection id="general" title="General">
      <SettingsGroup>
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
