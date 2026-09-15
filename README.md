# 主题工坊 Theme Studio（`pi.theme.studio`）

把 PI-Desktop 的外观调成你自己的样子：内置 6 套配色起手（Aurora / Ember / Nocturne / Paper / Sand / QQ 2008），改完一键应用 —— 应用窗口立刻换色，不需要重启。

- **7 个可独立设置的区域**：整窗、左栏、中栏、右栏、标题栏、会话区、输入栏 —— 各自可设底色、渐变、图片、背景模糊与圆角。
- **预览就是真窗口**：预览按真窗口的 1280×800 渲染，类名与度量逐条对齐宿主样式表，所以「预览里长这样」等于「应用里长这样」。
- **点哪里改哪里**：在预览里点你想改的那一块，右侧浮出那一块的设置。
- **56 个 `--ds-*` token** 全部可改，带 WCAG 对比度检查。
- **图片零重载**：PNG 拖进来即用，存在插件自己的数据目录里，主题 CSS 直接引用绝对路径。

## 结构

```text
pi.theme.studio
├─ manifest.json            面板 + 停靠视图 + 1 条命令（+ 2 个静态贡献主题占位）
├─ main.js                  插件进程（CJS）：onLoad / onUnload / onPanelInvoke
├─ lib/
│  ├─ theme-core.mjs        56 个 token 表、7 个区域、序列化、对比度与颜色计算
│  └─ presets.mjs           6 套内置配色（QQ 2008 带一张随包的 8×8 贴图）
├─ assets/presets/           预设随包的贴图（加载时复制进数据目录，CSS 用绝对路径）
├─ src/                     渲染层源码：React + Tailwind + shadcn/ui 风格组件
│  ├─ main.tsx              挂载
│  ├─ styles.css            Tailwind 与工坊调色板（--ui-*），预览配色是另一条线
│  ├─ lib/                  pluginBridge 封装、类型、主题模型的类型再导出
│  ├─ store/                唯一的状态源（库 / 设计 / 面板 / 防抖保存）
│  ├─ components/ui/        shadcn/ui 风格原子组件（Button / Tabs / Slider / …）
│  └─ features/
│     ├─ preview/           宿主复刻：调色板快照、度量、区域点选、有效颜色探针
│     ├─ shell/             顶栏、主题库、画布、悬浮球轨道、悬浮面板、状态条
│     └─ panels/            区域 / Token / 图片 / 检查 + 拖拽上传
├─ index.html               Vite 入口（构建后成为 renderer/index.html）
└─ renderer/                构建产物：index.html + assets/*.js + assets/*.css
```


## 让 Agent 帮你建主题

装上之后，你可以直接用一句话让 Agent 干活，不用自己点面板：

> 把 `C:\pics\scene.png` 作为整窗背景，内容区都透出来；强调色换成暖橙；新主题叫「黄昏」

Agent 手上有四个工具（名字前面会带插件前缀）：

| 工具 | 作用 |
| --- | --- |
| `theme_studio_list` | 有多少个主题、各自叫什么、哪个正在用、图片库、可设置的区域 id、全部可改的 token。Agent 动手前会先看这个。 |
| `theme_studio_import_image` | 把用户给的 PNG **绝对路径**导入图片库，得到 id（同一张图要用在多处时才需要单独做）。 |
| `theme_studio_write` | 新建或修改一个主题：token、区域底色/渐变/图片/模糊/圆角、左栏底图、以及「把上层透出来」。 |
| `theme_studio_delete` | 删除主题（只在明确要求时用）。 |

几件它已经替你想到的事：

- **新建还是修改**：不传 `id` 就是新建（返回值里给出 id）；传了 `id` 就只改传进来的字段，其余原样保留。传 `applied` / `active` 表示「正在用的那个」/「面板里正在编辑的那个」。
- **「要透明 / 透出来」**：区域 `fill: "transparent"` 让下层透出来；整窗还会连带放开 `bg-primary` / `bg-sidebar` / `bg-composer`；图放了却看不见就用 `reveal: true`（等价于面板的「一键透出」）。
- **左栏**：底图用 `sidebar` 字段（宿主真正消费 `--ds-bg-sidebar-image` 的地方，开箱可见）；整体配色改 token `bg-sidebar`；`regions` 里的 `sidebar` 只管那块列表区域的底色/圆角。
- **右栏不给图**：内嵌的插件视图是原生 `WebContentsView`，图片盖不住它，工具会直接说明而不是假装成功。
- **图片校验**：只收 PNG（按魔数，不认扩展名）、绝对路径、单张 ≤ 4MB。
- **内置预设**：改预设时会先复制一份再改，预设保持原样，返回值里的 `copiedFrom` 说明来源。
- **不会静默成功**：传错的 token / 区域 / 颜色会返回带原因的 `{ ok: false, error }`，Agent 会自己改对再试。

工具只在 **Agent 模式**可用 —— 它们没有声明 plan-safe 动作，所以按宿主规则在 Plan/Goal 模式下对模型不可见（写主题、删主题不该发生在计划阶段）。

