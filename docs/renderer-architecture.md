# 渲染层架构（v0.8.0 重写后）

这份文档记录渲染层的**现状**：为什么长这样、约束来自哪里、改的时候该动哪个文件。
（重写前的迁移计划已随实现完成而作废，本文件取代它。）

## 1. 宿主侧的硬约束

| 事实 | 出处 | 影响 |
| --- | --- | --- |
| 面板用 `loadURL(pathToFileURL(html))` 加载 | `apps/desktop/electron/main/plugin-panel-host.ts` | 产物必须是**经典脚本 + 相对路径**：file:// 下 `type="module"` 会被 CORS 拒掉 |
| 内置插件 `pi.file-manager` 的 `views/index.html` 用普通 `<script>` | 同上仓库 | 单包 IIFE 是官方先例 |
| 开发监听器忽略 `node_modules` / `.git` / `dist` / `target` | `apps/desktop/electron/main/plugin-watcher.ts` | 插件目录里可以放依赖与构建中间产物 |
| `pi-plugin pack` 只忽略 `.git` / `node_modules`，限 2000 文件 / 50MB | `packages/plugin-devkit/dist/walk.js` | **`dist/` 会被打进包**，交付前清掉 |
| 插件进程：先 `require(entry)`，`ERR_REQUIRE_ESM` 时才 `import()` | `apps/desktop/electron/main/plugin-host-process.mjs` | `main.js` 保持 CJS，`lib/*.mjs` 用动态 import 加载 |
| `ui.panel` 与 `contributes.views[].entry` 都指向 `renderer/index.html` | `manifest.json` | Vite 的 `outDir` 就是 `renderer/` |
| 顶部 `var(--pi-plugin-titlebar-height)`（独立窗口 46px / 停靠 0）是宿主的窗口控制胶囊 | `preload/plugin-panel.ts` → `publishTitlebarHeight` | 页面自己要把它让出来（`.panel-topbar`），否则右侧按钮被胶囊压住 |
| `pi-plugin-chrome: v3` 会在带子里按可交互元素矩形挖洞 | `preload/plugin-panel.ts` → `PAINT_THROUGH_NO_DRAG_SELECTOR` + MutationObserver | 页面不用自己声明 drag 区域；button/input/[tabindex] 自动可点 |

## 2. 产物形态

```bash
npm run build     # → renderer/index.html + renderer/assets/index.js + assets/style.css
```

- 单包 **IIFE**（`rollupOptions.output.format`），`base: "./"`，关 code split / modulePreload。
- 入口脚本被 Vite 提到 `<head>`；经典脚本没有 module 的天然 defer，所以 `transformIndexHtml`
  里补 `defer`（否则脚本早于 `#root` 出现）。
- 配置是 `vite.config.mts`：根 `package.json` 必须保持 CommonJS（`main.js` 走 `require`），
  所以不能用 `"type": "module"` 让 `.ts` 变成 ESM。

## 3. 目录与职责

| 路径 | 职责 |
| --- | --- |
| `src/main.tsx` | 挂载，CSS 引入顺序（Tailwind 在前，照抄宿主的纯 CSS 在后） |
| `src/styles.css` | Tailwind v4 + 工坊调色板 `--ui-*` + `@theme inline`（shadcn 语义 token、`text-ui-*` 字号档、宿主圆角阶梯）+ `.panel-topbar` |
| `src/lib/bridge.ts` | 通道类型表（与 `main.js` 的 `PANEL_HANDLERS` 一一对应）、错误翻译、图片 URL |
| `src/lib/theme-model.ts` | 再导出 `lib/theme-core.mjs`（类型在 `lib/theme-core.d.mts`） |
| `src/lib/types.ts` | 跨进程契约形状（主题、表面、图片、库响应） |
| `src/store/studio-store.ts` | 唯一状态源：库 / 设计 / 选择 / 楼层 / 面板 / 600ms 防抖保存 / 外观订阅 |
| `src/features/preview/host-tokens.css` | 宿主调色板与尺度快照（抄自 `apps/desktop/src/styles/tokens.css`） |
| `src/features/preview/host-replica.css` | 预览的几何与外观，逐条标注宿主出处 |
| `src/features/preview/preview-overlay.css` | 工坊自己的交互层：悬停提示、选中描边、`data-label` 角标 |
| `src/features/preview/ReplicaShell.tsx` | 1280×800 复刻体（左栏 / 中栏 / 右栏 + 三个视图） |
| `src/features/preview/region-picks.tsx` | 按 `REGIONS` 贴 `data-region`，点击最内层优先，`Esc` 上跳 |
| `src/features/preview/use-effective-tokens.ts` | 用 1×1 画布读出真实 RGBA（对付 `color-mix()` 的 `oklab()` 计算值） |
| `src/features/shell/*` | 顶栏 / 主题库 / 画布（缩放 + 点选）/ 轨道 / 悬浮面板 / 状态条 |
| `src/features/panels/*` | 区域 / Token / 图片 / 检查 四个面板 + 拖拽上传 |

## 4. 两条 CSS 变量线（不要混）

```text
--ui-*   工坊自己的界面。跟随应用基调（appearance 写 <html data-theme>），永远可读。
--ds-*   被编辑主题的候选值。只作用在 .pv-root 这一棵子树上，由 store 算出的 CSS 注入。
```

预览的类名一律用宿主的，所以主题里按真实选择器写的规则在预览里同样生效 —— 这也是为什么
`ReplicaShell.tsx` 里**不允许**出现 Tailwind 工具类。

## 5. 数据流

```text
studio.library（插件进程：主题库 + 宿主默认值 + 图片登记）
      ↓ 选中
当前设计（tokens / sidebarImage / regions）
      ↓ 每次改动（mutate / commit）
React 重绘  →  预览 CSS 注入 → 对比度与「当前值」重新测
      ↓ 600ms 防抖
studio.theme.save → pi.themes.upsert（运行时注册，不写插件包）
      ↓ 如果这个主题正是应用中的那个
应用窗口立刻换色，**不需要重载插件**
```

## 6. 改的时候注意

- **改宿主度量**：先改 `host-replica.css` 里对应那一段（它标了出处），再回宿主确认。
- **`--ds-*` 快照过期**：宿主改 `tokens.css` 时同步 `host-tokens.css`。
- **新增区域**：只改 `lib/theme-core.mjs` 的 `REGIONS` —— 预览打标签、面板列表、面包屑都跟着走。
- **新增面板通道**：`main.js` 的 `PANEL_HANDLERS` + `src/lib/bridge.ts` 的 `Channels` 两处同改，
  调用点由类型兜住。
- **改 Agent 工具**：`main.js` 的 descriptors 与 `manifest.json` 的 `contributes.agentTools[]`
  两处同改；设计说明见 [agent-tools.md](agent-tools.md)。
- **不要**在预览里写 Tailwind 类，也不要让工坊界面的样式泄漏到 `.pv-root` 子树里。
