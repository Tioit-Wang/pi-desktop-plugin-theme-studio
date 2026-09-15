/**
 * 主题工坊的数据形状。
 *
 * 这些类型描述的是「跨进程契约」：插件进程 main.js 的 PANEL_HANDLERS 与它的
 * normalizeTheme()。改这里必须同时改那边，反之亦然。
 */

/** 一个表面（区域 / 侧边栏）的背景设定。取值都是模型白名单里的字符串。 */
export type SurfaceImage = {
  on: boolean;
  /** 图片 id（= 数据目录里的文件名去掉扩展名）。空串 = 还没选图。 */
  image: string;
  size: string;
  repeat: string;
  position: string;
};

export type SurfaceGradient = {
  on: boolean;
  angle: number;
  from: string;
  to: string;
};

export type Surface = {
  fill?: string;
  gradient?: SurfaceGradient;
  image?: SurfaceImage;
  blur?: number;
  radius?: string;
};

/** 侧边栏专用：走 --ds-bg-sidebar-image（ADR 0249）。 */
export type SidebarImage =
  | { on: false; kind: "none" }
  | { on: true; kind: "gradient"; angle: number; from: string; to: string }
  | { on: true; kind: "image"; image: string };

export type ThemeBase = "dark" | "light";

/** 一份主题设计。tokens 只存被改过的 key（未改的留给宿主）。 */
export type Theme = {
  id: string;
  label: string;
  base: ThemeBase;
  builtin?: boolean;
  tokens: Record<string, string>;
  sidebarImage?: SidebarImage;
  regions?: Record<string, Surface>;
};

/** 一张上传过的图片。path 是绝对路径（ADR 0255）。 */
export type ImageEntry = {
  id: string;
  path: string;
  bytes: number;
  name: string;
  addedAt?: number;
  /** 上传时正在编辑的主题 id；仅用于展示。 */
  owner?: string;
};

/** 数据目录里有文件、但登记表里没有记录的图片。 */
export type OrphanImage = {
  path: string;
  bytes: number;
  name: string;
};

export type RuntimeApi = { available: boolean | null; reason: string };

/** studio.library 的响应。 */
export type LibraryResponse = {
  pluginId: string;
  runtimeApi: RuntimeApi;
  themes: Theme[];
  active: string;
  applied: string;
  registered: string[];
  images: ImageEntry[];
  orphans: OrphanImage[];
  defaults: { dark: Record<string, string>; light: Record<string, string> };
};

export type SaveResult = { ok: boolean; id: string; bytes: number };
export type ApplyResult = { ok: boolean; applied: string };
export type PutImageResult = {
  ok: boolean;
  id: string;
  path: string;
  name: string;
  bytes: number;
  owner: string;
  total: number;
};
export type ReadImageResult = { dataUrl: string };

/** 桌面端的插件桥（apps/desktop/electron/preload/plugin-panel.ts）。 */
export type PluginBridge = {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => () => void;
  send: (channel: string, payload?: unknown) => void;
  getDroppedFilePath?: (file: File) => string | null;
};

/** 悬浮面板里的四块内容。 */
export type PaneId = "region" | "token" | "images" | "audit";

/** 预览里的三个视图。 */
export type PreviewView = "chat" | "settings" | "menu";

/**
 * 缩放。「适应」= 按画布尺寸实时算倍率；其余是固定倍率。
 *
 * 是 number 而不是字面量联合：Ctrl/⌘+滚轮会在一串阶梯上连续调（0.25 … 2），
 * 顶栏那四个按钮只是其中四个常用档。
 */
export type Zoom = "fit" | number;
