/**
 * 主题工坊 — PI-Desktop 插件 entry.
 *
 * 插件 id: pi.theme.studio
 * 命令 id: themeStudio.open
 * 面板:   renderer/index.html（ui.panel 独立窗口 + contributes.views 停靠视图共用）
 *
 * 走 ADR 0249 的运行时主题通道，因此**不写任何文件**：
 *
 *   pi.themes.upsert({ id, label, base, css })   注册/更新自己的主题
 *   pi.themes.remove(themeId)                     删除自己的主题
 *   pi.themes.list()                              列出自己的主题
 *   pi.app.setTheme(themeId)                      直接把某个主题应用为应用主题
 *
 * 主题库整份存在插件自己的 settings 里（studioState），每次加载时重新注册：
 * 运行时注册表在宿主内存中，插件重载后需要重建，这也让「主题存在 = 插件启用」
 * 成为自然语义。
 *
 * 校验与序列化都复用同目录的 lib/theme-core.js —— 面板预览和落盘注册用的是
 * 同一套 token 表、同一套白名单、同一个序列化实现，两边不可能漂移。
 *
 * 宿主注入全局 `pi`。
 */

const fs = require("node:fs");
const path = require("node:path");

const core = require("./lib/theme-core.js");
const presets = require("./lib/presets.js");

const COMMAND_ID = "themeStudio.open";
const STATE_KEY = "studioState";

/** 与宿主 THEME_LOCAL_ID_PATTERN 一致。 */
const THEME_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const MAX_LABEL = 64;
const MAX_SURFACE_VALUE = 200;

const BUILTIN_PREFERENCES = ["system", "light", "dark"];

/** 承载本地图片的静态主题：路径固定，工坊重写它的 CSS。 */
 const LIVE_THEMES = {
   dark: { id: "live", label: "主题工坊 Live", file: "themes/live.css" },
   light: { id: "live-light", label: "主题工坊 Live (Light)", file: "themes/live-light.css" },
 };

 function liveThemeFor(base) {
   return base === "light" ? LIVE_THEMES.light : LIVE_THEMES.dark;
 }
 /**
  * 上传图片的上限 —— 必须与宿主对齐，**故意保留**这道检查。
  *
  * 宿主对「一个主题声明的资源合计」有 4MB 硬上限，而且它是 bail! 级别的：
  * 超了不是"这张图不生效"，而是 crates/host-core/src/plugins/validation.rs:238
  * 直接判 PLUGIN_INVALID，**整个插件加载不了**，用户还得手动删文件才能恢复。
  * 所以这里提前拦一道，报可读的错；它不限制你，它保护你不要把插件弄坏。
  */
 const MAX_ASSET_BYTES = 4 * 1024 * 1024;
 /** 上传图片的落地目录（相对插件包）。 */
 /** 图片落在插件**数据目录**（不在插件包里）：包内写文件会触发开发监听器重载。 */
const IMG_DIR_NAME = "images";
/** 图片 id 的合法形状：时间戳命名（也兼容旧的 16 位内容哈希）。 */
const IMAGE_ID_RE = /^[0-9A-Za-z][0-9A-Za-z_-]{7,63}$/;

/** 未知面板 channel 会转发到这里；白名单之外一律报错。 */
 const PANEL_HANDLERS = {
   "studio.library": () => readLibrary(),
   "studio.theme.save": (payload) => saveTheme(payload),
   "studio.theme.remove": (payload) => removeTheme(payload),
   "studio.apply": (payload) => applyTheme(payload),
   "studio.state.put": (payload) => writeState(payload),
   "studio.image.put": (payload) => putImage(payload),
   "studio.image.remove": (payload) => removeImage(payload),
   "studio.image.prune": () => pruneImages(),
  "studio.image.drop": (payload) => dropOrphan(payload),
  "studio.image.read": (payload) => readImageBytes(payload),
 };

/* ---------------------------------------------------------------- 读取 */

async function readState() {
  const settings = await pi.plugin.getSettings();
  const state = settings && settings[STATE_KEY];
  return state && typeof state === "object" ? state : {};
}

/**
 * 首帧的主题库：首次运行时从预设种下去，之后完全由用户数据决定。
 * 只返回面板需要的东西（含一次性下发的 data URL，预览与注册共用同一份）。
 */
