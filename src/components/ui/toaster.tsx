import { CircleCheckBig, Info, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Toast, useStudio } from "@/store/studio-store";

/**
 * 面板自己的提示层。
 *
 * 底部那行状态字只有 10.5px，而且任何时候都有内容 —— 「已导出」和「正在编辑」长得
 * 一模一样，用户根本不会注意到动作已经完成。这里的每条提示都对应一件用户刚发起的
 * 事：结果、位置、失败原因。错误一律走这里（setStatus 里做了一次分发）。
 *
 * 位置固定在底部居中、状态行上方：右侧被悬浮面板占着（right-14 + w-84），居中既不
 * 压住它也不压住左侧主题库。层级高于悬浮面板，因为提示是瞬时的。
 */
const TONE = {
  success: "text-success",
  error: "text-danger",
  info: "text-muted",
} as const;

const ICON = {
  success: CircleCheckBig,
  error: TriangleAlert,
  info: Info,
} as const;

export function Toaster() {
  const toasts = useStudio((state) => state.toasts);
  const dismiss = useStudio((state) => state.dismissToast);
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-9 z-80 flex flex-col items-center gap-1.5 px-4"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICON[toast.kind];
  return (
    <div
      role="status"
      className={cn(
        "toast-in pointer-events-auto flex w-full max-w-[440px] items-start gap-2 rounded-sm",
        "border border-line bg-raised py-2 pr-1.5 pl-2.5 shadow-[0_16px_38px_rgba(0,0,0,0.34)]",
      )}
    >
      <Icon className={cn("mt-0.5 size-3.5 flex-none", TONE[toast.kind])} />
      <div className="min-w-0 flex-1">
        <p className="text-ui-sm font-medium text-ink">{toast.title}</p>
        {toast.detail ? (
          <p
            className={cn(
              "mt-0.5 text-ui-2xs break-all whitespace-pre-line text-faint",
              toast.mono && "font-mono",
            )}
          >
            {toast.detail}
          </p>
        ) : null}
        {toast.action ? (
          <Button
            variant="default"
            size="sm"
            className="mt-1.5"
            onClick={() => toast.action?.run()}
          >
            {toast.action.label}
          </Button>
        ) : null}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="关闭提示" onClick={onDismiss}>
        <X className="size-3" />
      </Button>
    </div>
  );
}
