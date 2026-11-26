import { useAtomValue, useSetAtom } from "jotai";
import { CircleArrowUp, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { RELEASES_URL } from "@/constants/updates";
import {
  dismissedUpdateAtom,
  updatePromptAtom,
} from "@/context/update-context";
import { useUpdateActions } from "@/hooks/use-update-actions";
import { ReleaseNotes } from "./release-notes";
import { UpdateProgress } from "./update-progress";

function UpdateDialog() {
  const update = useAtomValue(updatePromptAtom);
  const setDismissed = useSetAtom(dismissedUpdateAtom);
  const { state, install } = useUpdateActions();

  if (!update) return null;

  const working = state.phase === "downloading" || state.phase === "installing";
  const dismiss = () => {
    if (!working) setDismissed(update.version);
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? null : dismiss())}>
      <DialogContent className="gap-5 sm:max-w-lg" showCloseButton={!working}>
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-vio/12 text-vio ring-6 ring-vio/5">
            <CircleArrowUp className="size-5.5" strokeWidth={1.8} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-[19px]">
              Aurolis {update.version} is available
            </DialogTitle>
            <DialogDescription>
              You have version {update.currentVersion}. Aurolis downloads the
              update, checks its signature and restarts. Your workspaces and
              settings stay as they are.
            </DialogDescription>
          </div>
        </div>

        <ReleaseNotes notes={update.notes} className="max-h-64" />

        {working ? <UpdateProgress state={state} /> : null}
        {state.phase === "error" && state.error ? (
          <p className="-mt-1 text-sm text-err">{state.error}</p>
        ) : null}

        <DialogFooter className="sm:items-center">
          <a
            href={`${RELEASES_URL}/tag/v${update.version}`}
            target="_blank"
            rel="noreferrer"
            className="mr-auto inline-flex items-center gap-1.5 text-sm text-mute transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3.5" strokeWidth={1.8} aria-hidden />
            View on GitHub
          </a>
          <Button variant="outline" disabled={working} onClick={dismiss}>
            Later
          </Button>
          <Button autoFocus disabled={working} onClick={install}>
            <RefreshCw
              className={working ? "animate-spin" : undefined}
              strokeWidth={1.8}
            />
            {working ? "Updating…" : "Update and restart"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpdateDialog;