async function readLibrary() {
  const state = await readState();
  const themes = Array.isArray(state.themes) && state.themes.length
    ? state.themes
    : presets.clone();
  const registered = await safeList();
  return {
     pluginId: pi.plugin.getId(),
     runtimeApi: await detectRuntimeApi(),
    themes,
    active: typeof state.active === "string" ? state.active : "",
    applied: typeof state.applied === "string" ? state.applied : "",
    registered,
     // 注意：images / live 是库根上的字段，不是 defaults 的属性。
     images: imageList(state),
    // 盘上有、但登记表里没有的文件（见 orphanFiles）。
    orphans: orphanFiles(state.images || {}),
     live: { dark: LIVE_THEMES.dark, light: LIVE_THEMES.light },
     defaults: {
       dark: core.defaults("dark"),
       light: core.defaults("light"),
     },
  };
}

async function safeList() {

  try {
    return await pi.themes.list();
  } catch {
    return [];
  }
}

/**
 * 宿主运行时主题 API（ADR 0249）是否可用。
 *
 * PI-Desktop < 0.14.8 的插件进程里没有 `pi.themes`，直接调用会抛出
 * "Cannot read properties of undefined (reading 'upsert')" —— 对使用者毫无
 * 意义。所以启动时探测一次，之后所有写操作都给出可执行的提示。
 */
let runtimeApi = { available: null, reason: "" };

function missingApiError() {
  return new Error(
    "宿主的运行时主题 API 不可用（pi.themes / pi.app.setTheme）。" +
      "本插件需要 PI-Desktop ≥ 0.14.8；如果应用是从旧代码启动的，请从更新后的代码重启。" +
      (runtimeApi.reason ? " 原始错误：" + runtimeApi.reason : ""),
  );
}

async function detectRuntimeApi() {
  if (runtimeApi.available !== null) return runtimeApi;
  if (!pi.themes || typeof pi.themes.upsert !== "function") {
    runtimeApi = { available: false, reason: "pi.themes 不存在" };
    return runtimeApi;
  }
  try {
    await pi.themes.list();
    runtimeApi = { available: true, reason: "" };
  } catch (error) {
    runtimeApi = { available: false, reason: error.message };
  }
  return runtimeApi;
}

function requireRuntimeApi() {
  if (runtimeApi.available === false) throw missingApiError();
}

/* ------------------------------------------------------------ 校验 */

function themeIdError(id) {
  if (typeof id !== "string" || !THEME_ID_PATTERN.test(id)) {
    return `主题 id 必须是 [a-zA-Z][a-zA-Z0-9_-]{0,63}：${String(id || "(空)")}`;
  }
  return "";
}

/**
 * 校验一个主题设计，返回规范化后的副本。
 * 抛错而不是静默丢弃 —— 面板收到的就是可以直接展示给用户的原因。
 */
