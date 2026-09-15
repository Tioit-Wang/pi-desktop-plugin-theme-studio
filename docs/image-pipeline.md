# 图片链路：从选文件到铺满窗口

本文描述 **v0.6.0** 的实际行为，每处结论都对应代码位置。要回答四个问题：图片存在哪里、
怎么被读取、怎么变成背景图、当前支持到什么程度。

---

## 0. 一句话结论

- 图片**只有一个来源**：你在系统文件选择器里选的本地 PNG。
- 文件落在**插件数据目录** `pi.plugin.getDataPath()/images/<时间戳>-<4位随机>.png`，
  **不在插件包里**。
- 主题 CSS 直接引用它的**绝对路径**；宿主解析并交给渲染进程（宿主 ADR 0255），
  所以主题走 `pi.themes.upsert` 注册即可，**不写任何包内文件、不触发重载**。
- 「整窗」底图要看得见，需要把盖在它上面的层透明 —— 面板里有「一键透出」。

---

## 1. 数据存在哪里

| 位置 | 内容 | 谁在什么时候写 |
| --- | --- | --- |
| `<getDataPath>/images/<时间戳>.png` | 图片文件本体 | `studio.image.put` → `putImage`，选完文件立刻写 |
| 插件 settings 的 `studioState.images` | 登记表：`id → { path, bytes, name, addedAt, owner }` | 同上 |
| `studioState.themes[].regions[].image` | 设计里的引用：`{ on, image: <id>, size, repeat, position }` | 面板每次改动（自动保存） |

插件包内**没有**图片，也不再改 `manifest.json` 的 `assets`。

---

## 2. 应用窗口的读取链路

```text
[面板] 你点「选择 PNG 文件…」
   │  bytes（走 panel 通道）
   ▼
studio.image.put（main.js: putImage）
   ├─ 校验：非空、PNG 魔数、单张 ≤ 4MB（宿主上限）
   └─ 写 <getDataPath>/images/<时间戳>.png  +  登记 studioState.images[id]
      （数据目录不在开发插件监听器范围内 → 不重载、面板不掉）
   ▼
[面板] 设计里的 image 字段被写成这个 id → 自动保存 studio.theme.save
   ▼
registerTheme（main.js）→ pi.themes.upsert({ id, label, base, css })
   └─ css 里出现 background-image: url("C:/Users/…/images/<时间戳>.png")
      （纯 IPC 文本，不写文件 → 不重载）
   ▼
[宿主] plugin-runtime.ts → themes.upsert
   ├─ sanitizeThemeCss(css, 256KB, resolver)
   │    resolver = externalThemeAsset()：绝对路径 + 白名单扩展名 + 文件存在 + ≤4MB
   │    → 登记进该插件的资源表，并改写成 plugin-asset://<pluginId>/<percent-encoded 路径>
   └─ 主题进入运行时注册表（卸载插件即整表清空）
   ▼
[渲染进程] 浏览器请求 plugin-asset://…/%2FUsers%2F…%2Fimg.png
   ▼
[主进程] plugin-asset-protocol.ts → decodeURIComponent → resolveThemeAsset → readFileSync
         响应 200 / image/png / no-store
   ▼
        像素铺到目标选择器上（见 §4 分层）
```

要点：**换图字节不用重载**（每次请求都重新读文件），**换路径也不用**（upsert 是消息）。

---

## 3. 面板预览的链路

```text
[面板] paintPreview() → core.serialize(..., resolveImage = resolvePreviewImage)
   ├─ 先看缓存 state.previewData[id]
   │    ← prefetchPreviewImages() 通过 studio.image.read 预读（data:image/png;base64,…）
   └─ 缓存没有 → plugin-asset://<插件>/<encodeURIComponent(绝对路径)>
   → 写进 <style id="pv-theme">，作用在预览副本上
```

`data:` 这条兜底是必须的：面板是独立 session 的沙箱页，`studio.image.read` 一定可用。

---

## 4. 分层：为什么图片经常「没有效果」

```text
:root (html)            ← 主题的 :root 规则落在这里
└── .app-shell          ← background: var(--ds-bg-primary)        base.css:167      不透明
    ├── .sidebar        ← background-image: var(--ds-bg-sidebar-image)  chrome.css:202
    ├── .main-pane      ← background: var(--ds-bg-primary)        chat-shell.css:47 不透明
    │   ├── .main-titlebar   ← 自身没有底色
    │   └── .thread-scroll   ← 自身没有底色
    ├── .composer-shell ← background: var(--ds-bg-composer)       composer.css:128  不透明
    └── .work-panel-main ← 自身没有底色（内嵌原生 WebView 永远在最上层）
```

