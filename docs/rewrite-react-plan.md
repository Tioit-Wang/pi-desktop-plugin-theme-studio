# 渲染层重写计划（React + Tailwind + shadcn/ui）

状态：**进行中**。插件进程（`main.js`）与共享主题模型（`lib/*.mjs`）不动；被重写的
只有渲染层（现在的 `renderer/index.html` + `studio.css` + `studio-app.js`）。

## 1. 为什么能这么做（宿主侧的硬约束）

| 事实 | 出处 | 影响 |
| --- | --- | --- |
| 面板用 `loadURL(pathToFileURL(html))` 加载 | `apps/desktop/electron/main/plugin-panel-host.ts` | 产物必须是**经典脚本 + 相对路径**：file:// 下 `type="module"` 会被 CORS 拒掉 |
| 内置插件 `pi.file-manager` 的 `views/index.html` 用的就是普通 `<script>` | 同上仓库 | 打包成单包 IIFE 是官方先例 |
| 开发监听器忽略 `node_modules` / `.git` / `dist` / `target` | `apps/desktop/electron/main/plugin-watcher.ts` | 可以在插件目录里放 node_modules 与构建中间产物 |
| `pi-plugin pack` 同样排除这些目录，且限 2000 文件 / 50MB | `docs/spec/07-plugins/10-plugin-devex.md` | 只发构建产物，不发源码与依赖 |
| 插件进程：先 `require(entry)`，`ERR_REQUIRE_ESM` 时退到 `import()` | `apps/desktop/electron/main/plugin-host-process.mjs` | `main.js` 保持 CJS，`lib/*.mjs` 用动态 import 加载 |
| `ui.panel` 与 `contributes.views[].entry` 都指向 `renderer/index.html` | `manifest.json` | Vite 的 `outDir` 就是 `renderer/` |

## 2. 技术栈

- **Vite 8** + `@vitejs/plugin-react`，产物：`renderer/index.html` + `renderer/assets/index.js`（单包 IIFE）+ `assets/style.css`
- **React 19** + TypeScript 5.9（`strict`）
- **Tailwind v4**（`@tailwindcss/vite`）；`@theme inline` 把工坊的 `--ui-*` 调色板映射成
  shadcn 的语义 token（`bg-background` / `text-muted-foreground` / `border-border`），
  另有一套 `text-ui-*` 字号档与宿主同源的圆角阶梯
- **shadcn/ui 风格组件**（源码在 `src/components/ui/`，不跑 CLI）：Button / Input / Label /
  Card / Tabs / Slider / Switch / Select / Tooltip / Separator / ScrollArea / Badge /
  ToggleGroup / Collapsible
- **zustand**（一个设计态的 store）、**lucide-react**（图标）

### 观感定位（已确认）

工坊**自己的界面**按 shadcn 的默认观感重做：控件 32/36px、间距宽松、卡片式分区。
**预览本身不受影响** —— 它必须继续 1:1 复刻真窗口（1280×800，宿主度量）。两条线在
CSS 里是分开的：`--ui-*` 是工坊界面，`--ds-*` 只作用在预览子树上。

## 3. 目录

```text
index.html                  Vite 入口（构建后成为 renderer/index.html）
src/
  main.tsx                  挂载
  styles.css                Tailwind + 工坊调色板 + 主题 token 映射
  lib/
    utils.ts                cn()
    bridge.ts               pluginBridge 封装与通道类型
    theme-model.ts          复用 lib/theme-core.mjs（类型来自 lib/theme-core.d.mts）
    format.ts               尺寸 / 颜色 / 对比度格式化
  store/studio-store.ts     library + design + 选择 + 面板 + 保存防抖
  components/ui/            shadcn 风格原子组件
  features/
    shell/                  外壳：顶栏、主题库、画布、悬浮球轨道、悬浮面板、状态条
    preview/                宿主复刻：host-tokens.css / host-replica.css / 区域点选 / 缩放
    panels/                 区域 / Token / 图片 / 检查 四个面板 + 拖拽上传
```

## 4. 移植清单（旧 → 新）

| 旧渲染层 | 新位置 | 说明 |
| --- | --- | --- |
| `index.html` 的顶栏 / 左栏 / 画布 / 右缘轨道 | `features/shell/*` | 布局与交互保持：左栏可折叠成左上悬浮球、右侧非常驻悬浮面板 |
| `studio.css` 的 `--ui-*` 段 | `src/styles.css` | 已迁移 |
| `studio.css` 的 `--ds-*` 快照段 | `features/preview/host-tokens.css` | 宿主调色板 + 尺度快照，纯 CSS 保留（便于与宿主逐行对照） |
| `studio.css` 的预览度量段 | `features/preview/host-replica.css` | 逐条对应宿主样式表；区域类的类名保持宿主原名 |
| `studio-app.js` 的库渲染 / 选中 / 保存 | `store/studio-store.ts` + `features/shell/LibraryColumn.tsx` | 600ms 防抖保存、运行时注册、零重载 |
| `studio-app.js` 的区域面板 / 点选 / 面包屑 | `features/panels/RegionPanel.tsx` + `features/preview/useRegionPick.ts` | 最内层优先、`Esc` 上跳、`Alt`+点整窗、点空白整窗 |
| `studio-app.js` 的 token 面板 | `features/panels/TokenPanel.tsx` | 56 个 token 分组 + 搜索 + 宿主默认值回退 |
| `studio-app.js` 的图片管线 | `features/panels/ImagesPanel.tsx` + `ImageDropzone.tsx` | 拖拽 PNG（魔数校验）、4MB 上限、存插件数据目录、绝对路径 |
| `studio-app.js` 的对比度表 | `features/panels/AuditPanel.tsx` | WCAG 2.1，半透明前景先合成 |
| `appearance.js` | `store/appearance.ts` | 只取基调与语言，忽略宿主注入的插件主题 CSS |

## 5. 切换步骤

1. 功能移植完成、在 harness 里逐项验证（预览几何、点选、保存、图片、对比度）
2. `npm run build` → 产物落进 `renderer/`，删除旧 `renderer/*.{html,css,js}`
3. `manifest.json` 版本 → 0.8.0 + changelog；README 说明「`renderer/` 是构建产物」
4. 在 dev 宿主里开面板走一遍：预览保真、点选、改 token 立即生效、存图、应用主题
5. 提交并推分支，等评审后再合 main
