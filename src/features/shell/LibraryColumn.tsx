import { Copy, PanelLeftClose, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Theme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { previewColors } from "@/store/studio-store";

type Row = { id: string; label: string; theme: Theme };

/**
 * 右键菜单位置：Radix 的 DropdownMenu 只会锚在 trigger 上，而右键没有 trigger，
 * 所以放一颗 0×0 的隐形锚点在点击坐标上（position:fixed，不占布局）。
 */
type MenuState = { id: string; x: number; y: number } | null;

function LibraryRow({
  row,
  active,
  applied,
  defaults,
  onSelect,
  onContextMenu,
}: {
  row: Row;
  active: boolean;
  applied: boolean;
  defaults: { dark: Record<string, string>; light: Record<string, string> };
  onSelect: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}) {
  const colors = previewColors(row.theme, defaults);

  return (
    <div
      className={cn(
        "group flex h-9 w-full items-center gap-2.5 px-3",
        active ? "bg-tile-deep" : "hover:bg-tile",
      )}
      onContextMenu={onContextMenu}
    >
      <span
        className="flex size-5.5 shrink-0 overflow-hidden rounded-2xs shadow-[0_0_0_1px_var(--ui-border-strong)]"
        aria-hidden="true"
      >
        {colors.map((color, index) => (
          <i key={index} className="flex-1" style={{ background: color }} />
        ))}
      </span>

      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 truncate text-left text-ui-md",
          active ? "font-semibold text-ink" : "text-ink-2 hover:underline",
        )}
        title={`${row.id} · 右键打开菜单`}
        onClick={onSelect}
        onContextMenu={onContextMenu}
      >
        {row.label}
      </button>

      <Badge variant={active ? "strong" : "outline"}>
        {row.theme.builtin ? "预设" : row.theme.base === "light" ? "L" : "D"}
      </Badge>

      {applied ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-success"
          title="使用中"
          aria-label="使用中"
        />
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
  onDuplicate,
  onDelete,
  onApply,
  onRename,
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
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onApply: (id: string) => void;
  onRename: (id: string) => void;
  onNew: () => void;
  onCollapse: () => void;
}) {
  const needle = filter.trim().toLowerCase();
  const match = (id: string, label: string) =>
    !needle || label.toLowerCase().includes(needle) || id.toLowerCase().includes(needle);

  const [menu, setMenu] = useState<MenuState>(null);
  const menuTheme = menu ? themes.find((item) => item.id === menu.id) : null;
  const menuLocked = Boolean(menuTheme?.builtin);

  const openMenu = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    setMenu({ id, x: event.clientX, y: event.clientY });
  };

  const groups: Array<{ label: string; rows: Row[] }> = [
    {
      label: "我的主题",
      rows: themes
        .filter((theme) => !theme.builtin)
        .filter((theme) => match(theme.id, theme.label))
        .map((theme) => ({ id: theme.id, label: theme.label, theme })),
    },
    {
      label: "内置预设",
      rows: themes
        .filter((theme) => theme.builtin)
        .filter((theme) => match(theme.id, theme.label))
        .map((theme) => ({ id: theme.id, label: theme.label, theme })),
    },
  ];

  const shown = groups.reduce((total, group) => total + group.rows.length, 0);
  const total = themes.length;

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
                  active={row.id === active}
                  applied={applied === row.id}
                  defaults={defaults}
                  onSelect={() => onSelect(row.id)}
                  onContextMenu={(event) => openMenu(row.id, event)}
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

      {/*
        右键菜单：modal={false} 是为了让面板里的其它交互（悬浮提示、预览点选）
        不被它截断；锚点是那颗 0×0 的隐形 span。
      */}
      <DropdownMenu
        open={Boolean(menu)}
        modal={false}
        onOpenChange={(open) => {
          if (!open) setMenu(null);
        }}
      >
        <DropdownMenuTrigger asChild>
          {menu ? (
            <span
              aria-hidden
              style={{ position: "fixed", left: menu.x, top: menu.y, width: 0, height: 0 }}
            />
          ) : (
            <span aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="min-w-44">
          <DropdownMenuLabel>{menuTheme?.label ?? ""}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => menu && onApply(menu.id)}>
            <Send className="size-3.5" /> 应用这个主题
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => menu && onDuplicate(menu.id)}>
            <Copy className="size-3.5" /> 复制
          </DropdownMenuItem>
          <DropdownMenuItem disabled={menuLocked} onSelect={() => menu && onRename(menu.id)}>
            <Pencil className="size-3.5" /> 重命名
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={menuLocked}
            className="data-[highlighted]:text-danger"
            onSelect={() => menu && onDelete(menu.id)}
          >
            <Trash2 className="size-3.5" /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
