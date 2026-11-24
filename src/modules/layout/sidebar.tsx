import { useEffect, useState, type ReactElement } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  bottomMenuItems,
  sideMenuItems,
  type SideMenuItem,
} from "@/constants/menu-items";
import { breadCrumbAtom } from "@/context/breadcrumb-context";
import { authService } from "@/services/auth.service";
import { getInitials } from "@/utils/extract-initials";

const ALL_ITEMS = [...sideMenuItems, ...bottomMenuItems];

function isActivePath(link: string, pathname: string) {
  if (link === "/") return pathname === "/";
  return pathname === link || pathname.startsWith(`${link}/`);
}

function RailTooltip({
  label,
  children,
}: Readonly<{
  label: string;
  children: ReactElement;
}>) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function RailItem({
  item,
  active,
}: Readonly<{ item: SideMenuItem; active: boolean }>) {
  const Icon = item.icon;
  return (
    <RailTooltip label={item.title}>
      <Link
        to={item.link}
        aria-label={item.title}
        aria-current={active ? "page" : undefined}
        className={cn(
          "grid size-11.5 shrink-0 place-items-center rounded-full transition-colors duration-150 outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-surface-selected text-ink"
            : "text-dim hover:bg-surface-hover hover:text-ink",
        )}
      >
        <Icon className="size-5" strokeWidth={1.8} aria-hidden />
      </Link>
    </RailTooltip>
  );
}

function SideBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const setBreadCrumb = useSetAtom(breadCrumbAtom);
  const [accountName, setAccountName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void authService.getStatus().then((status) => {
      if (!active) return;
      const user = status.user;
      const name = user?.name?.trim() || user?.login || null;
      setAccountName(name);
    });
    return () => {
      active = false;
    };
  }, []);

  // Keep the header breadcrumb in step with the current route.
  useEffect(() => {
    const current = ALL_ITEMS.find((item) => isActivePath(item.link, pathname));
    if (current?.breadCrumb) setBreadCrumb(current.breadCrumb);
  }, [pathname, setBreadCrumb]);

  return (
    <nav
      aria-label="Main"
      className="flex h-full w-17 shrink-0 flex-col items-center border-r border-line bg-background px-2.75 py-3.5"
    >
      {/* Logo tile */}
      <Link
        to="/"
        aria-label="Aurolis home"
        className="mb-4 grid size-10.5 shrink-0 place-items-center rounded-[12px] border border-line-strong bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src="/aurolis-logo/svg/aurolis-mark-light.svg"
          alt=""
          className="size-6.5 dark:hidden"
          draggable={false}
        />
        <img
          src="/aurolis-logo/svg/aurolis-mark-dark.svg"
          alt=""
          className="hidden size-6.5 dark:block"
          draggable={false}
        />
      </Link>

      {/* Main destinations */}
      <div className="flex flex-col items-center gap-1.5">
        {sideMenuItems.map((item) => (
          <RailItem
            key={item.key}
            item={item}
            active={isActivePath(item.link, pathname)}
          />
        ))}
      </div>

      {/* Bottom: settings + account */}
      <div className="mt-auto flex flex-col items-center gap-3">
        {bottomMenuItems.map((item) => (
          <RailItem
            key={item.key}
            item={item}
            active={isActivePath(item.link, pathname)}
          />
        ))}

        {accountName ? (
          <RailTooltip label={accountName}>
            <button
              type="button"
              aria-label={`Account: ${accountName}`}
              className="grid size-10 place-items-center rounded-full bg-linear-to-br from-orb-a to-orb-c text-[13px] font-medium text-lav-ink outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {getInitials({ name: accountName })}
            </button>
          </RailTooltip>
        ) : null}
      </div>
    </nav>
  );
}

export default SideBar;
