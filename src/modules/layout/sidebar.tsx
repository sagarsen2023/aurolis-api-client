import { useEffect, useState, type ReactElement } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Button } from "@/components/ui/button";
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
import { availableUpdateAtom } from "@/context/update-context";
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
  note,
}: Readonly<{ item: SideMenuItem; active: boolean; note?: string }>) {
  const Icon = item.icon;
  const label = note ? `${item.title} · ${note}` : item.title;
  return (
    <RailTooltip label={label}>
      <Link
        to={item.link}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "grid size-11.5 shrink-0 place-items-center rounded-full transition-colors duration-150 outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-surface-selected text-ink"
            : "text-dim hover:bg-surface-hover hover:text-ink",
        )}
      >
        <span className="relative">
          <Icon className="size-5" strokeWidth={1.8} aria-hidden />
          {note ? (
            <span
              className="absolute -top-0.5 -right-0.5 size-2.25 rounded-full bg-vio ring-2 ring-background"
              aria-hidden
            />
          ) : null}
        </span>
      </Link>
    </RailTooltip>
  );
}

function SideBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const setBreadCrumb = useSetAtom(breadCrumbAtom);
  const update = useAtomValue(availableUpdateAtom);
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

  useEffect(() => {
    const current = ALL_ITEMS.find((item) => isActivePath(item.link, pathname));
    if (current?.breadCrumb) setBreadCrumb(current.breadCrumb);
  }, [pathname, setBreadCrumb]);

  return (
    <nav
      aria-label="Main"
      className="flex h-full w-17 shrink-0 flex-col items-center border-r border-line bg-background px-2.75 py-3.5"
    >
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

      <div className="flex flex-col items-center gap-1.5">
        {sideMenuItems.map((item) => (
          <RailItem
            key={item.key}
            item={item}
            active={isActivePath(item.link, pathname)}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-3">
        {bottomMenuItems.map((item) => (
          <RailItem
            key={item.key}
            item={item}
            active={isActivePath(item.link, pathname)}
            note={
              item.key === "settings" && update ? "Update available" : undefined
            }
          />
        ))}

        {accountName ? (
          <RailTooltip label={accountName}>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Account: ${accountName}`}
              className="size-10 rounded-full bg-linear-to-br from-orb-a to-orb-c p-0 text-[13px] font-medium text-lav-ink hover:bg-transparent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {getInitials({ name: accountName })}
            </Button>
          </RailTooltip>
        ) : null}
      </div>
    </nav>
  );
}

export default SideBar;
