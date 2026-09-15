import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** shadcn/ui Switch，缩到面板刻度（轨道 32×18、滑块 14）。 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-4.5 w-8 shrink-0 items-center rounded-full border border-transparent transition-colors",
        "data-[state=checked]:bg-accent data-[state=unchecked]:bg-tile-deep",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-3.5 rounded-full shadow-sm transition-transform",
          "data-[state=checked]:translate-x-3.5 data-[state=checked]:bg-accent-ink",
          "data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-faint",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
