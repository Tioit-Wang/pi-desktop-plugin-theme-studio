import { AlertTriangle, RefreshCw, Trash, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { humanSize } from "@/lib/format";
import { imageUrl } from "@/lib/bridge";
import type { ImageEntry, OrphanImage, Theme } from "@/lib/types";

/** 图片库：这张图是什么、被谁用着、删掉它。 */
export function ImagesPanel({
  images,
  orphans,
  themes,
  usedIds,
  previewData,
  pluginId,
  onRemove,
  onPrune,
  onDropOrphan,
}: {
  images: ImageEntry[];
  orphans: OrphanImage[];
  themes: Theme[];
  usedIds: string[];
  previewData: Record<string, string>;
  pluginId: string;
  onRemove: (id: string) => void;
  onPrune: () => void;
  onDropOrphan: (path: string) => void;
}) {
  const usageOf = (id: string): string[] => {
    const where: string[] = [];
    for (const theme of themes) {
      const sidebar = theme.sidebarImage;
      if (sidebar && sidebar.on === true && sidebar.kind === "image" && sidebar.image === id) {
        where.push("左栏");
      }
      for (const regionId of Object.keys(theme.regions ?? {})) {
        const image = theme.regions?.[regionId]?.image;
        if (image && image.on === true && image.image === id) where.push(regionId);
      }
    }
    return [...new Set(where)];
  };

  const total = images.reduce((sum, entry) => sum + (Number(entry.bytes) || 0), 0);

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-ui-sm leading-relaxed text-faint">
        图片存在插件自己的数据目录里（<b className="text-ink-2">不在插件包内</b>
        ），主题 CSS 直接引用它的绝对路径 —— 所以换图不会触发插件重载，面板也不会被关掉。
        单张上限 4MB（宿主限制）。
      </p>

      <div className="flex items-center gap-2">
        <span className="text-ui-sm text-ink-2">
          {images.length} 张 · {humanSize(total)}
        </span>
        <span className="flex-1" />
        <Button size="sm" onClick={onPrune} title="删掉没有任何设计引用的图片文件">
          <RefreshCw className="size-3" /> 清理未引用
        </Button>
      </div>

      {images.length === 0 ? (
        <p className="rounded-sm border border-dashed border-line-strong p-4 text-center text-ui-sm text-faint">
          还没有上传过图片。在「区域」面板里把 PNG 拖进来。
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {images.map((entry) => {
          const used = usedIds.includes(entry.id);
          const where = usageOf(entry.id);
          return (
            <div key={entry.id} className="flex items-center gap-2.5 rounded-sm bg-tile p-2">
              <span className="size-11 flex-none overflow-hidden rounded-2xs bg-tile-deep">
                <img
                  src={imageUrl(entry.id, images, previewData, pluginId)}
                  alt=""
                  className="size-full object-cover"
                />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-ui-sm font-medium text-ink">{entry.name}</b>
                <small className="text-ui-2xs text-faint">
                  {humanSize(entry.bytes)} · {where.length ? `用在 ${where.join("、")}` : "未被引用"}
                </small>
              </div>
              {!used ? <AlertTriangle className="size-3.5 flex-none text-warning" /> : null}
              <Button
                variant="ghost"
                size="icon-sm"
                title="删除图片（引用它的区域会改成「没有图片」）"
                className="hover:text-danger"
                onClick={() => onRemove(entry.id)}
              >
                <Trash className="size-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {orphans.length ? (
        <div className="flex flex-col gap-1.5">
          <h5 className="text-ui-xs font-semibold tracking-wide text-faint">
            孤立文件（数据目录里有文件，但登记表里没有记录）
          </h5>
          {orphans.map((entry) => (
            <div key={entry.path} className="flex items-center gap-2.5 rounded-sm bg-tile p-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-ui-sm font-medium text-ink-2">{entry.name}</b>
                <small className="truncate text-ui-2xs text-faint">{humanSize(entry.bytes)}</small>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                title="删除这个文件"
                className="hover:text-danger"
                onClick={() => onDropOrphan(entry.path)}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
