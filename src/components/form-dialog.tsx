import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function FormDialog({
  title,
  description,
  submitLabel,
  busy,
  canSubmit,
  onSubmit,
  onClose,
  children,
  wide,
}: Readonly<{
  title: string;
  description: ReactNode;
  submitLabel: string;
  busy: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}>) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && !busy) onSubmit();
  };
  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className={cn(wide && "sm:max-w-xl")}>
        <form className="flex flex-col gap-6" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
