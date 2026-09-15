import { useEffect, useRef, useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PreviewView, Zoom } from "@/lib/types";

/** 预览的逻辑尺寸：真窗口的这个尺寸下，左栏 275 / 内容带 760 / 右栏 360。 */
export const PREVIEW_WIDTH = 1280;
export const PREVIEW_HEIGHT = 800;

const VIEWS: Array<{ value: PreviewView; label: string }> = [
  { value: "chat", label: "对话" },
  { value: "settings", label: "设置" },
  { value: "menu", label: "菜单" },
];

const ZOOMS: Array<{ value: string; label: string; zoom: Zoom }> = [
  { value: "fit", label: "适应", zoom: "fit" },
  { value: "0.5", label: "50%", zoom: 0.5 },
  { value: "0.75", label: "75%", zoom: 0.75 },
  { value: "1", label: "100%", zoom: 1 },
];

/**
 * Ctrl/⌘ + 滚轮的倍率阶梯。跨过 1 的两侧都有档位（旧版就是这样），所以可以放大到
 * 200% 看清细节，也可以缩到 25% 通揽全局。
 */
const WHEEL_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];

/**
 * 画布列：工具条 + 预览。
 *
 * 缩放只改**观看倍率**：预览永远按 1280×800 的逻辑尺寸渲染，再整体 transform ——
 * 所以无论放大缩小，里面的比例、字号关系、留白都和真窗口一模一样。外框会跟着
 * 倍率一起缩放（否则 50% 时右边和下边会各留一大块空白，滚动条也没意义）。
 *
 * 「适应」按画布可用尺寸实时算，窗口或左栏一变就重算（ResizeObserver）。
 */
export function CanvasColumn({
  view,
  zoom,
  onView,
  onZoom,
  onPickShell,
  children,
}: {
  view: PreviewView;
  zoom: Zoom;
  onView: (value: PreviewView) => void;
  onZoom: (value: Zoom) => void;
  /** 画布空白处的点击：整窗。 */
  onPickShell: () => void;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.5);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const style = getComputedStyle(wrap);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const width = Math.max(0, wrap.clientWidth - padX - 2);
      const height = Math.max(0, wrap.clientHeight - padY - 2);
      const next = Math.min(1, width / PREVIEW_WIDTH, height / PREVIEW_HEIGHT);
      setFit(Math.max(0.15, next || 0.15));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const factor = zoom === "fit" ? fit : zoom;

  return (
    <section className="relative flex min-w-0 flex-1 flex-col">
      <div className="flex h-10 flex-none items-center gap-2 border-b border-line px-3">
        <span className="text-ui-xs text-faint">实时预览</span>
        <span className="text-ui-2xs text-faint">点预览里的区域即可编辑那一块</span>
        <ToggleGroup
          className="ml-auto"
          type="single"
          value={view}
          onValueChange={(value) => value && onView(value as PreviewView)}
          aria-label="预览视图"
        >
          {VIEWS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={String(zoom)}
          onValueChange={(value) => {
            const match = ZOOMS.find((item) => item.value === value);
            if (match) onZoom(match.zoom);
          }}
          aria-label="预览缩放"
        >
          {ZOOMS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="w-9 text-right text-ui-2xs text-faint tabular-nums">
          {Math.round(factor * 100)}%
        </span>
      </div>

      <div
        ref={wrapRef}
        className="flex-1 overflow-auto bg-canvas p-3 [background-image:radial-gradient(circle_at_1px_1px,var(--ui-dot)_1px,transparent_0)] [background-size:14px_14px]"
        onWheel={(event) => {
          // Ctrl/⌘ + 滚轮：在阶梯上前后一档。只改观看倍率，预览逻辑尺寸不变。
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          const next =
            event.deltaY < 0
              ? WHEEL_STEPS.find((value) => value > factor + 0.001)
              : [...WHEEL_STEPS].reverse().find((value) => value < factor - 0.001);
          if (next !== undefined) onZoom(next);
        }}
        onClick={(event) => {
          // 点预览外面的空白 = 选整窗（最底层）。
          if ((event.target as HTMLElement).closest(".preview-shell")) return;
          onPickShell();
        }}
      >
        <div
          className="preview-frame"
          style={{ width: PREVIEW_WIDTH * factor, height: PREVIEW_HEIGHT * factor }}
        >
          <div style={{ "--preview-zoom": factor } as React.CSSProperties}>{children}</div>
        </div>
      </div>
    </section>
  );
}
