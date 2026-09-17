import { create } from "zustand";

import {
  asImages,
  asOrphans,
  asThemes,
  detail,
  imageUrl,
  invoke,
  on,
} from "@/lib/bridge";
import * as core from "@/lib/theme-model";
import { humanSize } from "@/lib/format";
import { tryCapturePreview } from "@/lib/preview-shot";
import type {
  ImageEntry,
  LibraryResponse,
  OrphanImage,
  PaneId,
  PreviewView,
  RuntimeApi,
  SidebarImage,
  Surface,
  Theme,
  ThemeBase,
  Zoom,
} from "@/lib/types";

/** 改动落盘前的防抖窗口：一次连续拖动只注册一次。 */
export const SAVE_DEBOUNCE_MS = 600;

export const PANE_TITLES: Record<PaneId, string> = {
  region: "区域",
  token: "Token",
  images: "图片",
  audit: "检查",
};

export function isValidThemeId(id: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id);
}

/** 提示的三种语气。 */
export type ToastKind = "success" | "error" | "info";

/**
 * 一条提示。
 *
 * 同一 key 的提示互相替换：「正在导出…」原地变成「已导出…」，而不是叠两条。
 */
export type Toast = {
  id: string;
  key: string;
  kind: ToastKind;
  title: string;
  detail?: string;
  /** detail 是路径这类内容时用等宽字体。 */
  mono?: boolean;
  action?: { label: string; run: () => void };
};

export type ToastInput = Omit<Toast, "id" | "key"> & { key?: string };

/** 自动消失的时间：成功/信息看清楚就够，失败留久一点（都能手动关）。 */
const TOAST_TTL: Record<ToastKind, number> = { success: 6000, info: 4500, error: 12000 };

/** 同时最多挂几条，再多就把最老的挤掉。 */
const TOAST_LIMIT = 4;

let toastSeq = 0;
const toastTimers = new Map<string, number>();

type StudioState = {
  /* ---- 库与进程数据 ---- */
  loading: boolean;
  loaded: boolean;
  pluginId: string;
  themes: Theme[];
  active: string;
  applied: string;
  registered: string[];
  images: ImageEntry[];
  orphans: OrphanImage[];
  previewData: Record<string, string>;
  defaults: { dark: Record<string, string>; light: Record<string, string> };
  runtimeApi: RuntimeApi;

  /* ---- 界面 ---- */
  filter: string;
  region: string;
  pane: PaneId | null;
  lastPane: PaneId;
  libraryOpen: boolean;
  view: PreviewView;
  zoom: Zoom;
  status: string;
  statusError: boolean;
  /** 悬浮提示：动作的结果要看得见，而不是只在底部那行小字里换句话。 */
  toasts: Toast[];

  /* ---- 动作 ---- */
  load: () => Promise<void>;
  setStatus: (text: string, isError?: boolean, options?: { toast?: boolean }) => void;
  pushToast: (toast: ToastInput, options?: { ttl?: number | null }) => void;
  dismissToast: (id: string) => void;
  /** 把一段文本放进剪贴板，并把结果作为提示说出来（导出成功的路径按钮用它）。 */
  copyPath: (path: string) => Promise<void>;

  setFilter: (value: string) => void;
  setLibraryOpen: (open: boolean) => void;
  setView: (view: PreviewView) => void;
  setZoom: (zoom: Zoom) => void;
  openPane: (id: PaneId) => void;
  closePane: () => void;

  selectTheme: (id: string) => void;
  applyCurrent: () => Promise<void>;
  newTheme: () => void;
  duplicateTheme: (id: string) => void;
  deleteTheme: (id: string) => void;
  rename: (label: string) => void;

  mutate: (mutator: (theme: Theme) => void) => void;
  commit: (mutator: (region: Surface) => void) => void;
  setToken: (key: string, value: string) => void;
  setSidebarImage: (image: SidebarImage) => void;
  revealUpper: () => void;

  push: (options?: { quiet?: boolean }) => Promise<void>;
  copyCss: () => Promise<void>;
  /** 导出当前主题为 zip（设计 + 图片 + 预览图 + CSS）。位置由用户在原生对话框里选。 */
  exportTheme: (shell: HTMLElement | null) => Promise<void>;
  /** 只导出预览图 PNG。 */
  exportPreview: (shell: HTMLElement | null) => Promise<void>;
  /** 导入一个导出包（zip 或解开的同名目录）。位置同样由用户选。 */
  importTheme: () => Promise<void>;

  pickRegion: (id: string) => void;
  /** 把当前设计用到的图片读成 data: URL 放进缓存（只读缺的那些）。 */
  prefetchImages: () => Promise<void>;
  refreshImages: () => Promise<void>;
  putImage: (file: File) => Promise<string | null>;
  removeImage: (id: string) => Promise<void>;
  pruneImages: () => Promise<void>;
  dropOrphan: (path: string) => Promise<void>;
};

