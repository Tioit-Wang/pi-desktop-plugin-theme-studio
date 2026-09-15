import { useEffect, type RefObject } from "react";

import * as core from "@/lib/theme-model";

/**
 * 区域点选。
 *
 * 标签不打在 JSX 里，而是在挂载后按 lib/theme-core.mjs 的 REGIONS 逐条贴上去 ——
 * 区域表是「哪些选择器算一个区域」的唯一真相，JSX 只负责长得像宿主的 DOM。两者
 * 因此不可能对不上：模型改了选择器，预览立刻跟着改。
 *
 * 点击按**最内层优先**：从 event.target 往上找第一个带 data-region 的祖先。
 * 找不到（点在三栏之外的空白）就是整窗。
 */
export function useRegionPicks(
  containerRef: RefObject<HTMLElement | null>,
  picked: string,
  onPick: (id: string) => void,
): (event: React.MouseEvent) => void {
  // 贴标签（只做一次：区域表是静态的）。
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    for (const region of core.REGIONS) {
      if (!region.selector) continue;
      for (const node of root.querySelectorAll(region.selector)) {
        node.setAttribute("data-region", region.id);
        node.setAttribute("data-label", region.label);
      }
    }
    // 左栏头部那条也在「左栏」里：区域表面是 .sidebar-body，但点它的头部同样应该
    // 选中左栏，否则最上面 46px 是死区。
    for (const node of root.querySelectorAll(".sidebar")) {
      if (!node.getAttribute("data-region")) {
        node.setAttribute("data-region", "sidebar");
        node.setAttribute("data-label", "左栏");
      }
    }
  }, [containerRef]);

  // 选中描边与角标：和旧版的 paintRegionPicks 等价。
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    for (const node of root.querySelectorAll("[data-region]")) {
      node.classList.toggle("picked", node.getAttribute("data-region") === picked);
    }
  }, [containerRef, picked]);

  return (event: React.MouseEvent) => {
    // Alt+点任意位置 = 整窗（老规矩，也是「被上层挡住」时的逃生口）。
    if (event.altKey) {
      onPick("shell");
      return;
    }
    let node: HTMLElement | null = event.target as HTMLElement | null;
    while (node && node !== event.currentTarget) {
      const id = node.getAttribute?.("data-region");
      if (id) {
        onPick(id);
        return;
      }
      node = node.parentElement;
    }
    onPick("shell");
  };
}

/** 区域在树里的上一层：栏内 → 中栏，栏 → 整窗。 */
export function regionParent(id: string): string | null {
  const region = core.REGIONS.find((item) => item.id === id);
  if (!region || region.depth === 0) return null;
  return region.depth >= 2 ? "main" : "shell";
}

export function regionTrail(id: string): string[] {
  const trail: string[] = [];
  let cursor: string | null = id;
  while (cursor) {
    trail.unshift(cursor);
    cursor = regionParent(cursor);
  }
  return trail;
}

export function regionLabel(id: string): string {
  return core.REGIONS.find((item) => item.id === id)?.label ?? id;
}
