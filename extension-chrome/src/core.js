/* GENERATED FILE — do not edit. Source of truth: core/core.js (refresh with scripts/sync-core.sh). */
/*
 * JSON Beautifier — core engine.
 *
 * Pure JavaScript: no chrome.* APIs, no page detection, no DOM hijacking. This
 * file is consumed by the browser extensions AND by jsonbeautifier.dev, which is
 * the whole point — the tree the extension draws and the tree the website draws
 * can never drift apart.
 *
 * Loaded as a plain script, not an ES module: MV3 content scripts cannot be
 * modules, so it assigns globalThis.JSONBeautifierCore. Inside an extension that
 * happens in the isolated world, so the page itself stays untouched.
 *
 * The design constraints it inherits from the extension, all of them load-bearing:
 *  - Big documents must not hang the tab. Children render lazily AND windowed AND
 *    the initial auto-expand is bounded by a node budget (no 100^depth blow-up).
 *  - Search walks the DATA MODEL, not the rendered DOM, so matches in a 5000-item
 *    array beyond the first render window are still found.
 *  - Never a silent failure: a parse error carries position, line, column and a
 *    pointer into the source text.
 */
(() => {
  "use strict";

  const AUTO_BUDGET = 1500; // nodes the initial auto-expand may create
  const CHUNK = 100; // children rendered per "show more" step
  const SEARCH_MAX = 500; // matches collected per query
  const EXPAND_ALL_BUDGET = 20000; // ceiling for "Expand all" on pathological files

  // ---- Value helpers -------------------------------------------------------

  function valueType(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }

  function count(v) {
    return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0;
  }

  function renderScalar(v, type) {
    if (type === "string") return JSON.stringify(v).slice(1, -1);
    return String(v);
  }

  // JSONPath segment. JSON.stringify handles quotes, backslashes, control chars
  // and unicode correctly, so copy-path always yields a valid path.
  function safeChildKey(k) {
    return /^[A-Za-z_$][\w$]*$/.test(k) ? "." + k : "[" + JSON.stringify(String(k)) + "]";
  }

  // defineProperty avoids the __proto__ setter trap that would drop that key.
  function sortDeep(o) {
    if (Array.isArray(o)) return o.map(sortDeep);
    if (o && typeof o === "object") {
      const out = {};
      for (const k of Object.keys(o).sort())
        Object.defineProperty(out, k, {
          value: sortDeep(o[k]),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      return out;
    }
    return o;
  }

  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  // ---- Parse / print / minify ----------------------------------------------

  function extractPos(message) {
    const m = /position (\d+)/.exec(String(message));
    return m ? parseInt(m[1], 10) : null;
  }

  function contextAround(text, pos) {
    const start = Math.max(0, pos - 40);
    return "…" + text.slice(start, pos) + "▸" + text.slice(pos, pos + 40) + "…";
  }

  /*
   * V8 отдаёт что-то вроде
   *   Expected ',' or '}' after property value in JSON at position 282 (line 7 column 5)
   * «position 282» человеку не говорит ничего: смещение в символах невозможно
   * соотнести с тем, что он видит на экране. Полезная часть — первая половина
   * фразы; строку и колонку мы показываем отдельно и делаем по ним переход.
   */
  function cleanMessage(raw) {
    const cleaned = raw
      .replace(/\s*at position\s+\d+/i, "")
      .replace(/\s*\(line\s+\d+\s+column\s+\d+\)/i, "")
      .replace(/\s+in JSON\s*$/i, "")
      .trim();
    return cleaned || raw;
  }

  function describeError(err, text) {
    const rawMessage = String(err && err.message ? err.message : err);
    const pos = extractPos(rawMessage);
    const out = {
      message: cleanMessage(rawMessage),
      rawMessage,
      pos,
      line: null,
      column: null,
      lineText: null,
      context: null,
    };
    if (pos != null && typeof text === "string" && pos <= text.length) {
      const before = text.slice(0, pos);
      const lineStart = before.lastIndexOf("\n") + 1;
      const lineEnd = text.indexOf("\n", pos);
      out.line = before.split("\n").length;
      out.column = pos - lineStart + 1;
      out.lineText = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
      out.context = contextAround(text, pos);
    }
    return out;
  }

  /** Never throws. → { ok: true, data } | { ok: false, error: {message,pos,line,column,context} } */
  function parse(text) {
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch (e) {
      return { ok: false, error: describeError(e, text) };
    }
  }

  /** → string, or null if the value cannot be serialised (cycles, BigInt…). */
  function prettyPrint(data, options) {
    const opts = options || {};
    if (data === undefined) return null;
    try {
      return JSON.stringify(opts.sortKeys ? sortDeep(data) : data, null, opts.indent ?? 2);
    } catch {
      return null;
    }
  }

  /** Text in, text out. Never throws: → { ok, text } | { ok: false, error }. */
  function minify(text) {
    const res = parse(text);
    if (!res.ok) return res;
    try {
      return { ok: true, text: JSON.stringify(res.data) };
    } catch (e) {
      return { ok: false, error: describeError(e, text) };
    }
  }

  // ---- DOM helpers ---------------------------------------------------------

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

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopy(text);
    }
  }

  function flash(node) {
    node.classList.add("jsoneat-copied");
    setTimeout(() => node.classList.remove("jsoneat-copied"), 500);
  }

  // ---- Tree view -----------------------------------------------------------

  /**
   * Render `data` as an interactive tree inside `container`.
   *
   * settings: { indent, expandDepth, sortKeys, treeId }
   * returns:  { element, search(query), setAllCollapsed(bool), destroy() }
   */
  function renderTree(container, data, settings) {
    const opts = { indent: 2, expandDepth: 2, sortKeys: false, ...(settings || {}) };

    // Indent step. This used to be hardcoded at 14px, which made the Indent
    // setting do nothing visible (found by Kirill in v0.2.2). 8px ≈ one column
    // of 13px monospace: indent=2 → 16px per level, 4 → 32px, 1 → 8px.
    const indentStep = () => (opts.indent || 2) * 8;

    let initialPass = true;
    let autoNodesLeft = AUTO_BUDGET;

    const tree = el("div", "jsoneat-treeview");
    if (opts.treeId) tree.id = opts.treeId;
    // Нумерация строк дерева делается целиком на CSS-счётчиках (см. viewer.css):
    // свёрнутые ветки стоят display:none, боксов не создают и счётчик не двигают,
    // поэтому номера всегда совпадают с тем, что видно, и пересчёт при
    // сворачивании достаётся бесплатно — без единой строчки JS.
    if (opts.lineNumbers) tree.classList.add("jsoneat-lines");
    tree.appendChild(buildNode("$", data, 0, true));
    initialPass = false;
    if (container) container.appendChild(tree);

    // key = raw property name (string) or array index (number), for DISPLAY.
    // The JSONPath segment used by copy-path is computed separately.
    function buildNode(key, value, depth, isRoot) {
      if (initialPass) autoNodesLeft--;

      const type = valueType(value);
      const isContainer = type === "object" || type === "array";
      const row = el("div", "jsoneat-node jsoneat-t-" + type);

      const line = el("div", "jsoneat-line");
      line.style.paddingLeft = depth * indentStep() + 8 + "px";
      line.appendChild(
        el("span", "jsoneat-twisty" + (isContainer ? "" : " jsoneat-leaf"), isContainer ? "▸" : "")
      );

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
        line.appendChild(
          el(
            "span",
            "jsoneat-summary",
            n === 0 ? "" : " " + n + (type === "array" ? " items " : " keys ")
          )
        );
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

        let built = false;
        let entries = null;
        let renderedCount = 0;

        const ensureEntries = () => {
          if (entries) return;
          entries =
            type === "array"
              ? value.map((v, i) => [i, v])
              : (opts.sortKeys ? Object.keys(value).sort() : Object.keys(value)).map((k) => [
                  k,
                  value[k],
                ]);
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
            const childNode = buildNode(ck, cv, depth + 1, false);
            childNode.dataset.fullpath = (row.dataset.fullpath || "$") + seg;
            frag.appendChild(childNode);
          }
          renderedCount = end;
          childrenWrap.appendChild(frag);
          if (renderedCount < entries.length) {
            const remaining = entries.length - renderedCount;
            const more = el(
              "div",
              "jsoneat-more",
              "▸ show " + Math.min(CHUNK, remaining) + " more (" + remaining + " left)"
            );
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

        // Reveal a specific child (used by the data-model search): expand and
        // render chunks until the child at `rawKey` exists, then return its node.
        row._revealTo = (rawKey) => {
          ensureEntries();
          const idx =
            type === "array" ? Number(rawKey) : entries.findIndex((e) => e[0] === rawKey);
          if (idx < 0 || idx >= entries.length) return null;
          setOpen(true);
          let guard = 0;
          while (renderedCount <= idx && guard++ < 100000) renderChunk();
          return childrenWrap.querySelectorAll(":scope > .jsoneat-node")[idx] || null;
        };

        line.addEventListener("click", () => toggle());

        // Auto-expand only during the initial pass, only within the depth limit,
        // and only while the node budget lasts — this is what prevents 100^depth.
        if (initialPass && depth < opts.expandDepth && count(value) > 0 && autoNodesLeft > 0) {
          setOpen(true);
        } else {
          row.classList.add("jsoneat-collapsed");
        }
      }
      return row;
    }

    /** Search the DATA MODEL, then expand exactly the branches that matched. */
    function search(query) {
      tree.querySelectorAll(".jsoneat-hit").forEach((n) => n.classList.remove("jsoneat-hit"));
      const q = String(query || "").trim().toLowerCase();
      if (!q || data === undefined) return 0;

      // 1) Walk the parsed data, collecting paths (arrays of raw keys/indices) to
      //    every node whose key OR scalar value contains the query. Bounded.
      const paths = [];
      (function walk(val, segs, keyName) {
        if (paths.length >= SEARCH_MAX) return;
        let match = keyName != null && String(keyName).toLowerCase().includes(q);
        const t = valueType(val);
        if (!match && t !== "object" && t !== "array") {
          if (String(val).toLowerCase().includes(q)) match = true;
        }
        if (match) paths.push(segs);
        if (t === "array") {
          for (let i = 0; i < val.length && paths.length < SEARCH_MAX; i++)
            walk(val[i], segs.concat(i), i);
        } else if (t === "object") {
          for (const k of Object.keys(val)) {
            if (paths.length >= SEARCH_MAX) break;
            walk(val[k], segs.concat(k), k);
          }
        }
      })(data, [], null);

      // 2) Reveal each match by expanding + rendering the exact branch.
      let firstHit = null;
      let hits = 0;
      const rootNode = tree.querySelector(".jsoneat-node");
      for (const segs of paths) {
        let node = rootNode;
        for (const seg of segs) {
          if (!node || !node._revealTo) {
            node = null;
            break;
          }
          node = node._revealTo(seg);
        }
        if (node) {
          const l = node.querySelector(":scope > .jsoneat-line");
          if (l) {
            l.classList.add("jsoneat-hit");
            hits++;
            if (!firstHit) firstHit = l;
          }
        }
      }
      if (firstHit && typeof firstHit.scrollIntoView === "function")
        firstHit.scrollIntoView({ block: "center", behavior: "smooth" });
      return hits;
    }

    function setAllCollapsed(collapsed) {
      if (collapsed) {
        tree.querySelectorAll(".jsoneat-node").forEach((r) => r._toggle && r._toggle(true));
        return;
      }
      // Expanding builds new nodes, and the NodeList is static, so loop until the
      // count stabilises or the budget runs out — this bounds "Expand all" on
      // pathological files instead of freezing the tab.
      let prev = -1;
      let cur = tree.querySelectorAll(".jsoneat-node").length;
      let guard = 0;
      while (cur !== prev && cur < EXPAND_ALL_BUDGET && guard++ < 60) {
        prev = cur;
        tree.querySelectorAll(".jsoneat-node").forEach((r) => r._toggle && r._toggle(false));
        cur = tree.querySelectorAll(".jsoneat-node").length;
      }
    }

    function destroy() {
      tree.remove();
    }

    return { element: tree, search, setAllCollapsed, destroy };
  }

  globalThis.JSONBeautifierCore = {
    // data
    parse,
    prettyPrint,
    minify,
    sortDeep,
    valueType,
    count,
    renderScalar,
    safeChildKey,
    fmtBytes,
    // dom
    el,
    btn,
    copyText,
    flash,
    renderTree,
  };
})();
