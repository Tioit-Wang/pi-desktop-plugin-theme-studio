/**
 * 主题工坊 —— 面板逻辑。
 *
 * 数据流：
 *
 *   studio.library（插件进程：主题库 + 宿主默认值 + 资源 data URL）
 *        ↓ 选中
 *   当前设计（tokens / sidebarImage / surfaces）
 *        ↓ 每次改动
 *   paintPreview()：core.serialize(..., rootSelector=".pv-root[…]") 注入预览
 *        ↓ 600ms 防抖
 *   studio.theme.save → pi.themes.upsert → 宿主爆 pluginChanged
 *        ↓ 如果这个主题正是应用中的那个
 *   应用窗口立刻换色，**不需要重载插件**（ADR 0249）
 *
 * 「应用」额外调用 studio.apply → pi.app.setTheme，把该主题设为应用主题。
 *
 * 主题库整份存在插件 settings 里，插件加载时重新注册，所以这里不做本地持久化
 * 之外的任何缓存 —— 唯一真相是插件进程返回的 state。
 */
(function () {
  "use strict";

  var core = window.ThemeModel;
  var appearance = window.__studioAppearance;
  var bridge = window.pluginBridge || null;

  var SAVE_DEBOUNCE_MS = 600;

  /** 只读的「回到宿主默认」选项，不是本插件的主题。 */
  var BUILTIN_CHOICES = [
    { id: "system", label: "跟随系统" },
    { id: "dark", label: "内置 Dark" },
    { id: "light", label: "内置 Light" }
  ];

  var BASE_HEX = /^#[0-9a-fA-F]{6}$/;

  var state = {
    themes: [],
    active: "",
    applied: "",
    pluginId: "",
     images: [],
     orphans: [],
     previewData: {},
     defaults: { dark: {}, light: {} },
     runtimeApi: { available: null, reason: "" },
    view: "chat",
    zoom: "fit",
    filter: "",
    // 当前选中的区域（整窗 / 左栏 / …），以及打开的悬浮面板
    region: "shell",
    pane: null,
    libraryOpen: true,
    saveTimer: 0
  };

  var probe = null;

  /* ==================================================================== *
   * 基础
   * ==================================================================== */

  function el(id) {
    return document.getElementById(id);
  }

  function invoke(channel, payload) {
    if (!bridge || typeof bridge.invoke !== "function") {
      return Promise.reject(new Error("插件桥不可用"));
    }
    return bridge.invoke(channel, payload || {});
  }

   /**
    * 把宿主的原始错误翻译成能照着做的说明。
    * 最常见的一种是插件进程里没有 pi.themes（宿主 < 0.14.8），原生报错是
    * "Cannot read properties of undefined (reading 'upsert')"，对使用者毫无信息量。
    */
   function detail(error) {
     var message = String((error && error.message) || error || "未知错误");
     if (/reading '(upsert|remove|list|setTheme)'/.test(message)) {
       return (
         "宿主的运行时主题 API 不可用（pi.themes / pi.app.setTheme），需要 PI-Desktop ≥ 0.14.8；" +
         "若应用是从旧代码启动的，请从更新后的代码重启"
       );
     }
     return message;
   }

   /**
    * 宿主缺少运行时主题 API 时，把不能用的动作关掉并说明原因 ——
    * 比让用户点下去再吃一个 TypeError 好。
    */
   function applyCapabilityGate() {
     if (state.runtimeApi.available !== false) return;
     var ids = ["btnNewTheme", "btnDuplicate", "btnSave", "btnApply"];
     for (var i = 0; i < ids.length; i += 1) {
       var node = el(ids[i]);
       if (node) {
         node.disabled = true;
         node.title = "宿主的运行时主题 API 不可用";
       }
     }
     var rowActions = document.querySelectorAll(".lib-row .row-actions .mini");
     for (var j = 0; j < rowActions.length; j += 1) rowActions[j].disabled = true;
     setStatus(
       "宿主的运行时主题 API 不可用（pi.themes / pi.app.setTheme）：本插件需要 PI-Desktop ≥ 0.14.8，"
         + "且应用要从未合并前的旧代码重启。当前只能预览，无法注册主题。"
         + (state.runtimeApi.reason ? "（" + state.runtimeApi.reason + "）" : ""),
       true,
     );
   }

  function setStatus(text, isError) {
    var node = el("status");
    node.textContent = text;
    node.className = isError ? "status error" : "status";
  }

  function activeTheme() {
    for (var i = 0; i < state.themes.length; i += 1) {
      if (state.themes[i].id === state.active) return state.themes[i];
    }
    return null;
  }

  function themeBase(theme) {
    return theme && theme.base === "light" ? "light" : "dark";
  }

  /** 当前主题的设计三件套（预览、序列化、保存都用它）。 */
  function designOf(theme) {
    return {
      tokens: (theme && theme.tokens) || {},
      sidebarImage: (theme && theme.sidebarImage) || { on: false, kind: "none" },
       regions: (theme && theme.regions) || {},
    };
  }

  /**
   * 预览里图片怎么落地。
   *
   * 优先用预读好的 data: URL（一定可用），其次才是
   * plugin-asset://<插件>/<包内路径> —— 宿主只为「已应用主题声明过的资源」
   * 提供它，别的主题的图在那里是 404。
   */
  function resolvePreviewImage(image) {
    if (!image || image.on !== true || !image.image) return "";
    var list = state.images || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === image.image) {
        if (state.previewData[image.image]) return state.previewData[image.image];
        // 兜底：宿主按绝对路径提供字节（ADR 0255），所以整条路径都要编码。
        return list[i].path
          ? "plugin-asset://" + state.pluginId + "/" + encodeURIComponent(list[i].path.replace(/\\/g, "/"))
          : "";
      }
    }
    return "";
  }

  /**
   * 把当前主题用到的图片预读成 data: URL。
   *
   * 宿主 scheme 只对已应用主题声明过的资源可用，而面板要能预览任意主题；
   * data: 一定可用，代价是内存里多一份 base64。只读一次，之后走缓存。
   */
  function prefetchPreviewImages() {
    var theme = activeTheme();
    if (!theme) return Promise.resolve();
    var ids = [];
    var sides = [theme.sidebarImage];
    var regions = theme.regions || {};
    for (var id in regions) {
      if (Object.prototype.hasOwnProperty.call(regions, id)) {
        sides.push(regions[id] && regions[id].image);
      }
    }
    sides.forEach(function (image) {
      if (image && image.on === true && image.image && !state.previewData[image.image]) {
        ids.push(image.image);
      }
    });
    if (!ids.length) return Promise.resolve();
    return Promise.all(
      ids.map(function (id) {
        return invoke("studio.image.read", { id: id })
          .then(function (result) {
            state.previewData[id] = result.dataUrl;
          })
          .catch(function () {
            /* 读不到就不预览，不影响其它部分 */
          });
      }),
    ).then(function () {
      paintPreview();
    });
  }

  function overriddenCount(theme) {
    return core.overriddenKeys(designOf(theme)).length;
  }

  /* ==================================================================== *
   * 预览
   * ==================================================================== */

  function previewRootSelector() {
    return '.pv-root[data-theme="' + themeBase(activeTheme()) + '"]';
  }

  function previewCss(theme) {
    return core.serialize(themeBase(theme), designOf(theme), {
      rootSelector: previewRootSelector(),
       resolveImage: resolvePreviewImage,
      note: (theme && theme.label) || "",
    });
  }

  function paintPreview() {
    var theme = activeTheme();
    prefetchPreviewImages();
    var shell = el("previewShell");
    var base = themeBase(theme);

    // 基调 + 设计覆盖值都落在 .pv-root 上：未覆盖的 token 由 studio.css 里
    // 的宿主默认调色板快照提供，所以预览等于真实界面。
    shell.setAttribute("data-theme", base);
    shell.style.colorScheme = base;

    var style = document.getElementById("pv-theme");
    if (!style) {
      style = document.createElement("style");
      style.id = "pv-theme";
      document.head.append(style);
    }
    style.textContent = previewCss(theme);

    el("dockTitle").textContent = theme ? theme.label : "—";
    el("dockMeta").textContent =
      base + " 基底 · 覆盖 " + (theme ? overriddenCount(theme) : 0) + " 个 token";
    el("settingsThemeLabel").textContent = theme ? "主题工坊 · " + theme.label : "主题工坊";

    var swatch = el("dockSwatch");
    swatch.replaceChildren();
    var preview = pickPreviewColors();
    for (var i = 0; i < preview.length; i += 1) {
      var cell = document.createElement("i");
      cell.style.background = preview[i];
      swatch.append(cell);
    }
  }

  /**
   * 用探针把 CSS 变量解析成真实颜色。
   *
   * 宿主默认值里大量使用 color-mix()/var() 链，字符串本身不是颜色；把变量赋给
   * 一个元素的 background-color 再读计算值，得到的就是浏览器解析后的真实结果。
   */
  function ensureProbe() {
    if (probe && probe.isConnected) return probe;
    probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;";
    el("previewShell").append(probe);
    return probe;
  }

  /** 解析一个 --ds-* 到 #rrggbb 或 #rrggbbaa；解析不出来返回 ""。 */
  function resolveVar(name) {
    var node = ensureProbe();
    node.style.backgroundColor = "";
    node.style.backgroundColor = "var(--ds-" + name + ")";
    var computed = window.getComputedStyle(node).backgroundColor;
    var parsed = core.parseColor(computed);
    if (!parsed) return "";
    return parsed.a < 1 ? core.toHex8(parsed) : core.toHex(parsed);
  }

  function resolveNonColor(name) {
    var node = ensureProbe();
    node.style.removeProperty("--probe");
    return window.getComputedStyle(node).getPropertyValue("--ds-" + name).trim();
  }

  /** 某一列为 6 位或 8 位十六进制。 */
  function splitHex(value) {
    var text = String(value || "");
    if (BASE_HEX.test(text)) return { rgb: text.toLowerCase(), alpha: 255 };
    if (/^#[0-9a-fA-F]{8}$/.test(text)) {
      return { rgb: "#" + text.slice(1, 7).toLowerCase(), alpha: parseInt(text.slice(7, 9), 16) };
    }
    return { rgb: "#000000", alpha: 255 };
  }

  function withAlpha(rgb, alpha) {
    return alpha >= 255 ? rgb.toLowerCase() : rgb.toLowerCase() + alpha.toString(16).padStart(2, "0");
  }

  function alphaPercent(value) {
    return Math.round((splitHex(value).alpha / 255) * 100);
  }

  function pickPreviewColors() {
    return [
      resolveVar("bg-under"),
      resolveVar("bg-sidebar"),
      resolveVar("accent"),
      resolveVar("text-primary"),
    ].map(function (value) {
      return value || "transparent";
    });
  }

  /* ==================================================================== *
   * 控件工厂
   * ==================================================================== */

  function row(labelText, hint) {
    var node = document.createElement("div");
    node.className = "ctl";
    var label = document.createElement("label");
    label.textContent = labelText;
    if (hint) label.title = hint;
    node.append(label);
    return node;
  }

  /** 颜色 + 透明度：swatch、hex、alpha 滑杆。value 为 "" 表示未覆盖。 */
  function colorControl(labelText, value, effective, onChange, hint) {
    var node = row(labelText, hint);
    var parts = splitHex(BASE_HEX.test(value) || /^#[0-9a-fA-F]{8}$/.test(value) ? value : effective);

    var swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = value || effective || "transparent";
    var picker = document.createElement("input");
    picker.type = "color";
    picker.value = BASE_HEX.test(parts.rgb) ? parts.rgb : "#000000";
    swatch.append(picker);

    var text = document.createElement("input");
    text.type = "text";
    text.className = "hex";
    text.spellcheck = false;
    text.value = value || "";
    text.placeholder = effective || "继承";

    var alpha = document.createElement("input");
    alpha.type = "range";
    alpha.className = "alpha";
    alpha.min = "0";
    alpha.max = "255";
    alpha.value = String(parts.alpha);
    alpha.title = "透明度";

    function commit(next) {
      var text2 = String(next || "").trim();
      if (text2 === "") {
        onChange("");
        return;
      }
      if (!/^#[0-9a-fA-F]{6}$/.test(text2) && !/^#[0-9a-fA-F]{8}$/.test(text2)) {
        text.value = value || "";
        return;
      }
      var normalized = text2.toLowerCase();
      // 改回与宿主默认一致时就不留覆盖，主题里少一条无意义的声明。
      onChange(normalized === String(effective || "").toLowerCase() ? "" : normalized);
    }

    picker.addEventListener("input", function () {
      var next = withAlpha(picker.value, Number(alpha.value));
      text.value = next;
      swatch.style.background = next;
      commit(next);
    });
    text.addEventListener("change", function () {
      commit(text.value);
    });
    alpha.addEventListener("input", function () {
      var currentRgb = BASE_HEX.test(text.value) ? text.value : parts.rgb;
      var next = withAlpha(currentRgb, Number(alpha.value));
      text.value = next;
      swatch.style.background = next;
      commit(next);
    });

    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "mini";
    reset.textContent = "↺";
    reset.title = "恢复为宿主默认";
    reset.addEventListener("click", function () {
      onChange("");
    });

    node.append(swatch, text, alpha, reset);
    return node;
  }

  function textControl(labelText, value, placeholder, onCommit, hint) {
    var node = row(labelText, hint);
    var input = document.createElement("input");
    input.type = "text";
    input.className = "wide";
    input.value = value || "";
    input.placeholder = placeholder || "";
    input.spellcheck = false;
    input.addEventListener("change", function () {
      onCommit(input.value.trim());
    });
    node.append(input);
    return node;
  }

  function rangeControl(labelText, value, min, max, onInput, hint) {
    var node = row(labelText, hint);
    var input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    var out = document.createElement("span");
    out.className = "val";
    out.textContent = String(value);
    input.addEventListener("input", function () {
      out.textContent = input.value;
      onInput(Number(input.value));
    });
    node.append(input, out);
    return node;
  }

  function selectControl(labelText, value, options, onChange, hint) {
    var node = row(labelText, hint);
    var select = document.createElement("select");
    for (var i = 0; i < options.length; i += 1) {
      var option = document.createElement("option");
      option.value = options[i].value;
      option.textContent = options[i].label;
      select.append(option);
    }
    select.value = value;
    select.addEventListener("change", function () {
      onChange(select.value);
    });
    node.append(select);
    return node;
  }

  function toggleControl(labelText, checked, onChange, hint) {
    var node = row(labelText, hint);
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", function () {
      onChange(input.checked);
    });
    node.append(input);
    return node;
  }

  /* ==================================================================== *
   * 设计改动
   * ==================================================================== */

  /** 所有改动的唯一出口：改设计 → 重绘 → 防抖注册。 */
  function mutate(mutator) {
    var theme = activeTheme();
    if (!theme) return;
    mutator(theme);
    paintPreview();
    renderTopbar();
    renderLibrarySwatches();
    renderAudit();
    scheduleSave();
  }

  /**
   * 改**当前选中区域**的一个字段，然后重画预览、面板与检查表。
   *
   * 区域由 state.region 决定（点预览选中的那块）；区域清空后就把 key 删掉，
   * 主题里不会留空声明。
   */
  function commit(mutator) {
    var theme = activeTheme();
    if (!theme) return;
    var id = state.region || "shell";
    var regions = (theme.regions = theme.regions || {});
    var region = regions[id] || (regions[id] = {});
    mutator(region);
    if (core.surfaceIsEmpty(region)) delete regions[id];
    else regions[id] = region;
    mutate(function () {});
    if (state.pane === "region") renderRegionPanel();
  }

  function setToken(key, value) {
    mutate(function (theme) {
      var tokens = theme.tokens || (theme.tokens = {});
      if (value === "" || value === undefined || value === null) delete tokens[key];
      else tokens[key] = value;
    });
  }

  function scheduleSave() {
    if (state.saveTimer) window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(function () {
      state.saveTimer = 0;
      pushTheme({ quiet: true });
    }, SAVE_DEBOUNCE_MS);
  }

  /* ==================================================================== *
   * 注册 / 应用
   * ==================================================================== */

  /**
   * 这份设计里有图片吗？
   *
   * 有图片 → 只能由静态贡献承载；没有图片 → 运行时注册，改完即刻生效。
   */
  function designHasImage(design) {
    var sides = [design.sidebarImage];
    var regions = design.regions || {};
    for (var id in regions) {
      if (Object.prototype.hasOwnProperty.call(regions, id)) {
        sides.push(regions[id] && regions[id].image);
      }
    }
    for (var i = 0; i < sides.length; i += 1) {
      var image = sides[i];
      if (image && image.on === true && image.image) return true;
    }
    return false;
  }

  /** 把当前主题推给宿主。quiet=true 时用于自动保存，不打断状态栏。 */
  function pushTheme(options) {
    var theme = activeTheme();
    if (!theme) return Promise.resolve(null);
    return invoke("studio.theme.save", { theme: theme })
      .then(function (result) {
         if (!options || !options.quiet) {
           // 只有一条通道：运行时注册。宿主会解析 CSS 里的绝对路径（ADR 0255），
           // 所以保存不写任何插件包内文件，也就不会触发重载。
           var hasImage = designHasImage(designOf(theme));
           setStatus(
             "已注册「" + theme.label + "」· " + result.bytes + " 字节 CSS" +
               (hasImage ? " · 含本地图片（绝对路径）" : "") +
               (theme.id === state.applied ? " · 应用窗口已同步更新" : ""),
           );

         }
        return result;
      })
      .catch(function (error) {
        setStatus("注册失败：" + detail(error), true);
        return null;
      });
  }

  function applyCurrent() {
    var theme = activeTheme();
    if (!theme) return;
    setStatus("正在应用「" + theme.label + "」…");
    pushTheme({ quiet: true })
      .then(function () {
        return invoke("studio.apply", { id: theme.id });
      })
      .then(function (result) {
        state.applied = result && result.applied ? result.applied : theme.id;
        renderTopbar();
        setStatus(
          "已应用「" + theme.label + "」· " +
            (designHasImage(designOf(theme))
              ? "含本地图片，插件重载后换色（约 0.3s）"
              : "应用窗口即刻换色"),
        );
      })
      .catch(function (error) {
        setStatus("应用失败：" + detail(error), true);
      });
  }

  function applyBuiltin(id) {
    invoke("studio.apply", { id: id })
      .then(function () {
        state.applied = id;
        renderTopbar();
        setStatus("已切换为宿主主题：" + id);
      })
      .catch(function (error) {
        setStatus("切换失败：" + detail(error), true);
      });
  }

  /* ==================================================================== *
   * 主题库
   * ==================================================================== */

  function renderLibrary() {
    var host = el("libList");
    host.replaceChildren();

    var filter = state.filter.trim().toLowerCase();
    var groups = [
      { label: "我的主题", items: state.themes.filter(function (t) { return !t.builtin; }) },
      { label: "内置预设", items: state.themes.filter(function (t) { return t.builtin; }) },
      { label: "宿主主题", items: BUILTIN_CHOICES.map(function (c) {
        return { id: "builtin:" + c.id, label: c.label, base: "", builtinHost: true };
      }) },
    ];

    var shown = 0;
    for (var g = 0; g < groups.length; g += 1) {
      var items = groups[g].items.filter(function (item) {
        if (!filter) return true;
        return (
          String(item.label).toLowerCase().indexOf(filter) !== -1 ||
          String(item.id).toLowerCase().indexOf(filter) !== -1
        );
      });
      if (!items.length) continue;
      shown += items.length;

      var head = document.createElement("div");
      head.className = "lib-group";
      head.textContent = groups[g].label;
      host.append(head);

      for (var k = 0; k < items.length; k += 1) host.append(libraryRow(items[k]));
    }

    if (!shown) {
      var empty = document.createElement("div");
      empty.className = "lib-empty";
      empty.textContent = "没有匹配的主题";
      host.append(empty);
    }
  }

  function libraryRow(theme) {
    var isHost = theme.builtinHost === true;
    var isActive = !isHost && theme.id === state.active;
    var isApplied = isHost
      ? state.applied === theme.id.slice("builtin:".length)
      : state.applied === theme.id;

    var row = document.createElement("div");
    row.className = "lib-row" + (isActive ? " on" : "");
    row.title = isHost ? theme.id.slice("builtin:".length) : theme.id;
    if (isHost) row.setAttribute("data-host", "1");

    var sw = document.createElement("span");
    sw.className = "sw";
    var colors = isHost ? [] : previewColorsFor(theme);
    for (var i = 0; i < 4; i += 1) {
      var cell = document.createElement("i");
      cell.style.background = colors[i] || "transparent";
      sw.append(cell);
    }

    var name = document.createElement("button");
    name.type = "button";
    name.className = "nm";
    name.textContent = theme.label;
    name.addEventListener("click", function () {
      if (isHost) {
        applyBuiltin(theme.id.slice("builtin:".length));
        return;
      }
      selectTheme(theme.id);
    });

    var badge = document.createElement("span");
    badge.className = "bd";
    badge.textContent = isHost ? "宿主" : theme.base === "light" ? "L" : "D";

    row.append(sw, name, badge);

    if (isApplied) {
      var live = document.createElement("span");
      live.className = "live-dot";
      live.title = "使用中";
      row.append(live);
    }

    if (!isHost) {
      var actions = document.createElement("span");
      actions.className = "row-actions";

      var dup = document.createElement("button");
      dup.type = "button";
      dup.className = "mini";
      dup.textContent = "⧉";
      dup.title = "复制";
      dup.addEventListener("click", function (event) {
        event.stopPropagation();
        duplicateTheme(theme.id);
      });

      var del = document.createElement("button");
      del.type = "button";
      del.className = "mini";
      del.textContent = "✕";
      del.title = "删除";
      del.addEventListener("click", function (event) {
        event.stopPropagation();
        deleteTheme(theme.id);
      });

      actions.append(dup, del);
      row.append(actions);
    }

    return row;
  }

  /** 列表缩略色：直接对该主题算一遍，不依赖当前选中项。 */
  function previewColorsFor(theme) {
    var base = themeBase(theme);
    var tokens = (theme && theme.tokens) || {};
    function pick(key) {
      var value = tokens[key];
      if (value) return value;
      var fallback = (state.defaults[base] || {})[key];
      var parsed = core.parseColor(fallback);
      return parsed ? (parsed.a < 1 ? core.toHex8(parsed) : core.toHex(parsed)) : "transparent";
    }
    return [pick("bg-under"), pick("bg-sidebar"), pick("accent"), pick("text-primary")];
  }

  function renderLibrarySwatches() {
    renderLibrary();
  }

  function selectTheme(id) {
    state.active = id;
    renderLibrary();
    renderTopbar();
    renderEditor();
    renderSidebarPanel();
    renderSurfacePanel();
    paintPreview();
    renderAudit();
    invoke("studio.state.put", { state: { active: id } }).catch(function () {
      /* 只是记住上次编辑的对象，失败无所谓 */
    });
    setStatus("正在编辑「" + (activeTheme() ? activeTheme().label : id) + "」· 改动会自动注册");
  }

  function newTheme() {
    var n = 1;
    var existing = {};
    for (var i = 0; i < state.themes.length; i += 1) existing[state.themes[i].id] = true;
    while (existing["custom-" + n]) n += 1;
    var id = "custom-" + n;
    var theme = {
      id: id,
      label: "自定义 " + n,
      base: themeBase(activeTheme()),
      tokens: {},
      sidebarImage: { on: false, kind: "none" },
       regions: {},
    };
    state.themes.push(theme);
    state.active = id;
    selectTheme(id);
    pushTheme({ quiet: true });
    setStatus("已新建「" + theme.label + "」· 改完会自动注册，点「应用」切换过去");
  }

  function duplicateTheme(id) {
    var source = null;
    for (var i = 0; i < state.themes.length; i += 1) {
      if (state.themes[i].id === id) source = state.themes[i];
    }
    if (!source) return;
    var n = 2;
    var existing = {};
    for (var j = 0; j < state.themes.length; j += 1) existing[state.themes[j].id] = true;
    while (existing[id + "-" + n]) n += 1;
    var copy = JSON.parse(JSON.stringify(source));
    copy.id = id + "-" + n;
    copy.label = source.label + " 副本";
    delete copy.builtin;
    state.themes.push(copy);
    selectTheme(copy.id);
    pushTheme({ quiet: true });
    setStatus("已复制为「" + copy.label + "」");
  }

  function renameTheme() {
    var theme = activeTheme();
    if (!theme) return;
    var next = window.prompt("主题名称：", theme.label);
    if (next === null) return;
    var label = String(next).trim().slice(0, 64);
    if (!label) return;
    mutate(function (target) {
      target.label = label;
    });
    renderLibrary();
    pushTheme({ quiet: true });
    setStatus("已改名为「" + label + "」");
  }

  function deleteTheme(id) {
    if (state.themes.length <= 1) {
      setStatus("至少要保留一个主题", true);
      return;
    }
    var theme = null;
    for (var i = 0; i < state.themes.length; i += 1) {
      if (state.themes[i].id === id) theme = state.themes[i];
    }
    if (!theme) return;
    if (!window.confirm("删除「" + theme.label + "」？")) return;

    invoke("studio.theme.remove", { id: id })
      .then(function () {
        state.themes = state.themes.filter(function (entry) {
          return entry.id !== id;
        });
        if (state.active === id) state.active = state.themes.length ? state.themes[0].id : "";
        selectTheme(state.active);
        setStatus("已删除「" + theme.label + "」");
      })
      .catch(function (error) {
        setStatus("删除失败：" + detail(error), true);
      });
  }

  /* ==================================================================== *
   * 顶部条
   * ==================================================================== */

  function renderTopbar() {
    var theme = activeTheme();
    var base = themeBase(theme);

    el("targetLabel").textContent = theme ? theme.label : "—";
    el("targetBase").textContent = base;
    var changed = theme ? overriddenCount(theme) : 0;
    el("dirtyMark").textContent = changed ? "覆盖 " + changed + " 项" : "未覆盖";

    var strip = el("strip");
    var colors = pickPreviewColors();
    for (var i = 0; i < strip.children.length; i += 1) {
      strip.children[i].style.background = colors[i] || "transparent";
    }

    var applied = state.applied === (theme && theme.id);
    el("appliedChip").hidden = !applied;
    if (applied && theme) el("appliedLabel").textContent = theme.label;
    el("btnApply").disabled = applied;
  }

  /* ==================================================================== *
   * Token 编辑器
   * ==================================================================== */

  function renderEditor() {
    var host = el("groups");
    host.replaceChildren();
    var theme = activeTheme();
    if (!theme) return;

    var base = themeBase(theme);
    var tokens = theme.tokens || {};
    var filter = el("tokenSearch").value.trim().toLowerCase();

    for (var g = 0; g < core.TOKEN_GROUPS.length; g += 1) {
      var group = core.TOKEN_GROUPS[g];
      var visible = group.tokens.filter(function (token) {
        if (!filter) return true;
        return token.key.indexOf(filter) !== -1 || token.name.indexOf(filter) !== -1;
      });
      if (!visible.length) continue;

      var box = document.createElement("details");
      box.className = "group";
      box.open = Boolean(filter) || group.id === "surfaces" || group.id === "sidebar";

      var summary = document.createElement("summary");
      summary.textContent = group.label;
      var count = document.createElement("em");
      count.textContent = String(visible.length);
      summary.append(count);
      box.append(summary);

      var desc = document.createElement("p");
      desc.className = "group-desc";
      desc.textContent = group.desc;
      box.append(desc);

      for (var t = 0; t < visible.length; t += 1) {
        box.append(tokenRow(visible[t], tokens, base));
      }
      host.append(box);
    }
  }

  function tokenRow(token, tokens, base) {
    var overridden = tokens[token.key];
    var effective = "";

    if (token.type === "color" || token.type === "alpha") {
      effective = resolveVar(token.key);
      return colorControl(
        "--ds-" + token.key,
        overridden || "",
        effective,
        function (next) {
          setToken(token.key, next);
        },
        token.name,
      );
    }

    // size / shadow：值本身可读，直接用文本编辑。
    effective = (state.defaults[base] || {})[token.key] || "";
    return textControl(
      "--ds-" + token.key + "  ·  " + token.name,
      overridden || "",
      effective,
      function (next) {
        if (next && !core.isTokenValueAllowed(token.key, next)) {
          setStatus("--ds-" + token.key + " 的值不被允许：" + next, true);
          renderEditor();
          return;
        }
        setToken(token.key, next);
      },
      token.name,
    );
  }

  /* ==================================================================== *
   * 侧边栏背景
   * ==================================================================== */

   var SIDEBAR_KINDS = [
     { value: "none", label: "无（纯色）" },
     { value: "gradient", label: "渐变" },
     { value: "image", label: "图片（本地 PNG）" },
   ];

  function renderSidebarPanel() {
    var host = el("sidebarImage");
    host.replaceChildren();
    var theme = activeTheme();
    if (!theme) return;

    var design = designOf(theme);
    var image = design.sidebarImage || { on: false, kind: "none" };
    var kind = image.on === true ? image.kind : "none";

    host.append(
      selectControl("背景类型", kind, SIDEBAR_KINDS, function (value) {
        setSidebarImage(value === "none"
          ? { on: false, kind: "none" }
          : value === "gradient"
            ? { on: true, kind: "gradient", angle: 160, from: "#00000000", to: "#00000000" }
     : { on: true, kind: "image", image: "" });
      }),
    );

    if (kind === "gradient") {
      host.append(
        rangeControl("角度", Number(image.angle) || 160, 0, 360, function (value) {
          setSidebarImage(Object.assign({}, image, { angle: value }));
        }),
      );
      host.append(
        colorControl("起始色", image.from || "", "#00000000", function (value) {
          setSidebarImage(Object.assign({}, image, { from: value || "transparent" }));
        }),
      );
      host.append(
        colorControl("结束色", image.to || "", "#00000000", function (value) {
          setSidebarImage(Object.assign({}, image, { to: value || "transparent" }));
        }),
      );
    }

    if (kind === "image") {
      host.append(
        imagePicker(
          image.image,
          function (hash) {
            setSidebarImage(
              Object.assign({}, image, { on: true, kind: "image", image: hash }),
            );
          },
          function () {
            setSidebarImage({ on: false, kind: "none" });
          },
          renderSidebarPanel,
        ),
      );
    }

    host.append(previewThumb(design));
  }

  /** 只刷新图片相关的库数据（不动主题与当前选择）。 */
  function refreshImages() {
    return invoke("studio.library")
      .then(function (library) {
        state.images = Array.isArray(library.images) ? library.images : [];
        state.orphans = Array.isArray(library.orphans) ? library.orphans : [];
        renderSidebarPanel();
        renderSurfacePanel();
        renderImageManager();
        paintPreview();
      })
      .catch(function (error) {
        setStatus("刷新图片库失败：" + detail(error), true);
      });
  }

  /* ==================================================================== *
   * 图片：选择、展示、库管理
   * ==================================================================== */

  function regionById(id) {
    for (var i = 0; i < core.REGIONS.length; i += 1) {
      if (core.REGIONS[i].id === id) return core.REGIONS[i];
    }
    return null;
  }

  function humanSize(bytes) {
    var value = Number(bytes) || 0;
    if (value >= 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + "MB";
    return Math.max(1, Math.round(value / 1024)) + "KB";
  }

  function imageNames(id) {
    var list = state.images || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /**
   * 一张图的展示地址。
   *
   * 先看预读缓存（studio.image.read 给的 data: URL，面板一定加载得到），
   * 再退回宿主 scheme（面板的 egress 白名单允许 plugin-asset:）。
   */
  function imageUrlFor(id) {
    if (!id) return "";
    if (state.previewData[id]) return state.previewData[id];
    var entry = imageNames(id);
    if (!entry || !entry.path) return "";
    return (
      "plugin-asset://" + state.pluginId + "/" + encodeURIComponent(String(entry.path).replace(/\\/g, "/"))
    );
  }

  function imageThumb(id, extraClass) {
    var node = document.createElement("img");
    node.className = "image-thumb" + (extraClass ? " " + extraClass : "");
    node.alt = "";
    var url = imageUrlFor(id);
    if (url) node.src = url;
    else node.classList.add("is-loading");
    return node;
  }

  /** 这张图被哪些主题、哪些区域用着（面板自己算，插件不必回传）。 */
  function imageUsage(id) {
    var out = [];
    (state.themes || []).forEach(function (theme) {
      var where = [];
      var sidebar = theme.sidebarImage;
      if (sidebar && sidebar.on === true && sidebar.kind === "image" && sidebar.image === id) {
        where.push("左栏");
      }
      var regions = theme.regions || {};
      Object.keys(regions).forEach(function (regionId) {
        var image = regions[regionId] && regions[regionId].image;
        if (image && image.on === true && image.image === id) {
          var definition = regionById(regionId);
          where.push(definition ? definition.label : regionId);
        }
      });
      if (where.length) out.push({ theme: theme, where: where });
    });
    return out;
  }

  /** 已经尝试预读过的 id：读失败的只试一次，否则会反复触发重渲染。 */
  var previewTried = {};

  /** 把整库的缩略图预读好（没读过、也没试过的才读）。 */
  function prefetchLibraryImages() {
    var list = state.images || [];
    var pending = list.filter(function (entry) {
      return entry.id && !state.previewData[entry.id] && !previewTried[entry.id];
    });
    if (!pending.length) return Promise.resolve();
    pending.forEach(function (entry) {
      previewTried[entry.id] = true;
    });
    return Promise.all(
      pending.map(function (entry) {
        return invoke("studio.image.read", { id: entry.id })
          .then(function (result) {
            state.previewData[entry.id] = result.dataUrl;
          })
          .catch(function () {
            /* 读不到就不显示缩略图；previewTried 保证不再重试 */
          });
      }),
    ).then(function () {
      renderImageManager();
    });
  }

  /** 一个动作按钮（统一尺寸与语义）。 */
  function actionButton(text, onClick, options) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "act" + (options && options.danger ? " danger" : "") + (options && options.primary ? " primary" : "");
    button.textContent = text;
    if (options && options.title) button.title = options.title;
    button.addEventListener("click", onClick);
    return button;
  }

  /** 选一张本地 PNG 并上传（返回按钮；原生 input 藏在里面）。 */
  function imageUpload(label, onPicked, onDone) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png";
    input.className = "visually-hidden";
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      setStatus("正在上传「" + file.name + "」…");
      file
        .arrayBuffer()
        .then(function (buffer) {
          return invoke("studio.image.put", {
            name: file.name,
            bytes: new Uint8Array(buffer),
            // 一张图只服务一个主题：记下它属于谁，删它不必问别人。
            themeId: state.active,
          });
        })
        .then(function (result) {
          // 登记表先本地补上，预览不必等下一次读库。
          state.images = (state.images || []).concat([
            {
              id: result.id,
              path: result.path,
              bytes: result.bytes,
              name: result.name,
              addedAt: Date.now(),
              owner: result.owner || state.active,
            },
          ]);
          setStatus("已上传「" + result.name + "」（" + humanSize(result.bytes) + "）");
          if (onPicked) onPicked(result.id);
          prefetchPreviewImages();
          if (onDone) onDone();
        })
        .catch(function (error) {
          setStatus("上传失败：" + detail(error), true);
        });
    });
    var button = actionButton(label, function () {
      input.click();
    });
    var wrap = document.createElement("span");
    wrap.className = "uploader";
    wrap.append(button, input);
    return wrap;
  }

  /**
   * 区域 / 侧边栏的图片行。
   *
   * 有图：缩略图 + 文件名 + 大小 + 更换 / 不用。没有图：一个虚线「选择 PNG 图片」。
   * 「不用图片」只改这份设计（不删文件）；删文件在「图片」标签页里做。
   */
  function imagePicker(currentId, onPicked, onDetach, rerender) {
    var box = document.createElement("div");
    box.className = "image-picker";
    var entry = currentId ? imageNames(currentId) : null;
    if (currentId && entry) {
      box.append(imageThumb(currentId, "image-thumb-lg"));
      var meta = document.createElement("div");
      meta.className = "image-meta";
      var name = document.createElement("b");
      name.textContent = entry.name;
      name.title = entry.path || entry.name;
      var size = document.createElement("small");
      size.textContent = humanSize(entry.bytes) + " · 插件数据目录";
      meta.append(name, size);
      box.append(meta);
      var actions = document.createElement("div");
      actions.className = "image-actions";
      actions.append(imageUpload("更换", onPicked, rerender));
      if (onDetach) {
        actions.append(actionButton("不用", function () {
          onDetach();
          if (rerender) rerender();
        }, { title: "只把这份设计里的图片去掉，不删文件" }));
      }
      box.append(actions);
      return box;
    }
    if (currentId) {
      // 引用了但登记表里没有：旧数据或已被删掉的文件。
      var missing = document.createElement("p");
      missing.className = "note warn";
      missing.textContent = "这张图片已经不在登记表里（可能已删除），请重新选择一张。";
      box.append(missing);
    }
    var empty = document.createElement("div");
    empty.className = "image-empty";
    empty.append(imageUpload("＋ 选择 PNG 图片", onPicked, rerender));
    var hint = document.createElement("small");
    hint.textContent = "打开系统文件选择器 · 只收 PNG · 单张上限 4MB";
    empty.append(hint);
    box.append(empty);
    return box;
  }

  /** 一行图片：缩略图 / 名称 + 大小 / 用途 / 操作。 */
  function imageRow(entry, options) {
    var row = document.createElement("div");
    row.className = "image-row";
    row.append(imageThumb(entry.id, options && options.orphan ? "is-orphan" : ""));

    var meta = document.createElement("div");
    meta.className = "image-meta";
    var name = document.createElement("b");
    name.textContent = entry.name;
    name.title = entry.path || entry.name;
    meta.append(name);
    var sub = document.createElement("small");
    if (options && options.orphan) {
      sub.textContent = humanSize(entry.bytes) + " · 未登记（可直接清理）";
    } else {
      var usage = imageUsage(entry.id);
      var parts = usage.map(function (item) {
        return item.theme.label + " · " + item.where.join("、");
      });
      sub.textContent = humanSize(entry.bytes) + " · " + (parts.length ? parts.join("；") : "未使用");
      if (!parts.length) sub.className = "muted";
    }
    meta.append(sub);
    row.append(meta);

    if (options && options.actions) {
      var actions = document.createElement("div");
      actions.className = "image-actions";
      options.actions.forEach(function (button) {
        actions.append(button);
      });
      row.append(actions);
    }
    return row;
  }

  /**
   * 「图片」标签页：当前主题用到哪几张、图片库里都有什么、谁在用、孤儿文件。
   *
   * 把「这份设计用哪张图」和「这个文件要不要留」分开摆：上面是当前主题的引用，
   * 下面是库；删文件只出现在库这一层。
   */
  function renderImageManager() {
    var host = document.getElementById("imageManager");
    if (!host) return;
    host.replaceChildren();

    var theme = activeTheme();
    var list = state.images || [];
    var orphans = state.orphans || [];
    var total = list.reduce(function (sum, entry) {
      return sum + (Number(entry.bytes) || 0);
    }, 0);

    // ---- 当前主题用到的图 ----
    var used = document.createElement("div");
    used.className = "image-block";
    var usedTitle = document.createElement("div");
    usedTitle.className = "image-block-title";
    usedTitle.textContent = "当前主题" + (theme ? "（" + theme.label + "）" : "");
    used.append(usedTitle);
    var usedIds = theme
      ? (function () {
          var ids = [];
          var sidebar = theme.sidebarImage;
          if (sidebar && sidebar.on === true && sidebar.kind === "image" && sidebar.image) {
            ids.push(sidebar.image);
          }
          var regions = theme.regions || {};
          Object.keys(regions).forEach(function (regionId) {
            var image = regions[regionId] && regions[regionId].image;
            if (image && image.on === true && image.image) ids.push(image.image);
          });
          return ids.filter(function (id, index) {
            return ids.indexOf(id) === index;
          });
        })()
      : [];
    if (!usedIds.length) {
      var none = document.createElement("p");
      none.className = "note";
      none.textContent = "这套主题还没有用图片 —— 在「表面」页给某个区域选一张，或在上面「侧边栏」页设一张。";
      used.append(none);
    } else {
      usedIds.forEach(function (id) {
        var entry = imageNames(id);
        if (!entry) {
          var gone = document.createElement("p");
          gone.className = "note warn";
          gone.textContent = "引用了已不存在的图片（" + id + "），重新选一张即可。";
          used.append(gone);
          return;
        }
        used.append(imageRow(entry, { actions: [] }));
      });
    }
    host.append(used);

    // ---- 图片库 ----
    var library = document.createElement("div");
    library.className = "image-block";
    var libraryTitle = document.createElement("div");
    libraryTitle.className = "image-block-title";
    libraryTitle.textContent =
      "图片库 · " + list.length + " 张 · 合计 " + humanSize(total);
    library.append(libraryTitle);
    if (!list.length) {
      var emptyLib = document.createElement("p");
      emptyLib.className = "note";
      emptyLib.textContent = "还没有图片。上传的图会存在插件的数据目录里，不进插件包。";
      library.append(emptyLib);
    } else {
      list.forEach(function (entry) {
        library.append(
          imageRow(entry, {
            actions: [
              actionButton(
                "删除",
                function () {
                  if (!window.confirm("删除「" + entry.name + "」？用到它的主题会失去这张图。")) return;
                  invoke("studio.image.remove", { id: entry.id })
                    .then(function () {
                      delete state.previewData[entry.id];
                      setStatus("已删除「" + entry.name + "」，主题里的引用也已清掉");
                      return refreshImages();
                    })
                    .catch(function (error) {
                      setStatus("删除失败：" + detail(error), true);
                    });
                },
                { danger: true },
              ),
            ],
          }),
        );
      });
    }

    host.append(library);

    // ---- 孤儿文件 ----
    if (orphans.length) {
      var orphanBlock = document.createElement("div");
      orphanBlock.className = "image-block";
      var orphanTitle = document.createElement("div");
      orphanTitle.className = "image-block-title";
      orphanTitle.textContent = "未登记的文件 · " + orphans.length + " 个";
      orphanBlock.append(orphanTitle);
      orphans.forEach(function (entry) {
        orphanBlock.append(
          imageRow(entry, {
            orphan: true,
            actions: [
              actionButton(
                "清理",
                function () {
                  if (!window.confirm("这个文件没有登记记录（可能是插件重装前留下的），删掉它？")) return;
                  invoke("studio.image.drop", { path: entry.path })
                    .then(function () {
                      setStatus("已清理未登记文件 " + entry.name);
                      return refreshImages();
                    })
                    .catch(function (error) {
                      setStatus("清理失败：" + detail(error), true);
                    });
                },
                { danger: true },
              ),
            ],
          }),
        );
      });
      host.append(orphanBlock);
    }

    // ---- 底部动作 ----
    var footer = document.createElement("div");
    footer.className = "image-block image-footer";
    footer.append(
      actionButton(
        "清理未使用的图片",
        function () {
          invoke("studio.image.prune")
            .then(function (result) {
              setStatus(result.removed ? "已清理 " + result.removed + " 张未使用的图片" : "没有未使用的图片");
              return refreshImages();
            })
            .catch(function (error) {
              setStatus("清理失败：" + detail(error), true);
            });
        },
      ),
      actionButton(
        "刷新",
        function () {
          refreshImages();
        },
      ),
    );
    host.append(footer);

    // 缩略图要 data: 才一定显示得出来，所以顺手把没读过的读一遍。
    prefetchLibraryImages();
  }

  /**
   * 「让底图可见」：把盖在这个区域上面的那些区域底色设成透明。
   *
   * 宿主每一栏都有自己的不透明底色（.app-shell / .main-pane / .work-panel-composer…），
   * 底图就藏在它们后面。不改它们，图片永远不会露出来 —— 这不是 bug，是分层的事实。
   */
  function revealControl(definition) {
    var node = row("让底图可见", "把更深层区域的底色设为透明，下层图片才看得到");
    var button = document.createElement("button");
    button.type = "button";
    button.className = "mini";
    button.textContent = "一键透出";
    button.addEventListener("click", function () {
      var deeper = core.REGIONS.filter(function (region) {
        return region.depth > definition.depth;
      }).map(function (region) {
        return region.id;
      });
      commit(function (target) {
        target.regions = target.regions || {};
        deeper.forEach(function (id) {
          target.regions[id] = Object.assign({}, target.regions[id] || {}, {
            fill: "transparent",
          });
        });
        if (definition.id === "shell") {
          // 宿主的 .app-shell / .sidebar / .composer-shell 各有自己的不透明底色，
          // 值来自这三条 token：整窗要透出，就得连它们一起放开。
          target.tokens = target.tokens || {};
          target.tokens["bg-primary"] = "transparent";
          target.tokens["bg-sidebar"] = "transparent";
          target.tokens["bg-composer"] = "transparent";
        }
      });
      setStatus(
        "已把 " + deeper.length + " 个上层区域的底色设为透明 · " + deeper.join("、") +
          (definition.id === "shell" ? " · 并把 bg-primary / bg-sidebar / bg-composer 设为透明" : ""),
      );
    });
    node.append(button);
    return node;
  }