`renderer/` 是**构建产物**，不要手改 —— 改 `src/` 再构建。`lib/*.mjs` 是 ESM，插件进程与面板
import 的是同一份实现，所以两者不可能漂移。

## 安装

- **开发**：PI-Desktop 的「插件」页 →「加载开发插件」→ 指向本目录。之后改插件里任何文件都会
  热重载（`node_modules`、`.git`、`dist` 除外）。
- **使用**：`pnpm pi-plugin pack .` 打包后在「插件」页安装（市场/更新流程见宿主仓库规格）。

加载后「主题工坊」出现在工作面板的应用菜单里；也可以执行命令 **主题工坊：打开**。

## 开发与构建

```bash
npm install          # 只装渲染层的构建依赖（React / Tailwind / Vite / Radix）
npm run build        # 构建到 renderer/（交付物）
npm run dev          # 同样输出到 renderer/，改动即重建
npm run typecheck    # tsc --noEmit，strict
```

面板是 `file://` 加载的，所以产物必须是**单包 IIFE**（`type="module"` 在 file:// 下会被 CORS
拒掉，宿主内置插件同样是这个形态）。构建配置里因此还有两件必要的事：把入口脚本改回经典
`<script defer>`，以及关掉 code split。细节写在 `vite.config.mts` 的注释里。

## 用法

| 步骤 | 说明 |
| --- | --- |
| 选主题 | 左栏是主题库：折叠后只剩左上角一颗悬浮按钮。分「我的主题 / 内置预设 / 宿主主题」三组；预设只读，复制一份即可改。 |
| 点哪里改哪里 | 在预览里点你想改的那一块。右侧浮出「区域」面板，只显示这一块。嵌套时按最内层算；`Esc` 回上一层；点预览外面的空白（或 `Alt`+点）选最底层的**整窗**。 |
| 分区设背景 | 区域面板里：底色、渐变（角度 + 两端色）、图片（拖 PNG）、背景模糊、圆角。 |
| 让底图看得见 | 图片被上层挡住了：点「一键透出」，把更深层的区域底色设成透明；整窗还会顺带放开 `bg-primary` / `bg-sidebar` / `bg-composer`。 |
| Token | 悬浮面板的「Token」页：56 个变量按组折叠，未改的显示宿主当前值。颜色支持 `#rrggbb` / `#rrggbbaa` / `transparent`。 |
| 图片 | 「图片」页列出你上传过的 PNG、它被谁用着、合计大小；也列出数据目录里没有登记记录的孤立文件。 |
| 检查 | 「检查」页：WCAG 2.1 对比度表，半透明前景会先合成到背景上再算。低于 4.5:1 标红但不阻止保存。 |
| 缩放 | 画布工具条上的「适应 / 50% / 75% / 100%」，或 `Ctrl`/`⌘` + 滚轮（0.25–2 连续档）。缩放只改观看倍率。 |
| 快捷键 | `Ctrl/⌘+S` 注册当前主题；`Ctrl/⌘+R` 聚焦主题名改名；`Esc` 收面板 / 回上一层。 |
| 应用 | 「应用」把当前主题设为应用主题；「保存并应用」先注册再切换。 |

主题设计与图片登记都存在插件自己的 settings（`studioState`），跨重启保留；卸载插件即一并清除。

## 落盘通道：只有一条

主题通过 **运行时注册**（`pi.themes.upsert`，ADR 0249）交给宿主：改完立刻生效，**不写插件包内
的任何文件**，所以开发插件监听器不会因为「保存」而重载插件、也不会顺手关掉面板窗口。

宿主的运行时通道只给 `url()` 一个来源：**绝对路径**（ADR 0255）。图片落在插件数据目录里，
主题 CSS 写它的绝对路径（正斜杠），宿主解析后把字节交给渲染进程。这就是「上传图片零重载」的
全部原理。

## 图片

完整链路见 **[docs/image-pipeline.md](docs/image-pipeline.md)**。规则：

- **唯一来源**：你自己选的本地 PNG（只收 PNG，按魔数校验，单张 ≤ 4MB）。
- **存在哪**：插件的**数据目录** `pi.plugin.getDataPath()/images/<时间戳>-<4 位随机>.png`。
  不在插件包里 —— 开发插件监听器递归盯着插件包，往包里写文件会重载插件并关掉面板窗口。
- **每次上传都是新文件**，不按内容去重；一张图只属于一个主题（登记表里记 `owner`）。
- **删除**：文件消失，同时把所有设计里对它的引用清成「没有图片」。
- **看得见的前提**：宿主每一栏都有自己的不透明底色（`.app-shell` / `.main-pane` /
  `.composer-shell` …），底图藏在它们后面 —— 用「一键透出」把上层放开。左栏图片走
  `--ds-bg-sidebar-image`，是唯一开箱可见的位置。

## 预览是怎么做到保真的

预览不是「差不多的示意图」，而是**真窗口的静态复刻**：

- **DOM 结构与类名用宿主的**（`.sidebar` / `.conversation-topbar` / `.thread-content` /
  `.composer-shell` / `.work-panel` …），所以主题里按真实选择器写的规则在预览里同样生效。
