import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Button，尺寸按面板的紧凑刻度改过：这里的 1 个单位是 4px，
 * 面板上的控件是 24 / 28 / 32px 三档，而不是网页的 36 / 40px。
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xs text-ui-md font-medium transition-colors outline-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-border bg-secondary text-foreground hover:bg-accent",
        primary: "border border-transparent bg-primary text-primary-foreground hover:opacity-90",
        ghost: "border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        danger: "border border-border text-muted-foreground hover:border-destructive hover:text-destructive",
      },
      size: {
        sm: "h-6 px-2 text-ui-xs",
        md: "h-7 px-2.5",
        lg: "h-8 px-3",
        icon: "size-7 p-0",
        "icon-sm": "size-6 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
