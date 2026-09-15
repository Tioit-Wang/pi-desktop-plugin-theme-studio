import { Contrast, Image as ImageIcon, LayoutGrid, Palette, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PaneId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PANE_TITLES } from "@/store/studio-store";

const ORBS: Array<{ id: PaneId; icon: typeof Palette; hint: string }> = [
  { id: "region", icon: Palette, hint: "区域：点预览里的地方就能改那一块" },
  { id: "token", icon: SlidersHorizontal, hint: "Token：56 个 --ds-* 变量" },
  { id: "images", icon: ImageIcon, hint: "图片：本地 PNG 库" },
  { id: "audit", icon: Contrast, hint: "检查：对比度（WCAG 2.1）" },
];

/** 主题库折叠后剩下的那颗悬浮球（左上角，压着画布）。 */
export function LibraryOrb({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label="展开主题库"
          className="absolute top-2.5 left-2.5 z-40 grid size-8.5 place-items-center rounded-full border border-line bg-raised text-ink shadow-[var(--ui-shadow-orb)] transition-colors hover:border-line-strong hover:bg-tile-hover"
        >
          <LayoutGrid className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>展开主题库</TooltipContent>
    </Tooltip>
  );
}

/**
 * 右缘轨道：一排悬浮球，从**顶部**往下排（PS 的工具条那样），不垂直居中。
 *
 * 这里容易写错：轨道本身是行向 flex，`items-center` 会把整列球竖向居中 —— 要靠顶就得
 * items-start + pt-2.5。面板是**非常驻**的：轨道永远在，面板只在点开时浮在预览上面。
 */
export function Rail({
  pane,
  onOpen,
  onClose,
}: {
  pane: PaneId | null;
  onOpen: (id: PaneId) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex w-11.5 flex-none items-start justify-center border-l border-line bg-panel pt-2.5">
      <div className="flex flex-col items-center gap-2">
        {ORBS.map((orb) => {
          const Icon = orb.icon;
          const active = pane === orb.id;
          return (
            <Tooltip key={orb.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={PANE_TITLES[orb.id]}
                  aria-pressed={active}
                  onClick={() => (active ? onClose() : onOpen(orb.id))}
                  className={cn(
                    "relative grid size-8 place-items-center rounded-full border transition-colors",
                    active
                      ? "border-transparent bg-accent text-accent-ink"
                      : "border-line bg-raised text-ink-2 hover:border-line-strong hover:bg-tile-hover",
                  )}
                >
                  <Icon className="size-4" />
                  {orb.id === "region" ? (
                    <i className="absolute -top-px -right-px size-2 rounded-full border-2 border-panel bg-success" />
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{orb.hint}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 悬浮面板：盖在预览上，不占布局宽度。
 *
 * 顶部从画布工具条**下方**开始 —— 那条上有视图切换与放大倍率，面板不能压住它。
 * 工具条 40px + 8px 间距 = top-12；右侧留出 46px 的悬浮球轨道再加 10px 间隙 = right-14。
 */
export function FloatingPanel({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-hidden={!open}
      className={cn(
        "absolute top-12 right-14 bottom-2 z-60 flex w-84 flex-col overflow-hidden rounded-md border border-line bg-panel shadow-[var(--ui-shadow-panel)] transition-[opacity,transform] duration-150",
        open ? "opacity-100" : "pointer-events-none translate-x-3.5 opacity-0",
      )}
    >
      <header className="flex h-10 flex-none items-center gap-2 border-b border-line pr-2 pl-3">
        <span className="text-ui-lg font-semibold">{title}</span>
        <span className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="收起（Esc）">
              <X className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>收起（Esc）</TooltipContent>
        </Tooltip>
      </header>
      <ScrollArea className="flex-1">{children}</ScrollArea>
    </section>
  );
}

/** 底部状态条：一句话说清刚刚发生了什么。 */
export function StatusBar({ text, error }: { text: string; error: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        "h-7 flex-none truncate border-t border-line px-3 leading-7 text-ui-2xs",
        error ? "text-danger" : "text-faint",
      )}
      title={text}
    >
      {text}
    </div>
  );
}