function previewThumb(design) {
    var wrap = document.createElement("div");
    wrap.className = "thumb-wrap";
    var label = document.createElement("span");
    label.className = "thumb-label";
    label.textContent = "侧边栏预览";
    var thumb = document.createElement("div");
    thumb.className = "thumb pv-root";
    thumb.setAttribute("data-theme", themeBase(activeTheme()));

    var css = core.serialize(themeBase(activeTheme()), design, {
      rootSelector: '.pv-root[data-theme="' + themeBase(activeTheme()) + '"]',
       resolveImage: resolvePreviewImage,
    });
    var style = document.createElement("style");
    style.textContent = css;
    wrap.append(label, style, thumb);

    var inner = document.createElement("div");
    inner.className = "sidebar";
    var header = document.createElement("div");
    header.className = "sidebar-header";
    var dot = document.createElement("span");
    var text = document.createElement("span");
    text.textContent = "PI-Desktop";
    header.append(dot, text);
    var body = document.createElement("div");
    body.className = "sidebar-body";
    for (var i = 0; i < 3; i += 1) {
      var line = document.createElement("div");
      line.className = "pv-row";
      line.textContent = i === 0 ? "项目会话" : "会话 " + (i + 1);
      body.append(line);
    }
    inner.append(header, body);
    thumb.append(inner);
    return wrap;
  }

  function setSidebarImage(next) {
    mutate(function (theme) {
      theme.sidebarImage = next;
    });
    renderSidebarPanel();
  }

  /* regionBlock 已删除：7 组平铺的旧表面面板被「点预览选区 → 一张卡片」取代。 */

