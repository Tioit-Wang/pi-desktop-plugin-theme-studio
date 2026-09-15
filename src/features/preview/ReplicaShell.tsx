import type { PreviewView } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 预览 = 真窗口的静态快照。
 *
 * 这里的类名**必须**是宿主的（.sidebar / .conversation-topbar / .thread-content /
 * .composer-shell / .work-panel …），样式全部来自 host-replica.css。所以：
 *   - 不要在这个文件里写 Tailwind 工具类（那会把预览变成另一套设计）；
 *   - 区域点选不在这里声明 data-region，由 useRegionPicks 按 REGIONS 贴上去。
 *
 * 内容度量与宿主一一对应：左栏 275px、内容带 min(100%,760px)、输入栈
 * min(100%,768px)、右栏 360px、顶部条 46px。
 */

function ReplicaSidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span />
        PI-Desktop
        <u>«</u>
      </div>
      <div className="sidebar-body">
        <div className="pv-new">
          <b>＋</b> 新建会话
        </div>
        <div className="pv-search">⌕ 搜索会话</div>
        <div className="pv-group">项目</div>
        <div className="pv-row on">
          <i />主题工坊设计
        </div>
        <div className="pv-row">
          <i />渲染进程重构
        </div>
        <div className="pv-row">
          <i />插件市场联调
        </div>
        <div className="pv-group">临时</div>
        <div className="pv-row">
          <i />未命名会话
        </div>
        <div className="pv-side-foot">
          <em>⚙</em>
          <em>◔</em>
          <b>v0.14.8</b>
        </div>
      </div>
    </div>
  );
}