/* ---------------------------------------------------------------- 选择器 */

export function activeTheme(state: Pick<StudioState, "themes" | "active">): Theme | null {
  return state.themes.find((theme) => theme.id === state.active) ?? null;
}

/** 一份设计 = 主题里与设计有关的那部分（不含 id/label 这些元数据）。 */
export function designOf(theme: Theme | null) {
  return {
    tokens: theme?.tokens ?? {},
    sidebarImage: theme?.sidebarImage,
    regions: theme?.regions ?? {},
  };
}

export function themeBase(theme: Theme | null): ThemeBase {
  return theme?.base === "light" ? "light" : "dark";
}

export function overriddenCount(theme: Theme | null): number {
  return theme ? core.overriddenKeys(designOf(theme)).length : 0;
}

/** 列表缩略色：直接对该主题算一遍，不依赖当前选中项。 */
export function previewColors(
  theme: Pick<Theme, "base" | "tokens">,
  defaults: StudioState["defaults"],
): string[] {
  const base = themeBase(theme as Theme);
  const tokens = theme.tokens ?? {};
  const pick = (key: string): string => {
    const value = tokens[key];
    if (value) return value;
    const parsed = core.parseColor(defaults[base]?.[key]);
    if (!parsed) return "transparent";
    return parsed.a < 1 ? core.toHex8(parsed) : core.toHex(parsed);
  };
  return [pick("bg-under"), pick("bg-sidebar"), pick("accent"), pick("text-primary")];
}

/** 预览 CSS：与落盘注册共用 core.serialize，只是根选择器不同。 */
export function previewCss(
  theme: Theme | null,
  images: ImageEntry[],
  previewData: Record<string, string>,
  pluginId: string,
): string {
  return core.serialize(themeBase(theme), designOf(theme), {
    rootSelector: `.pv-root[data-theme="${themeBase(theme)}"]`,
    note: theme?.label ?? "",
    resolveImage: (image) => imageUrl(image.image ?? "", images, previewData, pluginId),
  });
}

/** 这份设计里用到的图片 id。 */
export function imageIdsIn(theme: Theme | null): string[] {
  if (!theme) return [];
  const ids: string[] = [];
  const push = (image: { on?: boolean; image?: string } | undefined) => {
    if (image && image.on === true && image.image) ids.push(image.image);
  };
  const sidebar = theme.sidebarImage;
  if (sidebar && sidebar.on === true && sidebar.kind === "image") push({ on: true, image: sidebar.image });
  for (const id of Object.keys(theme.regions ?? {})) push(theme.regions?.[id]?.image);
  return [...new Set(ids)];
}

/** 这张图被哪些主题的哪些区域用着。 */
export function imageUsage(themeList: Theme[], id: string): string[] {
  const where: string[] = [];
  for (const theme of themeList) {
    const sidebar = theme.sidebarImage;
    if (sidebar && sidebar.on === true && sidebar.kind === "image" && sidebar.image === id) {
      where.push("左栏");
    }
    for (const regionId of Object.keys(theme.regions ?? {})) {
      const image = theme.regions?.[regionId]?.image;
      if (image && image.on === true && image.image === id) {
        const definition = core.REGIONS.find((item) => item.id === regionId);
        where.push(definition?.label ?? regionId);
      }
    }
  }
  return where;
}

/* ---------------------------------------------------------------- store */

let saveTimer = 0;
let booted = false;

const EMPTY_DEFAULTS = { dark: {}, light: {} };

