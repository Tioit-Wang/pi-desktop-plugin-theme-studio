import { ArrowDownToLine, ClipboardCopy, FolderInput, Image as ImageIcon, Package, PanelLeft, PanelRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as core from "@/lib/theme-model";
import { cn } from "@/lib/utils";

/** 顶栏的一枚胶囊（对比度、使用中）。 */
function Chip({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "danger";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-tile px-2.5 text-ui-sm text-ink-2",
        "[&_b]:font-semibold [&_b]:text-ink [&_b]:tabular-nums",
      )}
    >
      {tone ? (
        <i
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-danger",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

export function Topbar({
  themeLabel,
  base,
  overridden,
  strip,
  worst,
  applied,
  appliedLabel,
  disabled,
  gated,
  libraryOpen,
  paneOpen,
  onRename,
  onToggleLibrary,
  onTogglePane,
  onCopy,
  onExportTheme,
  onExportPreview,
  onImportTheme,
  onApply,
  onSave,
}: {
  themeLabel: string;
  base: "dark" | "light";
  overridden: number;
  strip: string[];
  worst: number;
  applied: boolean;
  appliedLabel: string;
  disabled: boolean;
  gated: boolean;
  libraryOpen: boolean;
  paneOpen: boolean;
  onRename: (label: string) => void;
  onToggleLibrary: () => void;
  onTogglePane: () => void;
  onCopy: () => void;
  /** 导出当前主题为 zip（位置由原生对话框选）。 */
  onExportTheme: () => void;
  /** 只导出预览图 PNG。 */
  onExportPreview: () => void;
  /** 导入一个导出包。 */
  onImportTheme: () => void;
  onApply: () => void;
  onSave: () => void;
}) {
  const [draft, setDraft] = useState(themeLabel);

  // 换主题时把输入框同步过去；正在输入时不覆盖（否则打字会被打断）。
  useEffect(() => setDraft(themeLabel), [themeLabel]);

  const tone: "success" | "warning" | "danger" | undefined =
    worst >= 4.5 ? "success" : worst >= 3 ? "warning" : "danger";

  return (
    <header className="panel-topbar flex flex-none items-center gap-2.5 border-b border-line px-3">
      <span
        className="flex shrink-0 overflow-hidden rounded-3xs shadow-[0_0_0_1px_var(--ui-border-strong)]"
        aria-hidden="true"
      >
        {strip.map((color, index) => (
          <i key={index} className="block h-4.5 w-2.5" style={{ background: color }} />
        ))}
      </span>

      <Input
        aria-label="主题名称"
        data-theme-name=""
        title="主题名（Ctrl/⌘+R 聚焦改名）"
        value={draft}
        spellCheck={false}
        className="h-7 w-44 border-transparent bg-transparent font-semibold hover:bg-tile"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onRename(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />

      <Badge variant="strong">{base === "light" ? "Light" : "Dark"}</Badge>
      <span className="shrink-0 text-ui-xs whitespace-nowrap text-faint">
        覆盖 {overridden} 个 token
      </span>

      <span className="flex-1" />

      <Chip tone={worst ? tone : undefined} title="WCAG 2.1：正文层最弱的一对前景/背景">
        最低正文对比度 <b>{worst ? core.formatRatio(worst) : "—"}</b>
      </Chip>
      {applied ? <Chip tone="success">使用中 {appliedLabel}</Chip> : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="border border-line"
            aria-pressed={libraryOpen}
            onClick={onToggleLibrary}
          >
            <PanelLeft className={cn("size-3.5", libraryOpen && "text-ink")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{libraryOpen ? "折叠主题库" : "展开主题库"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="border border-line"
            aria-pressed={paneOpen}
            onClick={onTogglePane}
          >
            <PanelRight className={cn("size-3.5", paneOpen && "text-ink")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{paneOpen ? "收起右侧面板" : "打开右侧面板"}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={disabled || gated} title="导出与导入">
            <ArrowDownToLine className="size-3.5" /> 导出
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>导出当前主题「{themeLabel}」</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onExportTheme}>
            <Package className="size-3.5" /> 打包为 ZIP…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportPreview}>
            <ImageIcon className="size-3.5" /> 预览图 PNG…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopy}>
            <ClipboardCopy className="size-3.5" /> 复制 CSS
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onImportTheme}>
            <FolderInput className="size-3.5" /> 导入主题…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button onClick={onCopy}>复制 CSS</Button>
      <Button disabled={disabled || gated} onClick={onApply}>
        应用
      </Button>
      <Button variant="primary" disabled={disabled || gated} onClick={onSave}>
        保存并应用
      </Button>
    </header>
  );
}
