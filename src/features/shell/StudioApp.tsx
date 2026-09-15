import { useEffect, useMemo, useRef } from "react";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuditPanel } from "@/features/panels/AuditPanel";
import { ImagesPanel } from "@/features/panels/ImagesPanel";
import { RegionPanel } from "@/features/panels/RegionPanel";
import { TokenPanel } from "@/features/panels/TokenPanel";
import { ReplicaShell } from "@/features/preview/ReplicaShell";
import { regionParent, useRegionPicks } from "@/features/preview/region-picks";
import { useEffectiveTokens } from "@/features/preview/use-effective-tokens";
import { CanvasColumn } from "@/features/shell/CanvasColumn";
import { FloatingPanel, LibraryOrb, Rail, StatusBar } from "@/features/shell/Chrome";
import { LibraryColumn } from "@/features/shell/LibraryColumn";
import { Topbar } from "@/features/shell/Topbar";
import * as core from "@/lib/theme-model";
import {
  PANE_TITLES,
  activeTheme,
  imageIdsIn,
  initAppearance,
  overriddenCount,
  previewColors,
  previewCss,
  themeBase,
  useStudio,
} from "@/store/studio-store";
export function StudioApp() {
  const s = useStudio();
  const shellRef = useRef<HTMLDivElement>(null);

  const theme = activeTheme(s);
  const base = themeBase(theme);
  const css = useMemo(
    () => previewCss(theme, s.images, s.previewData, s.pluginId),
    [theme, s.images, s.previewData, s.pluginId],
  );

  // 预览里实际解析出来的颜色：对比度、顶栏读数、token 的「当前值」都靠它。
  const effective = useEffectiveTokens(shellRef, [css]);

  // 区域点选：按 REGIONS 贴标签，点哪里改哪里。
  const onPick = useRegionPicks(shellRef, s.region, (id) => {
    s.pickRegion(id);
    s.openPane("region");
  });

  // 启动：库 + 宿主基调。
  useEffect(() => {
    void s.load();
    return initAppearance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当前设计用到的图片预读成 data: URL（宿主 scheme 只为已应用主题服务）。
  const imageKey = imageIdsIn(theme).join(",");
  useEffect(() => {
    void s.prefetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.active, imageKey]);

  /**
   * 键盘：
   *   Esc                 先收面板，再把选中的区域往上还一层
   *   Ctrl/⌘ + S          注册当前主题（不切应用）
   *   Ctrl/⌘ + R          聚焦主题名，改名
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void s.push();
        return;
      }
      if (mod && event.key.toLowerCase() === "r") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[data-theme-name]");
        input?.focus();
        input?.select();
        return;
      }
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) {
        target.blur();
        return;
      }
      if (s.pane) {
        s.closePane();
        return;
      }
      const parent = regionParent(s.region);
      if (parent) s.pickRegion(parent);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [s]);

  const gated = s.runtimeApi.available === false;
  const usedIds = useMemo(
    () => [...new Set(s.themes.flatMap((item) => imageIdsIn(item)))],
    [s.themes],
  );
  const strip = theme ? previewColors(theme, s.defaults) : [];
  const worst = useMemo(() => {
    const rows = Object.keys(effective).length ? core.audit(effective) : [];
    return rows.length ? core.worstRatio(rows) : 0;
  }, [effective]);

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-ink">
        <Topbar
          themeLabel={theme?.label ?? "—"}
          base={base}
          overridden={overriddenCount(theme)}
          strip={strip}
          worst={worst}
          applied={Boolean(s.applied) && s.applied === theme?.id}
          appliedLabel={theme?.label ?? ""}
          disabled={!theme}
          gated={gated}
          libraryOpen={s.libraryOpen}
          paneOpen={Boolean(s.pane)}
          onRename={(label) => s.rename(label)}
          onToggleLibrary={() => s.setLibraryOpen(!s.libraryOpen)}
          onTogglePane={() => (s.pane ? s.closePane() : s.openPane(s.lastPane))}
          onCopy={() => void s.copyCss()}
          onExportTheme={() => void s.exportTheme(shellRef.current)}
          onExportPreview={() => void s.exportPreview(shellRef.current)}
          onImportTheme={() => void s.importTheme()}
          onApply={() => void s.applyCurrent()}
          onSave={() => {
            void s.push().then(() => s.applyCurrent());
          }}
        />

        <div className="relative flex min-h-0 flex-1">
          <LibraryColumn
            open={s.libraryOpen}
            themes={s.themes}
            active={s.active}
            applied={s.applied}
            filter={s.filter}
            defaults={s.defaults}
            onFilter={s.setFilter}
            onSelect={s.selectTheme}
            onApplyHost={(id) => void s.applyBuiltin(id)}
            onDuplicate={s.duplicateTheme}
            onDelete={s.deleteTheme}
            onNew={s.newTheme}
            onCollapse={() => s.setLibraryOpen(false)}
          />

          <div className="relative flex min-w-0 flex-1">
            {!s.libraryOpen ? <LibraryOrb onClick={() => s.setLibraryOpen(true)} /> : null}

            <CanvasColumn
              view={s.view}
              zoom={s.zoom}
              onView={s.setView}
              onZoom={s.setZoom}
              onPickShell={() => {
                s.pickRegion("shell");
                s.openPane("region");
              }}
            >
              <ReplicaShell
                base={base}
                view={s.view}
                picked={s.region}
                themeLabel={theme?.label ?? ""}
                dockMeta={`${base} 基底 · 覆盖 ${overriddenCount(theme)} 个 token`}
                swatch={strip}
                shellRef={shellRef}
                onPick={onPick}
              />
            </CanvasColumn>

            <FloatingPanel
              title={s.pane ? PANE_TITLES[s.pane] : PANE_TITLES[s.lastPane]}
              open={Boolean(s.pane)}
              onClose={() => s.closePane()}
            >
              {s.pane === "region" && theme ? (
                <RegionPanel
                  region={s.region}
                  theme={theme}
                  images={s.images}
                  previewData={s.previewData}
                  pluginId={s.pluginId}
                  onPick={s.pickRegion}
                  onCommit={s.commit}
                  onUpload={s.putImage}
                  onSidebarImage={s.setSidebarImage}
                  onReveal={s.revealUpper}
                />
              ) : null}
              {s.pane === "token" && theme ? (
                <TokenPanel
                  theme={theme}
                  defaults={s.defaults[base] ?? {}}
                  effective={effective}
                  onSetToken={s.setToken}
                  onInvalid={(message) => s.setStatus(message, true, { toast: false })}
                />
              ) : null}
              {s.pane === "images" ? (
                <ImagesPanel
                  images={s.images}
                  orphans={s.orphans}
                  themes={s.themes}
                  usedIds={usedIds}
                  previewData={s.previewData}
                  pluginId={s.pluginId}
                  onRemove={(id) => void s.removeImage(id)}
                  onPrune={() => void s.pruneImages()}
                  onDropOrphan={(path) => void s.dropOrphan(path)}
                />
              ) : null}
              {s.pane === "audit" ? <AuditPanel effective={effective} /> : null}
            </FloatingPanel>

            <Rail
              pane={s.pane}
              onOpen={s.openPane}
              onClose={() => s.closePane()}
            />
          </div>
        </div>

        <StatusBar text={statusText(s, theme?.label ?? "")} error={s.statusError} />
        <Toaster />

        {/* 预览用的主题 CSS：选择器已经限定在 .pv-root[data-theme=…] 上 */}
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </div>
    </TooltipProvider>
  );
}

function statusText(state: ReturnType<typeof useStudio.getState>, label: string): string {
  if (!state.loaded && state.loading) return "正在读取主题库…";
  if (state.runtimeApi.available === false) {
    return (
      "宿主的运行时主题 API 不可用（pi.themes / pi.app.setTheme）：本插件需要 " +
      "PI-Desktop ≥ 0.14.8，且应用要从未合并前的旧代码重启。当前只能预览，无法注册主题。" +
      (state.runtimeApi.reason ? `（${state.runtimeApi.reason}）` : "")
    );
  }
  return state.status || (label ? `正在编辑「${label}」` : "");
}
