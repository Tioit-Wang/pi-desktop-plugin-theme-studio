/**
 * 主题模型 —— token 表、表面规则、颜色数学、序列化/解析。
 *
 * 覆盖 PI-Desktop 在 apps/desktop/src/styles/tokens.css 里定义的全部 --ds-* token
 * （56 个），不只是颜色：侧边栏玻璃层、尺寸、圆角、阴影都在内。
 *
 * 三条约定：
 *
 *  1. **只有被改过的 token 才会被写进主题文件。** 没改的留空，让宿主自己的值
 *     生效 —— 这也是贡献主题该有的样子：一层薄薄的覆盖，而不是把整套调色板抄
 *     一遍（很多宿主值本身是 color-mix()/var() 链，抄不过来也抄不对）。
 *
 *  2. **颜色可以带透明度。** 值支持 #rrggbb、#rrggbbaa 和 transparent；对比度
 *     计算会先把前景按 alpha 合成到背景上，所以半透明 token 得到的是真实比值。
 *
 *  3. **渐变、图片、模糊只走结构化的「表面」，绝不接受自由文本 CSS。**
 *     每个取值都在白名单内校验后才拼进声明，面板无法把任意 CSS 注进主题文件。
 *
 * 暴露为 window.ThemeModel。
 */
 (function (root, factory) {
   var api = factory();
   if (typeof module === "object" && module.exports) module.exports = api;
   else root.ThemeModel = api;
 })(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ==================================================================== *
   * 1. token 表
   * ==================================================================== */

  /**
   * type:
   *   color  —— 纯色，编辑器给取色器
   *   alpha  —— 允许透明的颜色（宿主本来就用 alpha 混合）
   *   size   —— 长度（px / clamp）
   *   shadow —— 阴影或描边
   */
  var TOKEN_GROUPS = [
    {
      id: "surfaces",
      label: "表面 Surfaces",
      desc: "面板、浮层与状态底色。带 alpha 的值会让下层透出来。",
      tokens: [
        { key: "bg-primary", name: "主面板", type: "color", dark: "#181818", light: "#ffffff" },
        { key: "bg-secondary", name: "次级面板", type: "color", dark: "#212121", light: "#f9f9f9" },
        { key: "bg-tertiary", name: "三级 / 浮层", type: "color", dark: "#282828", light: "#f3f3f3" },
        { key: "bg-inset", name: "凹槽 / 代码块", type: "color", dark: "#0d0d0d", light: "#ededed" },
        { key: "bg-under", name: "底层（侧栏之后）", type: "color", dark: "#000000", light: "#f9f9f9" },
        { key: "bg-dock", name: "工作面板列", type: "color", dark: "#212121", light: "#fafafa" },
        { key: "bg-dock-raised", name: "工作面板抬升条", type: "alpha", dark: "transparent", light: "#ffffff" },
        { key: "bg-elevated", name: "浮层（半透明）", type: "alpha", dark: "color-mix(in oklab, #212121 96%, transparent)", light: "color-mix(in oklab, #ffffff 70%, transparent)" },
        { key: "bg-elevated-opaque", name: "浮层（不透明）", type: "color", dark: "#282828", light: "#ffffff" },
        { key: "bg-elevated-primary", name: "主浮层", type: "alpha", dark: "color-mix(in oklab, #212121 96%, transparent)", light: "color-mix(in oklab, #ffffff 70%, transparent)" },
        { key: "bg-hover", name: "hover 底色", type: "alpha", dark: "color-mix(in oklab, #ffffff 6%, transparent)", light: "color-mix(in oklab, #1a1c1f 5%, transparent)" },
        { key: "bg-active", name: "选中底色", type: "alpha", dark: "color-mix(in oklab, #ffffff 10%, transparent)", light: "color-mix(in oklab, #1a1c1f 8%, transparent)" },
        { key: "bg-composer", name: "输入栏", type: "color", dark: "#212121", light: "#ffffff" },
        { key: "bg-chip", name: "胶囊 / 标签底", type: "alpha", dark: "color-mix(in oklab, #ffffff 6%, transparent)", light: "color-mix(in oklab, #1a1c1f 4%, transparent)" }
      ]
    },
    {
      id: "sidebar",
      label: "侧边栏 Sidebar",
      desc: "侧边栏底色与 macOS 玻璃层。tint/sheen 只在启用了原生侧栏材质时有可见作用。",
      tokens: [
        { key: "bg-sidebar", name: "侧边栏底色", type: "color", dark: "#000000", light: "#f3f3f3" },
        { key: "sidebar-glass-tint", name: "玻璃色罩", type: "alpha", dark: "color-mix(in oklab, #000000 40%, transparent)", light: "color-mix(in oklab, #f3f3f3 55%, transparent)" },
        { key: "sidebar-glass-sheen-top", name: "玻璃高光（上）", type: "alpha", dark: "color-mix(in oklab, #ffffff 7%, transparent)", light: "color-mix(in oklab, #ffffff 45%, transparent)" },
        { key: "sidebar-glass-sheen-bottom", name: "玻璃高光（下）", type: "alpha", dark: "color-mix(in oklab, #ffffff 4%, transparent)", light: "color-mix(in oklab, #ffffff 30%, transparent)" },
        { key: "sidebar-width", name: "侧边栏宽度", type: "size", dark: "clamp(240px, 275px, min(520px, calc(100vw - 320px)))", light: "clamp(240px, 275px, min(520px, calc(100vw - 320px)))" }
      ]
    },
    {
      id: "text",
      label: "文字 Text",
      desc: "四级文字层次。宿主默认值本身就是 alpha 阶，所以也允许带透明度。",
      tokens: [
        { key: "text-primary", name: "正文", type: "alpha", dark: "#ffffff", light: "#1a1c1f" },
        { key: "text-secondary", name: "次级文字", type: "alpha", dark: "color-mix(in oklab, #ffffff 70%, transparent)", light: "color-mix(in oklab, #1a1c1f 74%, transparent)" },
        { key: "text-muted", name: "弱化文字", type: "alpha", dark: "color-mix(in oklab, #ffffff 52%, transparent)", light: "#5d5d5d" },
        { key: "text-faint", name: "最弱文字", type: "alpha", dark: "color-mix(in oklab, #ffffff 38%, transparent)", light: "#afafaf" }
      ]
    },
    {
      id: "structure",
      label: "结构 Structure",
      desc: "色块、抬升面与描边。D297 之后流内结构靠这三层色阶而不是分割线。",
      tokens: [
        { key: "tile", name: "色块", type: "alpha", dark: "color-mix(in oklab, #ffffff 3.5%, transparent)", light: "color-mix(in oklab, #1a1c1f 3.5%, transparent)" },
        { key: "tile-hover", name: "色块 hover", type: "alpha", dark: "color-mix(in oklab, #ffffff 6%, transparent)", light: "color-mix(in oklab, #1a1c1f 6%, transparent)" },
        { key: "tile-deep", name: "色块加深 / 选中", type: "alpha", dark: "color-mix(in oklab, #ffffff 8%, transparent)", light: "color-mix(in oklab, #1a1c1f 8%, transparent)" },
        { key: "raised", name: "抬升面", type: "color", dark: "#282828", light: "#ffffff" },
        { key: "border-default", name: "描边", type: "alpha", dark: "color-mix(in oklab, #ffffff 8%, transparent)", light: "color-mix(in oklab, #1a1c1f 8%, transparent)" },
        { key: "border-subtle", name: "弱描边", type: "alpha", dark: "color-mix(in oklab, #ffffff 5%, transparent)", light: "color-mix(in oklab, #1a1c1f 5%, transparent)" },
        { key: "border-strong", name: "强描边", type: "alpha", dark: "color-mix(in oklab, #ffffff 14%, transparent)", light: "color-mix(in oklab, #1a1c1f 12%, transparent)" }
      ]
    },
    {
      id: "accent",
      label: "强调色 Accent",
      desc: "主操作、选中态与聚焦环。强调填充上的墨色用 --ds-bg-primary。",
      tokens: [
        { key: "accent", name: "强调色", type: "color", dark: "#ffffff", light: "#1a1c1f" },
        { key: "accent-hover", name: "强调色 hover", type: "color", dark: "#ededed", light: "#303030" },
        { key: "accent-soft", name: "强调色柔化", type: "color", dark: "#afafaf", light: "#5d5d5d" }
      ]
    },
    {
      id: "status",
      label: "状态 Status",
      desc: "语义色，改动会影响全应用的状态表达。",
      tokens: [
        { key: "success", name: "成功", type: "color", dark: "#40c977", light: "#00a240" },
        { key: "warning", name: "警告", type: "color", dark: "#ff8549", light: "#e25507" },
        { key: "error", name: "错误", type: "color", dark: "#ff6764", light: "#e02e2a" },
        { key: "info", name: "信息", type: "color", dark: "#afafaf", light: "#5d5d5d" },
        { key: "purple", name: "紫 / 特殊", type: "color", dark: "#c27aff", light: "#7c3aed" }
      ]
    },
    {
      id: "switch",
      label: "开关 Switch",
      desc: "开关轨道与滑块。开启态用强调色，所以滑块默认取主面板色。",
      tokens: [
        { key: "switch-track-off", name: "关闭态轨道", type: "alpha", dark: "color-mix(in oklab, #ffffff 10%, transparent)", light: "color-mix(in oklab, #1a1c1f 10%, transparent)" },
        { key: "switch-track-off-hover", name: "关闭态轨道 hover", type: "alpha", dark: "color-mix(in oklab, #ffffff 18%, transparent)", light: "color-mix(in oklab, #1a1c1f 18%, transparent)" },
        { key: "switch-ring-off", name: "关闭态描环", type: "alpha", dark: "color-mix(in oklab, #ffffff 22%, transparent)", light: "color-mix(in oklab, #1a1c1f 20%, transparent)" },
        { key: "switch-knob-off", name: "关闭态滑块", type: "color", dark: "#afafaf", light: "#ffffff" },
        { key: "switch-knob-on", name: "开启态滑块", type: "color", dark: "#181818", light: "#ffffff" }
      ]
    },
    {
      id: "depth",
      label: "阴影与描边 Depth",
      desc: "抬升、浮层与输入栏的投影。",
      tokens: [
        { key: "raised-shadow", name: "抬升面投影", type: "shadow", dark: "0 1px 2px rgba(0, 0, 0, 0.35)", light: "0 1px 2px rgba(0, 0, 0, 0.1), 0 0 0 0.5px rgba(0, 0, 0, 0.04)" },
        { key: "shadow-dialog", name: "对话框投影", type: "shadow", dark: "0 16px 48px rgba(0, 0, 0, 0.55)", light: "0 16px 48px rgba(0, 0, 0, 0.12)" },
        { key: "elevation-stroke", name: "浮层描边", type: "shadow", dark: "0 0 0 0.5px color-mix(in oklab, #ffffff 12%, transparent)", light: "0 0 0 0.5px color-mix(in oklab, #1a1c1f 12%, transparent)" },
        { key: "shadow-composer", name: "输入栏投影", type: "shadow", dark: "0 3px 7.5px #0000000a, 0 0 20px #0000000d", light: "0 3px 7.5px #0000000a, 0 0 20px #0000000d" }
      ]
    },
    {
      id: "metrics",
      label: "尺寸与圆角 Metrics",
      desc: "外壳度量。改动会直接改变版面密度，谨慎使用。",
      tokens: [
        { key: "toolbar-height", name: "工具栏高度", type: "size", dark: "46px", light: "46px" },
        { key: "settings-nav-width", name: "设置导航宽度", type: "size", dark: "275px", light: "275px" },
        { key: "work-panel-toggle-size", name: "面板开关尺寸", type: "size", dark: "28px", light: "28px" },
        { key: "work-panel-toggle-inset", name: "面板开关内缩", type: "size", dark: "12px", light: "12px" },
        { key: "work-panel-toggle-gap", name: "面板开关间距", type: "size", dark: "20px", light: "20px" },
        { key: "preview-action-lane-width", name: "预览操作列宽", type: "size", dark: "56px", light: "56px" },
        { key: "window-controls-width", name: "窗口控件区宽", type: "size", dark: "120px", light: "120px" },
        { key: "composer-radius", name: "输入栏圆角", type: "size", dark: "var(--radius-xl)", light: "var(--radius-xl)" },
        { key: "composer-radius-lg", name: "输入栏圆角（大）", type: "size", dark: "var(--radius-xl)", light: "var(--radius-xl)" }
      ]
    }
  ];

  var TOKEN_KEYS = [];
  var TOKEN_BY_KEY = {};
  for (var gi = 0; gi < TOKEN_GROUPS.length; gi += 1) {
    var group = TOKEN_GROUPS[gi];
    for (var ti = 0; ti < group.tokens.length; ti += 1) {
       var token = group.tokens[ti];
       TOKEN_KEYS.push(token.key);
       TOKEN_BY_KEY[token.key] = token;
     }
   }

   /* ==================================================================== *
    * 2. 背景区域（层级 / 渐变 / 图片 / 模糊）
    * ==================================================================== */

   /**
    * 背景区域。**层级即 DOM 层级**：整窗在最底，三栏盖住它，栏内区域再盖住栏。
    * 谁设了底色/图片就盖住自己那一块，没设的就透出下层 —— 这正是 CSS 的天然行为。
    *
    * selector 取自真实外壳，空字符串表示「区域本身就是那个根元素」。
    * fillOnly 的区域不提供图片（右栏嵌入的是原生 WebContentsView，它永远画在
    * 渲染进程之上，图片盖不住 —— 与其让用户误会，不如不给这个开关）。
    */
   var REGIONS = [
     { id: "shell", label: "整窗", selector: "", depth: 0, note: "最底层，铺满左中右三栏背后" },
     { id: "sidebar", label: "左栏", selector: ".sidebar-body", depth: 1, note: "导航 / 项目 / 会话列表" },
     { id: "main", label: "中栏", selector: ".main-pane", depth: 1, note: "会话主区域" },
     { id: "dock", label: "右栏", selector: ".work-panel-main", depth: 1, note: "右侧工具列（只设底色）", fillOnly: true },
    // 标题栏：聊天页那条是 .conversation-topbar（chrome.css）。宿主的 .main-titlebar
    // 只出现在非聊天页，写它等于什么都没改 —— 所以这里跟着聊天页的元素走。
    { id: "titlebar", label: "标题栏", selector: ".conversation-topbar", depth: 2, note: "中栏顶部那条" },
     { id: "thread", label: "会话区", selector: ".thread-scroll", depth: 2, note: "中栏消息滚动区" },
     { id: "composer", label: "输入栏", selector: ".composer-shell", depth: 2, note: "底部输入胶囊" },
   ];
  var BACKGROUND_SIZES = ["cover", "contain", "auto"];
  var BACKGROUND_REPEATS = ["no-repeat", "repeat", "repeat-x", "repeat-y"];
  var BACKGROUND_POSITIONS = ["center", "top", "bottom", "left", "right"];
  var MAX_BLUR = 40;

   /**
    * 图片只有一种来源：用户自己从文件选择器里选的本地 PNG。
    *
    * 文件按内容 sha256 命名落在 themes/img/ 里，CSS 只写包内相对路径，由宿主
    * 改写成 plugin-asset://（ADR 0248）。没有槽位、没有数量上限、也没有别的
    * 来源可选。
    *
    * 代价是这类主题必须走静态贡献：运行时注册的 CSS 只允许 data:（ADR 0249），
    * 装不下图片文件。所以带图片的主题保存后会走一次插件重载（约 0.3s）。
    */
   function emptyImage() {
     return {
       on: false,
       /** 上传图片的内容哈希（sha256 前 16 位）。空串 = 还没选图。 */
       image: "",
       size: "cover",
       repeat: "no-repeat",
       position: "center",
     };
   }

   function emptySurface() {
     return {
       fill: "",
       gradient: { on: false, angle: 160, from: "#00000000", to: "#00000000" },
       image: emptyImage(),
       blur: 0,
       radius: "",
     };
   }

  /** 一个表面是否有任何设置（用来决定要不要为它输出规则）。 */
  function surfaceIsEmpty(surface) {
    if (!surface) return true;
    var hasFill = typeof surface.fill === "string" && surface.fill.trim() !== "";
    var hasGradient = surface.gradient && surface.gradient.on === true;
    var hasImage = surface.image && surface.image.on === true;
    var hasBlur = Number(surface.blur) > 0;
    var hasRadius = typeof surface.radius === "string" && surface.radius.trim() !== "";
    return !hasFill && !hasGradient && !hasImage && !hasBlur && !hasRadius;
  }

  /* ==================================================================== *
   * 3. 值校验（白名单，绝不直接拼自由文本）
   * ==================================================================== */

  var HEX6 = /^#[0-9a-fA-F]{6}$/;
  var HEX8 = /^#[0-9a-fA-F]{8}$/;
  var SIZE_VALUE = /^(?:\d+(?:\.\d+)?(?:px|rem|em|%)?|auto|var\(--radius-[a-z0-9-]+\)|clamp\([^;{}()]{0,80}\))$/;
  var SHADOW_VALUE = /^[0-9a-zA-Z#(),.%\s/+-]{1,220}$/;
  var ANGLE = /^\d{1,3}$/;
  var RADIUS_VALUE = /^\d{1,3}px$/;

  function isHex6(value) {
    return typeof value === "string" && HEX6.test(value.trim());
  }

  /** 编辑器里允许写进主题文件的颜色：6 位、8 位，或关键字 transparent。 */
  function isColorValue(value) {
    if (typeof value !== "string") return false;
    var text = value.trim();
    return text === "transparent" || HEX6.test(text) || HEX8.test(text);
  }

  function isSizeValue(value) {
    return typeof value === "string" && SIZE_VALUE.test(value.trim());
  }

  function isShadowValue(value) {
    if (typeof value !== "string") return false;
    var text = value.trim();
    if (!text || text.length > 220) return false;
    // 不得含 url( / 分号 / 大括号 —— shadow 里没有任何合法用法需要它们。
    if (/url\(|[;{}]|@/i.test(text)) return false;
    return SHADOW_VALUE.test(text);
  }

  function isTokenValueAllowed(key, value) {
    var token = TOKEN_BY_KEY[key];
    if (!token) return false;
     // 所有颜色 token 都允许透明度：宿主很多 token 本来就是 alpha 混合，
     // 而「半透明的面板/描边」是主题设计里的常规手法。
     if (token.type === "color" || token.type === "alpha") return isColorValue(value);
    if (token.type === "size") return isSizeValue(value);
    if (token.type === "shadow") return isShadowValue(value);
    return false;
  }

  function normalizeColor(value) {
    var text = String(value || "").trim();
    return text === "transparent" ? text : text.toLowerCase();
  }

  /** 默认值表（未改动时留给宿主的就是这些）。 */
  function defaults(base) {
    var want = base === "light" ? "light" : "dark";
    var out = {};
    for (var i = 0; i < TOKEN_KEYS.length; i += 1) {
      var token = TOKEN_BY_KEY[TOKEN_KEYS[i]];
      out[token.key] = token[want];
    }
    return out;
  }

  /* ==================================================================== *
   * 4. 颜色数学（透明度感知）
   * ==================================================================== */

  /** 把 "#rgb"/"#rrggbb"/"#rrggbbaa"/"rgb()"/"rgba()" 解析成 {r,g,b,a}。 */
  function parseColor(value) {
    var text = String(value || "").trim().toLowerCase();
    if (!text) return null;
    if (text === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    if (text.charAt(0) === "#") {
      var hex = text.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1
        };
      }
      if (hex.length === 6 || hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
        };
      }
      return null;
    }
    var match = text.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    var parts = match[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    var alpha = parts.length > 3 ? Number(parts[3]) : 1;
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
      a: isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1
    };
  }

  /** 把可能带 alpha 的前景合成到不透明背景上，得到实际呈现的颜色。 */
  function composite(fg, bg) {
    if (!fg) return bg;
    if (!bg) return fg;
    var a = Math.max(0, Math.min(1, fg.a));
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1
    };
  }

  function toHex(color) {
    var clamp = function (value) {
      var n = Math.round(value);
      return Math.max(0, Math.min(255, n));
    };
    var hex = function (value) {
      var part = clamp(value).toString(16);
      return part.length === 1 ? "0" + part : part;
    };
    return "#" + hex(color.r) + hex(color.g) + hex(color.b);
  }

  function toHex8(color) {
    var alpha = Math.max(0, Math.min(255, Math.round(color.a * 255)));
    return toHex(color) + (alpha.toString(16).length === 1 ? "0" : "") + alpha.toString(16);
  }

  function channelToLinear(value) {
    var c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(color) {
    if (!color) return 0;
    return (
      0.2126 * channelToLinear(color.r) +
      0.7152 * channelToLinear(color.g) +
      0.0722 * channelToLinear(color.b)
    );
  }

  /**
   * WCAG 2.1 对比度。前景的 alpha 会先合成到背景上 —— 半透明文字在深色底上
   * 本来就比"纯色算出来的"更暗，不算合成会高估可读性。
   */
  function contrast(fgValue, bgValue) {
    var fg = parseColor(fgValue);
    var bg = parseColor(bgValue);
    if (!fg || !bg) return 0;
    var solidBg = composite(bg, { r: 0, g: 0, b: 0, a: 1 });
    var solidFg = composite(fg, solidBg);
    var lf = relativeLuminance(solidFg);
    var lb = relativeLuminance(solidBg);
    var hi = Math.max(lf, lb);
    var lo = Math.min(lf, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function formatRatio(value) {
    if (!isFinite(value) || value <= 0) return "—";
    return value >= 10 ? value.toFixed(1) + ":1" : value.toFixed(2) + ":1";
  }

  /** 强调填充上的墨色 = 主面板色（与宿主 tokens.css 的配对一致）。 */
  function accentInk(effective) {
    return effective["bg-primary"];
  }

  var AUDIT_PAIRS = [
    { label: "正文 / 主面板", fg: "text-primary", bg: "bg-primary", tier: "body" },
    { label: "正文 / 侧边栏", fg: "text-primary", bg: "bg-sidebar", tier: "body" },
    { label: "正文 / 工作面板列", fg: "text-primary", bg: "bg-dock", tier: "body" },
    { label: "正文 / 输入栏", fg: "text-primary", bg: "bg-composer", tier: "body" },
    { label: "正文 / 浮层", fg: "text-primary", bg: "bg-elevated-opaque", tier: "body" },
    { label: "正文 / 抬升面", fg: "text-primary", bg: "raised", tier: "body" },
    { label: "次级 / 主面板", fg: "text-secondary", bg: "bg-primary", tier: "body" },
    { label: "次级 / 侧边栏", fg: "text-secondary", bg: "bg-sidebar", tier: "body" },
    { label: "弱化 / 主面板", fg: "text-muted", bg: "bg-primary", tier: "body" },
    { label: "弱化 / 侧边栏", fg: "text-muted", bg: "bg-sidebar", tier: "body" },
    { label: "最弱 / 主面板", fg: "text-faint", bg: "bg-primary", tier: "decorative" },
    { label: "强调填充上的墨色", fg: null, bg: "accent", tier: "body" },
    { label: "成功 / 主面板", fg: "success", bg: "bg-primary", tier: "decorative" },
    { label: "警告 / 主面板", fg: "warning", bg: "bg-primary", tier: "decorative" },
    { label: "错误 / 主面板", fg: "error", bg: "bg-primary", tier: "decorative" }
  ];

  /** effective 是「已解析出的实际颜色」表，键为 token key。 */
  function audit(effective) {
    var rows = [];
    for (var i = 0; i < AUDIT_PAIRS.length; i += 1) {
      var pair = AUDIT_PAIRS[i];
      var fg = pair.fg === null ? accentInk(effective) : effective[pair.fg];
      var ratio = contrast(fg, effective[pair.bg]);
      rows.push({
        label: pair.label,
        fg: fg,
        bg: effective[pair.bg],
        ratio: ratio,
        tier: pair.tier,
        bodyOk: ratio >= 4.5,
        largeOk: ratio >= 3
      });
    }
    return rows;
  }

  function worstRatio(rows, tier) {
    var want = tier || "body";
    var worst = Infinity;
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].tier !== want) continue;
      if (rows[i].ratio < worst) worst = rows[i].ratio;
    }
    return worst === Infinity ? 0 : worst;
  }

  /* ==================================================================== *
   * 5. 序列化
   * ==================================================================== */

  function selectorFor(base) {
    return base === "light" ? ':root[data-theme="light"]' : ':root[data-theme="dark"]';
  }

  function gradientCss(gradient) {
    var angle = parseInt(gradient.angle, 10);
    if (!isFinite(angle)) angle = 160;
    angle = Math.max(0, Math.min(360, angle));
    var from = isColorValue(gradient.from) ? normalizeColor(gradient.from) : "transparent";
    var to = isColorValue(gradient.to) ? normalizeColor(gradient.to) : "transparent";
    return "linear-gradient(" + angle + "deg, " + from + ", " + to + ")";
  }

  /**
   * 生成一个表面的声明列表。全部取值都在白名单内校验后才拼接 ——
   * 因此面板没有任何路径可以把任意 CSS 写进主题文件。
   */
   /**
    * 生成一个区域的声明列表。所有取值都在白名单内校验后才拼接 ——
    * 面板没有任何路径可以把任意 CSS 写进主题文件。
    *
    * resolveImage(image) 决定图片怎么落地：用户上传的 PNG 返回包内相对路径
    * （宿主改写成 plugin-asset://）。路径不经过自由文本，也不由面板决定。
    */
  function surfaceDeclarations(region, resolveImage) {
    var lines = [];
    if (surfaceIsEmpty(region)) return lines;

    if (typeof region.fill === "string" && isColorValue(region.fill)) {
      lines.push("  background-color: " + normalizeColor(region.fill) + ";");
    }

    var layers = [];
    if (region.gradient && region.gradient.on === true) {
      layers.push(gradientCss(region.gradient));
    }
    var imageUrl = "";
    if (region.image && region.image.on === true) {
      imageUrl = resolveImage(region.image);
      if (imageUrl) layers.push('url("' + imageUrl + '")');
    }
    if (layers.length) {
      lines.push("  background-image: " + layers.join(", ") + ";");
    }

    if (imageUrl) {
      var size = BACKGROUND_SIZES.indexOf(region.image.size) !== -1 ? region.image.size : "cover";
      var repeat =
        BACKGROUND_REPEATS.indexOf(region.image.repeat) !== -1 ? region.image.repeat : "no-repeat";
      var position =
        BACKGROUND_POSITIONS.indexOf(region.image.position) !== -1 ? region.image.position : "center";
      lines.push("  background-size: " + size + ";");
      lines.push("  background-repeat: " + repeat + ";");
      lines.push("  background-position: " + position + ";");
    }

    var blur = Number(region.blur);
    if (isFinite(blur) && blur > 0) {
      var clamped = Math.min(MAX_BLUR, Math.round(blur));
      lines.push("  backdrop-filter: blur(" + clamped + "px);");
    }

    if (typeof region.radius === "string" && RADIUS_VALUE.test(region.radius.trim())) {
      lines.push("  border-radius: " + region.radius.trim() + ";");
    }
    return lines;
  }

  /**
   * 生成一份贡献主题 CSS。
   *
    *
    * opts.rootSelector —— 文件用 ":root"，预览用 ".pv-root"。
    * opts.note         —— 写进头部注释的说明。
    * opts.resolveImage —— (image) => url。决定图片怎么落地：
    *                       内置图形 → data: URL
    *                       本地槽位 → 包内相对路径（由宿主改写成 plugin-asset://）
    *                      运行时注册的主题只能接受前者，所以 caller 在
    *                      "这个设计用了本地槽位" 时会拒绝走运行时通道。
    */
   function serialize(base, design, opts) {
     var options = opts || {};
     var root = options.rootSelector || selectorFor(base);
     var resolveImage =
       options.resolveImage ||
       function () {
         return "";
       };
     var tokens = (design && design.tokens) || {};
     var regions = (design && design.regions) || {};

    var declarations = [];
    for (var i = 0; i < TOKEN_KEYS.length; i += 1) {
      var key = TOKEN_KEYS[i];
     var value = tokens[key];
      if (value === undefined || value === null || value === "") continue;
      if (!isTokenValueAllowed(key, value)) continue;
      declarations.push("  --ds-" + key + ": " + normalizeColor(value) + ";");
    }

     // 侧边栏背景走 ADR 0249 的专用 token：--ds-bg-sidebar 必须保持为颜色，
     // 否则会破坏玻璃色罩、描边与 macOS vibrancy 的 color-mix 消费方。
     var sidebarImage = sidebarImageCss(design && design.sidebarImage, resolveImage);
     if (sidebarImage) {
       declarations.push("  --ds-bg-sidebar-image: " + sidebarImage + ";");
     }

    var blocks = [];
    if (declarations.length) {
      blocks.push(root + " {\n" + declarations.join("\n") + "\n}");
    }

     for (var ri = 0; ri < REGIONS.length; ri += 1) {
       var region = REGIONS[ri];
       var decls = surfaceDeclarations(regions[region.id], resolveImage);
       if (!decls.length) continue;
       if (!region.selector) {
         // 整窗：根元素上写一份，另外再写一份 .app-shell —— 宿主 .app-shell 有不透明
         // 底色，只写根元素的话整窗图片永远被它盖住（base.css:163-168）。
         blocks.push(root + " {\n" + decls.join("\n") + "\n}");
         blocks.push(root + " .app-shell {\n" + decls.join("\n") + "\n}");
         continue;
       }
       blocks.push(root + " " + region.selector + " {\n" + decls.join("\n") + "\n}");
     }

    if (!blocks.length) {
      // 宿主拒绝空样式表，所以留一个只有注释的块：合法、且什么都不改。
      blocks.push(root + " {\n  /* 尚未覆盖任何 token 或表面。 */\n}");
    }

    var header = [
      "/*",
      " * " + (options.note || "由主题工坊 pi.theme.studio 生成。"),
      " *",
      " * 只写被改动过的声明：未覆盖的 token 由宿主自己的 tokens.css 决定。",
       " * 图片只有一种来源：你自己选的本地 PNG，写成包内相对路径，由宿主在加载时",
       " * 改写成 plugin-asset://（ADR 0248）。",
      " */"
    ];

    return header.concat(blocks).join("\n") + "\n";
  }

  /* ==================================================================== *
   * 6. 解析（导入用）
   * ==================================================================== */

  /**
   * 从任意 CSS 抓 `--ds-<key>: <值>` 声明。
   * 先剥掉注释与字符串，避免把注释里的示例当成真实声明。
   */
  function parse(css) {
    var text = String(css || "")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
    var tokens = {};
    var skipped = 0;
    var pattern = /--ds-([a-zA-Z0-9-]+)\s*:\s*([^;{}]+)/g;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      var key = match[1];
      var raw = match[2].trim();
      if (TOKEN_KEYS.indexOf(key) === -1) {
        skipped += 1;
        continue;
      }
      if (!isTokenValueAllowed(key, raw)) {
        skipped += 1;
        continue;
      }
      tokens[key] = normalizeColor(raw);
    }
    return { tokens: tokens, skipped: skipped };
  }

  /** 已覆盖的 token 列表。 */
  function overriddenKeys(design) {
    var tokens = (design && design.tokens) || {};
    var out = [];
    for (var i = 0; i < TOKEN_KEYS.length; i += 1) {
      var key = TOKEN_KEYS[i];
      var value = tokens[key];
      if (value === undefined || value === null || value === "") continue;
      if (isTokenValueAllowed(key, value)) out.push(key);
    }
    return out;
  }

   /** 把设计序列化成一段 CSS <image> 值（或 "" 表示不覆盖）。 */
   /**
    * 侧边栏背景 → 一段 CSS <image> 值（或 "" 表示不覆盖）。
    * 侧边栏必须走 --ds-bg-sidebar-image（ADR 0249）：--ds-bg-sidebar 得保持为颜色，
    * 否则会破坏玻璃色罩、描边与 macOS vibrancy 的 color-mix 消费方。
    */
   function sidebarImageCss(sidebarImage, resolveImage) {
     if (!sidebarImage || sidebarImage.on !== true) return "";
     if (sidebarImage.kind === "gradient") {
       return gradientCss({
         angle: sidebarImage.angle,
         from: isColorValue(sidebarImage.from) ? sidebarImage.from : "transparent",
         to: isColorValue(sidebarImage.to) ? sidebarImage.to : "transparent"
       });
     }
     // 图片只有一种来源：用户自己选的本地 PNG。有哈希就出图，没有就当没设。
     var url = resolveImage(sidebarImage);
     return url ? 'url("' + url + '")' : "";
   }

   return {
     TOKEN_GROUPS: TOKEN_GROUPS,
     TOKEN_KEYS: TOKEN_KEYS,
     TOKEN_BY_KEY: TOKEN_BY_KEY,
     REGIONS: REGIONS,
     AUDIT_PAIRS: AUDIT_PAIRS,
     BACKGROUND_SIZES: BACKGROUND_SIZES,
     BACKGROUND_REPEATS: BACKGROUND_REPEATS,
     BACKGROUND_POSITIONS: BACKGROUND_POSITIONS,
     MAX_BLUR: MAX_BLUR,

     defaults: defaults,
     emptySurface: emptySurface,
     emptyImage: emptyImage,
     surfaceIsEmpty: surfaceIsEmpty,
     surfaceDeclarations: surfaceDeclarations,
     sidebarImageCss: sidebarImageCss,

     isHex6: isHex6,
     isColorValue: isColorValue,
     isTokenValueAllowed: isTokenValueAllowed,
     normalizeColor: normalizeColor,

     parseColor: parseColor,
     composite: composite,
     toHex: toHex,
     toHex8: toHex8,
     relativeLuminance: relativeLuminance,
     contrast: contrast,
     formatRatio: formatRatio,
     accentInk: accentInk,
     audit: audit,
     worstRatio: worstRatio,

     selectorFor: selectorFor,
     serialize: serialize,
     parse: parse,
     overriddenKeys: overriddenKeys
   };
 });