function normalizeTheme(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("主题必须是一个对象");
  }
  const idError = themeIdError(raw.id);
  if (idError) throw new Error(idError);

  const base = raw.base === "light" ? "light" : "dark";
  const label = String(raw.label || raw.id).trim().slice(0, MAX_LABEL) || raw.id;

  const tokens = {};
  const rawTokens = raw.tokens && typeof raw.tokens === "object" ? raw.tokens : {};
  for (const [key, value] of Object.entries(rawTokens)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || value.length > 220) {
      throw new Error(`--ds-${key} 的值不合法`);
    }
    if (!core.isTokenValueAllowed(key, value)) {
      throw new Error(`--ds-${key} 的值不被允许：${value.slice(0, 40)}`);
    }
    tokens[key] = core.normalizeColor(value);
  }

   // 侧边栏背景：结构化三选一（none / gradient / 图片），不接受自由文本。
   const sidebarImage = normalizeSidebarImage(raw.sidebarImage);

   // 背景区域按真实 DOM 层级逐个校验；右栏不接受图片（嵌入的是原生视图）。
   const regions = {};
   const rawRegions = raw.regions && typeof raw.regions === "object" ? raw.regions : {};
   for (const region of core.REGIONS) {
     const value = rawRegions[region.id];
     if (!value || typeof value !== "object") continue;
     regions[region.id] = normalizeRegion(region.id, value, region.fillOnly === true);
   }

   return { id: raw.id, label, base, tokens, sidebarImage, regions };
}

 /** 侧边栏背景 → 结构化三选一（none / gradient / 图片）。 */
 function normalizeSidebarImage(raw) {
   if (!raw || typeof raw !== "object" || raw.on !== true) return { on: false, kind: "none" };
   if (raw.kind === "gradient") {
     const from = core.isColorValue(raw.from) ? core.normalizeColor(raw.from) : "transparent";
     const to = core.isColorValue(raw.to) ? core.normalizeColor(raw.to) : "transparent";
     const angle = Number(raw.angle);
     return {
       on: true,
       kind: "gradient",
       angle: isFinite(angle) ? Math.max(0, Math.min(360, Math.round(angle))) : 160,
       from,
       to,
     };
   }
   // 图片只有「用户选的本地 PNG」这一种：读到哈希就算数，读不到就当没设。
   // 认不出的形状（旧版本的 kind:"builtin" / "slot"）优雅降级成「没有图片」，
   // 降级好过让整个主题加载失败。
   return normalizeImage(raw) || { on: false, kind: "none" };
 }

 /**
  * 一个区域的图片设置。fillOnly 的区域不接受图片。
  *
  * 只有一种输入：面板上传后得到的图片哈希。**没有哈希 = 没有图片**，返回
  * undefined 让调用方跳过 —— 面板上「刚打开开关还没选文件」是正常中间态，
  * 不该让整次保存失败。存在性在 saveTheme 里对着登记表检查（那里才有登记表）。
  */
 function normalizeImage(raw) {
   const id = String(raw.image || "").trim();
   if (!IMAGE_ID_RE.test(id)) return undefined;
   const out = { on: true, image: id };
   out.size = core.BACKGROUND_SIZES.indexOf(raw.size) !== -1 ? raw.size : "cover";
   out.repeat = core.BACKGROUND_REPEATS.indexOf(raw.repeat) !== -1 ? raw.repeat : "no-repeat";
   out.position =
     core.BACKGROUND_POSITIONS.indexOf(raw.position) !== -1 ? raw.position : "center";
   return out;
 }

 /** 一个区域的设置。取值全部走白名单，越界的抛错而不是静默丢弃。 */
 function normalizeRegion(id, raw, fillOnly) {
   const out = {};
   if (raw.fill !== undefined && raw.fill !== "") {
     if (!core.isColorValue(raw.fill)) throw new Error(`${id}.fill 必须是颜色`);
     out.fill = core.normalizeColor(raw.fill);
   }
   if (raw.gradient && raw.gradient.on === true) {
     if (!core.isColorValue(raw.gradient.from) || !core.isColorValue(raw.gradient.to)) {
       throw new Error(`${id}.gradient 的两个色标必须是颜色`);
     }
     const angle = Number(raw.gradient.angle);
     out.gradient = {
       on: true,
       angle: isFinite(angle) ? Math.max(0, Math.min(360, Math.round(angle))) : 160,
       from: core.normalizeColor(raw.gradient.from),
       to: core.normalizeColor(raw.gradient.to),
     };
   }
   if (!fillOnly && raw.image && typeof raw.image === "object") {
     const image = normalizeImage(raw.image);
     if (image) out.image = image;
   }
   const blur = Number(raw.blur);
   if (isFinite(blur) && blur > 0) out.blur = Math.min(core.MAX_BLUR, Math.round(blur));
   if (typeof raw.radius === "string" && raw.radius.trim()) {
     const radius = raw.radius.trim();
     if (!/^\d{1,3}px$/.test(radius)) throw new Error(`${id}.radius 必须形如 12px`);
     out.radius = radius;
   }
   return out;
 }

/* ------------------------------------------------------------ 注册 */

/** 用 lib/theme-core.js 生成 CSS —— 与面板预览完全同一套实现。 */
function buildCss(theme, images) {
  return core.serialize(theme.base, theme, {
    rootSelector: core.selectorFor(theme.base),
    resolveImage: (image) => imagePath(image, images),
    note: `${theme.label} —— 由主题工坊 pi.theme.studio 生成。`,
  });
}

/**
 * 图片怎么落地：用户上传的 PNG → 包内相对路径，由宿主改写成 plugin-asset://。
 * 只有静态贡献的主题能用 —— 运行时注册的 CSS 走的是不带资源解析器的
 * sanitizeThemeCss，url() 只能是 data:（ADR 0249）。
 */
