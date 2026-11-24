import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Download, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { githubUserAtom } from "@/context/auth-context";
import {
  activeWorkspaceAtom,
  currentWorkspaceAtom,
} from "@/context/workspace-context";
import { useWorkspaceActions } from "@/hooks/use-workspaces";
import { usePromise } from "@/hooks/usePromise";
import { authService } from "@/services/auth.service";
import { workspaceService } from "@/services/workspace.service";
import type { RemoveCheck } from "@/types/workspace/workspace-store.type";
import { SettingRow, SettingsGroup, SettingsSection } from "./section";

function describeRisk(check: RemoveCheck) {
  const parts = [];
  if (check.changedFiles > 0) {
    parts.push(
      `${check.changedFiles} uncommitted ${check.changedFiles === 1 ? "file" : "files"}`,
    );
  }
  if (check.unpushedCommits > 0) {
    parts.push(
      check.hasRemote
        ? `${check.unpushedCommits} unpushed ${check.unpushedCommits === 1 ? "commit" : "commits"}`
        : `${check.unpushedCommits} ${check.unpushedCommits === 1 ? "commit" : "commits"} that exist only on this computer`,
    );
  }
  return parts.length ? `This folder has ${parts.join(" and ")}.` : null;
}

function RemoveWorkspaceRow() {
  const workspace = useAtomValue(currentWorkspaceAtom);
  const navigate = useNavigate();
  const { openActiveOrFirst } = useWorkspaceActions();
  const [check, setCheck] = useState<RemoveCheck | null>(null);
  const deleteFolder = useRef(false);

  const { loading: checking, runPromise: startRemove } = usePromise({
    promise: () => workspaceService.removeCheck(workspace?.id ?? ""),
    onSuccess: setCheck,
  });

  const { loading: removing, runPromise: remove } = usePromise({
    promise: async () => {
      await workspaceService.remove(workspace?.id ?? "", deleteFolder.current);
      return deleteFolder.current;
    },
    onSuccessAsync: async (deleted) => {
      toast.success(
        deleted ? "Workspace and folder deleted" : "Removed from Aurolis",
      );
      setCheck(null);
      await openActiveOrFirst();
      await navigate({ to: "/" });
    },
  });
  const confirm = (withFolder: boolean) => {
    deleteFolder.current = withFolder;
    void remove();
  };

  if (!workspace) return null;
  const risk = check ? describeRisk(check) : null;

  return (
    <SettingRow
      title="Remove workspace"
      description={
        check
          ? [
              risk,
              check.managed
                ? "Keep the folder on disk, or delete it too."
                : "Aurolis will forget it. Your folder stays where it is.",
            ]
              .filter(Boolean)
              .join(" ")
          : `Remove “${workspace.name}” from Aurolis.`
      }
    >
      {check ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCheck(null)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={removing}
            onClick={() => confirm(false)}
          >
            {check.managed ? "Keep folder" : "Remove"}
          </Button>
          {check.managed ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={removing}
              onClick={() => confirm(true)}
            >
              <Trash2 strokeWidth={1.8} />
              Delete folder too
            </Button>
          ) : null}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={() => void startRemove()}
        >
          <Trash2 strokeWidth={1.8} />
          Remove…
        </Button>
      )}
    </SettingRow>
  );
}

export function DataSection() {
  const navigate = useNavigate();
  const user = useAtomValue(githubUserAtom);
  const workspace = useAtomValue(activeWorkspaceAtom);

  const exportWorkspace = () => {
    if (!workspace?.data) return;
    const payload = {
      workspace: workspace.data,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.entry.name.replace(/[^\w.-]+/g, "-") || "workspace"}.aurolis.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
          description="The active workspace's collections and environments as one JSON file. Secret values are never included."
        >
          <Button
            variant="outline"
            size="sm"
            disabled={!workspace?.data}
            onClick={exportWorkspace}
          >
            <Download strokeWidth={1.8} />
            Export
          </Button>
        </SettingRow>
        <RemoveWorkspaceRow />
        <SettingRow
          title="Sign out"
          description={
            user ? `Signed in as @${user.login}` : "Signed in with GitHub"
          }
        >
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut strokeWidth={1.8} />
            Sign out
          </Button>
        </SettingRow>
      </SettingsGroup>
    </SettingsSection>
  );
}
