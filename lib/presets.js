/**
 * 主题工坊的内置预设。
 *
 * 这里只列**与宿主默认值不同**的 token —— 序列化时也只写这些，主题文件因此
 * 是一层薄覆盖，而不是把宿主整套调色板抄一遍。
 *
 * 侧边栏背景走 ADR 0249 的专用 token `--ds-bg-sidebar-image`：`--ds-bg-sidebar`
 * 必须保持为颜色，否则会破坏玻璃色罩、描边与 macOS vibrancy 的 color-mix。
 *
 * 在 Node（插件进程）与浏览器（面板）里都能加载。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ThemePresets = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function preset(id, label, base, tokens, sidebarImage) {
    return {
      id: id,
      label: label,
      base: base,
      builtin: true,
      tokens: tokens,
      sidebarImage: sidebarImage || { on: false, kind: "none" },
       regions: {}  // 预设只改配色；区域渐变/图片留给用户自己加
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
    )
  ];

  /** 深拷贝一份预设库，避免调用方改到常量。 */
  function clone() {
    return JSON.parse(JSON.stringify(PRESETS));
  }

  return { PRESETS: PRESETS, clone: clone };
});