三条可见性规则：

1. 一个区域设了图片，只有它**上面的每一层都透明**时才看得见。
2. **左栏**是唯一开箱可见的位置：走专用 token `--ds-bg-sidebar-image`。
3. **整窗**同时写到 `:root` 和 `.app-shell`；面板的「一键透出」会把更深层区域底色设为
   `transparent`，整窗还会顺带放开 `bg-primary` / `bg-sidebar` / `bg-composer`。

区域 → 选择器（`lib/theme-core.js` → `REGIONS`）：

| 区域 | 选择器 | 能否设图 |
| --- | --- | --- |
| 整窗 | `:root` + `.app-shell` | 能 |
| 左栏 | `.sidebar-body`（图片另走 token） | 能 |
| 中栏 | `.main-pane` | 能 |
| 右栏 | `.work-panel-main` | **不能**（只提供底色） |
| 标题栏 | `.main-titlebar` | 能 |
| 会话区 | `.thread-scroll` | 能 |
| 输入栏 | `.composer-shell` | 能 |

---

## 5. 宿主强制的约束

| 约束 | 来源 |
| --- | --- |
| 单个主题 CSS 文本 ≤ 256 KB | `packages/plugin-sdk/src/theme-css.ts:1` |
| 单个资源文件 ≤ 4 MB；声明资源合计 ≤ 4 MB | `theme-css.ts:15` / `plugin-runtime.ts` `externalThemeAsset` |
| 资源扩展名 7 种：png / jpg / jpeg / webp / avif / svg / woff2 | `theme-css.ts:4` |
| 资源必须是**绝对路径**且文件真实存在 | ADR 0255 / `normalizeThemeAssetPath` |
| 主题 CSS 禁止 `@import`、标记、`javascript:` | `sanitizeThemeCss` |
| 插件卸载即撤销其全部资源 URL | `plugin-runtime.ts` 卸载路径 |

插件自己**不设**数量上限、不设累计大小上限、不做内容去重。

---

## 6. 当前版本支持什么

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 选本地 PNG 当背景 | ✅ | 系统文件选择器；只收 PNG |
| 一张图只属于一个主题 / 时间戳命名 / 不去重 | ✅ | 登记表里的 `owner` |
| 删除图片（即使正被主题引用） | ✅ | 同时把设计里的引用清成「没有图片」 |
| 面板缩略图 + 预览 | ✅ | 预读 `data:`，选完立刻可见 |
| 左栏背景图 | ✅ | `--ds-bg-sidebar-image`，开箱可见 |
| 整窗 / 中栏 / 标题栏 / 会话区 / 输入栏 背景图 | ✅（需透出） | 机制完整；先「一键透出」 |
| 右栏背景图 | ❌ | 宿主限制：内嵌原生视图永远在最上层 |
| GIF / BMP / HEIC | ❌ | 宿主白名单不含它们 |
| 上传触发插件重载 | ❌（已消除） | 图片在数据目录，CSS 走 upsert |

---

## 7. 已知取舍

- 主题 CSS 里出现的是**绝对路径**：分享主题时对方需要同路径的文件（宿主 ADR 0255 的代价）。
- 图片按内容不去重：同一张图选两次就是两份文件，删一份不影响另一份。
- 预览副本是复刻体，不是真窗口；最终确认请在真实窗口里看。

---

## 8. 代码位置速查

| 做什么 | 看哪里 |
| --- | --- |
| 上传 / 删除 / 清理 / 读成 data: URL | `main.js` → `putImage` / `removeImage` / `pruneImages` / `readImageBytes` |
| 图片绝对路径与可用性 | `main.js` → `imageTarget` / `imageUsable` / `imagePath` |
| 主题注册（唯一通道） | `main.js` → `registerTheme` / `refreshThemes` |
| 面板选图、缩略图、图片库、一键透出 | `renderer/studio-app.js` → `imageUpload` / `imagePicker` / `imageLibrary` / `revealControl` |
| 预览取图 | `renderer/studio-app.js` → `resolvePreviewImage` / `prefetchPreviewImages` |
| 区域与选择器、序列化 | `lib/theme-core.js` → `REGIONS` / `serialize` |
| 宿主侧放行与改写 | `apps/desktop/electron/main/plugin-runtime.ts` → `externalThemeAsset` / `resolveThemeAssets`；`plugin-asset-protocol.ts` |