/** 聊天页 = AppShell → ChatSurface → ChatTranscript 的静态复刻。 */
function ReplicaChat() {
  return (
    <div className="pv-view" data-view="chat">
      <div className="conversation-topbar">
        <div className="ct-left">
          <div className="ct-title-wrap">
            <span className="ct-title">主题工坊设计</span>
          </div>
        </div>
        <div className="ct-right">
          <div className="ct-actions">
            <span className="ct-icon-btn" aria-hidden="true">
              ⋯
            </span>
            <span className="ct-icon-btn" aria-hidden="true">
              ⌘K
            </span>
          </div>
        </div>
      </div>

      <div className="chat-surface">
        <div className="session-panes">
          <div className="session-pane">
            <div className="thread-wrap">
              <div className="thread-scroll">
                {/* 真窗口：滚动容器自身没有内边距，收窄/居中/留白全在 .thread-content */}
                <div className="thread-content">
                  <div className="message-row user">
                    <div className="message-col">
                      <div className="message-bubble">
                        侧栏压暗一点，强调色换成冷紫，背景加一层渐变
                      </div>
                    </div>
                  </div>
                  <div className="message-row assistant">
                    <div className="message-col">
                      <div className="prose-chat">
                        <p>
                          <strong>已更新 5 个 token。</strong>侧栏降到 <code>#070b16</code>
                          ，强调色提到 <code>#7fb0ff</code>
                          ，侧边栏背景换成光晕网格，正文对比度仍在 15:1 以上。
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="message-row tool">
                    <div className="message-col">
                      <div className="tool-activity-group">
                        <span className="tool-activity-header">
                          <span className="tool-activity-icon">▤</span>
                          <span className="tool-activity-label">ThemeStudio</span>
                          <span className="tool-activity-count">themes/aurora.css · +12 −8</span>
                        </span>
                      </div>
                      <div className="tool-activity-group">
                        <span className="tool-activity-header">
                          <span className="tool-activity-icon">◍</span>
                          <span className="tool-activity-label">TaskWait</span>
                          <span className="tool-activity-count">视觉回归 · 完成</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 输入栏：绝对贴底，内衬 0 24px 16px；区域点选只落在 .composer-shell 上 */}
        <div className="composer-dock composer-dock-docked">
          <div className="composer-stack">
            <div className="composer-shell">
              <div className="composer-input-wrap">
                <div className="composer-input-stage">
                  <span className="composer-placeholder">描述你想改的观感…</span>
                  <div className="composer-input" role="textbox" aria-readonly="true">
                    把左栏压暗一点，强调色换成冷紫
                  </div>
                </div>
              </div>
              <div className="composer-toolbar">
                <span className="composer-left">
                  <span className="icon-btn">＋</span>
                  <span className="composer-chip">
                    <span className="composer-mode-chip-face">Agent</span>
                  </span>
                  <span className="composer-chip">Sonnet 4.6</span>
                </span>
                <span className="composer-right">
                  <span className="icon-btn">◔</span>
                  <span className="send-btn">↑</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SETTINGS_FIELDS: Array<[string, string, string]> = [
  ["语言", "界面显示语言", "简体中文"],
  ["界面字体", "全局 font-family", "系统默认"],
];

function ReplicaSettings({ themeLabel }: { themeLabel: string }) {
  return (
    <div className="pv-view" data-view="settings">
      <div className="conversation-topbar">
        <div className="ct-left">
          <div className="ct-title-wrap">
            <span className="ct-title">设置</span>
          </div>
        </div>
      </div>
      <div className="pv-settings">
        <h3>外观</h3>
        <div className="pv-field">
          <span className="k">
            <b>主题</b>
            <small>选择应用的配色</small>
          </span>
          <span className="v">{themeLabel ? `主题工坊 · ${themeLabel}` : "主题工坊"}</span>
        </div>
        {SETTINGS_FIELDS.map(([name, hint, value]) => (
          <div className="pv-field" key={name}>
            <span className="k">
              <b>{name}</b>
              <small>{hint}</small>
            </span>
            <span className="v">{value}</span>
          </div>
        ))}
        <div className="pv-field">
          <span className="k">
            <b>工作面板</b>
            <small>显示右侧工具列</small>
          </span>
          <span className="pv-switch" />
        </div>
        <div className="pv-field">
          <span className="k">
            <b>减少动态效果</b>
            <small>关闭过渡与动画</small>
          </span>
          <span className="pv-switch off" />
        </div>
      </div>
    </div>
  );
}

function ReplicaMenu() {
  return (
    <div className="pv-menu" data-menu hidden>
      <div className="pv-menu-item hover">新会话</div>
      <div className="pv-menu-item dim">切换项目…</div>
      <div className="pv-menu-sep" />
      <div className="pv-menu-item">设置</div>
      <div className="pv-menu-item">键盘快捷键</div>
      <div className="pv-menu-sep" />
      <div className="pv-menu-item">退出</div>
    </div>
  );
}

/**
 * 右栏（工作面板）。内嵌的插件视图 / 浏览器是原生 WebContentsView，永远画在渲染
 * 进程之上 —— 所以「右栏」这个区域只提供底色，这里也只是一块示意内容。
 */
function ReplicaDock({
  themeLabel,
  meta,
  swatch,
}: {
  themeLabel: string;
  meta: string;
  swatch: string[];
}) {
  return (
    <div className="work-panel">
      <div className="work-panel-main">
        <div className="work-panel-header">
          <span className="pv-tab on">主题工坊</span>
          <span className="pv-tab">变更</span>
        </div>
        <div className="work-panel-body">
          <h5>{themeLabel || "—"}</h5>
          <p>{meta}</p>
          <div className="pv-swatch">
            {swatch.map((color, index) => (
              <i key={index} style={{ background: color }} />
            ))}
          </div>
          <div className="pv-line" />
          <div className="pv-line s" />
          <div className="pv-line" />
          <div className="pv-line s" />
        </div>
      </div>
    </div>
  );
}

export function ReplicaShell({
  base,
  view,
  picked,
  themeLabel,
  dockMeta,
  swatch,
  shellRef,
  onPick,
}: {
  base: "dark" | "light";
  view: PreviewView;
  picked: string;
  themeLabel: string;
  dockMeta: string;
  swatch: string[];
  shellRef: React.RefObject<HTMLDivElement | null>;
  onPick: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      ref={shellRef}
      className={cn("preview-shell pv-root app-shell", picked === "shell" && "picked")}
      data-theme={base}
      data-label="整窗（底层）"
      style={{ colorScheme: base }}
      onClick={onPick}
      role="img"
      aria-label="应用界面预览"
    >
      <ReplicaSidebar />
      <div className="pv-main main-pane pv-main-relative">
        {/* 三个视图共用同一块中栏：菜单视图是聊天页 + 一层浮层（与真窗口一致）。 */}
        {view === "settings" ? <ReplicaSettings themeLabel={themeLabel} /> : <ReplicaChat />}
        {view === "menu" ? <ReplicaMenu /> : null}
      </div>
      <ReplicaDock themeLabel={themeLabel} meta={dockMeta} swatch={swatch} />
    </div>
  );
}
