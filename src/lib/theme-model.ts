/**
 * 主题模型 —— 直接复用插件进程那一份（lib/theme-core.mjs）。
 *
 * 这里不再复制任何实现：token 表、白名单、序列化、对比度算法都只有一份，
 * 所以「面板里看到的」与「落盘注册的」不可能漂移。
 */
export * from "../../lib/theme-core.mjs";
export { default } from "../../lib/theme-core.mjs";
export type {
  AuditPair,
  AuditRow,
  RegionDef,
  Rgba,
  SerializeOptions,
  Surface as ModelSurface,
  TokenDef,
  TokenGroup,
  TokenType,
} from "../../lib/theme-core.mjs";