/**
 * 登记表里的这张图现在还能用吗？
 *
 * 登记表（settings 里的 studioState.images）可能比文件活得久：文件被插件之外
 * 的任何东西删掉之后，记录还在。所以「能用」= 有记录 **且** 文件真的在盘上。
 */
function imageUsable(id, images) {
  const entry = images && images[String(id || "")];
  if (!entry) return false;
  try {
    return fs.statSync(entry.path).isFile();
  } catch {
    return false;
  }
}

/**
 * 图片怎么落地：**绝对路径**。
 *
 * 宿主现在允许主题 CSS 直接引用绝对路径（ADR 0255），所以这里不再需要把文件
 * 复制进插件包 —— 路径写进 CSS，宿主按文件系统提供字节。
 */
function imagePath(image, images) {
  if (!image || image.on !== true || !imageUsable(image.image, images)) return "";
  // 正斜杠：CSS 字符串里的 `\` 是转义前缀（`C:\Users` 会变成 `C:Users`），
  // 而宿主与 Node 都接受 `/`。
  return String(images[String(image.image)].path).replace(/\\/g, "/");
}

 /** 这份设计用到了上传的图片吗？（有图片就说明 CSS 里会出现绝对路径） */
function usesImages(theme, images) {
  const sides = [theme && theme.sidebarImage];
  const regions = (theme && theme.regions) || {};
  for (const id of Object.keys(regions)) sides.push(regions[id] && regions[id].image);
  return sides.some((image) => image && image.on === true && imageUsable(image.image, images));
}

 /** 这份设计引用了哪些图片哈希（用于校验与裁剪）。 */
 function referencedImages(theme) {
   const out = new Set();
   const sides = [theme && theme.sidebarImage];
   const regions = (theme && theme.regions) || {};
   for (const id of Object.keys(regions)) sides.push(regions[id] && regions[id].image);
   for (const image of sides) {
     if (image && image.on === true && image.image) {
       out.add(String(image.image));
     }
   }
   return out;
 }

 /**
 * 清掉还没有绝对路径的图片记录。
 *
 * v0.5.0 的登记表存的是包内相对路径（`file`），而包内图片已经不再使用：这些记录既读
 * 不到文件，也没有可用的 path，只会让读取/预览抛错。一并把设计里对它们的引用清成
 * 「没有图片」，主题照常可用。
 */
function migrateImages(state) {
  const images = state.images || {};
  const stale = new Set(
    Object.keys(images).filter((id) => {
      const entry = images[id];
      return !entry || typeof entry.path !== "string" || !entry.path;
    }),
  );
  if (!stale.size) return { changed: false, dropped: 0 };

  const next = {};
  for (const id of Object.keys(images)) {
    if (!stale.has(id)) next[id] = images[id];
  }
  const themes = (Array.isArray(state.themes) ? state.themes : []).map((theme) => {
    let touched = false;
    for (const id of referencedImages(theme)) {
      if (stale.has(id)) touched = true;
    }
    if (!touched) return theme;
    let next2 = theme;
    for (const id of stale) next2 = withImageDetached(next2, id);
    return next2;
  });
  return { changed: true, dropped: stale.size, images: next, themes };
}

/**
 * 重新注册若干主题（图片被删/被换之后调用）。
 *
 * 运行时通道就是消息，不写文件，所以这一步不会重载插件。
 */
async function refreshThemes(themes, images) {
  requireRuntimeApi();
  let refreshed = 0;
  for (const theme of themes) {
    try {
      await registerTheme(normalizeTheme(theme), images);
      refreshed += 1;
    } catch {
      /* 注册不了就跳过，下一次保存会再试 */
    }
  }
  return refreshed;
}

async function registerTheme(theme, images) {
   requireRuntimeApi();
   if (!pi.themes || typeof pi.themes.upsert !== "function") throw missingApiError();
   const css = buildCss(theme, images);
   await pi.themes.upsert({ id: theme.id, label: theme.label, base: theme.base, css });
   return css.length;
 }

/** 宿主只接受「当前已注册」的 id，所以先注册再应用。 */
async function registeredThemeId(localId) {
  const list = await safeList();
  const full = `plugin:${pi.plugin.getId()}:${localId}`;
  for (const row of list) {
    if (row.themeId === localId || row.id === full) return row.id;
  }
  return null;
}

