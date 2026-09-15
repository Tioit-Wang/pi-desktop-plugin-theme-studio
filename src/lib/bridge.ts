import type {
  ApplyResult,
  ImageEntry,
  LibraryResponse,
  OrphanImage,
  PluginBridge,
  PutImageResult,
  ReadImageResult,
  SaveResult,
  Theme,
} from "@/lib/types";

/**
 * 面板与插件进程之间的通道。
 *
 * 只有这些 channel 存在 —— 每一条都对应 main.js 的 PANEL_HANDLERS。写错了不会
 * 静默失败：插件进程会抛 "unsupported panel channel: …"。
 */
export type Channels = {
  "studio.library": { payload: void; result: LibraryResponse };
  "studio.theme.save": { payload: { theme: Theme }; result: SaveResult };
  "studio.theme.remove": { payload: { id: string }; result: { ok: boolean; remaining: number } };
  "studio.apply": { payload: { id: string }; result: ApplyResult };
  "studio.state.put": { payload: { state: Record<string, unknown> }; result: { ok: boolean } };
  "studio.image.put": {
    payload: { bytes: Uint8Array; name: string; themeId: string };
    result: PutImageResult;
  };
  "studio.image.remove": { payload: { id: string }; result: { ok: boolean; total: number } };
  "studio.image.prune": { payload: void; result: { ok: boolean; removed: number; total: number } };
  "studio.image.drop": { payload: { path: string }; result: { ok: boolean; removed: number } };
  /** 导出当前主题：宿主弹原生目录对话框，插件往那里写 zip。 */
  "studio.theme.export": {
    payload: { theme: Theme; previewPng: string };
    result: {
      ok: boolean;
      canceled?: boolean;
      path?: string;
      bytes?: number;
      entries?: number;
      images?: number;
      preview?: boolean;
    };
  };
  /** 只导出预览图 PNG。 */
  "studio.preview.save": {
    payload: { label: string; png: string };
    result: { ok: boolean; canceled?: boolean; path?: string; bytes?: number };
  };
  /** 导入：位置也由用户在原生对话框里选，插件自己找 zip / 解开的目录。 */
  "studio.theme.import": {
    payload: void;
    result: {
      ok: boolean;
      canceled?: boolean;
      kind?: "zip" | "folder";
      source?: string;
      imported?: { id: string; label: string; bytes: number };
      renamed?: string[];
      images?: number;
      missingImages?: string[];
  };
  };
  "studio.image.read": { payload: { id: string }; result: ReadImageResult };
  "clipboard.writeText": { payload: { text: string }; result: { ok: boolean } };
  "app.getAppearance": {
    payload: void;
    result: { base?: string; locale?: string; theme?: string };
  };
};

export type ChannelName = keyof Channels;

/** 宿主注入的插件桥。开发环境（Vite dev / 自检页）里可能不存在。 */
export const bridge: PluginBridge | null =
  (globalThis as unknown as { pluginBridge?: PluginBridge }).pluginBridge ?? null;

export class BridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BridgeError";
  }
}

export function hasBridge(): boolean {
  return Boolean(bridge && typeof bridge.invoke === "function");
}

/** 调用一个通道。类型由 Channels 决定，调用点不需要写泛型。 */
export async function invoke<K extends ChannelName>(
  channel: K,
  ...[payload]: Channels[K]["payload"] extends void ? [] : [Channels[K]["payload"]]
): Promise<Channels[K]["result"]> {
  if (!bridge || typeof bridge.invoke !== "function") {
    throw new BridgeError("插件桥不可用");
  }
  const args = payload === undefined ? {} : payload;
  return (await bridge.invoke(channel, args)) as Channels[K]["result"];
}

/**
 * 把宿主/插件进程的原始错误翻译成能照着做的说明。
 *
 * 最常见的一种是插件进程里没有 pi.themes（宿主 < 0.14.8），原生报错是
 * "Cannot read properties of undefined (reading 'upsert')"，对使用者毫无信息量。
 */
export function detail(error: unknown): string {
  const message = String(
    (error as { message?: string } | null)?.message ?? error ?? "未知错误",
  );
  const hint = permissionHint(message);
  if (hint) return hint;
  if (/reading '(upsert|remove|list|setTheme)'/.test(message)) {
    return (
      "宿主的运行时主题 API 不可用（pi.themes / pi.app.setTheme），需要 PI-Desktop ≥ 0.14.8；" +
      "若应用是从旧代码启动的，请从更新后的代码重启"
    );
  }
  return message;
}

/** 订阅宿主事件。返回退订函数；没有桥时是空操作。 */
export function on(event: string, handler: (...args: unknown[]) => void): () => void {
  if (!bridge || typeof bridge.on !== "function") return () => {};
  try {
    return bridge.on(event, handler);
  } catch {
    return () => {};
  }
}

/* ---------------------------------------------------------------- 数据形状 */

export function asThemes(value: unknown): Theme[] {
  return Array.isArray(value) ? (value as Theme[]) : [];
}

export function asImages(value: unknown): ImageEntry[] {
  return Array.isArray(value) ? (value as ImageEntry[]) : [];
}

export function asOrphans(value: unknown): OrphanImage[] {
  return Array.isArray(value) ? (value as OrphanImage[]) : [];
}

/**
 * 权限类报错的翻译。
 *
 * 宿主对每个 pi.fs.* / pi.agent.* 调用都查权限，缺了会返回 `missing permission: fs.read`
 * 这种只有开发者看得懂的字符串。而权限变宽**不能靠热重载生效**（宿主会拒绝并提示重新
 * 加载），所以这里必须把「下一步该做什么」直接写给用户。
 */
function permissionHint(message: string): string | null {
  const match = /missing permission:\s*([a-z0-9.]+)/i.exec(message);
  if (!match) return null;
  return (
    `缺少权限「${match[1]}」：本插件需要它才能做到这件事。` +
    "请到插件页对本插件执行一次「加载开发插件」（重新指向原目录）并确认新权限 —— " +
    "权限变更不能靠热重载生效，宿主会主动拒绝。"
  );
}

/**
 * 一张图片的展示地址。
 *
 * 先用预读缓存（studio.image.read 给的 data: URL，面板一定加载得到），再退回
 * 宿主 scheme —— 但 scheme 只为「已应用主题声明过的资源」服务，所以它只是兜底。
 * 路径要整条编码：宿主按绝对路径给字节（ADR 0255）。
 */
export function imageUrl(
  id: string,
  images: ImageEntry[],
  previewData: Record<string, string>,
  pluginId: string,
): string {
  if (!id) return "";
  if (previewData[id]) return previewData[id];
  const entry = images.find((item) => item.id === id);
  if (!entry || !entry.path) return "";
  return `plugin-asset://${pluginId}/${encodeURIComponent(entry.path.replace(/\\/g, "/"))}`;
}
