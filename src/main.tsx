import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StudioApp } from "@/features/shell/StudioApp";
// 顺序有讲究：Tailwind（分层）在前，照抄宿主的纯 CSS 在后 —— 未分层的规则优先级更高，
// 预览的度量因此不会被工具类改写。
import "./styles.css";
import "@/features/preview/host-tokens.css";
import "@/features/preview/host-replica.css";
import "@/features/preview/preview-overlay.css";

const host = document.getElementById("root");
if (!host) throw new Error("theme studio: 面板文档里没有 #root");

createRoot(host).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
);