/* ------------------------------------------------------------ 动作 */

 async function saveTheme(payload) {
   const theme = normalizeTheme(payload && payload.theme);
   const state = await readState();
   const themes = Array.isArray(state.themes) && state.themes.length ? state.themes : presets.clone();

   const index = themes.findIndex((entry) => entry && entry.id === theme.id);
   if (index === -1) {
     themes.push(theme);
   } else {
     // 保留 builtin 标记，预设被编辑后仍然是「原本那套预设」。
     themes[index] = { ...theme, ...(themes[index].builtin ? { builtin: true } : {}) };
   }

   // 两条落盘通道，工坊按设计内容自动选：
   //   运行时注册 —— 立刻生效；CSS 里 url() 只能是 data:（ADR 0249），所以没有
   //                 图片的主题走这条。
   //   静态贡献   —— 写 themes/live.css；图片只能走这条（plugin-asset://），
   //                 代价是插件重载后才生效（约 0.3s）。
   const images = state.images || {};
   for (const hash of referencedImages(theme)) {
     if (!images[hash]) {
       throw new Error(`主题引用了不存在的图片（${hash}）—— 请重新上传那张图`);
     }
     if (!imageUsable(hash, images)) {
       throw new Error(
         `图片文件已不在磁盘上（${images[hash].path}）—— 请重新上传「${images[hash].name || hash}」`,
       );
     }
   }
   // 只有一条通道：运行时注册。宿主现在会解析主题 CSS 里的绝对路径（ADR 0255），
   // 所以图片不再需要复制进插件包，也就不需要静态贡献与 manifest 声明。
   const result = { channel: "runtime", bytes: await registerTheme(theme, images) };
   await persist({ ...state, themes, active: theme.id });
   const fullId = await registeredThemeId(theme.id);
   return { ok: true, id: theme.id, ...result, fullId };
 }

 

 /* --------------------------------------------------- 图片登记与声明 */

 /** 登记表 → 数组（面板用）。 */
/**
 * 图片登记表 → 数组（面板用）。
 *
 * `id` 是落地文件名去掉扩展名的那一段（时间戳），不是内容哈希：同一张图上传两次
 * 就是两个文件、两条记录 —— 一张图只属于一个主题，删它不必管别人。
 */
function imageList(state) {
  const images = (state && state.images) || {};
  return Object.keys(images)
    .map((id) => ({ ...images[id], id }))
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
}

/** 落地文件名：本地时间戳 + 毫秒 + 4 位随机，肉眼可读且不会重名。 */
function imageStamp() {
  const now = new Date();
  const pad = (value, width) => String(value).padStart(width, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}` +
    `-${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}` +
    `-${pad(now.getMilliseconds(), 3)}`;
  const salt = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${stamp}-${salt}`;
}

/** 把某个主题里对这张图的引用去掉（区域 + 侧边栏）。 */
function withImageDetached(theme, id) {
  const strip = (image) =>
    image && image.on === true && String(image.image || "") === id
      ? { ...image, on: false, image: "" }
      : image;
  const clone = { ...theme, sidebarImage: strip(theme.sidebarImage) };
  const regions = theme.regions || {};
  const next = {};
  for (const regionId of Object.keys(regions)) {
    const region = regions[regionId] || {};
    next[regionId] = { ...region, image: strip(region.image) };
  }
  clone.regions = next;
  return clone;
}

 /**
 * 登记表 → 真实存在的包内相对路径。
 *
 * manifest 的 assets[] 与静态 CSS 的 url() 必须用同一份判据：声明里出现一个不存在的
 * 文件，宿主会以 PLUGIN_INVALID: asset missing 拒掉**整个插件**，所以只声明真的在盘上的。
 */






/** 把相对路径解析限制在 themes/img 之内。 */
/**
 * 图片在插件数据目录里的绝对路径。
 *
 * 数据目录不在开发插件监听器范围内，所以上传/换图不会再触发插件重载，
 * 也就不会把面板窗口连带关掉。
 */
let imagesDir = "";
async function ensureImagesDir() {
  if (imagesDir) return imagesDir;
  const base = await pi.plugin.getDataPath();
  imagesDir = path.join(base, IMG_DIR_NAME);
  fs.mkdirSync(imagesDir, { recursive: true });
  return imagesDir;
}

/** 登记表里这张图的绝对路径（图片永远在数据目录里）。 */
function imageTarget(id) {
  if (!imagesDir) throw new Error("图片目录尚未初始化");
  return path.join(imagesDir, `${String(id || "")}.png`);
}

 function totalImageBytes(images) {
   let total = 0;
   for (const hash of Object.keys(images || {})) total += Number(images[hash].bytes) || 0;
   return total;
 }

 

