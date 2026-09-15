import { useEffect, useState } from "react";

import * as core from "@/lib/theme-model";
import type { Rgba } from "@/lib/theme-model";

/**
 * 把一段 CSS 颜色值解析成 RGBA。
 *
 * 不能只靠 core.parseColor：宿主默认值大量使用 color-mix() / var() 链，而 Chromium
 * 对这类值的计算结果是 `oklab(…)` 或 `color(srgb …)` —— 不是 rgb()。parseColor 只认
 * #rrggbb(aa) 与 rgb()/rgba()，于是半透明 token（text-secondary 70%、text-muted
 * 52%、bg-composer 96% …）会全部解析失败，对比度表里那几行变成 0.00、顶栏的
 * 「最低正文对比度」永远是「—」。
 *
 * 绕开的办法：把颜色涂到 1×1 画布上再读像素 —— canvas 接受任何 CSS 颜色语法，
 * 读回来的一定是实打实的 RGBA 字节。
 */
let ctx: CanvasRenderingContext2D | null = null;

function canvasContext(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  return ctx;
}

function toRgba(value: string): Rgba | null {
  const context = canvasContext();
  if (!context) return null;
  // 先涂一个哨兵色：赋值失败时 fillStyle 不会变，据此判断这个值浏览器认不认。
  context.fillStyle = "#000000";
  context.fillStyle = value;
  if (context.fillStyle === "#000000" && value.replace(/\s/g, "") !== "#000000") {
    // 也可能真的是黑色：再用 parseColor 复核一次。
    if (!core.parseColor(value)) return null;
  }
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}
/**
 * 把预览里**实际解析出来的**颜色读出来。
 *
 * 用途：对比度检查、顶栏的最低对比度、token 面板里未覆盖项的「当前值」。读的时机是
 * 预览 CSS 已经注入之后，所以拿到的是「宿主默认 + 当前主题覆盖」合成后的值 —— 也就是
 * 真窗口上会出现的颜色。
 */
export function useEffectiveTokens(
  shellRef: React.RefObject<HTMLElement | null>,
  deps: unknown[],
): Record<string, string> {
  const [effective, setEffective] = useState<Record<string, string>>({});

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;";
    shell.append(probe);

    const read = (name: string): string => {
      probe.style.backgroundColor = "";
      probe.style.backgroundColor = `var(--ds-${name})`;
      const computed = getComputedStyle(probe).backgroundColor;
      if (!computed) return "";
      const rgba = toRgba(computed) ?? core.parseColor(computed);
      if (!rgba) return "";
      return rgba.a < 1 ? core.toHex8(rgba) : core.toHex(rgba);
    };

    const next: Record<string, string> = {};
    for (const key of core.TOKEN_KEYS) next[key] = read(key);
    probe.remove();
    setEffective(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return effective;
}
