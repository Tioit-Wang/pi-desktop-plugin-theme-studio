import { ChevronRight, House, MoveUp, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ColorRow, ControlRow, SectionTitle, SliderRow, TextRow } from "@/features/panels/controls";
import { ImageDropzone } from "@/features/panels/ImageDropzone";
import { imageUrl } from "@/lib/bridge";
import * as core from "@/lib/theme-model";
import type { ImageEntry, SidebarImage, Surface, Theme } from "@/lib/types";
import { regionLabel, regionParent, regionTrail } from "@/features/preview/region-picks";
import { cn } from "@/lib/utils";

const SIDEBAR_KINDS: Array<{ value: string; label: string }> = [
  { value: "none", label: "无（纯色）" },
  { value: "gradient", label: "渐变" },
  { value: "image", label: "图片（本地 PNG）" },
];

const DEFAULT_GRADIENT = { on: false, angle: 160, from: "#00000000", to: "#00000000" };

/** 左栏的图片走独立 token（--ds-bg-sidebar-image），所以它有自己的一组控件。 */
function SidebarImageCard({
  theme,
  images,
  previewData,
  pluginId,
  onChange,
  onUpload,
}: {
  theme: Theme;
  images: ImageEntry[];
  previewData: Record<string, string>;
  pluginId: string;
  onChange: (image: SidebarImage) => void;
  onUpload: (file: File) => Promise<string | null>;
}) {
  const image = theme.sidebarImage && theme.sidebarImage.on ? theme.sidebarImage : null;
  const kind = image?.kind ?? "none";
  const current =
    image?.kind === "image"
      ? (images.find((entry) => entry.id === image.image) ?? null)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>侧边栏背景</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <ControlRow label="背景类型" hint="左栏底图走 --ds-bg-sidebar-image">
          <Select
            value={kind}
            onValueChange={(value) =>
              onChange(
                value === "gradient"
                  ? { on: true, kind: "gradient", angle: 160, from: "#00000000", to: "#00000000" }
                  : value === "image"
                    ? { on: true, kind: "image", image: "" }
                    : { on: false, kind: "none" },
              )
            }
          >
            <SelectTrigger className="w-32 flex-none">
              {SIDEBAR_KINDS.find((item) => item.value === kind)?.label}
            </SelectTrigger>
            <SelectContent>
              {SIDEBAR_KINDS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ControlRow>

        {image?.kind === "gradient" ? (
          <>
            <SliderRow
              label="角度"
              value={Number(image.angle) || 160}
              min={0}
              max={360}
              onInput={(value) => onChange({ ...image, angle: value })}
            />
            <ColorRow
              label="起始色"
              value={image.from}
              onChange={(value) => onChange({ ...image, from: value || "transparent" })}
            />
            <ColorRow
              label="结束色"
              value={image.to}
              onChange={(value) => onChange({ ...image, to: value || "transparent" })}
            />
          </>
        ) : null}

        {image?.kind === "image" ? (
          <ImageDropzone
            current={current}
            url={imageUrl(image.image, images, previewData, pluginId)}
            onUpload={async (file) => {
              const id = await onUpload(file);
              if (id) onChange({ on: true, kind: "image", image: id });
              return id;
            }}
            onClear={() => onChange({ on: false, kind: "none" })}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

/** 一张区域卡片：底色 / 渐变 / 图片 / 模糊 / 圆角 + 一键透出。 */
function SurfaceCard({
  title,
  definition,
  region,
  images,
  previewData,
  pluginId,
  onCommit,
  onUpload,
  onReveal,
}: {
  title: string;
  definition: core.RegionDef;
  region: Surface;
  images: ImageEntry[];
  previewData: Record<string, string>;
  pluginId: string;
  onCommit: (mutator: (region: Surface) => void) => void;
  onUpload: (file: File) => Promise<string | null>;
  onReveal: () => void;
}) {
  const gradient = region.gradient?.on ? region.gradient : DEFAULT_GRADIENT;
  const image = region.image ?? core.emptyImage();
  const current = images.find((entry) => entry.id === image.image) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {definition.fillOnly ? (
        <p className="px-3 pb-2 text-ui-2xs leading-relaxed text-faint">
          右栏只提供底色：内嵌的插件视图 / 浏览器是原生 WebContentsView，永远画在渲染进程
          之上，图片盖不住它。
        </p>
      ) : null}

      <CardContent className="flex flex-col gap-1">
        <ColorRow
          label="底色"
          hint="带 alpha 的值会让下层透出来"
          value={region.fill ?? ""}

          onChange={(value) =>
            onCommit((target) => {
              if (value) target.fill = value;
              else delete target.fill;
            })
          }
        />

        <ControlRow label="渐变">
          <Switch
            checked={gradient.on === true}
            onCheckedChange={(checked) =>
              onCommit((target) => {
                target.gradient = { ...gradient, on: checked };
              })
            }
          />
        </ControlRow>

        {gradient.on ? (
          <>
            <SliderRow
              label="角度"
              value={Number(gradient.angle) || 160}
              min={0}
              max={360}
              onInput={(value) =>
                onCommit((target) => {
                  target.gradient = { ...gradient, angle: value };
                })
              }
            />
            <ColorRow
              label="起始色"
              value={gradient.from}
              onChange={(value) =>
                onCommit((target) => {
                  target.gradient = { ...gradient, from: value || "transparent" };
                })
              }
            />
            <ColorRow
              label="结束色"
              value={gradient.to}
              onChange={(value) =>
                onCommit((target) => {
                  target.gradient = { ...gradient, to: value || "transparent" };
                })
              }
            />
          </>
        ) : null}

        {definition.fillOnly !== true ? (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <SectionTitle>背景图片</SectionTitle>
            <ImageDropzone
              current={current}
              url={imageUrl(image.image, images, previewData, pluginId)}
              onUpload={async (file) => {
                const id = await onUpload(file);
                if (id) {
                  onCommit((target) => {
                    target.image = { ...core.emptyImage(), on: true, image: id };
                  });
                }
                return id;
              }}
              onClear={() =>
                onCommit((target) => {
                  target.image = core.emptyImage();
                })
              }
            />
            {image.on ? (
              <div className="flex flex-col gap-1">
                <ControlRow label="铺法">
                  <Select
                    value={image.size}
                    onValueChange={(value) =>
                      onCommit((target) => {
                        target.image = { ...image, size: value as typeof image.size };
                      })
                    }
                  >
                    <SelectTrigger className="w-24 flex-none">{image.size}</SelectTrigger>
                    <SelectContent>
                      {core.BACKGROUND_SIZES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ControlRow>
                <ControlRow label="位置">
                  <Select
                    value={image.position}
                    onValueChange={(value) =>
                      onCommit((target) => {
                        target.image = { ...image, position: value as typeof image.position };
                      })
                    }
                  >
                    <SelectTrigger className="w-24 flex-none">{image.position}</SelectTrigger>
                    <SelectContent>
                      {core.BACKGROUND_POSITIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ControlRow>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1.5 flex flex-col gap-1">
          <SliderRow
            label="背景模糊"
            hint="backdrop-filter: blur(Npx)；元素背后有内容时才看得见"
            value={Number(region.blur) > 0 ? Number(region.blur) : 0}
            min={0}
            max={core.MAX_BLUR}
            onInput={(value) =>
              onCommit((target) => {
                if (value > 0) target.blur = value;
                else delete target.blur;
              })
            }
          />
          <TextRow
            label="圆角"
            placeholder="如 14px"
            value={region.radius ?? ""}
            onInput={(value) =>
              onCommit((target) => {
                if (value) target.radius = value;
                else delete target.radius;
              })
            }
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={onReveal} title="把盖在这个区域上面的那些区域底色设为透明，下层图片才看得到">
          <WandSparkles className="size-3.5" /> 一键透出
        </Button>
      </CardFooter>
    </Card>
  );
}

export function RegionPanel({
  region,
  theme,
  images,
  previewData,
  pluginId,
  onPick,
  onCommit,
  onUpload,
  onSidebarImage,
  onReveal,
}: {
  region: string;
  theme: Theme;
  images: ImageEntry[];
  previewData: Record<string, string>;
  pluginId: string;
  onPick: (id: string) => void;
  onCommit: (mutator: (region: Surface) => void) => void;
  onUpload: (file: File) => Promise<string | null>;
  onSidebarImage: (image: SidebarImage) => void;
  onReveal: () => void;
}) {
  const definition = core.REGIONS.find((item) => item.id === region) ?? core.REGIONS[0];
  const trail = regionTrail(definition.id);
  const parent = regionParent(definition.id);
  const surface = theme.regions?.[definition.id] ?? {};

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <p className="text-ui-sm leading-relaxed text-faint">
        点预览里的区域即可编辑那一块；区域按真实外壳的选择器定位，所以这里改的就是应用里
        对应那块。
      </p>

      <div className="flex flex-wrap items-center gap-1">
        {trail.map((id, index) => (
          <span key={id} className="flex items-center gap-1">
            {index ? <ChevronRight className="size-3 text-faint" /> : null}
            <button
              type="button"
              onClick={() => onPick(id)}
              className={cn(
                "rounded-2xs px-1 py-0.5 text-ui-sm hover:bg-tile-hover",
                id === definition.id ? "text-ink" : "text-muted",
              )}
            >
              {regionLabel(id)}
            </button>
          </span>
        ))}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          title="最底层：点预览外面的空白、Alt+点任意区域，或这里"
          onClick={() => onPick("shell")}
        >
          <House className="size-3" /> 整窗（底层）
        </Button>
        {parent ? (
          <Button variant="ghost" size="sm" title="等价于按 Esc" onClick={() => onPick(parent)}>
            <MoveUp className="size-3" /> {regionLabel(parent)}
          </Button>
        ) : null}
      </div>

      <SurfaceCard
        title={`背景 · ${definition.label}`}
        definition={definition}
        region={surface}
        images={images}
        previewData={previewData}
        pluginId={pluginId}
        onCommit={onCommit}
        onUpload={onUpload}
        onReveal={onReveal}
      />

      {definition.id === "sidebar" ? (
        <SidebarImageCard
          theme={theme}
          images={images}
          previewData={previewData}
          pluginId={pluginId}
          onChange={onSidebarImage}
          onUpload={onUpload}
        />
      ) : null}
    </div>
  );
}
