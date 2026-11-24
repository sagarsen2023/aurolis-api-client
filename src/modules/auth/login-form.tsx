import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FaGithub } from "react-icons/fa6";
import {
  LuCheck,
  LuChevronRight,
  LuCodeXml,
  LuCopy,
  LuExternalLink,
  LuGitBranch,
  LuLoaderCircle,
  LuLock,
  LuMonitor,
} from "react-icons/lu";
import { cn } from "@/lib/utils";
import { authService, GithubSignInFailure } from "@/services/auth.service";
import { githubService } from "@/services/github.service";
import { usePromise } from "@/hooks/usePromise";
import type { GithubDeviceCodePrompt } from "@/types/auth/auth-response.type";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/components/ui/theme-switch";

interface LoginFormProps {
  className?: string;
  onContinueLocal?: () => void;
}

type GithubSignInState =
  { step: "idle" } | { step: "waiting"; prompt: GithubDeviceCodePrompt };

export function LoginForm({
  className,
  onContinueLocal,
  ...props
}: LoginFormProps) {
  const navigate = useNavigate();
  const [signIn, setSignIn] = useState<GithubSignInState>({ step: "idle" });
  const inProgress = useRef(false);

  // Leaving the page mid-flow stops the polling in the main process.
  useEffect(
    () => () => {
      if (inProgress.current) void authService.cancelGithubLogin();
    },
    [],
  );

  const { loading: signingIn, runPromise: handleGithubSignIn } = usePromise({
    promise: async () => {
      inProgress.current = true;
      try {
        await authService.loginViaGithub((prompt) =>
          setSignIn({ step: "waiting", prompt }),
        );
        return "signed-in" as const;
      } catch (error) {
        if (
          error instanceof GithubSignInFailure &&
          error.code === "cancelled"
        ) {
          return "cancelled" as const;
        }
        throw error;
      } finally {
        inProgress.current = false;
      }
    },
    onSuccessAsync: async (result) => {
      if (result === "cancelled") return;
      void githubService
        .isInstalled()
        .then((installed) => {
          if (!installed) void githubService.openInstallPage();
        })
        .catch(() => {});
      await navigate({ to: "/", replace: true });
    },
    onFinally: () => setSignIn({ step: "idle" }),
  });

  const starting = signingIn && signIn.step === "idle";

  return (
    <div
      className={cn(
        "relative flex min-h-full w-full gap-4 overflow-hidden bg-background p-4",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-orb-a/25 blur-3xl dark:bg-orb-c/10"
      />

      {/* Left: brand + sign-in */}
      <section className="relative flex min-w-0 flex-1 flex-col px-4 py-2 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/aurolis-logo/svg/aurolis-mark-light.svg"
              alt=""
              className="size-6 dark:hidden"
            />
            <img
              src="/aurolis-logo/svg/aurolis-mark-dark.svg"
              alt=""
              className="hidden size-6 dark:block"
            />
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Aurolis
            </span>
            <span className="rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Preview
            </span>
          </div>
          <ThemeSwitch />
        </header>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="w-full max-w-md">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-1.5 rounded-full bg-vio ring-4 ring-vio/15" />
              Open-source API client
            </p>

            <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight text-foreground xl:text-5xl">
              Shape your requests.
              <br />
              <span className="bg-linear-to-r from-pur to-[#c2335a] bg-clip-text pr-1 font-serif font-normal tracking-normal text-transparent italic dark:from-orb-c dark:to-[#e58ab5]">
                Sync
              </span>{" "}
              your reality.
            </h1>

            <p className="mt-4 text-base text-muted-foreground">
              A local-first workspace for collections, environments and load
              tests, versioned in a GitHub repository you own.
            </p>

            {signIn.step === "waiting" ? (
              <DeviceCodePanel
                prompt={signIn.prompt}
                onCancel={() => void authService.cancelGithubLogin()}
              />
            ) : (
              <div className="mt-8 flex flex-col gap-3">
                <Button
                  type="button"
                  size="lg"
                  disabled={starting}
                  onClick={handleGithubSignIn}
                  className="w-full bg-inverse text-inverse-foreground hover:bg-inverse/90"
                >
                  {starting ? (
                    <LuLoaderCircle className="animate-spin" />
                  ) : (
                    <FaGithub />
                  )}
                  {starting ? "Connecting to GitHub…" : "Continue with GitHub"}
                </Button>

                <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={onContinueLocal}
                  className="group h-auto w-full justify-start gap-3 rounded-lg p-3 text-left font-normal whitespace-normal"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-icon text-vio">
                    <LuMonitor />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Continue on this device
                    </span>
                    <span className="text-xs text-muted-foreground">
                      No account. Everything stays in your browser.
                    </span>
                  </span>
                  <LuChevronRight className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            )}

            <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <TrustItem icon={<LuLock />}>Local-first storage</TrustItem>
              <TrustItem icon={<LuGitBranch />}>
                Your repo, your access rules
              </TrustItem>
              <TrustItem icon={<LuCodeXml />}>MIT licensed</TrustItem>
            </ul>
          </div>
        </div>
      </section>

      {/* Right: product hero */}
      <aside className="relative hidden w-1/2 max-w-5xl shrink-0 overflow-hidden rounded-2xl bg-[#0f0d10] lg:block">
        <img
          src="/aurolis-logo/png/aurolis-hero.png"
          alt="Aurolis request editor with source control and a running load test"
          className="absolute inset-0 size-full object-cover object-center"
        />
      </aside>
    </div>
  );
}

function TrustItem({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:text-vio">
      {icon}
      {children}
    </li>
  );
}

function DeviceCodePanel({
  prompt,
  onCancel,
}: {
  prompt: GithubDeviceCodePrompt;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(prompt.userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-8 flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-inverse text-inverse-foreground">
          <FaGithub className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            Enter this code on GitHub
          </p>
          <p className="text-xs text-muted-foreground">
            We opened {prompt.verificationUri.replace(/^https?:\/\//, "")} in
            your browser.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-4 py-3">
        <span
          aria-label={`Code ${prompt.userCode.split("").join(" ")}`}
          className="font-mono text-2xl font-medium tracking-widest text-foreground"
        >
          {prompt.userCode}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={copyCode}>
          {copied ? <LuCheck /> : <LuCopy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LuLoaderCircle className="size-3.5 animate-spin text-vio" />
          Waiting for you to approve…
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => window.open(prompt.verificationUri, "_blank")}
          >
            <LuExternalLink />
            Open GitHub
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
