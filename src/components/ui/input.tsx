import type * as React from "react";

import { cn } from "@/lib/utils";

/** shadcn/ui Input，按面板刻度收成 28px，并保留 monospace 变体给数值用。 */
function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-7 w-full min-w-0 rounded-xs border border-line bg-tile px-2 text-ui-md text-ink transition-colors",
        "placeholder:text-faint hover:border-line-strong focus-visible:border-line-strong focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-45",
        "[&[type=color]]:cursor-pointer [&[type=color]]:p-0.5",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
