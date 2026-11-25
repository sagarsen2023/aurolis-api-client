import { useEffect, useState } from "react";
import { FaGithub } from "react-icons/fa6";
import { LuLoaderCircle } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePromise } from "@/hooks/usePromise";
import { githubService } from "@/services/github.service";
import type { GithubInstallation } from "@/types/github/github-response.type";

const INSTALL_CHECK_INTERVAL_MS = 4000;

function useCheckWhileWaiting(waiting: boolean, check: () => Promise<unknown>) {
  useEffect(() => {
    if (!waiting) return;
    const runCheck = () => void check();
    window.addEventListener("focus", runCheck);
    const timer = window.setInterval(runCheck, INSTALL_CHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", runCheck);
      window.clearInterval(timer);
    };
  }, [waiting, check]);
}

function InstallAppPanel({ onDone }: Readonly<{ onDone: () => void }>) {
  const [opened, setOpened] = useState(false);

  const { loading: checking, runPromise: checkInstallations } = usePromise({
    showErrorToast: false,
    promise: () => githubService.getInstallations(),
    onSuccess: (installations: GithubInstallation[]) => {
      const [installation] = installations;
      if (!installation) return;
      toast.success(`Aurolis is installed on ${installation.account}`);
      onDone();
    },
  });

  useCheckWhileWaiting(opened, checkInstallations);

  const openInstallPage = () => {
    setOpened(true);
    void githubService.openInstallPage();
  };

  return (
    <div className="mt-8 flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-inverse text-inverse-foreground">
          <FaGithub className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            Install Aurolis on GitHub
          </p>
          <p className="text-xs text-muted-foreground">
            You're signed in. To clone, push to and create repositories, install
            the Aurolis GitHub App on your account and choose which repositories
            it can use.
          </p>
        </div>
      </div>

      {opened ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LuLoaderCircle className="size-3.5 animate-spin text-vio" />
          Waiting for the installation… This continues on its own.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Skip for now
        </Button>
        {opened ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={checking}
            onClick={() => void checkInstallations()}
          >
            I've installed it
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={openInstallPage}>
          <FaGithub />
          {opened ? "Open GitHub again" : "Install on GitHub"}
        </Button>
      </div>
    </div>
  );
}

export default InstallAppPanel;
