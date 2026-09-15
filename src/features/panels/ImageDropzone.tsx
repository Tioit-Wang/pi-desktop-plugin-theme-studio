import { ImagePlus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ImageEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 宿主对单个主题声明的资源合计上限。 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/**
 * 拖拽上传区。
 *
 * 只收 PNG，而且是按**魔数**判断的 —— 扩展名可以随便改，宿主要的是真的 PNG 字节。
 * 图片落进插件数据目录（不是插件包），所以上传不会触发开发监听器重载，面板不会被
 * 关掉，预览立刻更新。
 *
 * 没有示例图、没有默认图：要么不传，要么就传用户自己选的。
 */
export function ImageDropzone({
  current,
  url,
  onUpload,
  onClear,
}: {
  current: ImageEntry | null;
  url: string;
  onUpload: (file: File) => Promise<string | null>;
  onClear: () => void;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`单张上限 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB，这张 ${humanSize(file.size)}`);
      return;
    }
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isPng =
      head.length > 4 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    if (!isPng) {
      setError("只接受 PNG（请先转成 .png 再拖进来）");
      return;
    }
    setBusy(true);
    await onUpload(file);
    setBusy(false);
  };

  if (current) {
    return (
      <div className="flex items-center gap-2.5 rounded-sm border border-line bg-tile p-2">
        <span className="size-14 flex-none overflow-hidden rounded-2xs bg-tile-deep">
          {url ? <img src={url} alt="" className="size-full object-cover" /> : null}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-ui-sm font-medium text-ink">{current.name}</b>
          <small className="text-ui-2xs text-faint">{humanSize(current.bytes)}</small>
        </div>
        <Button variant="ghost" size="icon-sm" title="移除这张图" onClick={onClear}>
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void accept(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex min-h-19 items-center justify-center gap-2.5 rounded-sm border border-dashed p-3 text-center transition-colors",
          over
            ? "border-accent bg-accent/10"
            : "border-line-strong bg-tile hover:border-accent hover:bg-tile-hover",
        )}
      >
        <ImagePlus className="size-4 flex-none text-muted" />
        <span className="flex flex-col gap-0.5 text-left">
          <span className="text-ui-sm font-medium text-ink-2">
            {busy ? "正在上传…" : "把 PNG 拖到这里"}
          </span>
          <span className="text-ui-2xs text-faint">
            或者点击选择文件 · 只收 PNG · 单张上限 4MB
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(event) => {
          void accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error ? (
        <p role="alert" className="text-ui-2xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 一个「上传 / 换图 / 移除」的小动作组（图片列表里逐行用）。 */
export function UploadAction({
  label,
  onFile,
  disabled,
}: {
  label: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={() => ref.current?.click()}>
        <Upload className="size-3" /> {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </>
  );
}
