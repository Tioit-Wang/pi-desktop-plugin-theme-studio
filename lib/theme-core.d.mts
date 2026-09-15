/**
 * 主题模型（lib/theme-core.mjs）的类型声明。
 *
 * 模型本身是纯 JS —— 插件进程与渲染层加载的是同一份实现，这里只是给 TypeScript
 * 一个接口。改模型的导出时同步改这个文件。
 */

export type TokenType = "color" | "alpha" | "size" | "shadow";

export type TokenDef = {
  key: string;
  name: string;
  type: TokenType;
  dark: string;
  light: string;
};

export type TokenGroup = {
  id: string;
  label: string;
  desc: string;
  tokens: TokenDef[];
};

export type RegionDef = {
  id: string;
  label: string;
  /** 真实外壳里的选择器；空串表示「区域本身就是根元素」。 */
  selector: string;
  /** 0 = 整窗，1 = 三栏，2 = 栏内。 */
  depth: number;
  note: string;
  /** 只提供底色（右栏嵌的是原生 WebContentsView，盖不住图片）。 */
  fillOnly?: boolean;
};

export type AuditTier = "body" | "decorative";

export type AuditPair = {
  label: string;
  fg: string | null;
  bg: string;
  tier: AuditTier;
};

export type Rgba = { r: number; g: number; b: number; a: number };

export type AuditRow = {
  label: string;
  fg: string;
  bg: string;
  /** body = 正文层（4.5:1 才算过），decorative = 装饰层（不判失败）。 */
  tier: AuditTier;
  ratio: number;
  bodyOk: boolean;
  largeOk: boolean;
};

export type SurfaceImage = {
  on: boolean;
  image: string;
  size: string;
  repeat: string;
  position: string;
};

export type Surface = {
  fill?: string;
  gradient?: { on: boolean; angle: number; from: string; to: string };
  image?: SurfaceImage;
  blur?: number;
  radius?: string;
};

export type SerializeOptions = {
  rootSelector?: string;
  note?: string;
  resolveImage?: (image: { on?: boolean; image?: string }) => string;
};

export type Design = {
  tokens?: Record<string, string>;
  regions?: Record<string, Surface>;
  sidebarImage?: unknown;
};

export const TOKEN_GROUPS: TokenGroup[];
export const TOKEN_KEYS: string[];
export const TOKEN_BY_KEY: Record<string, TokenDef>;
export const REGIONS: RegionDef[];
export const AUDIT_PAIRS: AuditPair[];
export const BACKGROUND_SIZES: string[];
export const BACKGROUND_REPEATS: string[];
export const BACKGROUND_POSITIONS: string[];
export const MAX_BLUR: number;

export function defaults(base: string): Record<string, string>;
export function emptySurface(): Surface;
export function emptyImage(): SurfaceImage;
export function surfaceIsEmpty(surface: Surface | undefined): boolean;
export function surfaceDeclarations(
  region: Surface | undefined,
  resolveImage: (image: SurfaceImage) => string,
): string[];
export function sidebarImageCss(
  sidebarImage: unknown,
  resolveImage: (image: unknown) => string,
): string;

export function isHex6(value: unknown): boolean;
export function isColorValue(value: unknown): boolean;
export function isTokenValueAllowed(key: string, value: unknown): boolean;
export function normalizeColor(value: string): string;

export function parseColor(value: unknown): Rgba | null;
export function composite(fg: Rgba | null, bg: Rgba | null): Rgba | null;
export function toHex(color: Rgba): string;
export function toHex8(color: Rgba): string;
export function relativeLuminance(color: Rgba | null): number;
export function contrast(fg: unknown, bg: unknown): number;
export function formatRatio(ratio: number): string;
export function accentInk(effective: Record<string, string>): string;
export function audit(effective: Record<string, string>): AuditRow[];
export function worstRatio(rows: AuditRow[], tier?: AuditTier): number;

export function selectorFor(base: string): string;
export function serialize(base: string, design: Design, options?: SerializeOptions): string;
export function parse(css: string): unknown;
export function overriddenKeys(design: { tokens?: Record<string, string> }): string[];

/**
 * Ĭ�ϵ��� = ͬһ������������ռ���ͼ��ģ���� `export default ThemeModel`����
 */
declare const ThemeModel: {
  TOKEN_GROUPS: TokenGroup[];
  TOKEN_KEYS: string[];
  TOKEN_BY_KEY: Record<string, TokenDef>;
  REGIONS: RegionDef[];
  AUDIT_PAIRS: AuditPair[];
  defaults: typeof defaults;
  emptySurface: typeof emptySurface;
  emptyImage: typeof emptyImage;
  surfaceIsEmpty: typeof surfaceIsEmpty;
  serialize: typeof serialize;
  audit: typeof audit;
  worstRatio: typeof worstRatio;
  parseColor: typeof parseColor;
  isColorValue: typeof isColorValue;
  isTokenValueAllowed: typeof isTokenValueAllowed;
  overriddenKeys: typeof overriddenKeys;
};

export default ThemeModel;
