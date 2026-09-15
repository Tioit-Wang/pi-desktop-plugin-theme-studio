import * as core from "@/lib/theme-model";
import { cn } from "@/lib/utils";

/**
 * 对比度检查（WCAG 2.1）。
 *
 * 半透明前景会先合成到背景上再算，所以看到的是真实比值。低于 4.5:1 的组合标红，
 * 但**不阻止保存** —— 审美决定权在使用者；最弱文字与状态色按装饰层处理。
 */
export function AuditPanel({ effective }: { effective: Record<string, string> }) {
  const ready = Object.keys(effective).length > 0;
  const rows = ready ? core.audit(effective) : [];
  const worst = rows.length ? core.worstRatio(rows) : 0;

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <p className="text-ui-sm leading-relaxed text-faint">
        对比度按当前设计实时计算。低于 4.5:1 的组合标红但不阻止保存 —— 审美决定权在你；
        最弱文字与状态色按装饰层处理。
      </p>

      <div className="flex items-center gap-2">
        <span className="text-ui-sm text-ink-2">
          最低正文对比度{" "}
          <b
            className={cn(
              "tabular-nums",
              !worst ? "text-muted" : worst >= 4.5 ? "text-success" : worst >= 3 ? "text-warning" : "text-danger",
            )}
          >
            {worst ? core.formatRatio(worst) : "—"}
          </b>
        </span>
      </div>

      <table className="w-full border-collapse text-ui-xs">
        <thead>
          <tr>
            <th className="px-1.5 py-1 text-left font-medium text-faint">前景 / 背景</th>
            <th className="px-1.5 py-1 text-left font-medium text-faint">色对</th>
            <th className="px-1.5 py-1 text-left font-medium text-faint">比值</th>
            <th className="px-1.5 py-1 text-left font-medium text-faint">正文</th>
            <th className="px-1.5 py-1 text-left font-medium text-faint">大字</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="bg-tile">
              <td className="px-1.5 py-1.5 text-ink-2">{row.label}</td>
              <td className="px-1.5 py-1.5">
                <span className="inline-flex gap-0.5">
                  <i
                    className="size-3 rounded-3xs shadow-[inset_0_0_0_1px_var(--ui-border-strong)]"
                    style={{ background: row.fg }}
                  />
                  <i
                    className="size-3 rounded-3xs shadow-[inset_0_0_0_1px_var(--ui-border-strong)]"
                    style={{ background: row.bg }}
                  />
                </span>
              </td>
              <td className="px-1.5 py-1.5 font-mono tabular-nums text-ink-2">
                {core.formatRatio(row.ratio)}
              </td>
              <td className="px-1.5 py-1.5">
                <Verdict ok={row.bodyOk} decorative={row.tier === "decorative"} />
              </td>
              <td className="px-1.5 py-1.5">
                <Verdict ok={row.largeOk} decorative={row.tier === "decorative"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!ready ? <p className="text-ui-sm text-faint">正在读取预览里的实际颜色…</p> : null}
    </div>
  );
}

function Verdict({ ok, decorative }: { ok: boolean; decorative: boolean }) {
  if (decorative) {
    return <span className="text-faint">装饰</span>;
  }
  return <span className={ok ? "text-success" : "text-danger"}>{ok ? "通过" : "偏低"}</span>;
}
