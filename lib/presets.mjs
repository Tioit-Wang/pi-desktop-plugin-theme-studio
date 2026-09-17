/**
 * 主题工坊的内置预设。
 *
 * 这里只列**与宿主默认值不同**的 token —— 序列化时也只写这些，主题文件因此
 * 是一层薄覆盖，而不是把宿主整套调色板抄一遍。
 *
 * 侧边栏背景走 ADR 0249 的专用 token `--ds-bg-sidebar-image`：`--ds-bg-sidebar`
 * 必须保持为颜色，否则会破坏玻璃色罩、描边与 macOS vibrancy 的 color-mix。
 *
 * ESM 模块：插件进程与渲染层加载同一份。
 */
"use strict";

  function preset(id, label, base, tokens, sidebarImage, regions) {
    return {
      id: id,
      label: label,
      base: base,
      builtin: true,
      tokens: tokens,
      sidebarImage: sidebarImage || { on: false, kind: "none" },
      // 预设基本都是「只改配色」；带区域覆盖的那套（QQ 2008）把 regions 传进来，
      // 它的贴图是随包资源 assets/presets/<图片 id>.png，加载时落进数据目录。
      regions: regions || {}
    };
  }

  var PRESETS = [
    /*
     * QQ 2008：蓝白玻璃质感。
     *
     * 这套配色最早是被用户在面板里手搓出来的（Agent 工具按 slug 生成了 id
     * qq-2008），现在收进内置预设。它是唯一带区域覆盖与贴图的预设：
     *   · 标题栏半透明 + 12px 背景模糊，会话区用一张 8×8 贴图平铺；
     *   · 贴图是导出包里那张原样的 8×8 PNG（assets/presets/20260916-014022-860-2089.png），
     *     加载时落进插件数据目录 —— 主题 CSS 只认绝对路径（ADR 0255）。图片 id 原样保留：
     *     这样「用户手里那套同名主题」和预设是同一份设计，会被认领成预设，而不是变成两套。
     */
    preset(
      "qq-2008",
      "QQ 2008",
      "light",
      {
        accent: "#1b7ac6",
        "accent-hover": "#1466ac",
        "accent-soft": "#a6cff0",
        "bg-active": "#1b7ac64d",
        "bg-chip": "#1b7ac61f",
        "bg-composer": "#ffffff",
        "bg-dock": "#dceaf7",
        "bg-dock-raised": "#ffffff8c",
        "bg-elevated": "#ffffffeb",
        "bg-elevated-opaque": "#f7fbff",
        "bg-elevated-primary": "#fffffff7",
        "bg-hover": "#2e86cc26",
        "bg-inset": "#d5e5f4",
        "bg-primary": "#e9f3fc",
        "bg-secondary": "#dceaf7",
        "bg-sidebar": "#c6def2",
        "bg-tertiary": "#f4f9fe",
        "bg-under": "#b9d3e9",
        "border-default": "#a8c6e2",
        "border-strong": "#6e9cc6",
        "border-subtle": "#c8dcee",
        "composer-radius": "4px",
        "composer-radius-lg": "6px",
        "elevation-stroke": "0 0 0 1px #7fa6c780",
        error: "#d24545",
        info: "#2e86cc",
        purple: "#8e6bd0",
        raised: "#ffffff",
        "raised-shadow": "0 1px 2px #1a3d6229",
        "shadow-composer": "inset 0 0 0 1px #a8c6e252, 0 1px 2px #1a3d621f",
        "shadow-dialog": "0 6px 20px #10324d3d",
        "sidebar-glass-sheen-bottom": "#ffffff1a",
        "sidebar-glass-sheen-top": "#ffffff99",
        "sidebar-glass-tint": "#eaf4fd4d",
        success: "#2fa84f",
        "switch-knob-off": "#ffffff",
        "switch-knob-on": "#ffffff",
        "switch-ring-off": "#8fa9c266",
        "switch-track-off": "#a9c0d680",
        "switch-track-off-hover": "#93afcb99",
        "text-faint": "#62809c5c",
        "text-muted": "#47698a80",
        "text-primary": "#0f2c46e6",
        "text-secondary": "#2a4e70a6",
        tile: "#ffffff99",
        "tile-deep": "#b3d4efe6",
        "tile-hover": "#d9ebfaf2",
        warning: "#f0a020"
      },
      { on: true, kind: "gradient", angle: 180, from: "#dcebf9", to: "#a8ccea" },
      {
        main: {
          fill: "#e9f3fc",
          gradient: { on: true, angle: 180, from: "#d8e9f9", to: "#f4f9fe" }
        },
        dock: { fill: "#dceaf7" },
        titlebar: {
          fill: "transparent",
          gradient: { on: true, angle: 180, from: "#b6d7f05c", to: "#8cb9e040" },
          blur: 12
        },
        thread: {
          fill: "#f4f9fe",
          image: {
            on: true,
            image: "20260916-014022-860-2089",
            size: "auto",
            repeat: "repeat",
            position: "center"
          }
        },
        composer: {
          fill: "#ffffff",
          gradient: { on: true, angle: 180, from: "#ffffff", to: "#edf5fd" }
        }
      },
    ),

    /*
     * Contrast：高对比主题（深色底）。
     *
     * 面向可读性优先的场景：底色压到纯黑、文字全部实色提亮、描边与投影整体加深，
     * 弱化的那一档（text-faint）也守在 8:1 以上。强调色取亮蓝，墨色用主面板的纯黑，
     * 填充上的字照样清楚。纯配色，不依赖任何贴图。
     */
    preset(
      "contrast",
      "Contrast",
      "dark",
      {
        accent: "#4da3ff",
        "accent-hover": "#7cc0ff",
        "accent-soft": "#9fc8f0",
        "bg-active": "#4da3ff2e",
        "bg-chip": "#4da3ff1a",
        "bg-composer": "#0d0d0d",
        "bg-dock": "#0a0a0a",
        "bg-dock-raised": "#1a1a1acc",
        "bg-elevated": "#141414eb",
        "bg-elevated-opaque": "#141414",
        "bg-elevated-primary": "#141414f2",
        "bg-hover": "#ffffff14",
        "bg-inset": "#000000",
        "bg-primary": "#000000",
        "bg-secondary": "#0a0a0a",
        "bg-sidebar": "#000000",
        "bg-tertiary": "#141414",
        "bg-under": "#000000",
        "border-default": "#4d4d4d",
        "border-strong": "#707070",
        "border-subtle": "#333333",
        "composer-radius": "6px",
        "composer-radius-lg": "8px",
        "elevation-stroke": "0 0 0 1px #595959",
        error: "#ff6b6b",
        info: "#7cc0ff",
        purple: "#c4a7ff",
        raised: "#1a1a1a",
        "raised-shadow": "0 1px 2px rgba(0, 0, 0, 0.65)",
        "shadow-composer": "inset 0 0 0 1px #4d4d4d, 0 2px 6px rgba(0, 0, 0, 0.5)",
        "shadow-dialog": "0 16px 48px rgba(0, 0, 0, 0.75)",
        "sidebar-glass-sheen-bottom": "#ffffff0a",
        "sidebar-glass-sheen-top": "#ffffff14",
        "sidebar-glass-tint": "#00000066",
        success: "#4ade80",
        "switch-knob-off": "#ffffff",
        "switch-knob-on": "#000000",
        "switch-ring-off": "#707070",
        "switch-track-off": "#4d4d4d",
        "switch-track-off-hover": "#666666",
        "text-faint": "#a0a0a0",
        "text-muted": "#c8c8c8",
        "text-primary": "#ffffff",
        "text-secondary": "#e6e6e6",
        tile: "#1a1a1a",
        "tile-deep": "#333333",
        "tile-hover": "#262626",
        warning: "#ffd54a"
      },
      { on: true, kind: "gradient", angle: 180, from: "#1a1a1a", to: "#000000" },
    ),

    /*
     * Mint Dark：浅绿深系主题（深色底 + 薄荷绿）。
     *
     * 深绿系列的底色一路压到 #07170f，绿色只作为强调与状态色浮上来；侧边栏给一道
     * 深绿渐变，不靠任何贴图就有层次。文字四档全部实色，最弱档仍有 4.5:1。
     */
    preset(
      "mint-dark",
      "Mint Dark",
      "dark",
      {
        accent: "#4ade80",
        "accent-hover": "#6ef0a4",
        "accent-soft": "#2f9e63",
        "bg-active": "#4ade802e",
        "bg-chip": "#4ade801a",
        "bg-composer": "#0c2217",
        "bg-dock": "#0a1d13",
        "bg-dock-raised": "#10281bcc",
        "bg-elevated": "#10281be6",
        "bg-elevated-opaque": "#10281b",
        "bg-elevated-primary": "#10281bf2",
        "bg-hover": "#ffffff10",
        "bg-inset": "#030d08",
        "bg-primary": "#07170f",
        "bg-secondary": "#0b1f15",
        "bg-sidebar": "#05130c",
        "bg-tertiary": "#10281b",
        "bg-under": "#04120c",
        "border-default": "#1f4030",
        "border-strong": "#2f6244",
        "border-subtle": "#16301f",
        "composer-radius": "6px",
        "composer-radius-lg": "8px",
        "elevation-stroke": "0 0 0 1px #2f624466",
        error: "#ff7b6e",
        info: "#5fd9a8",
        purple: "#c4a7ff",
        raised: "#122c1e",
        "raised-shadow": "0 1px 2px rgba(0, 0, 0, 0.45)",
        "shadow-composer": "inset 0 0 0 1px #1f4030, 0 2px 8px rgba(0, 0, 0, 0.35)",
        "shadow-dialog": "0 16px 44px rgba(0, 0, 0, 0.55)",
        "sidebar-glass-sheen-bottom": "#4ade8014",
        "sidebar-glass-sheen-top": "#ffffff12",
        "sidebar-glass-tint": "#05130c66",
        success: "#4ade80",
        "switch-knob-off": "#e6fff2",
        "switch-knob-on": "#07170f",
        "switch-ring-off": "#2f6244",
        "switch-track-off": "#1f4030",
        "switch-track-off-hover": "#2a5339",
        "text-faint": "#63856f",
        "text-muted": "#9ec0ab",
        "text-primary": "#e6fff2",
        "text-secondary": "#bfe3cd",
        tile: "#102a1b",
        "tile-deep": "#1d452c",
        "tile-hover": "#163623",
        warning: "#f6c356"
      },
      { on: true, kind: "gradient", angle: 165, from: "#123323", to: "#05130c" },
    ),

    /*
     * Business Blue：商务浅蓝主题（浅色底）。
     *
     * 企业向的冷静浅蓝：底色带一点蓝灰白，正文用深藏青，强调色是可读性足够的
     * 商务蓝（白字 5.9:1）。阴影与描边都收得很轻，适合长时间阅读。
     */
    preset(
      "business-blue",
      "Business Blue",
      "light",
      {
        accent: "#1b5fc9",
        "accent-hover": "#154aa6",
        "accent-soft": "#9ec2f0",
        "bg-active": "#1b5fc92e",
        "bg-chip": "#1b5fc91a",
        "bg-composer": "#ffffff",
        "bg-dock": "#f0f5fa",
        "bg-dock-raised": "#ffffff8c",
        "bg-elevated": "#ffffffeb",
        "bg-elevated-opaque": "#ffffff",
        "bg-elevated-primary": "#fffffff7",
        "bg-hover": "#1b5fc214",
        "bg-inset": "#dbe3ec",
        "bg-primary": "#f7fafd",
        "bg-secondary": "#eef3f9",
        "bg-sidebar": "#e9eff7",
        "bg-tertiary": "#e6edf5",
        "bg-under": "#dce4ee",
        "border-default": "#c8d6e6",
        "border-strong": "#9fb4cc",
        "border-subtle": "#dbe5f0",
        "composer-radius": "6px",
        "composer-radius-lg": "8px",
        "elevation-stroke": "0 0 0 1px #9fb4cc80",
        error: "#c02626",
        info: "#2d5f8b",
        purple: "#6d28d9",
        raised: "#ffffff",
        "raised-shadow": "0 1px 2px #1b3a5c29",
        "shadow-composer": "inset 0 0 0 1px #c8d6e252, 0 1px 2px #1b3a5c1f",
        "shadow-dialog": "0 6px 20px #16283d33",
        "sidebar-glass-sheen-bottom": "#ffffff1a",
        "sidebar-glass-sheen-top": "#ffffff99",
        "sidebar-glass-tint": "#e9eff74d",
        success: "#0f7b3f",
        "switch-knob-off": "#ffffff",
        "switch-knob-on": "#ffffff",
        "switch-ring-off": "#9fb4cc66",
        "switch-track-off": "#c8d6e680",
        "switch-track-off-hover": "#b6c8de99",
        "text-faint": "#6f8299",
        "text-muted": "#4d6483",
        "text-primary": "#12253c",
        "text-secondary": "#3c5170",
        tile: "#ffffffd9",
        "tile-deep": "#dbe7f4f2",
        "tile-hover": "#f2f7fcf2",
        warning: "#b4570a"
      },
      { on: true, kind: "gradient", angle: 180, from: "#e9eff7", to: "#dbe6f1" },
    ),

    /*
     * China Red：中国红主题（浅色底）。
     *
     * 暖白底 + 中国红强调：底色是带一点暖意的米白，正文压到深赭，强调色用
     * 正红（白字 5.7:1），侧边栏给一道浅红渐变。纯配色，不依赖任何贴图。
     */
    preset(
      "china-red",
      "China Red",
      "light",
      {
        accent: "#c81e1a",
        "accent-hover": "#a81814",
        "accent-soft": "#e8a39c",
        "bg-active": "#c81e1a2e",
        "bg-chip": "#c81e1a1a",
        "bg-composer": "#ffffff",
        "bg-dock": "#fdf6f0",
        "bg-dock-raised": "#ffffff8c",
        "bg-elevated": "#ffffffeb",
        "bg-elevated-opaque": "#ffffff",
        "bg-elevated-primary": "#fffffff7",
        "bg-hover": "#c81e1a14",
        "bg-inset": "#f6e2d2",
        "bg-primary": "#fffaf5",
        "bg-secondary": "#fdf3ea",
        "bg-sidebar": "#fbe8db",
        "bg-tertiary": "#fbeade",
        "bg-under": "#f5e4d6",
        "border-default": "#e8c9b8",
        "border-strong": "#d09a7e",
        "border-subtle": "#f1ded0",
        "composer-radius": "6px",
        "composer-radius-lg": "8px",
        "elevation-stroke": "0 0 0 1px #d09a7e80",
        error: "#b91c1c",
        info: "#a8541e",
        purple: "#8b3a9e",
        raised: "#ffffff",
        "raised-shadow": "0 1px 2px #5c231729",
        "shadow-composer": "inset 0 0 0 1px #e8c9b852, 0 1px 2px #5c23171f",
        "shadow-dialog": "0 6px 20px #4a1a1133",
        "sidebar-glass-sheen-bottom": "#ffffff1a",
        "sidebar-glass-sheen-top": "#ffffff99",
        "sidebar-glass-tint": "#fbe8db4d",
        success: "#2f7a35",
        "switch-knob-off": "#ffffff",
        "switch-knob-on": "#ffffff",
        "switch-ring-off": "#d09a7e66",
        "switch-track-off": "#e8c9b880",
        "switch-track-off-hover": "#dfb69c99",
        "text-faint": "#9c7468",
        "text-muted": "#82594b",
        "text-primary": "#331a12",
        "text-secondary": "#6b4233",
        tile: "#ffffffd9",
        "tile-deep": "#f7e3d2f2",
        "tile-hover": "#fdf6f0f2",
        warning: "#b4570a"
      },
      { on: true, kind: "gradient", angle: 180, from: "#fbe8db", to: "#f5d9c4" },
    )
  ];

  /** 深拷贝一份预设库，避免调用方改到常量。 */
  function clone() {
    return JSON.parse(JSON.stringify(PRESETS));
  }

  const ThemePresets = { PRESETS: PRESETS, clone: clone };

  export { PRESETS, clone };
  export default ThemePresets;
