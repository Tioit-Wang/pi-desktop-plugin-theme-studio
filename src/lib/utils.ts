import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui 的 className 合并约定：条件类 + Tailwind 冲突收敛。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
