import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const pillVariants = cva(
  "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] leading-none font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "border border-border bg-surface-raise text-foreground",
        outline: "border border-input text-foreground",
        lav: "bg-lav text-lav-ink",
        ok: "bg-ok text-ok-foreground",
        warn: "bg-warn text-warn-foreground",
        err: "bg-err text-err-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Pill({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof pillVariants>) {
  return (
    <span
      data-slot="pill"
      className={cn(pillVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Pill, pillVariants };
