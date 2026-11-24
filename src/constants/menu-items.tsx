import {
  ArrowUpDown,
  Clock,
  Globe,
  Layers,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export interface BreadCrumbItem {
  name: string;
  link: string;
  icon: ReactNode;
}

export type RailLink =
  | "/"
  | "/environments"
  | "/history"
  | "/load-testing"
  | "/import-export"
  | "/settings";

export interface SideMenuItem {
  title: string;
  icon: LucideIcon;
  link: RailLink;
  key: string;
  breadCrumb?: BreadCrumbItem[];
}

function item(
  key: string,
  title: string,
  link: RailLink,
  Icon: LucideIcon,
): SideMenuItem {
  return {
    key,
    title,
    link,
    icon: Icon,
    breadCrumb: [{ name: title, link, icon: <Icon size={16} /> }],
  };
}

/** Main destinations, top of the rail. */
export const sideMenuItems: SideMenuItem[] = [
  item("collections", "Collections", "/", Layers),
  item("environments", "Environments", "/environments", Globe),
  item("history", "History", "/history", Clock),
  item("load-testing", "Load testing", "/load-testing", Zap),
  item("import-export", "Import & export", "/import-export", ArrowUpDown),
];

/** Pinned to the bottom of the rail, above the avatar. */
export const bottomMenuItems: SideMenuItem[] = [
  item("settings", "Settings", "/settings", Settings),
];
