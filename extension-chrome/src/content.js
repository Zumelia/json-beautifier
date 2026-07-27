/*
 * JSON Beautifier content script — detector + viewer.
 *
 * Design constraints, straight from the niche pain map (why incumbents die):
 *  - Reliability on MV3 first. EARLY-EXIT fast and cheap on any non-JSON page.
 *  - Zero network. No fetch/XHR/telemetry — everything is local.
 *  - Big files must not hang the tab. Children render lazily AND windowed AND
 *    the initial auto-expand is bounded by a node budget (no 100^depth blow-up).
 *  - Never a silent failure. Looks-like-JSON-but-doesn't-parse → we say so.
 *  - Search walks the DATA MODEL (not the rendered DOM), so matches in a 5000-
 *    element array beyond the first render window are still found.
 */
(() => {
  "use strict";

  // ---- 0. Re-entry guard -------------------------------------------------
  // The service worker injects this file into tabs that were already open at
  // install time (course 2.6). That tab may also get the declarative content
  // script on its next navigation — running twice would build the viewer twice.
  if (window.__jsonBeautifierLoaded) return;
  window.__jsonBeautifierLoaded = true;

  // DOM-guard для второго случая: после disable→enable расширения Chrome
  // создаёт СВЕЖИЙ isolated world (флаг выше пуст), но вьювер из прошлой
  // жизни всё ещё в DOM. Перестраивать его не из чего (исходный текст
  // заменён деревом) — молча выходим, не превращая страницу в ошибку.
  if (document.getElementById("jsoneat-root")) return;

  // ---- 1. Cheap gate: is this document raw JSON? -------------------------
  const ct = (document.contentType || "").toLowerCase();
  const looksJsonType =
    ct.includes("application/json") ||
    ct.includes("+json") ||
    ct.includes("application/manifest+json");

  const body = document.body;
  if (!body) return;

  // Untyped documents served as text/html are real web pages — never hijack
  // them even if their body happens to be a single <pre> of JSON-looking text.
  const isHtmlDoc = ct.includes("text/html");

  // Modern Chrome (2025+) renders raw JSON as <pre> PLUS its own viewer
  // widget: <div class="json-formatter-container"> holding a closed shadow
  // root with the "pretty print" checkbox. Old Chrome had the <pre> alone.
  // Treat "one <pre> + nothing but native-viewer containers" as a raw JSON
  // page; anything else in <body> means a real web page — never hijack it.
  const kidArr = Array.from(body.children);
  const pres = kidArr.filter((e) => e.tagName === "PRE");
  const onlyViewerExtras = kidArr.every(
    (e) =>
      e.tagName === "PRE" ||
      (e.tagName === "DIV" && e.classList.contains("json-formatter-container"))
  );
  const kids = body.children;
  const singlePre = pres.length === 1 && onlyViewerExtras ? pres[0] : null;

  let raw = null;
  if (singlePre) {
    raw = singlePre.textContent;
  } else if (looksJsonType && kids.length === 0) {
    raw = body.textContent;
  } else if (looksJsonType && singlePre === null && kids.length <= 1) {
    raw = body.textContent;
  }

  if (raw == null) return;
  const trimmed = raw.trim();
  if (!trimmed) return;

  const first = trimmed[0];
  const structural = first === "{" || first === "[";
  const primitiveJson = /^["\-\d]|^(true|false|null)\b/.test(trimmed);
  if (!looksJsonType) {
    // Untyped text: require a structural start AND that it isn't an HTML doc.
    if (!structural) return;
    if (isHtmlDoc) return;
  }
  if (!structural && !primitiveJson) return;

  // Size guard. Above the cap we don't auto-parse. But never hijack oversize
  // *untyped* text on first-char alone — only offer formatting when the server
  // actually claimed JSON.
  const HARD_CAP = 25 * 1024 * 1024; // 25 MB
  if (!looksJsonType && trimmed.length > HARD_CAP) return;
  const oversize = trimmed.length > HARD_CAP;

  let data,
    parseError = null;
  if (!oversize) {
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      parseError = e;
      if (!looksJsonType) return; // untyped + unparseable → leave page alone
    }
  }

  // ---- 2. Settings -------------------------------------------------------
  const DEFAULTS = { theme: "auto", indent: 2, expandDepth: 2, sortKeys: false };
  let settings = { ...DEFAULTS };

  let rendered = false;
  let rawEl = null;
  let initialPass = false; // true only during the first buildTreeView
  let autoNodesLeft = 0; // budget for initial auto-expansion
  const AUTO_BUDGET = 1500;

  const applyAfterSettings = () => queueMicrotask(render);

  // Шаг отступа дерева. Раньше был захардкожен (14px) — настройка Indent
  // не имела видимого эффекта (найдено Кириллом в v0.2.2). 8px ≈ ширина
  // символа моноширинного 13px: indent=2 → 16px/уровень, 4 → 32px, 1 → 8px.
  const indentStep = () => (settings.indent || 2) * 8;

  try {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(DEFAULTS, (got) => {
        if (!chrome.runtime.lastError && got) settings = { ...DEFAULTS, ...got };
        applyAfterSettings();
      });
    } else {
      applyAfterSettings();
    }
  } catch {
    applyAfterSettings();
  }

  // ---- 3. Rendering ------------------------------------------------------
  function render() {
    if (rendered) return;
    rendered = true;

    document.documentElement.setAttribute("data-jsoneat", themeAttr());

    const root = document.createElement("div");
    root.id = "jsoneat-root";
    root.appendChild(buildToolbar(trimmed, () => data));

    if (oversize) {
      root.appendChild(
        buildNotice(
          "Large document (" +
            fmtBytes(trimmed.length) +
            "). Showing raw text — click “Format” to build the tree.",
          () => {
            try {
              data = JSON.parse(trimmed);
              rebuildTree(root, data);
            } catch (e) {
              root.querySelectorAll(".jsoneat-notice, .jsoneat-raw").forEach((n) => n.remove());
              showParseError(root, e, trimmed);
            }
          }
        )
      );
      root.appendChild(buildRaw(trimmed));
    } else if (parseError) {
      showParseError(root, parseError, trimmed);
    } else {
      root.appendChild(buildTree(data));
    }

    body.textContent = "";
    body.appendChild(root);
    if (singlePre) singlePre.remove();
  }

  function buildTree(obj) {
    initialPass = true;
    autoNodesLeft = AUTO_BUDGET;
    const tree = document.createElement("div");
    tree.id = "jsoneat-tree";
    tree.className = "jsoneat-treeview";
    tree.appendChild(buildNode("$", obj, 0, true, false));
    initialPass = false;
    return tree;
  }

  function rebuildTree(root, obj) {
    root.querySelectorAll(".jsoneat-notice, .jsoneat-raw, #jsoneat-tree").forEach((n) => n.remove());
    root.appendChild(buildTree(obj));
  }

  // ---- Toolbar -----------------------------------------------------------
  function buildToolbar(rawText, getData) {
    const bar = document.createElement("div");
    bar.className = "jsoneat-toolbar";

    bar.appendChild(el("span", "jsoneat-brand", "JSON Beautifier"));

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search keys & values…";
    search.className = "jsoneat-search";
    search.setAttribute("aria-label", "Search JSON");
    let t;
    search.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => runSearch(search.value), 160);
    });
    bar.appendChild(search);

    // Один toggle вместо пары кнопок: подпись — действие по клику.
    let allCollapsed = false;
    const expToggle = btn("Collapse all", () => {
      allCollapsed = !allCollapsed;
      setAllCollapsed(allCollapsed);
      expToggle.textContent = allCollapsed ? "Expand all" : "Collapse all";
    });
    expToggle.classList.add("jsoneat-exptoggle");
    bar.appendChild(expToggle);
    const copyBtn = btn("Copy JSON", () => {
      // No sort → copy the exact source bytes (perfect fidelity, incl. big ints).
      // Sort → must re-stringify (documented: precision of >2^53 ints not kept).
      const text = settings.sortKeys
        ? prettyPrint(getData(), settings.indent, true) ?? rawText
        : rawText;
      copyText(text).then((ok) => ok && flash(copyBtn));
    });
    bar.appendChild(copyBtn);

    // Toggle Raw ⇄ Format: подпись — ДЕЙСТВИЕ, которое произойдёт по клику
    // (как у остальных кнопок), а не описание текущего состояния.
    const rawToggle = btn("Raw", () => toggleRaw(rawText, rawToggle));
    rawToggle.classList.add("jsoneat-rawtoggle");
    rawToggle.setAttribute("aria-pressed", "false");
    bar.appendChild(rawToggle);

    // Тема — справа (вернули по фидбеку v0.2.4).
    const themeBtn = btn(themeIcon(), () => cycleTheme(themeBtn));
    themeBtn.classList.add("jsoneat-theme");
    themeBtn.title = "Theme";
    bar.appendChild(themeBtn);

    // Шестерёнка — самая правая, открывает попап настроек
    // (chrome.action.openPopup через SW, Chrome 127+). Текстовый глиф «⚙»
    // был нечитаемо мелким (фидбек Кирилла) — теперь контурный SVG 18px.
    // Иконка: Tabler Icons "settings" (MIT, tabler.io/icons).
    const gear = btn("", () => {
      try {
        chrome?.runtime?.sendMessage?.({ type: "open-settings" }, () => {
          void chrome.runtime.lastError;
        });
      } catch (_) {}
    });
    gear.classList.add("jsoneat-settings");
    gear.title = "Settings";
    gear.setAttribute("aria-label", "Settings");
    gear.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/>' +
      '<path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/></svg>';
    bar.appendChild(gear);
    return bar;
  }

  // ---- Tree node (lazy + windowed + budgeted auto-expand) ----------------
  // key      = raw property name (string) or array index (number) — for DISPLAY
  // pathSeg  = JSONPath segment for copy-path, computed separately
  function buildNode(key, value, depth, isRoot, isArrayItem) {
    if (initialPass) autoNodesLeft--;

    const type = valueType(value);
    const isContainer = type === "object" || type === "array";
    const row = document.createElement("div");
    row.className = "jsoneat-node jsoneat-t-" + type;

    const line = el("div", "jsoneat-line");
    line.style.paddingLeft = depth * indentStep() + 8 + "px";
    line.appendChild(el("span", "jsoneat-twisty" + (isContainer ? "" : " jsoneat-leaf"), isContainer ? "▸" : ""));

    if (!isRoot) {
      // Display the RAW key exactly (fixes "content-type" showing as ["content-type"]).
      const k = el("span", "jsoneat-key", String(key));
      k.title = "Click to copy path";
      k.addEventListener("click", (e) => {
        e.stopPropagation();
        copyText(row.dataset.fullpath || String(key)).then((ok) => ok && flash(k));
      });
      line.appendChild(k);
      line.appendChild(el("span", "jsoneat-colon", ": "));
    }

    if (isContainer) {
      const n = count(value);
      const openCh = type === "array" ? "[" : "{";
      const closeCh = type === "array" ? "]" : "}";
      line.appendChild(el("span", "jsoneat-bracket", openCh));
      line.appendChild(el("span", "jsoneat-summary", n === 0 ? "" : " " + n + (type === "array" ? " items " : " keys ")));
      line.appendChild(el("span", "jsoneat-bracket jsoneat-closepreview", closeCh));
    } else {
      const v = el("span", "jsoneat-value jsoneat-v-" + type, renderScalar(value, type));
      v.title = "Click to copy value";
      v.addEventListener("click", (e) => {
        e.stopPropagation();
        copyText(type === "string" ? value : String(value)).then((ok) => ok && flash(v));
      });
      line.appendChild(v);
    }
    row.appendChild(line);

    if (isContainer) {
      const childrenWrap = el("div", "jsoneat-children");
      childrenWrap.style.display = "none";
      row.appendChild(childrenWrap);

      const CHUNK = 100;
      let built = false;
      let entries = null;
      let renderedCount = 0;
      const ensureEntries = () => {
        if (entries) return;
        entries =
          type === "array"
            ? value.map((v, i) => [i, v])
            : (settings.sortKeys ? Object.keys(value).sort() : Object.keys(value)).map((k) => [k, value[k]]);
      };
      const renderChunk = () => {
        ensureEntries();
        const prevMore = childrenWrap.querySelector(":scope > .jsoneat-more");
        if (prevMore) prevMore.remove();
        const frag = document.createDocumentFragment();
        const end = Math.min(renderedCount + CHUNK, entries.length);
        for (let i = renderedCount; i < end; i++) {
          const ck = entries[i][0];
          const cv = entries[i][1];
          const seg = type === "array" ? "[" + ck + "]" : safeChildKey(ck);
          const childNode = buildNode(ck, cv, depth + 1, false, type === "array");
          childNode.dataset.fullpath = (row.dataset.fullpath || "$") + seg;
          frag.appendChild(childNode);
        }
        renderedCount = end;
        childrenWrap.appendChild(frag);
        if (renderedCount < entries.length) {
          const remaining = entries.length - renderedCount;
          const more = el("div", "jsoneat-more", "▸ show " + Math.min(CHUNK, remaining) + " more (" + remaining + " left)");
          more.style.paddingLeft = (depth + 1) * indentStep() + 22 + "px";
          more.addEventListener("click", (e) => {
            e.stopPropagation();
            renderChunk();
          });
          childrenWrap.appendChild(more);
        }
      };
      const buildChildren = () => {
        if (built) return;
        built = true;
        renderChunk();
      };
      const setOpen = (open) => {
        const twisty = line.querySelector(".jsoneat-twisty");
        if (open) {
          buildChildren();
          childrenWrap.style.display = "";
          row.classList.remove("jsoneat-collapsed");
          twisty.textContent = "▾";
        } else {
          childrenWrap.style.display = "none";
          row.classList.add("jsoneat-collapsed");
          twisty.textContent = "▸";
        }
      };
      const toggle = (collapsed) => {
        if (collapsed === undefined) collapsed = childrenWrap.style.display !== "none";
        setOpen(!collapsed);
      };
      row._toggle = toggle;

      // Reveal a specific child (used by data-model search) — expand + render
      // chunks until the child at `rawKey` exists, then return its node.
      row._revealTo = (rawKey) => {
        ensureEntries();
        let idx = type === "array" ? Number(rawKey) : entries.findIndex((e) => e[0] === rawKey);
        if (idx < 0 || idx >= entries.length) return null;
        setOpen(true);
        let guard = 0;
        while (renderedCount <= idx && guard++ < 100000) renderChunk();
        return childrenWrap.querySelectorAll(":scope > .jsoneat-node")[idx] || null;
      };

      line.addEventListener("click", () => toggle());

      // Auto-expand only during the initial pass, only within the depth limit,
      // and only while the node budget lasts — this is what prevents 100^depth.
      if (initialPass && depth < settings.expandDepth && count(value) > 0 && autoNodesLeft > 0) {
        setOpen(true);
      } else {
        row.classList.add("jsoneat-collapsed");
      }
    }
    return row;
  }

  // ---- Search over the DATA MODEL ---------------------------------------
  function runSearch(query) {
    const tree = document.getElementById("jsoneat-tree");
    if (!tree) return;
    tree.querySelectorAll(".jsoneat-hit").forEach((n) => n.classList.remove("jsoneat-hit"));
    const q = query.trim().toLowerCase();
    if (!q || data === undefined) return;

    // 1) Walk the parsed data, collect paths (arrays of raw keys/indices) to
    //    every node whose key OR scalar value contains the query. Bounded.
    const MAX = 500;
    const paths = [];
    (function walk(val, segs, keyName) {
      if (paths.length >= MAX) return;
      let match = keyName != null && String(keyName).toLowerCase().includes(q);
      const t = valueType(val);
      if (!match && t !== "object" && t !== "array") {
        if (String(val).toLowerCase().includes(q)) match = true;
      }
      if (match) paths.push(segs);
      if (t === "array") for (let i = 0; i < val.length && paths.length < MAX; i++) walk(val[i], segs.concat(i), i);
      else if (t === "object") for (const k of Object.keys(val)) { if (paths.length >= MAX) break; walk(val[k], segs.concat(k), k); }
    })(data, [], null);

    // 2) Reveal each match by expanding + rendering the exact branch.
    let firstHit = null;
    const rootNode = tree.querySelector(".jsoneat-node");
    for (const segs of paths) {
      let node = rootNode;
      for (const seg of segs) {
        if (!node || !node._revealTo) { node = null; break; }
        node = node._revealTo(seg);
      }
      if (node) {
        const l = node.querySelector(":scope > .jsoneat-line");
        if (l) {
          l.classList.add("jsoneat-hit");
          if (!firstHit) firstHit = l;
        }
      }
    }
    if (firstHit && typeof firstHit.scrollIntoView === "function")
      firstHit.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function setAllCollapsed(collapsed) {
    const tree = document.getElementById("jsoneat-tree");
    if (!tree) return;
    if (collapsed) {
      tree.querySelectorAll(".jsoneat-node").forEach((r) => r._toggle && r._toggle(true));
      return;
    }
    // Expand: NodeList is static, and expanding builds new nodes, so loop until
    // the count stabilises or we hit a safety budget (bounds "Expand all" on
    // pathological files instead of freezing).
    const BUDGET = 20000;
    let prev = -1,
      cur = tree.querySelectorAll(".jsoneat-node").length,
      guard = 0;
    while (cur !== prev && cur < BUDGET && guard++ < 60) {
      prev = cur;
      tree.querySelectorAll(".jsoneat-node").forEach((r) => r._toggle && r._toggle(false));
      cur = tree.querySelectorAll(".jsoneat-node").length;
    }
  }

  // ---- Raw toggle --------------------------------------------------------
  function toggleRaw(rawText, button) {
    const root = document.getElementById("jsoneat-root");
    const tree = document.getElementById("jsoneat-tree");
    if (!rawEl) {
      rawEl = buildRaw(rawText);
      rawEl.style.display = "none";
      root.appendChild(rawEl);
    }
    const showingRaw = rawEl.style.display !== "none";
    rawEl.style.display = showingRaw ? "none" : "";
    if (tree) tree.style.display = showingRaw ? "" : "none";
    // После клика показываем: raw → кнопка предлагает «Format», и наоборот.
    if (button) {
      button.textContent = showingRaw ? "Raw" : "Format";
      button.setAttribute("aria-pressed", showingRaw ? "false" : "true");
    }
  }
  function buildRaw(rawText) {
    const pre = document.createElement("pre");
    pre.className = "jsoneat-raw";
    pre.textContent = rawText;
    return pre;
  }

  function showParseError(root, err, rawText) {
    const box = el("div", "jsoneat-error");
    box.appendChild(el("div", "jsoneat-error-title", "This looks like JSON but doesn’t parse."));
    box.appendChild(el("div", "jsoneat-error-msg", String(err && err.message ? err.message : err)));
    const pos = extractPos(err);
    if (pos != null) box.appendChild(el("div", "jsoneat-error-ctx", contextAround(rawText, pos)));
    root.appendChild(box);
    root.appendChild(buildRaw(rawText));
  }

  // ---- Helpers -----------------------------------------------------------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(label, onClick) {
    const b = el("button", "jsoneat-btn", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  function buildNotice(text, onAction) {
    const n = el("div", "jsoneat-notice", text + "  ");
    n.appendChild(btn("Format", onAction));
    return n;
  }
  function valueType(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }
  function renderScalar(v, type) {
    if (type === "string") return JSON.stringify(v).slice(1, -1);
    return String(v);
  }
  function count(v) {
    return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0;
  }
  // JSONPath segment. JSON.stringify handles quotes, backslashes, control chars
  // and unicode correctly, so copy-path is always valid.
  function safeChildKey(k) {
    return /^[A-Za-z_$][\w$]*$/.test(k) ? "." + k : "[" + JSON.stringify(String(k)) + "]";
  }
  function prettyPrint(obj, indent, sort) {
    if (obj === undefined) return null;
    try {
      return JSON.stringify(sort ? sortDeep(obj) : obj, null, indent);
    } catch {
      return null;
    }
  }
  // defineProperty avoids the __proto__ setter trap that would drop that key.
  function sortDeep(o) {
    if (Array.isArray(o)) return o.map(sortDeep);
    if (o && typeof o === "object") {
      const out = {};
      for (const k of Object.keys(o).sort())
        Object.defineProperty(out, k, { value: sortDeep(o[k]), enumerable: true, configurable: true, writable: true });
      return out;
    }
    return o;
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok;
  }
  function flash(node) {
    node.classList.add("jsoneat-copied");
    setTimeout(() => node.classList.remove("jsoneat-copied"), 500);
  }
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function extractPos(err) {
    const m = /position (\d+)/.exec(String(err && err.message));
    return m ? parseInt(m[1], 10) : null;
  }
  function contextAround(text, pos) {
    const start = Math.max(0, pos - 40);
    return "…" + text.slice(start, pos) + "▸" + text.slice(pos, pos + 40) + "…";
  }
  function themeAttr() {
    if (settings.theme === "auto") return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return settings.theme;
  }
  function themeIcon() {
    return themeAttr() === "dark" ? "☾" : "☀";
  }
  function cycleTheme(button) {
    // Кнопка — простой видимый переключатель: всегда ПРОТИВОПОЛОЖНАЯ тема.
    // Старый трёхшаговый цикл auto→light→dark давал «пустой» клик: шаг в auto
    // визуально совпадал с текущей системной темой (баг Кирилла в v0.2.6).
    // Режим auto по-прежнему доступен в попапе настроек.
    settings.theme = themeAttr() === "dark" ? "light" : "dark";
    try {
      chrome?.storage?.local?.set({ theme: settings.theme });
    } catch {}
    document.documentElement.setAttribute("data-jsoneat", themeAttr());
    if (button) button.textContent = themeIcon();
  }

  // ---- Live settings ------------------------------------------------------
  // Попап рассылает изменения настроек во все вкладки; применяем сразу,
  // без перезагрузки страницы (жалоба из отзывов конкурентов: «тема
  // применяется только к последней перезагруженной вкладке»).
  try {
    chrome?.runtime?.onMessage?.addListener((msg) => {
      if (!msg || msg.type !== "jsoneat-settings" || !msg.settings) return;
      settings = { ...settings, ...msg.settings };
      if (!rendered) return;
      document.documentElement.setAttribute("data-jsoneat", themeAttr());
      const root = document.getElementById("jsoneat-root");
      // Перестраиваем только когда дерево реально построено: в raw-режиме
      // больших файлов и на parse-ошибках перестраивать нечего.
      if (root && data !== undefined && document.getElementById("jsoneat-tree")) {
        rebuildTree(root, data);
      }
    });
  } catch {
    /* runtime недоступен (файл открыт вне расширения) — не критично */
  }
})();