/**
 * 上传一张 PNG。
 *
 * 规则：文件名 = 时间戳，每次上传都是新文件（不按内容去重）；一张图只属于一个
 * 主题（owner = 正在编辑的那个）；没有数量上限。唯一的硬限制来自宿主：
 * 单个主题声明的资源合计 ≤ 4MB，而静态贡献只承载当前应用的那个主题。
 */
/**
 * 上传一张 PNG —— 写进插件数据目录，**不碰插件包**。
 *
 * 因此不会触发开发插件监听器重载：上传完面板还在，预览立刻更新。
 * 文件名 = 时间戳，每次上传都是新文件；一张图只属于一个主题（owner）。
 */
async function putImage(payload) {
  const bytes = payload && payload.bytes;
  const length = bytes && typeof bytes.length === "number" ? bytes.length : 0;
  if (!length) throw new Error("图片为空");
  if (length > MAX_ASSET_BYTES) {
    throw new Error(
      `宿主规定单个主题的资源合计不能超过 ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)}MB，` +
        `这张图本身就有 ${(length / 1024 / 1024).toFixed(1)}MB`,
    );
  }
  const isPng =
    length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isPng) throw new Error("只接受 PNG（请先转成 .png 再选）");

  await ensureImagesDir();
  const state = await readState();
  const owner = String((payload && payload.themeId) || "").trim();
  const buffer = Buffer.from(bytes);
  const id = imageStamp();
  const target = imageTarget(id);
  fs.writeFileSync(target, buffer);
  const images = { ...(state.images || {}) };
  images[id] = {
    path: target,
    bytes: length,
    name: String((payload && payload.name) || "").trim().slice(0, 120) || `${id}.png`,
    addedAt: Date.now(),
    owner,
  };
  await persist({ ...state, images });
  return {
    ok: true,
    id,
    hash: id,
    path: target,
    name: images[id].name,
    bytes: images[id].bytes,
    owner,
    total: totalImageBytes(images),
  };
}

/**
 * 删除一张图片：文件 + 登记 + 所有设计里对它的引用一起清掉。
 *
 * 一张图只属于一个主题，所以删它不需要先让谁「松手」：引用它的设计会被自动改成
 * 「没有图片」，不会留下引用不到文件的主题。
 */
async function removeImage(payload) {
  const id = String((payload && (payload.id || payload.hash)) || "").trim();
  const state = await readState();
  const images = { ...(state.images || {}) };
  const entry = images[id];
  if (!entry) throw new Error(`图片不存在：${id || "(空)"}`);

  try {
    fs.unlinkSync(entry.path);
  } catch {
    /* 文件可能已经不在了 */
  }
  delete images[id];

  const themes = (Array.isArray(state.themes) ? state.themes : []).map((theme) =>
    referencedImages(theme).has(id) ? withImageDetached(theme, id) : theme,
  );
  await persist({ ...state, images, themes });

  // 引用被清掉的主题要重新注册一次，否则窗口上还挂着那张已经删掉的图。
  await refreshThemes(themes, images);
  return { ok: true, total: totalImageBytes(images) };
}

 /** 清理没有任何设计引用的图片（文件 + 登记 + manifest 声明一起清）。 */
 async function pruneImages() {
   const state = await readState();
   const images = { ...(state.images || {}) };
   const themes = Array.isArray(state.themes) ? state.themes : [];
   const used = new Set();
   for (const theme of themes) {
     for (const hash of referencedImages(theme)) used.add(hash);
   }

   let removed = 0;
   for (const hash of Object.keys(images)) {
     if (used.has(hash)) continue;
     try {
       fs.unlinkSync(images[hash].path);
     } catch {
       /* 已不在 */
     }
     delete images[hash];
     removed += 1;
   }
   if (!removed) return { ok: true, removed: 0, total: totalImageBytes(images) };

   await persist({ ...state, images });
   return { ok: true, removed, total: totalImageBytes(images) };
 }

/**
 * 图片目录里没有登记记录的文件（孤儿）。
 *
 * 典型来源：插件被卸载/重装后登记表被清空，但文件还在盘上。它们既不会被声明、
 * 也不会被任何主题引用，只是白占地方 —— 所以列出来让用户可以自己清掉。
 */
