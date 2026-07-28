/*
 * JSON Beautifier content script — detector + viewer shell.
 *
 * The JSON engine itself (parsing, the tree, search, copy) lives in core.js and
 * is shared with the Firefox build and with jsonbeautifier.dev. What stays here
 * is everything specific to being a browser extension running on a live page:
 * deciding whether this document is raw JSON at all, chrome.storage settings,
 * the toolbar, and the raw/format toggle.
 *
 * Design constraints, straight from the niche pain map (why incumbents die):
 *  - Reliability on MV3 first. EARLY-EXIT fast and cheap on any non-JSON page.
 *  - Zero network. No fetch/XHR/telemetry — everything is local.
 *  - Never a silent failure. Looks-like-JSON-but-doesn't-parse → we say so.
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

  // Ядро грузится первым файлом в content_scripts. Если его почему-то нет —
  // молча уходим: сломать чужую страницу хуже, чем не отформатировать свою.
  const core = globalThis.JSONBeautifierCore;
  if (!core) return;
  const { el, btn, copyText, flash } = core;

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

  let data;
  let parseError = null;
  if (!oversize) {
    const res = core.parse(trimmed);
    if (res.ok) data = res.data;
    else {
      parseError = res.error;
      if (!looksJsonType) return; // untyped + unparseable → leave page alone
    }
  }

  // ---- 2. Settings -------------------------------------------------------
  const DEFAULTS = { theme: "auto", indent: 2, expandDepth: 2, sortKeys: false, lineNumbers: true };
  let settings = { ...DEFAULTS };

  let rendered = false;
  let rawEl = null;
  let treeHandle = null;
  let enableTreeControls = null; // ставится тулбаром, когда управление временно отключено

  const applyAfterSettings = () => queueMicrotask(render);

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
  const treeOptions = () => ({
    indent: settings.indent,
    expandDepth: settings.expandDepth,
    sortKeys: settings.sortKeys,
    treeId: "jsoneat-tree",
  });

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
            core.fmtBytes(trimmed.length) +
            "). Showing raw text — click “Format” to build the tree.",
          () => {
            const res = core.parse(trimmed);
            root.querySelectorAll(".jsoneat-notice, .jsoneat-rawwrap").forEach((n) => n.remove());
            rawEl = null;
            if (res.ok) {
              data = res.data;
              treeHandle = core.renderTree(root, data, treeOptions());
              if (enableTreeControls) enableTreeControls();
            } else {
              showParseError(root, res.error, trimmed);
            }
          }
        )
      );
      rawEl = buildRaw(trimmed);
      root.appendChild(rawEl);
    } else if (parseError) {
      showParseError(root, parseError, trimmed);
    } else {
      treeHandle = core.renderTree(root, data, treeOptions());
    }

    body.textContent = "";
    body.appendChild(root);
    if (singlePre) singlePre.remove();
  }

  function rebuildTree(root) {
    if (treeHandle) treeHandle.destroy();
    root.querySelectorAll(".jsoneat-notice, .jsoneat-rawwrap").forEach((n) => n.remove());
    rawEl = null;
    treeHandle = core.renderTree(root, data, treeOptions());
  }

  // ---- Toolbar -----------------------------------------------------------
  function buildToolbar(rawText, getData) {
    const bar = el("div", "jsoneat-toolbar");

    bar.appendChild(el("span", "jsoneat-brand", "JSON Beautifier"));

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search keys & values…";
    search.className = "jsoneat-search";
    search.setAttribute("aria-label", "Search JSON");
    let t;
    search.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => treeHandle && treeHandle.search(search.value), 160);
    });
    bar.appendChild(search);

    // Один toggle вместо пары кнопок: подпись — действие по клику.
    let allCollapsed = false;
    const expToggle = btn("Collapse all", () => {
      allCollapsed = !allCollapsed;
      if (treeHandle) treeHandle.setAllCollapsed(allCollapsed);
      expToggle.textContent = allCollapsed ? "Expand all" : "Collapse all";
    });
    expToggle.classList.add("jsoneat-exptoggle");
    bar.appendChild(expToggle);

    const copyBtn = btn("Copy JSON", () => {
      // No sort → copy the exact source bytes (perfect fidelity, incl. big ints).
      // Sort → must re-stringify (documented: precision of >2^53 ints not kept).
      const text = settings.sortKeys
        ? core.prettyPrint(getData(), { indent: settings.indent, sortKeys: true }) ?? rawText
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

    // Документ не разобрался — дерева нет, значит поиску, сворачиванию и
    // переключателю Raw ⇄ Format работать не с чем. Оставить их живыми значит
    // предложить действия, которые ничего не делают (или, как выяснилось,
    // прячут единственное, что показано).
    if (parseError || oversize) {
      const why = parseError
        ? "Not available: this document didn’t parse"
        : "Not available yet: press Format to build the tree";
      for (const node of [search, expToggle, rawToggle]) {
        node.disabled = true;
        node.title = why;
      }
      // Большой документ ещё может стать деревом по кнопке Format — тогда
      // управление снова включается.
      if (oversize) enableTreeControls = () => {
        for (const node of [search, expToggle, rawToggle]) {
          node.disabled = false;
          node.removeAttribute("title");
        }
      };
    }

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

  // ---- Raw toggle --------------------------------------------------------
  function toggleRaw(rawText, button) {
    // Без дерева прятать raw нельзя: на экране не останется ничего. Кнопка в
    // таких состояниях ещё и визуально отключена, но синтетический клик её
    // обходит, поэтому защита стоит в самом обработчике.
    if (!treeHandle) return;
    const root = document.getElementById("jsoneat-root");
    const tree = treeHandle && treeHandle.element;
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

  /*
   * Raw-режим.
   *
   * Каждая строка — своя строка разметки: номер в несжимаемой колонке слева,
   * текст справа с переносом. Так номер остаётся привязан к своей логической
   * строке даже когда та переносится на несколько экранных — как в редакторах.
   *
   * Почему не одна <pre> с общим жёлобом номеров (как было в первой версии):
   * тогда ради выравнивания приходится запрещать перенос, а реальный raw-JSON
   * почти всегда минифицирован — одна строка на мегабайты. Без переноса браузер
   * должен нарисовать строку шириной в миллионы пикселей и не рисует ничего.
   * Перенос здесь важнее выравнивания, и такая вёрстка даёт и то и другое.
   *
   * Порог по числу строк нужен, потому что разметка стоит три узла на строку.
   * Выше порога — обычный <pre> с переносом и без номеров.
   */
  const RAW_NUMBERED_MAX_LINES = 20000;

  function buildRaw(rawText) {
    const wrap = el("div", "jsoneat-rawwrap");
    const lines = rawText.split("\n");
    const numbered =
      settings.lineNumbers !== false && lines.length > 1 && lines.length <= RAW_NUMBERED_MAX_LINES;

    if (!numbered) {
      const plain = el("div", "jsoneat-raw jsoneat-raw-plain");
      plain.textContent = rawText;
      wrap.appendChild(plain);
      if (lines.length > RAW_NUMBERED_MAX_LINES) {
        wrap.appendChild(
          el("div", "jsoneat-rawnote",
             `Line numbers are off above ${RAW_NUMBERED_MAX_LINES.toLocaleString("en-US")} lines.`)
        );
      }
      wrap._numbered = false;
      wrap._gotoLine = () => {};
      return wrap;
    }

    const body = el("div", "jsoneat-raw");
    const frag = document.createDocumentFragment();
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const row = el("div", "jsoneat-rawrow");
      // Номер — отдельный элемент с user-select:none, поэтому в буфер при
      // выделении текста мышью он не попадает.
      row.appendChild(el("span", "jsoneat-rawnum", String(i + 1)));
      row.appendChild(el("span", "jsoneat-rawline", lines[i]));
      frag.appendChild(row);
      rows.push(row);
    }
    body.appendChild(frag);
    wrap.appendChild(body);

    wrap._numbered = true;
    wrap._gotoLine = (n) => {
      if (!n || n < 1 || n > rows.length) return;
      const prev = wrap.querySelector(".jsoneat-rawrow-hit");
      if (prev) prev.classList.remove("jsoneat-rawrow-hit");
      const row = rows[n - 1];
      row.classList.add("jsoneat-rawrow-hit");
      try {
        if (typeof row.scrollIntoView === "function")
          row.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (_) {
        /* прокрутка не критична — подсветка уже стоит */
      }
    };
    return wrap;
  }

  function buildNotice(text, onAction) {
    const n = el("div", "jsoneat-notice", text + "  ");
    n.appendChild(btn("Format", onAction));
    return n;
  }

  /*
   * Фрагмент исходника с кареткой:
   *     7 │     "id": "ord_8126"
   *       │                     ^
   * Длинные строки подрезаем вокруг позиции ошибки, табы заменяем пробелом
   * один к одному — JSON.parse считает их за один символ, и каретка не съезжает.
   */
  function codeFrame(err) {
    const MAX_WIDTH = 120;
    let text = String(err.lineText || "").replace(/\t/g, " ");
    let col = err.column;
    if (text.length > MAX_WIDTH) {
      const from = Math.max(0, col - Math.floor(MAX_WIDTH / 2));
      const head = from > 0 ? "…" : "";
      text = head + text.slice(from, from + MAX_WIDTH) + "…";
      col = col - from + head.length;
    }
    const num = String(err.line);
    const box = el("div", "jsoneat-error-ctx");

    const src = document.createElement("div");
    src.appendChild(el("span", "jsoneat-ctx-num", num + " │ "));
    src.appendChild(document.createTextNode(text));

    const caret = document.createElement("div");
    caret.appendChild(el("span", "jsoneat-ctx-num", " ".repeat(num.length) + " │ "));
    caret.appendChild(el("span", "jsoneat-ctx-caret", " ".repeat(Math.max(0, col - 1)) + "^"));

    box.appendChild(src);
    box.appendChild(caret);
    return box;
  }

  function showParseError(root, err, rawText) {
    const box = el("div", "jsoneat-error");
    box.appendChild(el("div", "jsoneat-error-title", "This looks like JSON but doesn’t parse."));
    box.appendChild(el("div", "jsoneat-error-msg", err.message));

    const raw = buildRaw(rawText);
    let jumpBtn = null;

    if (err.line != null) {
      // Ошибка может быть на 200-й строке, далеко за пределами экрана, а само
      // сообщение всегда наверху — поэтому к строке нужен переход, а не только
      // её номер.
      jumpBtn = btn(`Line ${err.line}, column ${err.column} →`, () => raw._gotoLine(err.line));
      jumpBtn.classList.add("jsoneat-error-jump");
      jumpBtn.title = "Scroll to the line and highlight it";
      box.appendChild(jumpBtn);
      box.appendChild(codeFrame(err));
    } else if (err.context) {
      box.appendChild(el("div", "jsoneat-error-ctx", err.context));
    }

    root.appendChild(box);
    root.appendChild(raw);
    rawEl = raw; // чтобы кнопка Raw в тулбаре не создала второй экземпляр
    if (!raw._numbered && jumpBtn) {
      // Номеров нет — прыгать не к чему, честнее убрать кнопку.
      jumpBtn.remove();
    }
  }

  // ---- Theme --------------------------------------------------------------
  function themeAttr() {
    if (settings.theme === "auto")
      return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
      if (root && data !== undefined && treeHandle) rebuildTree(root);

      // Raw пересобираем отдельно: он живёт независимо от дерева и в нём
      // меняется нумерация строк.
      if (root && rawEl) {
        const wasVisible = rawEl.style.display !== "none";
        const fresh = buildRaw(trimmed);
        if (!wasVisible) fresh.style.display = "none";
        rawEl.replaceWith(fresh);
        rawEl = fresh;
      }
    });
  } catch {
    /* runtime недоступен (файл открыт вне расширения) — не критично */
  }
})();
