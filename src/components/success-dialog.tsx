import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

export function SuccessDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Not now",
  onConfirm,
  onClose,
  children,
}: Readonly<{
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}>) {
  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="gap-6 sm:max-w-md">
        <div className="flex flex-col items-center gap-4 pt-3 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success/12 text-success ring-8 ring-success/5">
            <CircleCheck className="size-7" strokeWidth={1.8} aria-hidden />
          </span>
          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-[19px]">{title}</DialogTitle>
            <DialogDescription className="text-balance">
              {description}
            </DialogDescription>
          </div>
          {children}
        </div>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button autoFocus onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
