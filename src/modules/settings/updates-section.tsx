import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { useUpdateActions } from "@/hooks/use-update-actions";
import { usePromise } from "@/hooks/usePromise";
import { ReleaseNotes } from "@/modules/updates/release-notes";
import { UpdateProgress } from "@/modules/updates/update-progress";
import { updateService } from "@/services/update.service";
import { timeAgo } from "@/utils/format-date";
import { progressLabel } from "@/utils/update-progress";
import { SettingRow, SettingsGroup, SettingsSection } from "./section";

function StatusPill({
  phase,
  hasUpdate,
}: Readonly<{ phase: string; hasUpdate: boolean }>) {
  if (phase === "downloading" || phase === "installing") {
    return <Pill variant="lav">Updating</Pill>;
  }
  if (hasUpdate) return <Pill variant="lav">Update available</Pill>;
  if (phase === "up-to-date") return <Pill variant="ok">Up to date</Pill>;
  if (phase === "error") return <Pill variant="err">Check failed</Pill>;
  return null;
}

export function UpdatesSection() {
  const { state, checkNow, install, busy } = useUpdateActions();
  const [version, setVersion] = useState<string | null>(null);
  const available = updateService.isAvailable();
  const { update } = state;
  const working = state.phase === "downloading" || state.phase === "installing";

  const { runPromise: loadVersion } = usePromise({
    promise: () => updateService.getVersion(),
    showErrorToast: false,
    onSuccess: setVersion,
  });

  useEffect(() => {
    if (available) void loadVersion();
  }, [available, loadVersion]);

  const statusText = working
    ? progressLabel(state)
    : update
      ? `Version ${update.version} is ready to install.`
      : state.phase === "up-to-date"
        ? "You have the latest version."
        : available
          ? "Aurolis checks GitHub for new releases when it starts and every few hours."
          : "Updates are available in the desktop app.";

  const checkText =
    state.phase === "error" && state.error
      ? state.error
      : state.checkedAt
        ? `Last checked ${timeAgo(state.checkedAt).toLowerCase()}.`
        : "Not checked yet.";

  return (
    <SettingsSection
      id="updates"
      title="Updates"
      description="Aurolis installs signed updates from its GitHub releases. Your workspaces and settings stay as they are."
    >
      <SettingsGroup>
        <SettingRow
          title={version ? `Aurolis ${version}` : "Aurolis"}
          description={statusText}
        >
          <StatusPill phase={state.phase} hasUpdate={Boolean(update)} />
        </SettingRow>
        {update ? (
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0">
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-0">
                <p className="text-[15px] text-foreground">
                  Aurolis {update.version}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-mute">
                  Downloads, installs and restarts Aurolis.
                </p>
              </div>
              <Button size="sm" disabled={busy} onClick={install}>
                <RefreshCw
                  className={working ? "animate-spin" : undefined}
                  strokeWidth={1.8}
                />
                {working ? "Updating…" : "Update and restart"}
              </Button>
            </div>
            {working ? <UpdateProgress state={state} /> : null}
          </div>
        ) : null}
        <SettingRow title="Check for updates" description={checkText}>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !available}
            onClick={checkNow}
          >
            <RefreshCw
              className={
                state.phase === "checking" ? "animate-spin" : undefined
              }
              strokeWidth={1.8}
            />
            {state.phase === "checking" ? "Checking…" : "Check now"}
          </Button>
        </SettingRow>
      </SettingsGroup>

      {update ? (
        <div className="mt-6">
          <h3 className="text-[15px] font-medium text-foreground">
            What's new in {update.version}
          </h3>
          <ReleaseNotes notes={update.notes} className="mt-3 max-h-96" />
        </div>
      ) : null}
    </SettingsSection>
  );
}
