#!/usr/bin/env node
/**
 * 内置预设的入库门槛。
 *
 * 每个预设用主题模型自己的颜色数学核算两类东西，任何一项不达标就退出码 1：
 *
 *  1. 对比度审计（audit() 的全部配对）—— body 层 ≥ 4.5:1，decorative 层 ≥ 3:1。
 *  2. 按钮配对 —— 主按钮墨色落在 accent / accent-hover 上、ghost 静置态、
 *     次级按钮（文字可读 + 按钮底色与页面底色能区分开，≥ 1.1:1）。
 *
 * 第 2 类是 qq-2008 事故的根因：token 层面没有「同色」，但次级按钮底
 * （tile-hover）合成到页面底上只剩 1.08:1，按钮整个隐形；主按钮 4.02:1
 * 低于正文门槛。调主题时跑这个脚本，别再把隐形按钮发出去。
 *
 * 用法：npm run audit:presets（或 node scripts/audit-presets.mjs）。
 */
import { audit, composite, contrast, defaults, formatRatio, parseColor, toHex } from "../lib/theme-core.mjs";
import { PRESETS } from "../lib/presets.mjs";

const BODY_MIN = 4.5;
const DECORATIVE_MIN = 3;
const BUTTON_DISTINCT_MIN = 1.1;

/** 未覆盖的 token 回落到宿主默认值。 */
function effective(preset) {
  const base = defaults(preset.base);
  const out = {};
  for (const key of Object.keys(base)) {
    const value = preset.tokens[key];
    out[key] = value === undefined || value === "" ? base[key] : value;
  }
  return out;
}

/** 半透明底合成到不透明底板上的实色。 */
function over(top, under) {
  const a = parseColor(top);
  const b = parseColor(under);
  return a && b ? toHex(composite(a, b)) : top;
}

const failures = [];

for (const preset of PRESETS) {
  const eff = effective(preset);
  const label = `${preset.id} (${preset.label}, base=${preset.base})`;

  for (const row of audit(eff)) {
    const min = row.tier === "body" ? BODY_MIN : DECORATIVE_MIN;
    if (row.ratio < min) {
      failures.push(`${label} 对比度「${row.label}」 ${formatRatio(row.ratio)} < ${min}:1（${row.tier}）`);
    }
  }

  const buttonPairs = [
    ["主按钮墨色 / accent", eff["bg-primary"], eff.accent],
    ["主按钮墨色 / accent-hover", eff["bg-primary"], eff["accent-hover"]],
    ["ghost 静置字 / 页面底", eff["text-secondary"], eff["bg-primary"]],
    ["次级按钮字 / 次级按钮底", eff["text-primary"], over(eff["tile-hover"], eff["bg-primary"])],
  ];
  for (const [name, fg, bg] of buttonPairs) {
    const ratio = contrast(fg, bg);
    if (ratio < BODY_MIN) {
      failures.push(`${label} 按钮「${name}」 ${formatRatio(ratio)} < ${BODY_MIN}:1`);
    }
  }

  const distinct = contrast(over(eff["tile-hover"], eff["bg-primary"]), eff["bg-primary"]);
  if (distinct < BUTTON_DISTINCT_MIN) {
    failures.push(
      `${label} 次级按钮底与页面底不可区分 ${distinct.toFixed(2)}:1 < ${BUTTON_DISTINCT_MIN}:1`,
    );
  }
}

if (failures.length) {
  console.error(`audit:presets — ${failures.length} 项不达标：`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`audit:presets — ${PRESETS.length} 个预设全部通过（对比度 + 按钮配对）。`);