export const useStudio = create<StudioState>((set, get) => {
  /** 所有改动的唯一出口：改设计 → 重绘（React 自动）→ 防抖注册。 */
  function scheduleSave(): void {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      void get().push({ quiet: true });
    }, SAVE_DEBOUNCE_MS);
  }

  return {
    loading: false,
    loaded: false,
    pluginId: "pi.theme.studio",
    themes: [],
    active: "",
    applied: "",
    registered: [],
    images: [],
    orphans: [],
    previewData: {},
    defaults: EMPTY_DEFAULTS,
    runtimeApi: { available: null, reason: "" },

    filter: "",
    region: "shell",
    pane: "region",
    lastPane: "region",
    libraryOpen: true,
    view: "chat",
    zoom: "fit",
    status: "正在读取主题库…",
    statusError: false,
    toasts: [],

    setStatus: (text, isError = false, options) => {
      set({ status: text, statusError: isError });
      // 失败必须自己冒出来：底部那行 10.5px 的小字没人盯。成功类消息默认只留在
      // 状态行，需要提示的调用点自己 pushToast（内容更丰富，还能带按钮）。
      if (options?.toast ?? isError) {
        get().pushToast({ kind: isError ? "error" : "info", title: text });
      }
    },

    pushToast(input, options) {
      const key = input.key ?? `${input.kind}:${input.title}`;
      const current = get().toasts;
      const existing = current.find((toast) => toast.key === key);
      const id = existing?.id ?? `toast-${(toastSeq += 1)}`;
      const next: Toast = {
        id,
        key,
        kind: input.kind,
        title: input.title,
        detail: input.detail,
        mono: input.mono,
        action: input.action,
      };
      set({
        toasts: existing
          ? current.map((toast) => (toast.id === id ? next : toast))
          : [...current, next].slice(-TOAST_LIMIT),
      });
      const running = toastTimers.get(key);
      if (running !== undefined) {
        window.clearTimeout(running);
        toastTimers.delete(key);
      }
      const ttl = options?.ttl === undefined ? TOAST_TTL[input.kind] : options.ttl;
      if (ttl) {
        toastTimers.set(
          key,
          window.setTimeout(() => {
            toastTimers.delete(key);
            get().dismissToast(id);
          }, ttl),
        );
      }
    },

    dismissToast(id) {
      const toast = get().toasts.find((item) => item.id === id);
      if (!toast) return;
      const running = toastTimers.get(toast.key);
      if (running !== undefined) {
        window.clearTimeout(running);
        toastTimers.delete(toast.key);
      }
      set({ toasts: get().toasts.filter((item) => item.id !== id) });
    },

    async copyPath(path) {
      try {
        await invoke("clipboard.writeText", { text: path });
        get().pushToast(
          { key: "clipboard", kind: "info", title: "已复制路径到剪贴板", detail: path, mono: true },
          { ttl: 3200 },
        );
      } catch (error) {
        get().setStatus(`复制失败：${detail(error)}`, true);
      }
    },

    async load() {
      if (booted) return;
      booted = true;
      set({ loading: true });
      try {
        const library = (await invoke("studio.library")) as LibraryResponse;
        const themes = asThemes(library.themes);
        const active = library.active || themes[0]?.id || "";
        set({
          pluginId: library.pluginId || "pi.theme.studio",
          themes,
          active,
          applied: library.applied ?? "",
          registered: Array.isArray(library.registered) ? library.registered : [],
          images: asImages(library.images),
          orphans: asOrphans(library.orphans),
          defaults: library.defaults ?? EMPTY_DEFAULTS,
          runtimeApi: library.runtimeApi ?? { available: null, reason: "" },
          loaded: true,
          loading: false,
        });
        const { applied, themes: list } = get();
        const label = list.find((theme) => theme.id === active)?.label ?? active;
        get().setStatus(
          applied
            ? `已就绪 · ${list.length} 个主题 · 当前应用：${applied} · 正在编辑「${label}」`
            : `已就绪 · ${list.length} 个主题 · 改动会自动注册给宿主`,
        );
        void get().refreshImages();
      } catch (error) {
        booted = false;
        set({ loading: false });
        get().setStatus(`读取主题库失败：${detail(error)}`, true);
      }
    },

    setFilter: (filter) => set({ filter }),
    setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
    setView: (view) => set({ view }),
    setZoom: (zoom) => set({ zoom }),
    openPane: (id) => set({ pane: id, lastPane: id }),
    closePane: () => set({ pane: null }),

    selectTheme(id) {
      set({ active: id });
      const theme = get().themes.find((item) => item.id === id);
      void invoke("studio.state.put", { state: { active: id } }).catch(() => {
        /* 只是记住上次编辑的对象，失败无所谓 */
      });
      get().setStatus(`正在编辑「${theme?.label ?? id}」· 改动会自动注册`);
    },

    async applyCurrent() {
      const theme = activeTheme(get());
      if (!theme) return;
      get().setStatus(`正在应用「${theme.label}」…`);
      try {
        await get().push({ quiet: true });
        const result = await invoke("studio.apply", { id: theme.id });
        set({ applied: result?.applied ?? theme.id });
        const hasImage = imageIdsIn(theme).length > 0;
        get().setStatus(
          `已应用「${theme.label}」· ` +
            (hasImage ? "含本地图片，应用窗口稍后换色" : "应用窗口即刻换色"),
        );
        get().pushToast(
          {
            key: "studio.apply",
            kind: "success",
            title: `已应用「${theme.label}」`,
            detail: hasImage ? "含本地图片，应用窗口稍后换色" : "应用窗口已即刻换色",
          },
          { ttl: 4200 },
        );
      } catch (error) {
        get().setStatus(`应用失败：${detail(error)}`, true);
      }
    },

    newTheme() {
      const { themes } = get();
      const taken = new Set(themes.map((theme) => theme.id));
      let index = 1;
      while (taken.has(`custom-${index}`)) index += 1;
      const id = `custom-${index}`;
      const theme: Theme = {
        id,
        label: `自定义 ${index}`,
        base: themeBase(activeTheme(get())),
        tokens: {},
        regions: {},
      };
      set({ themes: [...themes, theme] });
      get().selectTheme(id);
      void get().push({ quiet: true });
      get().setStatus(`已新建「${theme.label}」· 改完会自动注册，点「应用」切换过去`);
    },

    duplicateTheme(id) {
      const { themes } = get();
      const source = themes.find((theme) => theme.id === id);
      if (!source) return;
      const taken = new Set(themes.map((theme) => theme.id));
      let copyId = `${id}-copy`;
      let index = 2;
      while (taken.has(copyId)) {
        copyId = `${id}-copy-${index}`;
        index += 1;
      }
      const copy: Theme = {
        ...JSON.parse(JSON.stringify(source)),
        id: copyId,
        label: `${source.label} 副本`.slice(0, 64),
        builtin: false,
      };
      const next = themes.flatMap((theme) => (theme.id === id ? [theme, copy] : [theme]));
      set({ themes: next });
      get().selectTheme(copyId);
      void get().push({ quiet: true });
      get().setStatus(`已复制为「${copy.label}」`);
    },

    deleteTheme(id) {
      const { themes, active, applied } = get();
      const theme = themes.find((item) => item.id === id);
      if (!theme) return;
      if (typeof window.confirm === "function" && !window.confirm(`删除「${theme.label}」？`)) return;
      void invoke("studio.theme.remove", { id }).catch((error) => {
        get().setStatus(`删除失败：${detail(error)}`, true);
      });
      const next = themes.filter((item) => item.id !== id);
      set({
        themes: next,
        active: active === id ? (next[0]?.id ?? "") : active,
        applied: applied === id ? "" : applied,
      });
      get().setStatus(`已删除「${theme.label}」`);
    },

    rename(label) {
      const theme = activeTheme(get());
      if (!theme) return;
      const trimmed = label.trim().slice(0, 64);
      if (!trimmed || trimmed === theme.label) return;
      get().mutate((draft) => {
        draft.label = trimmed;
      });
      void get().push({ quiet: true });
    },

    mutate(mutator) {
      const { themes, active } = get();
      const next = themes.map((theme) => {
        if (theme.id !== active) return theme;
        const draft: Theme = JSON.parse(JSON.stringify(theme));
        mutator(draft);
        return draft;
      });
      set({ themes: next });
      scheduleSave();
    },

    commit(mutator) {
      const regionId = get().region || "shell";
      get().mutate((theme) => {
        const regions = (theme.regions ??= {});
        const region = regions[regionId] ?? {};
        mutator(region);
        // 清空的区域不留空声明。
        if (core.surfaceIsEmpty(region)) delete regions[regionId];
        else regions[regionId] = region;
      });
    },

    setToken(key, value) {
      get().mutate((theme) => {
        const tokens = (theme.tokens ??= {});
        if (!value) delete tokens[key];
        else tokens[key] = value;
      });
    },

    setSidebarImage(image) {
      get().mutate((theme) => {
        theme.sidebarImage = image;
      });
    },

    /**
     * 一键透出：把这个区域**上面**那些区域的底色设为透明，下层图片才看得到。
     *
     * 整窗还要连宿主的三个 token 一起放开 —— .app-shell / .sidebar /
     * .composer-shell 各有自己的不透明底色，值来自 bg-primary / bg-sidebar /
     * bg-composer。
     */
    revealUpper() {
      const definition = core.REGIONS.find((item) => item.id === (get().region || "shell"));
      if (!definition) return;
      const upper = core.REGIONS.filter((item) => item.depth > definition.depth);
      get().mutate((theme) => {
        const regions = (theme.regions ??= {});
        for (const item of upper) {
          regions[item.id] = { ...(regions[item.id] ?? {}), fill: "transparent" };
        }
        if (definition.id === "shell") {
          const tokens = (theme.tokens ??= {});
          tokens["bg-primary"] = "transparent";
          tokens["bg-sidebar"] = "transparent";
          tokens["bg-composer"] = "transparent";
        }
      });
      get().setStatus(
        `已把 ${upper.length} 个上层区域的底色设为透明 · ${upper.map((item) => item.label).join("、")}`,
      );
    },

    /**
     * 预读图片。
     *
     * 宿主的 plugin-asset:// 只为「已应用主题声明过的资源」服务，而面板要能预览
     * 任意主题；data: URL 一定可用，代价是内存里多一份 base64。只读一次，之后走
     * previewData 缓存。
     */
    async prefetchImages() {
      const theme = activeTheme(get());
      const cached = get().previewData;
      const missing = imageIdsIn(theme).filter((id) => !cached[id]);
      if (!missing.length) return;
      const loaded: Record<string, string> = {};
      await Promise.all(
        missing.map(async (id) => {
          try {
            const result = await invoke("studio.image.read", { id });
            if (result?.dataUrl) loaded[id] = result.dataUrl;
          } catch {
            /* 读不到就不预览这一张，不影响其它部分 */
          }
        }),
      );
      if (Object.keys(loaded).length) {
        set((state) => ({ previewData: { ...state.previewData, ...loaded } }));
      }
    },
    async push(options) {
      const theme = activeTheme(get());
      if (!theme) return;
      try {
        const result = await invoke("studio.theme.save", { theme });
        if (!options?.quiet) {
          const hasImage = imageIdsIn(theme).length > 0;
          get().setStatus(
            `已注册「${theme.label}」· ${result.bytes} 字节 CSS` +
              (hasImage ? " · 含本地图片（绝对路径）" : "") +
              (theme.id === get().applied ? " · 应用窗口已同步更新" : ""),
          );
        }
      } catch (error) {
        get().setStatus(`注册失败：${detail(error)}`, true);
      }
    },

    async copyCss() {
      const theme = activeTheme(get());
      if (!theme) return;
      const { images, previewData, pluginId } = get();
      // 复制的是**给宿主看的**那份（:root 选择器），不是预览用的 .pv-root。
      const css = core.serialize(themeBase(theme), designOf(theme), {
        resolveImage: (image) => imageUrl(image.image ?? "", images, previewData, pluginId),
      });
      try {
        await invoke("clipboard.writeText", { text: css });
        get().setStatus(`已复制「${theme.label}」的 CSS（${css.length} 字符）到剪贴板`);
        get().pushToast(
          {
            key: "studio.clipboard",
            kind: "success",
            title: `已复制「${theme.label}」的 CSS`,
            detail: `${css.length} 字符 · 给宿主用的 :root 那份`,
          },
          { ttl: 3600 },
        );
      } catch (error) {
        get().setStatus(`复制失败：${detail(error)}`, true);
      }
    },

    pickRegion: (id) => set({ region: id }),

    async refreshImages() {
      try {
        const library = (await invoke("studio.library")) as LibraryResponse;
        set({ images: asImages(library.images), orphans: asOrphans(library.orphans) });

      } catch (error) {
        get().setStatus(`刷新图片库失败：${detail(error)}`, true);
      }
    },
    async exportTheme(shell) {
      const theme = activeTheme(get());
      if (!theme) return;
      get().setStatus("正在生成预览图并打包…");
      // 先挂一条常驻的进行中提示：打包成功与否都会原地替换它，用户不会漏看结果。
      get().pushToast(
        {
          key: "studio.export",
          kind: "info",
          title: `正在导出「${theme.label}」…`,
          detail: "生成预览图后，在弹出的系统对话框里选保存目录",
        },
        { ttl: null },
      );
      try {
        const previewPng = await tryCapturePreview(shell);
        const result = await invoke("studio.theme.export", { theme, previewPng });
        if (result.canceled) {
          get().setStatus("已取消导出");
          get().pushToast(
            { key: "studio.export", kind: "info", title: "已取消导出，没有写出文件" },
            { ttl: 3200 },
          );
          return;
        }
        const path = String(result.path ?? "");
        const size = humanSize(result.bytes);
        const contents = `${size} · ${result.images ?? 0} 张图${result.preview ? " + 预览图" : ""}`;
        get().setStatus(`已导出「${theme.label}」→ ${path}（${contents}）`);
        get().pushToast({
          key: "studio.export",
          kind: "success",
          title: `已导出「${theme.label}」`,
          detail: `${path}\n${contents}`,
          mono: true,
          action: path ? { label: "复制路径", run: () => void get().copyPath(path) } : undefined,
        });
      } catch (error) {
        const message = detail(error);
        get().setStatus(`导出失败：${message}`, true, { toast: false });
        get().pushToast({ key: "studio.export", kind: "error", title: "导出失败", detail: message });
      }
    },

    async exportPreview(shell) {
      const theme = activeTheme(get());
      if (!theme) return;
      get().setStatus("正在生成预览图…");
      get().pushToast(
        {
          key: "studio.preview",
          kind: "info",
          title: "正在生成预览图…",
          detail: "在弹出的系统对话框里选保存目录",
        },
        { ttl: null },
      );
      try {
        const png = await tryCapturePreview(shell);
        if (!png) {
          const message = "这个宿主画不出预览画布（截图失败），导出已取消";
          get().setStatus(message, true, { toast: false });
          get().pushToast({
            key: "studio.preview",
            kind: "error",
            title: "预览截图失败",
            detail: message,
          });
          return;
        }
        const result = await invoke("studio.preview.save", { label: theme.label, png });
        if (result.canceled) {
          get().setStatus("已取消导出");
          get().pushToast(
            { key: "studio.preview", kind: "info", title: "已取消导出，没有写出文件" },
            { ttl: 3200 },
          );
          return;
        }
        const path = String(result.path ?? "");
        get().setStatus(`已导出预览图 → ${path}（${humanSize(result.bytes)}）`);
        get().pushToast({
          key: "studio.preview",
          kind: "success",
          title: `已导出「${theme.label}」的预览图`,
          detail: `${path}\n${humanSize(result.bytes)} · 1280×800`,
          mono: true,
          action: path ? { label: "复制路径", run: () => void get().copyPath(path) } : undefined,
        });
      } catch (error) {
        const message = detail(error);
        get().setStatus(`导出预览图失败：${message}`, true, { toast: false });
        get().pushToast({
          key: "studio.preview",
          kind: "error",
          title: "导出预览图失败",
          detail: message,
        });
      }
    },

    async importTheme() {
      get().setStatus("正在读取导出包…");
      get().pushToast(
        {
          key: "studio.import",
          kind: "info",
          title: "正在导入主题…",
          detail: "在弹出的系统对话框里选导出包（zip，或解开的那个目录）",
        },
        { ttl: null },
      );
      try {
        const result = await invoke("studio.theme.import");
        if (result.canceled) {
          get().setStatus("已取消导入");
          get().pushToast(
            { key: "studio.import", kind: "info", title: "已取消导入，主题库没有变化" },
            { ttl: 3200 },
          );
          return;
        }
        const library = (await invoke("studio.library")) as LibraryResponse;
        set({
          themes: asThemes(library.themes),
          images: asImages(library.images),
          orphans: asOrphans(library.orphans),
          active: result.imported?.id ?? get().active,
        });
        if (result.imported) {
          void invoke("studio.state.put", { state: { active: result.imported.id } }).catch(() => {});
        }
        const parts = [`已导入「${result.imported?.label ?? "主题"}」`];
        if (result.images) parts.push(`${result.images} 张图`);
        if (result.renamed?.length) parts.push(`id 改为 ${result.renamed.join("、")}`);
        if (result.missingImages?.length) parts.push(`缺 ${result.missingImages.length} 张图（已忽略）`);
        get().setStatus(parts.join(" · "));
        get().pushToast({
          key: "studio.import",
          kind: "success",
          title: `已导入「${result.imported?.label ?? "主题"}」`,
          detail: parts.slice(1).join("\n") || (result.imported ? humanSize(result.imported.bytes) : ""),
          action: result.imported
            ? { label: "应用这个主题", run: () => void get().applyCurrent() }
            : undefined,
        });
      } catch (error) {
        const message = detail(error);
        get().setStatus(`导入失败：${message}`, true, { toast: false });
        get().pushToast({ key: "studio.import", kind: "error", title: "导入失败", detail: message });
      }
    },

    async putImage(file) {
      const theme = activeTheme(get());
      if (!theme) return null;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const result = await invoke("studio.image.put", {
          bytes,
          name: file.name,
          themeId: theme.id,
        });
        await get().refreshImages();
        // 立刻把新图读成 data: URL 放进缓存，预览不用等宿主 scheme。
        try {
          const read = await invoke("studio.image.read", { id: result.id });
          set((state) => ({ previewData: { ...state.previewData, [result.id]: read.dataUrl } }));
        } catch {
          /* 读不到就退回宿主 scheme 兜底 */
        }
        const uploadSize = `${Math.max(1, Math.round(result.bytes / 1024))}KB`;
        get().setStatus(`已上传「${result.name}」· ${uploadSize}`);
        get().pushToast(
          {
            key: "studio.image",
            kind: "success",
            title: `已上传「${result.name}」`,
            detail: `${uploadSize} · 已存进插件的图片目录，主题 CSS 引用它的绝对路径`,
          },
          { ttl: 3600 },
        );
        return result.id;
      } catch (error) {
        get().setStatus(`上传失败：${detail(error)}`, true);
        return null;
      }
    },

    async removeImage(id) {
      try {
        await invoke("studio.image.remove", { id });
        set((state) => {
          const previewData = { ...state.previewData };
          delete previewData[id];
          return { previewData };
        });
        await get().refreshImages();
        // 引用被清掉的主题要重新注册一次，否则窗口上还挂着已经删掉的图。
        await get().push({ quiet: true });
        get().setStatus("已删除这张图片，引用它的区域已改为「没有图片」");
      } catch (error) {
        get().setStatus(`删除失败：${detail(error)}`, true);
      }
    },

    async pruneImages() {
      try {
        const result = await invoke("studio.image.prune");
        await get().refreshImages();
        get().setStatus(
          result.removed ? `已清理 ${result.removed} 张没有引用的图片` : "没有可清理的图片",
        );
      } catch (error) {
        get().setStatus(`清理失败：${detail(error)}`, true);
      }
    },

    async dropOrphan(path) {
      try {
        await invoke("studio.image.drop", { path });
        await get().refreshImages();
        get().setStatus("已删除这个孤立文件");
      } catch (error) {
        get().setStatus(`删除失败：${detail(error)}`, true);
      }
    },
  };
});

