# Agent 工具

让 Agent 直接用一句话建/改主题，例如
「把 `C:\pics\scene.png` 作为整窗背景，内容区都透出来」「左栏换成冷紫渐变」。

四个工具，注册在 `main.js` 的 `registerAgentTools()`，声明在 `manifest.json` 的
`contributes.agentTools[]`（**两处必须一致**：宿主按 manifest 授权与展示，运行时按
`pi.agent.registerTool` 再注册一次）。

| 工具 | 作用 | risk |
| --- | --- | --- |
| `theme_studio_list` | 有多少个主题、各自叫什么、哪个在用、图片库、区域 id 表、全部可改 token | low |
| `theme_studio_import_image` | 用户给的 PNG 绝对路径 → 图片库里的 id | medium |
| `theme_studio_write` | 新建或修改一个主题（tokens / 区域 / 左栏底图 / 透出） | medium |
| `theme_studio_delete` | 删除主题（可选顺带清理未引用的图片） | high |

权限：`agent.tool.register`（矩阵里是 high，安装时确认）。四个工具**不声明**
`planSafeActions`，所以按宿主规则只在 Agent 模式可用 —— Plan/Goal 模式下对模型不可见，
这是有意的：写主题、删主题不该发生在计划阶段。

## 语义：声明式合并

`theme_studio_write` 只改**传进来的字段**，其余原样保留。因此同一个工具既能新建也能微调，
Agent 不用记两套语义。

| 传入 | 行为 |
| --- | --- |
| 不传 `id` | 新建。id 由 label 派生（有 ASCII 就用 slug；纯中文退化成 `custom-N`，与面板命名一致），返回值里给出 |
| 传 `id`（字面量） | 改那个主题 |
| 传 `id: "applied"` / `"active"` | 解析成「当前应用中的」/「面板里在编辑的」——仅当库里没有恰好叫这个名字的 id |
| 传 `id` 但库里没有 | 报错并列出可用的 id。**不静默新建**，否则用户以为在改、其实多出来一个 |
| `id` 命中 `builtin: true` 预设 | 先复制一份（`<label> 副本`，id 形如 `contrast-2`）再改，预设保持原样；返回值 `copiedFrom` 说明来源 |

返回值里的 `report` 逐项列出做了什么（`tokensSet` / `tokensCleared` / `regions[].changes` /
`revealed` / `images` / `sidebar`），让 Agent 能准确复述，而不用回头再 list 一遍。

校验失败一律返回 `{ ok: false, error }`（不是抛异常）：模型拿到的是带 key、值、可用集合的
结构化原因，能自己改对重试。四个工具在这件事上一致。

## 「什么地方的背景 / 要不要透明」的映射

写进 `list` 的 `notes` 与 `write` 的 description，不让模型猜：

| 用户说法 | 怎么写 |
| --- | --- |
| 整窗 / 全局背景图 | `regions: [{ region: "shell", imagePath, reveal: true }]` |
| 左栏背景图 | `sidebar: { kind: "image", imagePath }` |
| 左栏整体配色（「左栏压暗」） | `tokens: { "bg-sidebar": "#070b16" }` |
| 中栏 / 右栏 / 标题栏 / 会话区 / 输入栏 | `regions: [{ region: "main" \| "dock" \| "titlebar" \| "thread" \| "composer", … }]` |
| 「要透明 / 让下层透出来」 | 区域 `fill: "transparent"`；整窗再加 `tokens: { bg-primary / bg-sidebar / bg-composer: "transparent" }` |
| 「图放了但看不见」 | 该区域 `reveal: true`（等价面板的「一键透出」） |

被**明确拒绝**的两种写法（报错里说明原因并指向正确字段）：

- 右栏给图片 —— 内嵌的插件视图是原生 `WebContentsView`，永远画在渲染进程之上。
- `regions` 里的 `sidebar` 给 `imagePath` —— 左栏底图只有 `sidebar` 字段这一条路
  （宿主消费 `--ds-bg-sidebar-image` 的地方）；`regions.sidebar` 只管那块列表区域的底色/圆角。

## 图片

`imagePath`（绝对路径，同一次调用里导入）或 `imageId`（复用已导入的）。校验：

- 必须是**绝对路径**，必须是文件
- 按**魔数**确认是 PNG（不认扩展名）
- ≤ 4MB（宿主给单个主题的资源预算）
- 写盘复用 `putImage` —— 与面板上传走同一条通道，命名、登记、错误信息完全一致

## 与面板的关系

工具与面板**共用同一批实现**：`saveTheme`（校验 + 落盘注册）、`putImage`、`removeTheme`、
`pruneImages`，以及 `lib/theme-core.mjs` 的 token 白名单与区域表。所以 Agent 做出来的主题和
面板里手改出来的完全同构，用户之后可以在面板里接着改。

## 改的时候注意

- **加/改工具**：`main.js` 的 descriptors 与 `manifest.json` 的 `contributes.agentTools[]`
  必须同步（name / description / risk / schema 四项）。manifest 的好处是安装时就展示给用户。
- **新增区域或 token**：只改 `lib/theme-core.mjs`；工具会自动跟着走（区域目录、token 目录
  都是从这个模型生成的）。
- **验证**：仓库外的 scratch 套件 `test-agent-tools.cjs` 用桩宿主跑 38 项断言，覆盖新建 /
  修改 / 别名 / 内置预设 / 传图 / 各类错误路径。桩要照着真实 API 形状来（例如
  `pi.themes.list()` 返回 `{id, themeId, label, base}`，不是字符串）。