- **调色板快照**：面板是独立文档，拿不到宿主的 `--ds-*`，所以 `host-tokens.css` 把
  `apps/desktop/src/styles/tokens.css` 抄了一份（含圆角、字号、行高这些派生尺度）。
- **度量逐条对照**：`host-replica.css` 的每一段都注明出处（chrome.css / chat-shell.css /
  composer.css / messages.css / work-panel.css / prose.css），宿主改度量时按同一处改。
- **区域点选不写死在 JSX 里**：挂载后按 `lib/theme-core.mjs` 的 `REGIONS` 贴 `data-region`，
  区域表是唯一真相。
- **「当前值」来自真实渲染**：对比度与 token 的生效值是把 CSS 变量涂到 1×1 画布上读回来的
  真实 RGBA —— 宿主默认值大量使用 `color-mix()`，它的计算值是 `oklab(...)`，用颜色解析器读
  不出来。

## 权限

声明的都是第三方插件做同样的事所需的公开权限：

```text
ui.panel              独立面板窗口
ui.view               停靠工作面板视图
ui.theme              贡献主题
fs.read   （中危）     导出/导入时弹宿主的原生目录对话框
agent.tool.register（高危）注册 Agent 工具
```

`fs.read` 只用来弹「选一个文件夹」的对话框（宿主对 `pi.fs.requestDirectory` 的鉴权就是它）。
zip 的读写走的是原生 `node:fs`，范围**只有你刚刚选中的那个目录**：文件名由插件固定
（`<主题名>-<时间戳>.zip`、`<主题名>-预览-<时间戳>.png`），不递归、不遍历、不碰别处；
图片仍然只写进插件自己的数据目录。

不申请 `fs.write`、不申请网络，不读工作区，不联网。

## 导出与导入

「导出」下拉（顶栏）里三件事都只针对**当前选中的主题**：

| 菜单项 | 产物 |
| --- | --- |
| 打包为 ZIP… | 一个自包含的 zip：`theme.json`（完整设计）/ `theme.css`（可直接给人用）/ `preview.png`（1280×800 预览图）/ `images/*.png`（原图字节）/ `README.txt` / `manifest.json`（清单）。位置由你在原生对话框里选。 |
| 预览图 PNG… | 只导出那张预览图。 |
| 复制 CSS | 复制到剪贴板（不变）。 |
| 导入主题… | 选 zip **所在的文件夹** —— 插件会找那个 `*.zip` 并还原（图片落进本机数据目录、引用改写成新 id）。把 zip 解开放进一个文件夹同样能导入。 |

为什么是「文件夹」：宿主给插件的只有目录选择对话框（没有保存/选文件对话框）。导出时文件
名由插件生成；导入时请把要导入的那个 zip 单独放一个目录，或者直接选解开的导出包目录。

导入**不会覆盖**已有主题：id 冲突会派生成 `xxx-2`，结果会在状态栏里说明。

## 宿主强制的限制（插件一视同仁，也不额外加码）

| 限制 | 来源 |
| --- | --- |
| 单个主题 CSS 文本 ≤ 256 KB | `packages/plugin-sdk/src/theme-css.ts:1` |
| 单个主题声明的资源文件合计 ≤ 4 MB | `theme-css.ts:15` / `crates/host-core/src/plugins/validation.rs:541` |
| 资源扩展名白名单 7 种：png / jpg / jpeg / webp / avif / svg / woff2 | `validation.rs:538` |
| 声明的资源文件必须真实存在，否则整个插件 `PLUGIN_INVALID` | `validation.rs:230-236` |

256 KB 只管 **CSS 文本**；图片以绝对路径引用，不占这 256 KB，但图片**字节**另外算在上面那个
4 MB（每主题）预算里，所以它不是免费的。

插件本身**不设**主题数量上限，也不设设置大小上限 —— 宿主对两者都没有限制。

## 设计边界（已知取舍）

- **没有 `windowAppearance`。** 原生窗口底色是**按插件**声明的，而一个插件里有 5 套以上
  配色，任何单一取值都会对不上多数主题，所以本插件不声明它。代价是拖动窗口尺寸时可能
  有一帧露出宿主的默认底色。
- **右栏只提供底色。** 右栏内嵌的插件视图 / 浏览器是原生 `WebContentsView`，永远画在渲染
  进程之上，图片盖不住它 —— 与其让用户误会，不如不给这个开关。
- **预览的版面细节是复刻，不是像素级镜像。** 图标、字体度量与实际窗口存在近似；最终确认请
  在真实窗口里看。
- **顶栏要让出宿主的窗口控制胶囊。** 顶部 `var(--pi-plugin-titlebar-height)`（独立窗口 46px，
  停靠视图 0）是宿主的，页面自己把内容排到它下面。

## 校验

```bash
pnpm pi-plugin check "C:\Code\PiPlugProjects\pi-desktop-plugin-pi-theme-studio"
```

它用宿主真实的 `validateManifest` + `validateContributions` 校验 manifest，并检查声明的每个
资源文件是否真的存在。
