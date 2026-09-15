import { Copy, PanelLeftClose, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Theme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BUILTIN_CHOICES, previewColors } from "@/store/studio-store";

type Row =
  | { kind: "theme"; id: string; label: string; theme: Theme }
  | { kind: "host"; id: string; label: string; hostId: string };

function LibraryRow({
  row,
  active,
  applied,
  defaults,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  row: Row;
  active: boolean;
  applied: boolean;
  defaults: { dark: Record<string, string>; light: Record<string, string> };
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const colors = row.kind === "theme" ? previewColors(row.theme, defaults) : [];

  return (
    <div
      className={cn(
        "group flex h-9 w-full items-center gap-2.5 px-3",
        active ? "bg-tile-deep" : "hover:bg-tile",
      )}
    >
      <span
        className="flex size-5.5 shrink-0 overflow-hidden rounded-2xs shadow-[0_0_0_1px_var(--ui-border-strong)]"
        aria-hidden="true"
      >
        {(row.kind === "theme" ? colors : ["transparent", "transparent", "transparent", "transparent"]).map(
          (color, index) => (
            <i key={index} className="flex-1" style={{ background: color }} />
          ),
        )}
      </span>

      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 truncate text-left text-ui-md",
          active ? "font-semibold text-ink" : "text-ink-2 hover:underline",
        )}
        title={row.kind === "host" ? row.hostId : row.id}
        onClick={onSelect}
      >
        {row.label}
      </button>

      <Badge variant={active ? "strong" : "outline"}>
        {row.kind === "host" ? "宿主" : row.theme.base === "light" ? "L" : "D"}
      </Badge>

      {applied ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-success"
          title="使用中"
          aria-label="使用中"
        />
      ) : null}

      {row.kind === "theme" ? (
        <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <Button variant="ghost" size="icon-sm" title="复制" onClick={onDuplicate}>
            <Copy className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="删除"
            className="hover:text-danger"
            onClick={onDelete}
          >
            <X className="size-3" />
          </Button>
        </span>
      ) : null}
    </div>
  );
}

export function LibraryColumn({
  open,
  themes,
  active,
  applied,
  filter,
  defaults,
  onFilter,
  onSelect,
  onApplyHost,
  onDuplicate,
  onDelete,
  onNew,
  onCollapse,
}: {
  open: boolean;
  themes: Theme[];
  active: string;
  applied: string;
  filter: string;
  defaults: { dark: Record<string, string>; light: Record<string, string> };
  onFilter: (value: string) => void;
  onSelect: (id: string) => void;
  onApplyHost: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onCollapse: () => void;
}) {
  const needle = filter.trim().toLowerCase();
  const match = (id: string, label: string) =>
    !needle || label.toLowerCase().includes(needle) || id.toLowerCase().includes(needle);

  const groups: Array<{ label: string; rows: Row[] }> = [
    {
      label: "我的主题",
      rows: themes
        .filter((theme) => !theme.builtin)
        .filter((theme) => match(theme.id, theme.label))
        .map((theme) => ({ kind: "theme" as const, id: theme.id, label: theme.label, theme })),
    },
    {
      label: "内置预设",
      rows: themes
        .filter((theme) => theme.builtin)
        .filter((theme) => match(theme.id, theme.label))
        .map((theme) => ({ kind: "theme" as const, id: theme.id, label: theme.label, theme })),
    },
    {
      label: "宿主主题",
      rows: BUILTIN_CHOICES.filter((choice) => match(choice.id, choice.label)).map((choice) => ({
        kind: "host" as const,
        id: `builtin:${choice.id}`,
        label: choice.label,
        hostId: choice.id,
      })),
    },
  ];

  const shown = groups.reduce((total, group) => total + group.rows.length, 0);
  const total = themes.length + BUILTIN_CHOICES.length;

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-none flex-col overflow-hidden border-r border-line bg-panel transition-[width] duration-150",
        open ? "w-62" : "w-0 border-r-transparent",
        // 窄窗：不挤压预览，改成覆盖式抽屉。
        open && "max-[1080px]:absolute max-[1080px]:inset-y-0 max-[1080px]:left-0 max-[1080px]:z-50",
      )}
      aria-hidden={!open}
    >
      <div className="flex h-9.5 flex-none items-center gap-2 px-3">
        <span className="text-ui-md font-semibold">主题库</span>
        <span className="text-ui-xs text-faint tabular-nums">
          {needle ? `${shown} / ${total}` : total}
        </span>
        <span className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onCollapse}>
              <PanelLeftClose className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>收起主题库</TooltipContent>
        </Tooltip>
      </div>

      <div className="px-3 pb-2">
        <Input
          value={filter}
          spellCheck={false}
          placeholder="搜索主题…"
          onChange={(event) => onFilter(event.target.value)}
        />
      </div>

      <ScrollArea className="flex-1">
        {groups.map((group) =>
          group.rows.length ? (
            <div key={group.label}>
              <div className="px-3 pt-2 pb-1 text-ui-2xs text-faint">{group.label}</div>
              {group.rows.map((row) => (
                <LibraryRow
                  key={row.id}
                  row={row}
                  active={row.kind === "theme" && row.id === active}
                  applied={row.kind !== "theme" ? applied === row.hostId : applied === row.id}
                  defaults={defaults}
                  onSelect={() =>
                    row.kind === "host" ? onApplyHost(row.hostId) : onSelect(row.id)
                  }
                  onDuplicate={() => row.kind === "theme" && onDuplicate(row.id)}
                  onDelete={() => row.kind === "theme" && onDelete(row.id)}
                />
              ))}
            </div>
          ) : null,
        )}
        {shown === 0 ? <div className="px-3 py-4 text-ui-sm text-faint">没有匹配的主题</div> : null}
      </ScrollArea>

      <div className="flex flex-none gap-1.5 border-t border-line p-2.5">
        <Button className="flex-1" onClick={onNew}>
          <Plus className="size-3.5" /> 新建
        </Button>
        <Button className="flex-1" disabled={!active} onClick={() => active && onDuplicate(active)}>
          复制
        </Button>
      </div>
    </aside>
  );
}
