import * as SliderPrimitive from "@radix-ui/react-slider";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** shadcn/ui Slider，轨道 4px、滑块 12px —— 面板里的取值控件都是这个刻度。 */
function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center data-[disabled]:opacity-45",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-tile-deep">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-3 shrink-0 rounded-full border border-line-strong bg-raised transition-[box-shadow] hover:shadow-[0_0_0_4px_var(--ui-tile-hover)] focus-visible:shadow-[0_0_0_4px_var(--ui-tile-hover)] focus-visible:outline-none" />
    </SliderPrimitive.Root>
  );
}

export { Slider };
