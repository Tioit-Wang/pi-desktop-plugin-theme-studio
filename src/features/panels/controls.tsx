import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** 一行控件：左边标签（可带一行说明），右边是控件本身。 */
export function ControlRow({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 py-1", className)}>
      <div className="min-w-0 flex-1">
        <Label className="block truncate text-ui-sm text-ink-2">{label}</Label>
        {hint ? <p className="mt-px text-ui-2xs leading-snug text-faint">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** 数值滑块 + 右侧读数。 */
export function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onInput,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onInput: (value: number) => void;
}) {
  return (
    <ControlRow label={label} hint={hint}>
      <Slider
        className="w-28 flex-none"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onInput(next[0] ?? value)}
      />
      <b className="w-6 flex-none text-right text-ui-xs text-muted tabular-nums">{value}</b>
    </ControlRow>
  );
}

/**
 * 颜色行：左边一个色块（点开系统取色器），右边一个文本框接受 #rrggbb /
 * #rrggbbaa / transparent。
 */
export function ColorRow({
  label,
  hint,
  value,
  effective,
  onChange,
}: {
  label: string;
  hint?: string;
  /** 主题里写的覆盖值；空串 = 用宿主默认。 */
  value: string;
  /** 实际生效的颜色（宿主默认 + 覆盖合成后），只读展示。 */
  effective?: string;
  onChange: (value: string) => void;
}) {
  const swatch = /^#[0-9a-fA-F]{6}/.test(value) ? value.slice(0, 7) : "#101214";
  return (
    <ControlRow label={label} hint={hint ?? (effective ? `当前 ${effective}` : undefined)}>
      <span
        className="relative size-5.5 flex-none overflow-hidden rounded-2xs shadow-[inset_0_0_0_1px_var(--ui-border-strong)]"
        title="选一个颜色"
      >
        <span className="absolute inset-0" style={{ background: value || effective || swatch }} />
        <input
          type="color"
          aria-label={`${label} 取色`}
          value={swatch}
          className="absolute -inset-2 size-[160%] cursor-pointer border-0 p-0 opacity-0"
          onChange={(event) => onChange(`${event.target.value}cc`)}
        />
      </span>
      <Input
        className={cn(
          "h-5.5 w-19 flex-none border-transparent bg-transparent text-right font-mono text-ui-2xs",
          "hover:bg-tile-hover",
          !value && "text-muted",
        )}
        spellCheck={false}
        placeholder={effective || "默认"}
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
      />
    </ControlRow>
  );
}

/** 纯文本框（圆角、长度、阴影这类值）。 */
export function TextRow({
  label,
  hint,
  value,
  placeholder,
  effective,
  onInput,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  effective?: string;
  onInput: (value: string) => void;
}) {
  return (
    <ControlRow label={label} hint={hint ?? (effective ? `当前 ${effective}` : undefined)}>
      <Input
        className="h-6 w-27 flex-none min-w-0 font-mono text-ui-2xs"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onInput(event.target.value.trim())}
      />
    </ControlRow>
  );
}

/** 分组标题。 */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h5 className={cn("text-ui-xs font-semibold tracking-wide text-faint", className)}>
      {children}
    </h5>
  );
}