/**
 * 数据目录里没有登记记录的文件（孤儿）。
 *
 * 典型来源：登记表被清空（例如插件被卸载重装）但文件还在。它们不再被任何主题
 * 引用，只是白占地方 —— 列出来让用户自己清。
 */
function orphanFiles(images) {
  if (!imagesDir) return [];
  const registered = new Set(imageList({ images }).map((entry) => entry.path));
  let names = [];
  try {
    names = fs.readdirSync(imagesDir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (!/\.png$/i.test(name)) continue;
    const full = path.join(imagesDir, name);
    if (registered.has(full)) continue;
    let bytes = 0;
    try {
      bytes = fs.statSync(full).size;
    } catch {
      continue;
    }
    out.push({ path: full, bytes, name });
  }
  return out;
}

/** 删掉一个孤儿文件。只接受 themes/img 下按时间戳命名的图片文件。 */
/** 删掉一个孤儿文件。只接受图片目录里的 .png。 */
async function dropOrphan(payload) {
  const target = String((payload && (payload.path || payload.file)) || "").trim();
  if (!target || !imagesDir) throw new Error(`只能清理图片目录里的文件：${target || "(空)"}`);
  if (path.dirname(target) !== path.resolve(imagesDir)) {
    throw new Error(`只能清理图片目录里的文件：${target}`);
  }
  if (!/\.png$/i.test(target)) throw new Error(`只清理 PNG：${target}`);
  const state = await readState();
  const images = state.images || {};
  if (imageList({ images }).some((entry) => entry.path === target)) {
    throw new Error("这张图还在登记表里，请用「删除文件」而不是「清理未登记文件」");
  }
  try {
    fs.unlinkSync(target);
  } catch {
    /* 已经不在了 */
  }
  return { ok: true, orphans: orphanFiles(images) };
}

/**
 * 把一张图读成 data: URL。面板预览用它兜底：宿主 scheme 在面板会话里不一定可用，
 * 而 data: 一定可用（宿主自己的主题规则也只允许 data:）。
 */
async function readImageBytes(payload) {
  const id = String((payload && (payload.id || payload.hash)) || "").trim();
  const state = await readState();
  const entry = (state.images || {})[id];
  if (!entry) throw new Error(`图片不存在：${id || "(空)"}`);
  if (typeof entry.path !== "string" || !entry.path) {
    throw new Error(`这张图是旧版本的记录（没有绝对路径）：${entry.name || id} —— 请重新上传`);
  }
  const bytes = fs.readFileSync(entry.path);
  return {
    ok: true,
    id,
    mime: "image/png",
    bytes: bytes.length,
    dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
  };
}

async function removeTheme(payload) {
  const id = String((payload && payload.id) || "");
  const state = await readState();
  const themes = (Array.isArray(state.themes) ? state.themes : []).filter(
    (entry) => entry && entry.id !== id,
  );
  try {
    await pi.themes.remove(id);
  } catch {
    // 宿主里本来就没有（比如上次启动失败）—— 本地删掉即可。
  }
  await persist({
    ...state,
    themes,
    active: state.active === id ? "" : state.active,
    applied: state.applied === id ? "" : state.applied,
  });
  return { ok: true, remaining: themes.length };
}

async function applyTheme(payload) {
   requireRuntimeApi();
   const raw = String((payload && payload.id) || "").trim();
  if (BUILTIN_PREFERENCES.indexOf(raw) !== -1) {
     if (!pi.app || typeof pi.app.setTheme !== "function") throw missingApiError();
     await pi.app.setTheme(raw);
    const state = await readState();
    await persist({ ...state, applied: raw });
    return { ok: true, applied: raw };
  }

   // 主题可能以两种方式存在，而且不一定叫它自己的名字：
   //   没有图片 → 运行时注册，宿主 id 是 plugin:<插件>:<主题 id>
   //   有图片   → 写进静态贡献的 live.css，宿主 id 是 plugin:<插件>:live（或 live-light）
   // 还有一层时序：插件刚重载完时运行时注册表还是空的。所以这里按通道解析，
   // 解析不到就现注册一次，而不是直接报「尚未注册」。
   const current = await readState();
   const known = Array.isArray(current.themes) && current.themes.length
     ? current.themes
     : presets.clone();
   const theme = known.find((entry) => entry && entry.id === raw);
   const images = current.images || {};

   // 主题一定以它自己的 id 在运行时注册表里（现在只有这一条通道）。
   let full = await registeredThemeId(raw);
   if (!full && theme) {
     await registerTheme(theme, images);
     full = await registeredThemeId(raw);
   }
   if (!full) {
     throw new Error(`应用失败：宿主里找不到主题 ${raw}（保存一次后重试）`);
   }
   if (!pi.app || typeof pi.app.setTheme !== "function") throw missingApiError();
   await pi.app.setTheme(full);
   await persist({ ...current, applied: raw, themes: known });
   return { ok: true, applied: raw, fullId: full };
}

/* ------------------------------------------------------------ 持久化 */

async function persist(state) {
  // 不设自加的大小上限：宿主对插件设置没有限制，用户想存多少主题就存多少。
  const encoded = JSON.stringify(state);
  await pi.plugin.setSettings({ [STATE_KEY]: state });
  return encoded.length;
}

async function writeState(payload) {
  const next = payload && payload.state;
  if (!next || typeof next !== "object" || Array.isArray(next)) {
    throw new Error("state 必须是一个对象");
  }
  const state = await readState();
  const merged = { ...state, ...next };
  return { ok: true, bytes: await persist(merged) };
}

/* ------------------------------------------------------------ 生命周期 */

async function onLoad() {
  await pi.commands.register({
    id: COMMAND_ID,
    title: "主题工坊：打开",
    keywords: ["theme", "studio", "主题", "工坊", "配色", "外观", "渐变", "背景"],
    category: "Appearance",
    run: async () => {
      await pi.ui.openPanel({ title: "主题工坊" });
    },
  });

   // 先确认宿主的运行时主题 API 在不在：不在就没必要逐个主题去撞同一面墙，
   // 直接给一条能照着做的日志。
   // 图片目录要先建好：登记表里存的是绝对路径，缺失时读取会失败。
   // 老宿主的 pi.plugin 里没有 getDataPath，此时图片功能不可用（主题本身照常注册）。
   try {
     await ensureImagesDir();
   } catch (error) {
     console.warn(`[theme-studio] 图片功能不可用：${error.message}`);
   }

   const api = await detectRuntimeApi();
   if (!api.available) {
    console.warn(
      `[theme-studio] 运行时主题 API 不可用，本次不注册主题（${api.reason}）。` +
        "需要 PI-Desktop ≥ 0.14.8；若应用是从旧代码启动的，请从更新后的代码重启。",
    );
    return;
  }

   // 重建运行时注册表。宿主的内存注册表随插件卸载清空，所以每次加载都要重新注册，
   // 这也让「主题存在 = 插件启用」成为自然语义。
   let state = await readState();
   const migration = migrateImages(state);
   if (migration.changed) {
     state = { ...state, images: migration.images, themes: migration.themes };
     await persist(state);
     console.log(`[theme-studio] 已清理 ${migration.dropped} 条没有绝对路径的旧图片记录`);
   }
   const themes = Array.isArray(state.themes) && state.themes.length ? state.themes : presets.clone();
   const images = state.images || {};

   // 全部走运行时注册：宿主会解析 CSS 里的绝对路径（ADR 0255），所以这里不写任何
   // 插件包内文件 —— 也就不会触发开发监听器重载。
   let viaRuntime = 0;
   let failed = 0;
   for (const theme of themes) {
     try {
       await registerTheme(normalizeTheme(theme), images);
       viaRuntime += 1;
     } catch (error) {
       failed += 1;
       console.warn(`[theme-studio] 跳过无法注册的主题 ${theme && theme.id}: ${error.message}`);
     }
   }
   if (!state.themes) await persist({ ...state, themes });
   console.log(
     `[theme-studio] 运行时注册 ${viaRuntime} 个主题` +
       (failed ? `，跳过 ${failed} 个` : ""),
   );
 }

async function onUnload() {
  // 运行时主题由宿主在插件卸载时一并清理；这里只需摘掉命令。
  await pi.commands.unregister(COMMAND_ID);
}

async function onPanelInvoke(channel, payload) {
  const handler = PANEL_HANDLERS[channel];
  if (!handler) throw new Error(`unsupported panel channel: ${channel}`);
  return handler(payload || {});
}

module.exports = { onLoad, onUnload, onPanelInvoke };