/* ------------------------------------------------------------ 宿主外观 */

/**
 * 只取基调与语言：工坊自己的界面用 --ui-* 变量，永远稳定可读。
 *
 * 刻意不订阅宿主注入的插件主题 CSS —— 对一个主题编辑器来说那恰恰是错的：正在编辑
 * 的主题会顺着 .sidebar-body / .work-panel-main 这些真实选择器糊到面板自己的
 * 预览上，预览就不再等于「这份设计单独长什么样」。
 */
export function initAppearance(): () => void {
  const root = document.documentElement;
  const apply = (raw: { base?: string; locale?: string } | undefined) => {
    const value = raw?.base;
    const base =
      value === "light" || value === "dark"
        ? value
        : window.matchMedia?.("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    const locale = String(raw?.locale ?? navigator.language ?? "").toLowerCase();
    root.dataset.theme = base;
    root.dataset.lang = locale.startsWith("zh") ? "zh" : "en";
    root.lang = locale.startsWith("zh") ? "zh-CN" : "en";
  };
  apply({ locale: navigator.language });
  void invoke("app.getAppearance")
    .then(apply)
    .catch(() => {
      /* 旧宿主没有这个 channel：保留上面那帧 */
    });
  return on("appearance:changed", (payload) => apply(payload as { base?: string; locale?: string }));
}
