import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * 面板是以 file:// 加载的（宿主 plugin-panel-host.ts 走
 * loadURL(pathToFileURL(htmlPath))），这决定了产物形态：
 *
 *  - `type="module"` 在 file:// 下会被 CORS 拒掉（origin 是 null）。宿主内置插件
 *    pi.file-manager 的 views/index.html 用的也是普通 <script>，所以这里打成
 *    **单包 IIFE**，并把 Vite 生成的 module 脚本标签改回经典脚本。
 *  - Vite 会把入口脚本提到 <head>（对 module 脚本无害，因为它天然 defer）。
 *    经典脚本没有这个语义，所以重写时必须补上 defer，否则会在 #root 出现之前执行。
 *  - 单包意味着不能有 code split / 动态 import chunk，base 必须是相对路径。
 *
 * outDir 是 renderer/ —— manifest.json 的 ui.panel 与 contributes.views[].entry
 * 都指向 renderer/index.html，构建产物直接覆盖它。dist/ 只给一次性实验用：它被
 * 宿主开发监听器忽略（plugin-watcher.ts 的 IGNORED_WATCH_DIRS），也不会被
 * pi-plugin pack 收进包里。
 *
 * 配置文件是 .mts 而不是 .ts：根 package.json 必须是 CommonJS（插件进程
 * main.js 走 require），所以不能用 "type": "module" 让 .ts 变成 ESM。
 */
function classicScriptTag(): Plugin {
  return {
    name: "pi-plugin-classic-script",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html
          .replace(/<script type="module" crossorigin/g, "<script defer")
          .replace(/<script type="module"/g, "<script defer")
          .replace(/<link rel="modulepreload"[^>]*>/g, "");
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), classicScriptTag()],
  base: "./",
  build: {
    outDir: "renderer",
    emptyOutDir: true,
    target: "chrome126",
    cssCodeSplit: false,
    modulePreload: false,
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "assets/index.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
