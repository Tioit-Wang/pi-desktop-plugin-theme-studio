/**
 * 把预览拍成一张 1280×800 的 PNG。
 *
 * 预览是 DOM（不是 canvas），所以走的是「DOM → SVG foreignObject → canvas」这条老路：
 * 把复刻体的副本连同**当时生效的全部 CSS** 塞进一个 SVG，交给 `<img>` 解码，再画到
 * canvas 上取像素。
 *
 * 之所以可行，是因为预览里没有任何外部资源：
 *   - CSS 全是文档内的 <style>（Vite 注入 + 各 host-*.css + React 注入的主题 CSS）
 *   - 图片是 data: URL（store 已经预读进缓存，见 prefetchImages）
 * 所以既不会出现跨域空白，也不会污染 canvas（data: 是同源的）。
 *
 * 已知会丢失的东西：`backdrop-filter`（背景模糊）在 foreignObject 里不生效 —— 它糊的
 * 是背后内容，而 SVG 里没有"背后"这个概念。导出图里那部分会显示成清晰的背景。
 */

/** 收集文档里所有样式表规则。跨域表读不到规则时跳过，不影响其余部分。 */
function collectCss(): string {
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // 跨域表：读不到就不管
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) chunks.push(rule.cssText);
  }
  // @import / 字体这些不影响像素（面板用的是系统字体）。
  return chunks.join("\n");
}

function svgDataUrl(svg: string): string {
  // encodeURIComponent 会把 # 也编码掉，否则 SVG 里的颜色会被当成片段标识符。
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export type PreviewShot = { png: string; width: number; height: number } | null;

export async function capturePreview(
  shell: HTMLElement,
  width = 1280,
  height = 800,
): Promise<PreviewShot> {
  const clone = shell.cloneNode(true) as HTMLElement;
  // 去掉交互层：选中描边、角标、悬停提示都不该出现在导出图里。
  clone.classList.remove("picked");
  for (const node of Array.from(clone.querySelectorAll(".picked"))) node.classList.remove("picked");
  for (const node of Array.from(clone.querySelectorAll("[data-region]"))) {
    node.removeAttribute("data-label");
  }
  // 预览是整体缩放过的：导出要 1:1，所以把倍率抹掉。
  clone.style.transform = "none";
  clone.style.setProperty("--preview-zoom", "1");

  const css = collectCss();
  const html =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden">` +
    `<style>${css}</style>` +
    clone.outerHTML +
    `</div></foreignObject></svg>`;

  const image = new Image();
  image.width = width;
  image.height = height;
  image.src = svgDataUrl(html);
  try {
    await image.decode();
  } catch (error) {
    throw new Error(`预览截图失败（SVG 解码）：${(error as Error).message}`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("预览截图失败：拿不到 canvas 上下文");
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/png"),
  );
  if (!blob) throw new Error("预览截图失败：canvas 没有产出 PNG");

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return { png: btoa(binary), width, height };
}

/** 拍不到就返回 null：导出不该因为一张预览图而失败。 */
export async function tryCapturePreview(shell: HTMLElement | null): Promise<string> {
  if (!shell) return "";
  try {
    const shot = await capturePreview(shell);
    return shot ? shot.png : "";
  } catch (error) {
    console.warn("[theme-studio] 预览截图失败，导出将不带预览图：", error);
    return "";
  }
}
