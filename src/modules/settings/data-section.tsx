import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_REQUEST_TIMEOUT } from "@/constants/settings";
import { DASHBOARD_USER } from "@/constants/dashboard";
import { WORKSPACES } from "@/constants/workspaces";
import {
  confirmCloseAtom,
  connectedAssistantsAtom,
  requestTimeoutAtom,
  workspaceNamesAtom,
} from "@/context/settings-atoms";
import { authService } from "@/services/auth.service";
import { SettingRow, SettingsGroup, SettingsSection } from "./section";

function defaultNames() {
  return Object.fromEntries(
    WORKSPACES.map((workspace) => [workspace.id, workspace.name]),
  );
}

export function DataSection() {
  const navigate = useNavigate();
  const setNames = useSetAtom(workspaceNamesAtom);
  const setTimeoutValue = useSetAtom(requestTimeoutAtom);
  const setConfirmClose = useSetAtom(confirmCloseAtom);
  const setConnected = useSetAtom(connectedAssistantsAtom);
  const [handle, setHandle] = useState(DASHBOARD_USER.handle);

  useEffect(() => {
    let active = true;
    void authService.getStatus().then((status) => {
      if (active && status.user?.login) setHandle(status.user.login);
    });
    return () => {
      active = false;
    };
  }, []);

  const exportWorkspace = () => {
    const payload = {
      workspaces: WORKSPACES,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aurolis-workspace.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const resetDemo = () => {
    setNames(defaultNames());
    setTimeoutValue(DEFAULT_REQUEST_TIMEOUT);
    setConfirmClose(true);
    setConnected({});
  };

  const signOut = async () => {
    await authService.logout();
    await navigate({ to: "/sign-in", replace: true });
  };

  return (
    <SettingsSection id="data" title="Data">
      <SettingsGroup>
        <SettingRow
          title="Export workspace"
          description="Collections and environments as JSON, Postman or Hoppscotch."
        >
          <Button variant="outline" size="sm" onClick={exportWorkspace}>
            <Download strokeWidth={1.8} />
            Export
          </Button>
        </SettingRow>
        <SettingRow title="Sign out" description={`Signed in as @${handle}`}>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut strokeWidth={1.8} />
            Sign out
          </Button>
        </SettingRow>
      </SettingsGroup>
    </SettingsSection>
  );
}