/**
    * 背景区域面板。
    *
    * 层级就是真实 DOM 的层级：整窗在最底，三栏盖住它，栏内区域再盖住栏。
    * 谁设了底色或图片就盖住自己那一块；没设（或显式「透出下层」）就露出下面一层。
    */
  /** 旧入口保留：所有调用点都指向新的区域面板。 */
  function renderSurfacePanel() {
    renderRegionPanel();
  }

  function countSurface(surface) {
    var n = 0;
    if (surface.fill) n += 1;
    if (surface.gradient && surface.gradient.on) n += 1;
    if (surface.image && surface.image.on) n += 1;
    if (Number(surface.blur) > 0) n += 1;
    if (surface.radius) n += 1;
    return n;
  }

  /* ==================================================================== *
   * 对比度
   * ==================================================================== */

  function renderAudit() {
    var theme = activeTheme();
    if (!theme) return;
    var effective = {};
    for (var i = 0; i < core.TOKEN_KEYS.length; i += 1) {
      var key = core.TOKEN_KEYS[i];
      var token = core.TOKEN_BY_KEY[key];
      if (token.type !== "color" && token.type !== "alpha") continue;
      effective[key] = resolveVar(key);
    }

    var rows = core.audit(effective);
    var host = el("auditRows");
    host.replaceChildren();

    for (var r = 0; r < rows.length; r += 1) {
      var item = rows[r];
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + item.label + "</td>" +
        '<td><span class="pair"><i style="background:' + (item.fg || "transparent") + '"></i>' +
        '<i style="background:' + (item.bg || "transparent") + '"></i></span></td>' +
        '<td class="ratio">' + core.formatRatio(item.ratio) + "</td>" +
        '<td class="' + (item.bodyOk ? "pass" : item.ratio >= 3 ? "warnc" : "fail") + '">' +
        (item.bodyOk ? "通过" : item.ratio >= 3 ? "仅大字" : "不足") + "</td>" +
        '<td class="' + (item.largeOk ? "pass" : "fail") + '">' + (item.largeOk ? "通过" : "不足") + "</td>";
      host.append(tr);
    }

    var worst = core.worstRatio(rows);
    el("contrastVal").textContent = core.formatRatio(worst);
    el("contrastDot").className =
      "dot" + (worst >= 4.5 ? "" : worst >= 3 ? " warn" : " bad");
    el("contrastChip").title = "最差的正文色对：" + core.formatRatio(worst);
  }

  /* ==================================================================== *
   * 视图 / 缩放
   * ==================================================================== */

  function renderView() {
    var views = document.querySelectorAll(".pv-view");
    for (var i = 0; i < views.length; i += 1) {
      var name = views[i].getAttribute("data-view");
      views[i].hidden = state.view === "settings" ? name !== "settings" : name !== "chat";
    }
    var menu = document.querySelector(".pv-menu");
    if (menu) menu.hidden = state.view !== "menu";
  }

  function applyZoom() {
    var wrap = el("canvasWrap");
    var frame = el("previewFrame");
    var logicalWidth = 1280;
    var logicalHeight = 800;
    var fit = Math.min(1, (wrap.clientWidth - 26) / logicalWidth);
    var zoom = state.zoom === "fit" ? fit : Number(state.zoom);
    if (!isFinite(zoom) || zoom <= 0) zoom = 1;
    el("previewShell").style.setProperty("--preview-zoom", String(zoom));
    frame.style.width = logicalWidth * zoom + "px";
    frame.style.height = logicalHeight * zoom + "px";
  }

  /* ==================================================================== *
   * 布局：主题库折叠 / 悬浮球 / 悬浮面板
   * ==================================================================== */

  var lastPane = "region";

  /** 主题库折叠：收起时只剩左上角一颗悬浮按钮。 */
  function setLibraryOpen(open) {
    state.libraryOpen = open !== false;
    el("library").classList.toggle("collapsed", !state.libraryOpen);
    el("libraryOrb").hidden = state.libraryOpen;
    el("btnLibrary").title = state.libraryOpen ? "折叠主题库" : "展开主题库";
  }

  var ORBS = [
    { id: "region", icon: "▣", label: "区域（点预览选）" },
    { id: "token", icon: "◑", label: "Token" },
    { id: "images", icon: "▤", label: "图片" },
    { id: "audit", icon: "◇", label: "对比度检查" },
  ];

  var PANE_TITLES = { region: "区域", token: "Token", images: "图片", audit: "对比度检查" };

  function renderOrbs() {
    var host = el("orbs");
    if (!host) return;
    host.replaceChildren();
    ORBS.forEach(function (orb) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "orb" + (state.pane === orb.id ? " on" : "");
      button.title = orb.label;
      button.setAttribute("aria-label", orb.label);
      var icon = document.createElement("span");
      icon.className = "orb-icon";
      icon.textContent = orb.icon;
      button.append(icon);
      if (orb.id === "region") {
        var dot = document.createElement("i");
        dot.className = "orb-dot";
        button.append(dot);
      }
      button.addEventListener("click", function () {
        if (state.pane === orb.id) closePane();
        else openPane(orb.id);
      });
      host.append(button);
    });
  }

  /** 面板里显示的那一块内容（#panes 里各保留一份，打开时搬过去）。 */
  function paneElement(id) {
    return document.querySelector('#panes [data-pane="' + id + '"]');
  }

  function openPane(id) {
    if (!PANE_TITLES[id]) return;
    var body = el("panelBody");
    var pane = paneElement(id);
    if (!body || !pane) return;
    state.pane = id;
    lastPane = id;
    // 先把上一块搬回隐藏区，再放新的 —— replaceChildren 会直接丢掉旧内容。
    var stash = el("panes");
    if (stash) {
      while (body.firstChild) stash.append(body.firstChild);
    }
    body.replaceChildren(pane);
    el("panelTitle").textContent = PANE_TITLES[id];
    el("panel").classList.add("open");
    el("sideCol").classList.remove("side-collapsed");
    renderOrbs();
  }

  function closePane() {
    var body = el("panelBody");
    var panes = el("panes");
    // 把内容搬回隐藏区，面板下次打开时再搬出来（DOM 只有一份）。
    if (body && panes) {
      while (body.firstChild) panes.append(body.firstChild);
    }
    state.pane = null;
    el("panel").classList.remove("open");
    renderOrbs();
  }

  /* ==================================================================== *
   * 区域点选
   * ==================================================================== */

  /**
   * 给预览副本打上区域标记。
   *
   * 选择器来自 lib/theme-core.js 的 REGIONS（.sidebar-body / .main-pane / …），
   * 与真实外壳同源；整窗就是 .app-shell 自己。
   */
  function tagRegions() {
    var shell = el("previewShell");
    if (!shell) return;
    shell.setAttribute("data-region", "shell");
    shell.setAttribute("data-label", regionLabel("shell"));
    for (var i = 0; i < core.REGIONS.length; i += 1) {
      var region = core.REGIONS[i];
      if (!region.selector) continue;
      var nodes = shell.querySelectorAll(region.selector);
      for (var j = 0; j < nodes.length; j += 1) {
        nodes[j].setAttribute("data-region", region.id);
        nodes[j].setAttribute("data-label", region.label);
      }
    }
  }

  function regionById(id) {
    for (var i = 0; i < core.REGIONS.length; i += 1) {
      if (core.REGIONS[i].id === id) return core.REGIONS[i];
    }
    return null;
  }

  function regionLabel(id) {
    var region = regionById(id);
    return region ? region.label : id;
  }

  /** 事件目标落在哪个区域上（最内层优先）。 */
  function regionUnder(node) {
    var current = node;
    while (current && current !== document) {
      if (current.getAttribute && current.getAttribute("data-region")) {
        return current.getAttribute("data-region");
      }
      current = current.parentElement;
    }
    return null;
  }

  /** 上一层：栏内（标题栏/会话区/输入栏）→ 中栏；栏 → 整窗。 */
  function regionParent(id) {
    var region = regionById(id);
    if (!region || region.depth === 0) return null;
    if (region.depth >= 2) return "main";
    return "shell";
  }

  function regionTrail(id) {
    var trail = [];
    var cursor = id;
    while (cursor) {
      trail.unshift(cursor);
      cursor = regionParent(cursor);
    }
    return trail;
  }

  function paintRegionPicks() {
    var shell = el("previewShell");
    if (!shell) return;
    var nodes = shell.querySelectorAll("[data-region]");
    for (var i = 0; i < nodes.length; i += 1) {
      var id = nodes[i].getAttribute("data-region");
      nodes[i].classList.toggle("picked", id === state.region);
    }
    shell.classList.toggle("picked", state.region === "shell");
  }

  function pickRegion(id) {
    state.region = id;
    paintRegionPicks();
    if (state.pane === "region") renderRegionPanel();
  }

  /* ==================================================================== *
   * 区域面板：面包屑 + 五项 + 一键透出
   * ==================================================================== */

  function renderRegionPanel() {
    var host = el("regions");
    if (!host) return;
    host.replaceChildren();
    var theme = activeTheme();
    if (!theme) return;
    var definition = regionById(state.region) || regionById("shell");
    var regions = (theme.regions = theme.regions || {});
    var region = regions[definition.id] || (regions[definition.id] = {});

    // 面包屑：整窗 › 中栏 › 输入栏
    var crumb = document.createElement("div");
    crumb.className = "crumb";
    regionTrail(definition.id).forEach(function (id, index) {
      if (index) {
        var sep = document.createElement("span");
        sep.className = "crumb-sep";
        sep.textContent = "›";
        crumb.append(sep);
      }
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = regionLabel(id);
      if (id === definition.id) button.className = "cur";
      button.addEventListener("click", function () {
        pickRegion(id);
      });
      crumb.append(button);
    });
    var jump = document.createElement("span");
    jump.className = "crumb-spacer";
    crumb.append(jump);
    var shellBtn = document.createElement("button");
    shellBtn.type = "button";
    shellBtn.className = "crumb-jump";
    shellBtn.textContent = "⌂ 整窗（底层）";
    shellBtn.title = "最底层：点预览外面的空白、Alt+点任意区域，或这里";
    shellBtn.addEventListener("click", function () {
      pickRegion("shell");
    });
    crumb.append(shellBtn);
    var up = regionParent(definition.id);
    if (up) {
      var upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "crumb-jump";
      upBtn.textContent = "↑ " + regionLabel(up);
      upBtn.title = "等价于按 Esc";
      upBtn.addEventListener("click", function () {
        pickRegion(up);
      });
      crumb.append(upBtn);
    }
    host.append(crumb);

    // 底色 / 渐变 / 图片 / 模糊 / 圆角
    host.append(surfaceCard(definition, region));

    // 左栏的图片走专用 token，把那一块放在同一张卡片下面
    if (definition.id === "sidebar") {
      var tokenHost = el("sidebarImage");
      if (tokenHost) host.append(tokenHost);
      renderSidebarPanel();
    }
  }

  /** 一张区域卡片：五项控件 + 一键透出。 */
  function surfaceCard(definition, region) {
    var card = document.createElement("div");
    card.className = "card";
    var title = document.createElement("h4");
    title.textContent = "背景 · " + definition.label;
    card.append(title);

    if (definition.fillOnly === true) {
      var why = document.createElement("p");
      why.className = "note";
      why.textContent =
        "右栏只提供底色：内嵌的插件视图 / 浏览器是原生 WebContentsView，永远画在渲染进程之上，图片盖不住它。";
      card.append(why);
    }

    // 底色
    var fill = document.createElement("input");
    fill.type = "color";
    fill.value = (core.isColorValue(region.fill) && region.fill.charAt(0) === "#"
      ? region.fill.slice(0, 7)
      : "#101214");
    fill.addEventListener("input", function () {
      commit(function (target) {
        target.fill = fill.value + "cc";
      });
    });
    card.append(controlRow("底色", fill, "带 alpha 的值会让下层透出来"));

    // 渐变
    var gradient = region.gradient && region.gradient.on === true
      ? region.gradient
      : { on: false, angle: 160, from: "#00000000", to: "#00000000" };
    var gradientToggle = document.createElement("input");
    gradientToggle.type = "checkbox";
    gradientToggle.checked = gradient.on === true;
    gradientToggle.addEventListener("change", function () {
      commit(function (target) {
        target.gradient = Object.assign({}, gradient, { on: gradientToggle.checked });
      });
    });
    card.append(controlRow("渐变", gradientToggle));
    if (gradient.on === true) {
      card.append(rangeRow("角度", Number(gradient.angle) || 160, 0, 360, function (value) {
        commit(function (target) {
          target.gradient = Object.assign({}, gradient, { angle: value });
        });
      }));
      card.append(colorRow("起始色", gradient.from, function (value) {
        commit(function (target) {
          target.gradient = Object.assign({}, gradient, { from: value || "transparent" });
        });
      }));
      card.append(colorRow("结束色", gradient.to, function (value) {
        commit(function (target) {
          target.gradient = Object.assign({}, gradient, { to: value || "transparent" });
        });
      }));
    }

    // 图片（拖拽上传区；右栏不给图）
    if (definition.fillOnly !== true) {
      var imageTitle = document.createElement("h5");
      imageTitle.className = "card-sub";
      imageTitle.textContent = "背景图片";
      card.append(imageTitle);
      card.append(imageDropzone(definition.id));
    }

    // 模糊 / 圆角
    card.append(rangeRow("背景模糊", Number(region.blur) > 0 ? Number(region.blur) : 0, 0, core.MAX_BLUR, function (value) {
      commit(function (target) {
        if (value > 0) target.blur = value;
        else delete target.blur;
      });
    }, "backdrop-filter: blur(Npx)；只在元素背后有内容时可见"));
    card.append(textRow("圆角", region.radius || "", "如 14px", function (value) {
      commit(function (target) {
        if (value) target.radius = value;
        else delete target.radius;
      });
    }));

    // 一键透出
    var reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "act";
    reveal.textContent = "一键透出";
    reveal.title = "把盖在这个区域上面的那些区域底色设为透明，下层图片才看得到";
    reveal.addEventListener("click", function () {
      var deeper = core.REGIONS.filter(function (item) {
        return item.depth > definition.depth;
      }).map(function (item) {
        return item.id;
      });
      commit(function (target) {
        target.regions = target.regions || {};
        deeper.forEach(function (id) {
          target.regions[id] = Object.assign({}, target.regions[id] || {}, {
            fill: "transparent",
          });
        });
        if (definition.id === "shell") {
          // 宿主的 .app-shell / .sidebar / .composer-shell 各有自己的不透明底色，
          // 值来自这三条 token：整窗要透出，连它们一起放开。
          target.tokens = target.tokens || {};
          target.tokens["bg-primary"] = "transparent";
          target.tokens["bg-sidebar"] = "transparent";
          target.tokens["bg-composer"] = "transparent";
        }
      });
      setStatus(
        "已把 " + deeper.length + " 个上层区域的底色设为透明 · " + deeper.join("、"),
      );
    });
    var actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(reveal);
    card.append(actions);
    return card;
  }

  function controlRow(labelText, node, hint) {
    // 注意别写成 `var row = row(...)`：局部变量会遮住同名的 row() 函数。
    var wrap = row(labelText, hint);
    wrap.append(node);
    return wrap;
  }

  function rangeRow(labelText, value, min, max, onInput, hint) {
    var input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    var out = document.createElement("b");
    out.textContent = String(value);
    input.addEventListener("input", function () {
      out.textContent = input.value;
      onInput(Number(input.value));
    });
    var wrap = row(labelText, hint);
    wrap.append(input, out);
    return wrap;
  }

  function colorRow(labelText, value, onChange) {
    var input = document.createElement("input");
    input.type = "color";
    input.value = core.isColorValue(value) && String(value).charAt(0) === "#" ? String(value).slice(0, 7) : "#000000";
    input.addEventListener("input", function () {
      onChange(input.value);
    });
    var wrap = row(labelText, "");
    wrap.append(input);
    return wrap;
  }

  function textRow(labelText, value, placeholder, onCommit) {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "wide";
    input.value = value || "";
    input.placeholder = placeholder || "";
    input.spellcheck = false;
    input.addEventListener("change", function () {
      onCommit(input.value.trim());
    });
    var wrap = row(labelText, "");
    wrap.append(input);
    return wrap;
  }

  /* ==================================================================== *
   * 图片：拖拽上传区（不做勾选，也不预置任何图）
   * ==================================================================== */

  /**
   * 拖拽上传区。
   *
   * 没有图时是一整块虚线区域：拖进来或用系统选择器选一张 PNG。有图时是
   * 缩略图 + 文件名 + 大小 + 更换/不用。
   */
  function imageDropzone(regionId) {
    var theme = activeTheme();
    var region = theme && theme.regions ? theme.regions[regionId] : null;
    var image = region && region.image ? region.image : null;
    var currentId = image && image.on === true && image.image ? String(image.image) : "";

    var zone = document.createElement("div");
    zone.className = "dropzone" + (currentId ? " filled" : "");

    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png";
    input.className = "visually-hidden";
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      input.value = "";
      if (file) useImageFile(regionId, file);
    });

    if (currentId) {
      var thumb = document.createElement("img");
      thumb.className = "image-thumb image-thumb-lg";
      var url = imageUrlFor(currentId);
      if (url) thumb.src = url;
      zone.append(thumb);
      var meta = document.createElement("div");
      meta.className = "image-meta";
      var name = document.createElement("b");
      var entry = imageNames(currentId);
      name.textContent = entry ? entry.name : currentId;
      meta.append(name);
      var sub = document.createElement("small");
      sub.textContent = entry
        ? humanSize(entry.bytes) + " · 存在插件数据目录"
        : "已在设计中引用";
      meta.append(sub);
      zone.append(meta);
      var actions = document.createElement("div");
      actions.className = "image-actions";
      var replace = document.createElement("button");
      replace.type = "button";
      replace.className = "act";
      replace.textContent = "更换";
      replace.addEventListener("click", function (event) {
        event.stopPropagation();
        input.click();
      });
      var off = document.createElement("button");
      off.type = "button";
      off.className = "act";
      off.textContent = "不用";
      off.addEventListener("click", function (event) {
        event.stopPropagation();
        commit(function (target) {
          target.image = Object.assign({}, image, { on: false, image: "" });
        });
      });
      actions.append(replace, off);
      zone.append(actions);
    } else {
      var icon = document.createElement("span");
      icon.className = "dz-icon";
      icon.textContent = "⤓";
      var text = document.createElement("span");
      text.className = "dz-text";
      var main = document.createElement("b");
      main.className = "dz-main";
      main.textContent = "把 PNG 拖到这里";
      var sub2 = document.createElement("small");
      sub2.className = "dz-sub";
      sub2.textContent = "或者点击选择文件 · 只收 PNG · 单张上限 4MB";
      text.append(main, sub2);
      zone.append(icon, text);
    }

    zone.append(input);
    zone.addEventListener("click", function () {
      input.click();
    });
    ["dragenter", "dragover"].forEach(function (type) {
      zone.addEventListener(type, function (event) {
        event.preventDefault();
        zone.classList.add("over");
      });
    });
    ["dragleave", "dragend"].forEach(function (type) {
      zone.addEventListener(type, function () {
        zone.classList.remove("over");
      });
    });
    zone.addEventListener("drop", function (event) {
      event.preventDefault();
      zone.classList.remove("over");
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) useImageFile(regionId, file);
    });
    return zone;
  }

  /** 收下一个文件：只收 PNG，然后走插件的上传通道（写进插件数据目录）。 */
  function useImageFile(regionId, file) {
    var looksPng = file.type === "image/png" || /\.png$/i.test(file.name);
    if (!looksPng) {
      setStatus("只收 PNG，请先转成 .png 再拖进来（" + file.name + "）", true);
      return;
    }
    setStatus("正在上传「" + file.name + "」…");
    file
      .arrayBuffer()
      .then(function (buffer) {
        return invoke("studio.image.put", {
          name: file.name,
          bytes: new Uint8Array(buffer),
          themeId: state.active,
        });
      })
      .then(function (result) {
        state.images = (state.images || []).concat([
          {
            id: result.id,
            path: result.path,
            bytes: result.bytes,
            name: result.name,
            addedAt: Date.now(),
            owner: result.owner || state.active,
          },
        ]);
        commit(function (target) {
          target.image = {
            on: true,
            image: result.id,
            size: "cover",
            repeat: "no-repeat",
            position: "center",
          };
        });
        setStatus("已上传「" + result.name + "」（" + humanSize(result.bytes) + "）");
        prefetchPreviewImages();
        if (state.pane === "images") renderImageManager();
      })
      .catch(function (error) {
        setStatus("上传失败：" + detail(error), true);
      });
  }

  /* ==================================================================== *
   * 缩放：只改观看倍率，预览的逻辑尺寸恒为 1280×800
   * ==================================================================== */

  function currentZoom() {
    if (state.zoom === "fit") {
      var wrap = el("canvasWrap");
      return Math.min(1, (wrap.clientWidth - 26) / 1280);
    }
    var value = Number(state.zoom);
    return isFinite(value) && value > 0 ? value : 1;
  }

  function renderZoomSeg() {
    var seg = el("zoomSeg");
    if (!seg) return;
    var buttons = seg.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i += 1) {
      var value = buttons[i].getAttribute("data-zoom");
      buttons[i].classList.toggle("on", String(state.zoom) === value);
    }
  }
  /* ==================================================================== *
   * 启动
   * ==================================================================== */

  function boot() {
    state.active = "";
    // 首帧：宿主默认调色板已经有了，先铺一个空设计，界面不会是空的。
    paintPreview();

    invoke("studio.library")
      .then(function (library) {
        state.themes = Array.isArray(library.themes) ? library.themes : [];
        state.active = library.active || (state.themes[0] ? state.themes[0].id : "");
        state.applied = library.applied || "";
        state.pluginId = library.pluginId || "pi.theme.studio";
         state.images = Array.isArray(library.images) ? library.images : [];
         state.orphans = Array.isArray(library.orphans) ? library.orphans : [];
         state.defaults = library.defaults || { dark: {}, light: {} };
         state.runtimeApi = library.runtimeApi || { available: null, reason: "" };

        if (!activeTheme() && state.themes.length) state.active = state.themes[0].id;

        renderLibrary();
        renderTopbar();
        renderEditor();
        // 新布局：区域标记 → 悬浮球 → 默认打开「区域」面板
        tagRegions();
        paintRegionPicks();
        renderOrbs();
        setLibraryOpen(true);
        openPane("region");
        renderRegionPanel();
        renderImageManager();
        paintPreview();
        renderAudit();

         applyCapabilityGate();

         if (state.runtimeApi.available === false) {
           applyCapabilityGate();
           return;
         }
         if (state.applied) {
           setStatus(
             "已就绪 · " + state.themes.length + " 个主题 · 当前应用：" + state.applied,
           );
         } else {
           setStatus("已就绪 · " + state.themes.length + " 个主题 · 改动会自动注册给宿主");
         }
      })
      .catch(function (error) {
         applyCapabilityGate();
         setStatus("读取主题库失败：" + detail(error), true);
      });
  }

  function bind() {
    el("btnSave").addEventListener("click", function () {
      pushTheme({ quiet: false }).then(function () {
        applyCurrent();
      });
    });
    el("btnApply").addEventListener("click", applyCurrent);
    el("btnCopy").addEventListener("click", function () {
      var theme = activeTheme();
      if (!theme) return;
      var css = previewCss(theme);
      invoke("clipboard.writeText", { text: css })
        .then(function () {
          setStatus("已复制「" + theme.label + "」的 CSS（" + css.length + " 字符）到剪贴板");
        })
        .catch(function (error) {
          setStatus("复制失败：" + detail(error), true);
        });
    });

    el("libSearch").addEventListener("input", function () {
      state.filter = el("libSearch").value;
      renderLibrary();
    });

    // 主题库折叠：折叠后只剩左上角那颗悬浮按钮
    el("btnLibrary").addEventListener("click", function () {
      setLibraryOpen(!state.libraryOpen);
    });
    el("libraryOrb").addEventListener("click", function () {
      setLibraryOpen(true);
    });
    el("btnSide").addEventListener("click", function () {
      if (state.pane) closePane();
      else openPane(lastPane || "region");
    });
    el("panelClose").addEventListener("click", closePane);

    // 点预览里的区域：选中它并打开「区域」面板
    el("previewShell").addEventListener("click", function (event) {
      var id = event.altKey ? "shell" : regionUnder(event.target);
      if (!id) return;
      event.stopPropagation();
      pickRegion(id);
      openPane("region");
    });
    // 点预览外面的画布 = 选整窗
    el("canvasWrap").addEventListener("click", function (event) {
      if (event.target.closest("#previewShell")) return;
      pickRegion("shell");
      openPane("region");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (state.pane) {
        closePane();
        return;
      }
      var up = regionParent(state.region);
      if (up) pickRegion(up);
    });

    // Ctrl/⌘ + 滚轮缩放（只改观看倍率，预览逻辑尺寸不变）
    el("canvasWrap").addEventListener("wheel", function (event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      var steps = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];
      var current = currentZoom();
      var next =
        event.deltaY < 0
          ? steps.filter(function (v) { return v > current + 0.001; })[0]
          : steps.filter(function (v) { return v < current - 0.001; }).pop();
      if (next === undefined) return;
      state.zoom = next;
      renderZoomSeg();
      applyZoom();
    });
    el("tokenSearch").addEventListener("input", renderEditor);
    el("btnNewTheme").addEventListener("click", newTheme);
    el("btnDuplicate").addEventListener("click", function () {
      if (state.active) duplicateTheme(state.active);
    });


    var views = document.querySelectorAll("#viewSeg button");
    for (var v = 0; v < views.length; v += 1) {
      views[v].addEventListener("click", function (event) {
        var button = event.currentTarget;
        state.view = button.getAttribute("data-view");
        for (var j = 0; j < views.length; j += 1) {
          views[j].classList.toggle("on", views[j] === button);
        }
        renderView();
      });
    }

    var zooms = document.querySelectorAll("#zoomSeg button");
    for (var z = 0; z < zooms.length; z += 1) {
      zooms[z].addEventListener("click", function (event) {
        var button = event.currentTarget;
        state.zoom = button.getAttribute("data-zoom");
        for (var j = 0; j < zooms.length; j += 1) {
          zooms[j].classList.toggle("on", zooms[j] === button);
        }
        applyZoom();
      });
    }

    // 主题库与右侧面板的开合由上面那组处理器负责（这里不再重复绑定）。

    window.addEventListener("resize", applyZoom);
    window.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        pushTheme({ quiet: false });
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "r") {
        event.preventDefault();
        renameTheme();
      }
    });
  }

  bind();
  renderView();
  applyZoom();
  if (appearance) {
    appearance.init(bridge);
    appearance.onChange(function () {
      // 工坊自身的界面跟随应用基调；预览由主题自己决定，不受影响。
      applyZoom();
    });
  }
  boot();
})();
