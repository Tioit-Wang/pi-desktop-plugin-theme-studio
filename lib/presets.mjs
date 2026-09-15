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
    preset(
      "aurora",
      "Aurora",
      "dark",
      {
        "bg-under": "#05070f",
        "bg-primary": "#0b0f1a",
        "bg-secondary": "#111827",
        "bg-tertiary": "#172033",
        "bg-inset": "#04060c",
        "bg-dock": "#0e1422",
        "bg-composer": "#141c2e",
        "bg-elevated-opaque": "#172033",
        "bg-sidebar": "#070b16",
        "text-primary": "#eef2ff",
        "text-secondary": "#b9c4e0",
        "text-muted": "#8a97b8",
        "text-faint": "#5d6885",
        tile: "#16203a",
        "tile-hover": "#1c2947",
        "tile-deep": "#223256",
        raised: "#1a2440",
        "border-default": "#26314d",
        "border-subtle": "#1b2338",
        "border-strong": "#38466a",
        accent: "#7fb0ff",
        "accent-hover": "#a3c7ff",
        "accent-soft": "#5a7fc4",
        success: "#4ade80",
        warning: "#fbbf24",
        error: "#f87171",
        info: "#93c5fd",
        purple: "#c4a7ff"
      },
       { on: true, kind: "gradient", angle: 165, from: "#22305a", to: "#070b16" },
    ),

    preset(
      "ember",
      "Ember",
      "dark",
      {
        "bg-under": "#120a06",
        "bg-primary": "#1a0f0a",
        "bg-secondary": "#241610",
        "bg-tertiary": "#2e1c14",
        "bg-inset": "#0d0705",
        "bg-dock": "#1e120c",
        "bg-composer": "#261812",
        "bg-elevated-opaque": "#2e1c14",
        "bg-sidebar": "#150c08",
        "text-primary": "#fff3ea",
        "text-secondary": "#e0c0aa",
        "text-muted": "#ab8570",
        "text-faint": "#77584a",
        tile: "#2b1a12",
        "tile-hover": "#362118",
        "tile-deep": "#41291e",
        raised: "#322016",
        "border-default": "#3d271c",
        "border-subtle": "#2b1a12",
        "border-strong": "#563928",
        accent: "#ff9a52",
        "accent-hover": "#ffb47a",
        "accent-soft": "#c26a2e",
        success: "#6ddb84",
        warning: "#ffc95c",
        error: "#ff7b6e",
        info: "#ffb87a",
        purple: "#d8a0ff"
      },
      { on: false, kind: "none" },
    ),

    preset(
      "nocturne",
      "Nocturne",
      "dark",
      {
        "bg-under": "#08060f",
        "bg-primary": "#0e0b18",
        "bg-secondary": "#16111f",
        "bg-tertiary": "#1e1729",
        "bg-inset": "#06040b",
        "bg-dock": "#130f1c",
        "bg-composer": "#191327",
        "bg-elevated-opaque": "#1e1729",
        "bg-sidebar": "#0a0713",
        "text-primary": "#f2ecff",
        "text-secondary": "#c6b9e4",
        "text-muted": "#9385b8",
        "text-faint": "#665a85",
        tile: "#1c1528",
        "tile-hover": "#251c36",
        "tile-deep": "#2f2444",
        raised: "#221a31",
        "border-default": "#2c2340",
        "border-subtle": "#1e182c",
        "border-strong": "#443560",
        accent: "#a78bfa",
        "accent-hover": "#c4b0ff",
        "accent-soft": "#7c5fd3",
        success: "#5fd98c",
        warning: "#f6c356",
        error: "#fb7185",
        info: "#a5b4fc",
        purple: "#d8b4fe"
      },
      // 渐变形式：演示「不依赖任何图片」的侧边栏层次。
      { on: true, kind: "gradient", angle: 165, from: "#241a3d", to: "#0a0713" },
    ),

    preset(
      "paper",
      "Paper",
      "light",
      {
        "bg-under": "#f2f3f5",
        "bg-primary": "#ffffff",
        "bg-secondary": "#f8f9fa",
        "bg-tertiary": "#f2f3f5",
        "bg-inset": "#ebedf0",
        "bg-dock": "#fafbfc",
        "bg-composer": "#ffffff",
        "bg-elevated-opaque": "#ffffff",
        "bg-sidebar": "#f1f2f5",
        "text-primary": "#14171c",
        "text-secondary": "#4b5158",
        "text-muted": "#646b73",
        "text-faint": "#9aa2ab",
        tile: "#f1f2f4",
        "tile-hover": "#e9ebee",
        "tile-deep": "#e1e4e8",
        raised: "#ffffff",
        "border-default": "#e3e5e9",
        "border-subtle": "#ecedf0",
        "border-strong": "#cfd3d9",
        accent: "#1b3a6b",
        "accent-hover": "#2a5290",
        "accent-soft": "#6b86ad",
        success: "#0f7b3f",
        warning: "#b4570a",
        error: "#c02626",
        info: "#2d5f8b",
        purple: "#6d28d9"
      },
       { on: true, kind: "gradient", angle: 165, from: "#f1ece1", to: "#ffffff" },
    ),

    preset(
      "sand",
      "Sand",
      "light",
      {
        "bg-under": "#f4f0e8",
        "bg-primary": "#fbf9f5",
        "bg-secondary": "#f6f2ea",
        "bg-tertiary": "#efeade",
        "bg-inset": "#ebe5d8",
        "bg-dock": "#f8f5ee",
        "bg-composer": "#fffdf9",
        "bg-elevated-opaque": "#fffdf9",
        "bg-sidebar": "#f2ede3",
        "text-primary": "#211d17",
        "text-secondary": "#554d40",
        "text-muted": "#6d6555",
        "text-faint": "#a19a8b",
        tile: "#efe9dd",
        "tile-hover": "#e7e0d1",
        "tile-deep": "#ded6c5",
        raised: "#fffdf9",
        "border-default": "#e2dbcb",
        "border-subtle": "#ece6da",
        "border-strong": "#cbc1ab",
        accent: "#7a4b12",
        "accent-hover": "#96601c",
        "accent-soft": "#a3855a",
        success: "#2f6b2a",
        warning: "#a35a06",
        error: "#a92a20",
        info: "#4a5f7a",
        purple: "#6b3fa0"
      },
      { on: false, kind: "none" },
    ),

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
    )
  ];

  /** 深拷贝一份预设库，避免调用方改到常量。 */
  function clone() {
    return JSON.parse(JSON.stringify(PRESETS));
  }

  const ThemePresets = { PRESETS: PRESETS, clone: clone };

  export { PRESETS, clone };
  export default ThemePresets;
