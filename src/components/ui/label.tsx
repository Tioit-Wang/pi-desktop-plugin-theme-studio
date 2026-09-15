import * as LabelPrimitive from "@radix-ui/react-label";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex min-w-0 items-center gap-2 text-ui-md text-ink-2 select-none",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
