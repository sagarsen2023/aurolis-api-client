import {
  SquareArrowRight,
  SquareDot,
  SquareMinus,
  SquarePlus,
  SquareX,
  type LucideIcon,
} from "lucide-react";
import type { ChangeStatus } from "@/types/workspace/source-control.type";

export const CHANGE_STATUS: Record<
  ChangeStatus,
  { label: string; letter: string; icon: LucideIcon; className: string }
> = {
  added: {
    label: "Added",
    letter: "A",
    icon: SquarePlus,
    className: "text-success",
  },
  modified: {
    label: "Modified",
    letter: "M",
    icon: SquareDot,
    className: "text-warning",
  },
  deleted: {
    label: "Deleted",
    letter: "D",
    icon: SquareMinus,
    className: "text-danger",
  },
  renamed: {
    label: "Renamed",
    letter: "R",
    icon: SquareArrowRight,
    className: "text-vio",
  },
  conflicted: {
    label: "Conflict",
    letter: "U",
    icon: SquareX,
    className: "text-danger",
  },
};

export const DIFFSTAT_BLOCKS = 5;
