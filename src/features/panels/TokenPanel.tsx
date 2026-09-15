import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ColorRow, TextRow } from "@/features/panels/controls";
import * as core from "@/lib/theme-model";
import type { Theme } from "@/lib/types";

/** Token 列表：56 个 --ds-* 变量，按组折叠，未覆盖的显示宿主当前值。 */
export function TokenPanel({
  theme,
  defaults,
  effective,
  onSetToken,
  onInvalid,
}: {
  theme: Theme;
  defaults: Record<string, string>;
  effective: Record<string, string>;
  onSetToken: (key: string, value: string) => void;
  onInvalid: (message: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();

  const groups = useMemo(
    () =>
      core.TOKEN_GROUPS.map((group) => ({
        ...group,
        visible: group.tokens.filter(
          (token) =>
            !needle ||
            token.key.toLowerCase().includes(needle) ||
            token.name.toLowerCase().includes(needle),
        ),
      })).filter((group) => group.visible.length > 0),
    [needle],
  );

  const overridden = theme.tokens ?? {};
  const count = Object.keys(overridden).length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 p-3 pb-2">
        <Input
          value={filter}
          spellCheck={false}
          placeholder="搜索 token（如 text-muted）"
          onChange={(event) => setFilter(event.target.value)}
        />
        <Badge title="已覆盖的 token 数量">{count}</Badge>
      </div>

      {groups.map((group) => (
        <Collapsible
          key={group.id}
          defaultOpen={Boolean(needle) || group.id === "surfaces" || group.id === "sidebar"}
        >
          <CollapsibleTrigger>
            {group.label}
            <span className="ml-auto text-ui-xs font-normal text-faint">{group.visible.length}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="px-3 pb-1.5 text-ui-2xs leading-relaxed text-faint">{group.desc}</p>
            <div className="pb-2">
              {group.visible.map((token) => {
                const value = overridden[token.key] ?? "";
                const key = `--ds-${token.key}`;

                if (token.type === "color" || token.type === "alpha") {
                  return (
                    <div key={token.key} className="px-3">
                      <ColorRow
                        label={key}
                        hint={token.name}
                        value={value}
                        effective={effective[token.key]}
                        onChange={(next) => onSetToken(token.key, next)}
                      />
                    </div>
                  );
                }

                return (
                  <div key={token.key} className="px-3">
                    <TextRow
                      label={`${key} · ${token.name}`}
                      value={value}
                      effective={defaults[token.key] ?? ""}
                      placeholder="如 12px"
                      onInput={(next) => {
                        if (next && !core.isTokenValueAllowed(token.key, next)) {
                          onInvalid(`${key} 的值不被允许：${next}`);
                          return;
                        }
                        onSetToken(token.key, next);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}

      {groups.length === 0 ? (
        <p className="px-3 py-4 text-ui-sm text-faint">没有匹配的 token</p>
      ) : null}

      <p className="px-3 pt-1 pb-3 text-ui-2xs leading-relaxed text-faint">
        只写被改动过的声明：没改的 token 由宿主自己的 tokens.css 决定，所以主题文件是一层
        薄覆盖。颜色支持 <code className="rounded-3xs bg-tile-hover px-1 font-mono">#rrggbb</code>
        、<code className="rounded-3xs bg-tile-hover px-1 font-mono">#rrggbbaa</code> 与{" "}
        <code className="rounded-3xs bg-tile-hover px-1 font-mono">transparent</code>。
      </p>
    </div>
  );
}
