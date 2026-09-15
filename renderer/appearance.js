/**
 * 工坊自己的外观处理。
 *
 * 刻意不复用 pi.todo 那套 appearance-boot/appearance：它们会把**当前激活的
 * 插件主题 CSS 注入本页面**。对一个主题编辑器来说这恰恰是错的 —— 正在编辑
 * 的主题会顺着 `.sidebar-body` / `.work-panel-main` 这些真实选择器糊到预览
 * replica 上，预览就不再等于「这份设计单独长什么样」。
 *
 * 所以这里只取基调（light/dark）与语言，忽略 pluginThemeCss：
 * 工坊自身的界面用 studio.css 的 --ui-* 变量，永远稳定可读。
 *
 * 暴露为 window.__studioAppearance。
 */
(function () {
  "use strict";

  var state = { base: "dark", locale: "zh-CN", started: false };
  var listeners = [];

  function prefersLight() {
    try {
      return window.matchMedia("(prefers-color-scheme: light)").matches;
    } catch (error) {
      return false;
    }
  }

  function resolveBase(value) {
    if (value === "light" || value === "dark") return value;
    return prefersLight() ? "light" : "dark";
  }

  function resolveLocale(value) {
    return String(value || "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  }

  function apply(appearance) {
    var raw = appearance || {};
    var base = resolveBase(raw.base);
    var locale = resolveLocale(raw.locale);
    var changed = base !== state.base || locale !== state.locale;

    state.base = base;
    state.locale = locale;

    var root = document.documentElement;
    root.dataset.theme = base;
    root.dataset.lang = locale === "zh-CN" ? "zh" : "en";
    root.lang = locale;

    if (changed) {
      for (var i = 0; i < listeners.length; i += 1) {
        try {
          listeners[i](state.base, state.locale);
        } catch (error) {
          /* 监听器不能影响外观处理 */
        }
      }
    }
    return state;
  }

  function init(bridge) {
    if (state.started) return;
    state.started = true;
    // 没有桥时先按操作系统偏好铺一帧，避免闪白。
    apply({ base: null, locale: navigator.language });
    if (!bridge || typeof bridge.invoke !== "function") return;

    bridge
      .invoke("app.getAppearance")
      .then(apply)
      .catch(function () {
        /* 老宿主没有这个 channel：保留上面那帧 */
      });

    if (typeof bridge.on === "function") {
      try {
        bridge.on("appearance:changed", apply);
      } catch (error) {
        /* 订阅失败无所谓 */
      }
    }
  }

  window.__studioAppearance = {
    init: init,
    apply: apply,
    current: function () {
      return { base: state.base, locale: state.locale };
    },
    onChange: function (fn) {
      listeners.push(fn);
    },
  };
})();
