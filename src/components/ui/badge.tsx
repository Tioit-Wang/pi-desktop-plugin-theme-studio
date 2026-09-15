import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-4.5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-ui-2xs whitespace-nowrap",
  {
    variants: {
      variant: {
        outline: "border-line text-muted",
        strong: "border-line-strong text-ink-2",
        solid: "border-transparent bg-accent text-accent-ink font-medium",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        danger: "border-transparent bg-danger/15 text-danger",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
