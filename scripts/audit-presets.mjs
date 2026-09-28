#!/usr/bin/env node
/**
 * 内置预设的入库门槛。
 *
 * 每个预设跑一遍主题模型的 auditDesign()（lib/theme-core.mjs）：对比度审计
 * （body 4.5:1 / decorative 3:1）+ 按钮配对（主按钮墨色、ghost 静置态、次级
 * 按钮可读与可区分）+ 抬升条漂白检查。任何一项不达标就退出码 1。
 *
 * 这套检查和 theme_studio_write 保存用户主题时跑的是同一份 —— qq-2008 把
 * 「次级按钮底与页面底只剩 1.08:1」的主题发出去的事故，两边都拦得住。
 *
 * 用法：npm run audit:presets（或 node scripts/audit-presets.mjs）。
 */
import { auditDesign } from "../lib/theme-core.mjs";
import { PRESETS } from "../lib/presets.mjs";

const failures = [];

for (const preset of PRESETS) {
  for (const failure of auditDesign(preset, preset.base)) {
    failures.push(`${preset.id} (${preset.label}): ${failure}`);
  }
}

if (failures.length) {
  console.error(`audit:presets — ${failures.length} 项不达标：`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`audit:presets — ${PRESETS.length} 个预设全部通过（对比度 + 按钮配对 + 抬升条）。`);
