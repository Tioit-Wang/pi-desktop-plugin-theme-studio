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
    ),

    /*
     * 奶龙：暖黄油彩风，三张贴图（左栏 / 中栏 / 会话区各一张）。
     *
     * 和 QQ 2008 一样，这套也是用户在面板里手搓出来、后来才收进预设的：纯中文 label 派生
     * 不出 slug（deriveThemeId 会退回 custom-N，和面板新建主题的命名一致），所以它当时叫
     * custom-1。三张 PNG 随包分发（assets/presets/<图片 id>.png），加载时落进插件数据目录；
     * 图片 id 原样保留 —— 用户库里那套同 id 同设计的主题会被认领成预设，而不是变成两套。
     *
     * 图片字节是 TinyPNG（tinify API）压过的：宽高与观感不变，三张合计 1.79 MB → 395 KB，
     * 离宿主「每个主题声明的资源合计 ≤ 4 MB」那条硬限制因此很远。
     */
    preset(
      "nailong",
      "奶龙",
      "light",
      {
        accent: "#9a6208",
        "accent-hover": "#a5660a",
        "accent-soft": "#e3b65a",
        "bg-active": "#fdd24fa6",
        "bg-chip": "#e8b44a26",
        "bg-composer": "#ffffff",
        "bg-dock": "#fdf8e8",
        "bg-dock-raised": "#ffffff8c",
        "bg-elevated": "#ffffffeb",
        "bg-elevated-opaque": "#fffdf6",
        "bg-elevated-primary": "#fffffff7",
        "bg-hover": "#efaf1b24",
        "bg-inset": "#f8eccc",
        "bg-primary": "#fefbf2",
        "bg-secondary": "#fdf5dd",
        "bg-sidebar": "#fdf2cb",
        "bg-tertiary": "#fffcf1",
        "bg-under": "#fbeec6",
        "border-default": "#e8c877",
        "border-strong": "#d9a63f",
        "border-subtle": "#f1dea8",
        "composer-radius": "20px",
        "composer-radius-lg": "24px",
        "elevation-stroke": "0 0 0 1px #e8c87759",
        error: "#ce3a22",
        info: "#a87a1e",
        purple: "#a05f8b",
        raised: "#ffffff",
        "raised-shadow": "0 1px 2px #a9741a1f, 0 0 0 0.5px #dfbe6e33",
        "shadow-composer": "0 2px 10px #c99a2e1f, 0 0 0 1px #f0dda4b3",
        "shadow-dialog": "0 16px 40px #a9741a29",
        "sidebar-glass-sheen-bottom": "#f0a21a1f",
        "sidebar-glass-sheen-top": "#ffffff99",
        "sidebar-glass-tint": "#fdf2cb59",
        success: "#47a233",
        "switch-knob-off": "#ffffff",
        "switch-knob-on": "#ffffff",
        "switch-ring-off": "#c99a2e5c",
        "switch-track-off": "#d9b45780",
        "switch-track-off-hover": "#c99a2e99",
        "text-faint": "#a08a5e",
        "text-muted": "#7e643d",
        "text-primary": "#3a2a0f",
        "text-secondary": "#63502a",
        tile: "#ffffff99",
        "tile-deep": "#fbe3a8e6",
        "tile-hover": "#fff7e3f2",
        warning: "#c97a09"
      },
      { on: true, kind: "gradient", angle: 180, from: "#fef8e6", to: "#fae5ac" },
      {
        shell: { fill: "#fefbf2" },
        sidebar: {
          image: {
            on: true,
            image: "20260916-124617-278-394b",
            size: "cover",
            repeat: "no-repeat",
            position: "center"
          }
        },
        main: {
          fill: "#fefbf2",
          image: {
            on: true,
            image: "20260916-124024-579-0962",
            size: "cover",
            repeat: "no-repeat",
            position: "center"
          }
        },
        dock: { fill: "#fdf8e8" },
        titlebar: {
          fill: "transparent",
          gradient: { on: true, angle: 180, from: "#fadf9666", to: "#fffcf2b3" },
          blur: 12
        },
        thread: {
          fill: "transparent",
          image: {
            on: true,
            image: "20260916-124730-963-7787",
            size: "cover",
            repeat: "no-repeat",
            position: "top"
          }
        },
        composer: {
          fill: "#ffffff",
          gradient: { on: true, angle: 180, from: "#ffffff", to: "#fffcf1" }
        }
      },
    ),

    /*
     * QQ 2009：两张贴图的皮肤（浅色）—— 整窗一张云朵 / 企鹅 / 草地，左栏另有一张竖图。
     *
     * 来历和前面两套一样：用户在面板里先调出来（当时 id 派生成 qq、label「QQ 风格」），
     * 现在收进预设。两张贴图随包分发（assets/presets/<图片 id>.png），加载时落进插件数据
     * 目录；图片 id 原样保留 —— 用户手里那套同 id 同设计的主题会被认领成预设。
     *
     * 这套的难点是「图铺满、字还得看得见」，靠的是**分层**，不是单靠颜色：
     *   · 区域底色画在区域自己那张图的下面，压不住同一块区域的图；而宿主在 Windows 上不给
     *     侧边栏铺玻璃色罩（--ds-sidebar-glass-* 只出现在 [data-platform=darwin] 的规则里），
     *     所以左栏那层霜白 + 毛玻璃只能由左栏区域自己出；
     *   · 左栏竖图因此放在**顶层 sidebar 槽**（画在 .sidebar 本体上），左栏区域
     *     （.sidebar-body）那层给 backdrop-filter: blur(2px) + 62% 霜白 —— 只有这一层才叠在
     *     图上，而不是被图盖住。模糊只给 2px 是用户自己挑的：毛玻璃要淡，对比度主要由霜白扛。
     *     余下一条缝：侧栏顶栏（.sidebar-header，46px）在两层之外，换深色图时那一行压在图本体上。
     *   · 中栏 84% 霜白；文字四档全部**实色加深**。按这张图逐像素算：正文最坏 5.1:1、
     *     典型 7.0:1；次级 / 弱化两档典型 4.8–4.9:1，低于 4.5:1 的像素约 1.5%。
     * 两张贴图字节经 TinyPNG（tinify API）压缩：宽高不变，1.65 MB + 1.71 MB → 460 KB + 438 KB。
     */
    preset(
      "qq-2009",
      "QQ 2009",
      "light",
      {
        accent: "#2f8bf7",
        "accent-hover": "#1a72e0",
        "accent-soft": "#a6cff0",
        "bg-active": "#1b7ac64d",
        "bg-chip": "#1b7ac61f",
        "bg-composer": "transparent",
        "bg-dock": "#b5dffd",
        "bg-dock-raised": "#ffffff8c",
        "bg-elevated": "#ffffffeb",
        "bg-elevated-opaque": "#f7fbff",
        "bg-elevated-primary": "#fffffff7",
        "bg-hover": "#2e86cc26",
        "bg-inset": "#dbeefa",
        "bg-primary": "transparent",
        "bg-secondary": "#e7f4fd",
        "bg-sidebar": "#f6fbff99",
        "bg-tertiary": "#f7fbff",
        "bg-under": "#7ec8fb",
        "border-default": "#a8c6e2",
        "border-strong": "#6e9cc6",
        "border-subtle": "#c8dcee",
        "composer-radius": "6px",
        "composer-radius-lg": "10px",
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
        "text-faint": "#2d5173",
        "text-muted": "#24486b",
        "text-primary": "#0c3050",
        "text-secondary": "#234a70",
        tile: "#ffffffe6",
        "tile-deep": "#d8eafbf2",
        "tile-hover": "#fffffff2",
        warning: "#f0a020"
      },
      { on: true, image: "20260916-152102-958-cae6", size: "cover", repeat: "no-repeat", position: "center" },
      {
        shell: {
          fill: "#f0f7ffcc",
          image: {
            on: true,
            image: "20260916-150732-378-d342",
            size: "cover",
            repeat: "no-repeat",
            position: "center"
          }
        },
        sidebar: { fill: "#f6fbff9e", blur: 2 },
        main: { fill: "#f8fcffd6" },
        dock: { fill: "transparent" },
        titlebar: {
          fill: "transparent",
          gradient: { on: true, angle: 180, from: "#d9edfecc", to: "#a9d8fdd9" },
          blur: 12
        },
        thread: { fill: "transparent" },
        composer: {
          fill: "transparent",
          gradient: { on: true, angle: 180, from: "#ffffff", to: "#eaf6fe" }
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
