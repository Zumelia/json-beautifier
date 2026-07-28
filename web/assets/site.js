/*
 * jsonbeautifier.dev — поведение страницы.
 *
 * Ни одного сетевого запроса: инструмент работает на том же ядре, что и
 * расширение (assets/core.js), разбор и форматирование идут прямо здесь.
 * Это не лозунг для лендинга, а проверяемое свойство — вкладка Network
 * остаётся пустой.
 */
(() => {
  "use strict";

  const cfg = window.JB_CONFIG;
  const core = window.JSONBeautifierCore;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Порог, за которым перестаём подсвечивать и нумеровать: подсветка стоит
  // элемент на токен, и на мегабайтном документе это перестаёт окупаться.
  const HIGHLIGHT_MAX_LINES = 5000;
  const WARN_BYTES = 5 * 1024 * 1024;
  const REFUSE_BYTES = 25 * 1024 * 1024;

  // ---- ссылки в стор: единственный источник — site-config.js --------------
  $$("[data-cta-slot]").forEach((a) => {
    a.href = cfg.cta(a.getAttribute("data-cta-slot"));
  });
  $$("[data-href=github]").forEach((a) => (a.href = cfg.GITHUB_URL));

  // ---- тема ----------------------------------------------------------------
  // Переключатель двухшаговый: всегда противоположная тема. Трёхшаговый цикл
  // через «auto» даёт «пустой» клик, когда auto совпадает с системной, — этот
  // урок мы уже оплатили в расширении.
  const root = document.documentElement;
  const prefersDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const effective = () => root.getAttribute("data-theme") || (prefersDark() ? "dark" : "light");
  function applyTheme(mode) {
    if (mode) root.setAttribute("data-theme", mode);
    $$("[data-theme-toggle]").forEach((b) => {
      b.setAttribute("aria-label", effective() === "dark" ? "Switch to light theme" : "Switch to dark theme");
      b.textContent = effective() === "dark" ? "☀" : "☾";
    });
  }
  try {
    const saved = localStorage.getItem("jb.theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (_) {}
  applyTheme();
  $$("[data-theme-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = effective() === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("jb.theme", next);
      } catch (_) {}
    })
  );

  // ---- мобильное меню -------------------------------------------------------
  const sheet = $("#sheet");
  $$("[data-menu-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const open = sheet.hidden;
      sheet.hidden = !open;
      b.setAttribute("aria-expanded", String(open));
      if (open) $("a", sheet)?.focus();
    })
  );

  // ---- переключатель языка --------------------------------------------------
  const picker = $("#lang");
  const pickerMenu = $("#lang-menu");
  if (picker) {
    picker.addEventListener("click", () => {
      const open = pickerMenu.hidden;
      pickerMenu.hidden = !open;
      picker.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => {
      if (!pickerMenu.hidden && !picker.contains(e.target) && !pickerMenu.contains(e.target)) {
        pickerMenu.hidden = true;
        picker.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        pickerMenu.hidden = true;
        if (!sheet.hidden) sheet.hidden = true;
      }
    });
  }

  // ---- инструмент -----------------------------------------------------------
  const input = $("#jb-input");
  if (input && core) {
    const out = $("#jb-out");
    const status = $("#jb-status");
    const hint = $("#jb-hint");
    const prompt = $("#jb-prompt");
    let mode = "beautify";
    let treeHandle = null;

    const indent = () => parseInt($("#jb-indent").value, 10);
    const sortKeys = () => $("#jb-sort").checked;

    const clearOut = () => {
      if (treeHandle) {
        treeHandle.destroy();
        treeHandle = null;
      }
      out.textContent = "";
    };

    function say(text, cls) {
      const p = document.createElement("p");
      p.className = cls || "out-empty";
      p.textContent = text;
      out.appendChild(p);
    }

    /* Подсветка. Строим узлами, а не innerHTML: вставленный текст никогда не
       становится разметкой, поэтому вредоносный JSON остаётся текстом. */
    const TOKENS = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
    function highlight(text) {
      const lines = text.split("\n");
      if (lines.length > HIGHLIGHT_MAX_LINES) {
        const plain = document.createElement("pre");
        plain.style.margin = "0";
        plain.style.padding = "0 16px";
        plain.textContent = text;
        out.appendChild(plain);
        say(`${lines.length.toLocaleString("en-US")} lines — syntax highlighting is off above ${HIGHLIGHT_MAX_LINES.toLocaleString("en-US")}.`);
        return;
      }
      const box = document.createElement("div");
      box.className = "jsoneat-treeview jsoneat-lines";
      const frag = document.createDocumentFragment();
      for (const line of lines) {
        const row = document.createElement("div");
        row.className = "jsoneat-line";
        let last = 0;
        let m;
        TOKENS.lastIndex = 0;
        while ((m = TOKENS.exec(line)) !== null) {
          if (m.index > last) row.appendChild(document.createTextNode(line.slice(last, m.index)));
          const span = document.createElement("span");
          if (m[1] !== undefined) {
            span.className = m[2] ? "jsoneat-key" : "jsoneat-v-string";
            span.textContent = m[2] ? m[1].slice(1, -1) : m[1].slice(1, -1);
            row.appendChild(span);
            if (m[2]) {
              const c = document.createElement("span");
              c.className = "jsoneat-colon";
              c.textContent = m[2];
              row.appendChild(c);
            }
          } else if (m[3] !== undefined) {
            span.className = "jsoneat-v-number";
            span.textContent = m[3];
            row.appendChild(span);
          } else {
            span.className = m[4] === "null" ? "jsoneat-v-null" : "jsoneat-v-boolean";
            span.textContent = m[4];
            row.appendChild(span);
          }
          last = TOKENS.lastIndex;
        }
        if (last < line.length) row.appendChild(document.createTextNode(line.slice(last)));
        frag.appendChild(row);
      }
      box.appendChild(frag);
      out.appendChild(box);
    }

    function showError(err, src) {
      const box = document.createElement("div");
      box.className = "err";
      const title = document.createElement("b");
      title.textContent =
        err.line != null ? `Parse error · line ${err.line}, column ${err.column}` : "Parse error";
      box.appendChild(title);
      box.appendChild(document.createTextNode(err.message));
      if (err.lineText != null) {
        const frame = document.createElement("pre");
        const num = String(err.line);
        frame.textContent =
          `${num} │ ${err.lineText.replace(/\t/g, " ")}\n` +
          `${" ".repeat(num.length)} │ ${" ".repeat(Math.max(0, err.column - 1))}^`;
        box.appendChild(frame);
      }
      out.appendChild(box);
      status.textContent = "Invalid JSON";
    }

    function bump() {
      let n = 0;
      try {
        n = parseInt(sessionStorage.getItem("jb.formatCount") || "0", 10) + 1;
        sessionStorage.setItem("jb.formatCount", String(n));
      } catch (_) {}
      hint.hidden = false;
      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem("jb.promptDismissed") === "1";
      } catch (_) {}
      if (n >= 3 && !dismissed) prompt.hidden = false;
    }

    function run() {
      const src = input.value.trim();
      clearOut();
      if (!src) {
        say("Paste JSON on the left, or press “Try a sample”.");
        status.textContent = "";
        return;
      }
      const bytes = new Blob([src]).size;
      if (bytes > REFUSE_BYTES) {
        say(`${(bytes / 1048576).toFixed(1)} MB is too much for a browser tab. The extension streams files this size — a web page cannot.`, "warn");
        status.textContent = "Too large";
        return;
      }
      if (bytes > WARN_BYTES) {
        say(`${(bytes / 1048576).toFixed(1)} MB — this may hang the tab.`, "warn");
      }

      if (mode === "minify") {
        const r = core.minify(src);
        if (!r.ok) return showError(r.error, src);
        highlight(r.text);
        const saved = src.length - r.text.length;
        status.textContent = `Minified · ${r.text.length.toLocaleString("en-US")} B (${saved > 0 ? "−" + saved.toLocaleString("en-US") : "±0"})`;
        return bump();
      }

      const parsed = core.parse(src);
      if (!parsed.ok) return showError(parsed.error, src);

      if (mode === "validate") {
        const p = document.createElement("p");
        p.className = "out-empty";
        p.style.color = "var(--ok)";
        p.textContent = `Valid JSON · ${src.split("\n").length.toLocaleString("en-US")} lines · ${new Blob([src]).size.toLocaleString("en-US")} B`;
        out.appendChild(p);
        status.textContent = "Valid";
        return bump();
      }

      if (mode === "tree") {
        treeHandle = core.renderTree(out, parsed.data, {
          indent: indent(),
          expandDepth: 2,
          sortKeys: sortKeys(),
          lineNumbers: true,
        });
        status.textContent = "Tree";
        return bump();
      }

      const text = core.prettyPrint(parsed.data, { indent: indent(), sortKeys: sortKeys() });
      highlight(text);
      status.textContent = `Formatted · ${text.split("\n").length.toLocaleString("en-US")} lines`;
      bump();
    }

    // Табы
    $$("[data-tool-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.getAttribute("data-tool-tab");
        $$("[data-tool-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
        run();
      })
    );
    $("#jb-indent").addEventListener("change", run);
    $("#jb-sort").addEventListener("change", run);
    $("[data-tool-action=format]").addEventListener("click", run);
    $("[data-tool-action=clear]").addEventListener("click", () => {
      input.value = "";
      run();
      input.focus();
    });
    $("[data-tool-action=sample]").addEventListener("click", () => {
      input.value = SAMPLE;
      run();
    });
    $("[data-tool-action=copy]").addEventListener("click", (e) => {
      const text = out.innerText;
      navigator.clipboard.writeText(text).then(() => {
        const b = e.currentTarget;
        const was = b.textContent;
        b.textContent = "Copied";
        setTimeout(() => (b.textContent = was), 1200);
      });
    });
    $("[data-tool-action=download]").addEventListener("click", () => {
      const blob = new Blob([out.innerText], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "formatted.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const file = $("#jb-file");
    $("[data-tool-action=upload]").addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      if (!f) return;
      f.text().then((t) => {
        input.value = t;
        run();
      });
    });
    ["dragover", "drop"].forEach((ev) =>
      input.addEventListener(ev, (e) => {
        e.preventDefault();
        if (ev === "drop" && e.dataTransfer.files[0])
          e.dataTransfer.files[0].text().then((t) => {
            input.value = t;
            run();
          });
      })
    );
    $("[data-prompt-dismiss]").addEventListener("click", () => {
      prompt.hidden = true;
      try {
        sessionStorage.setItem("jb.promptDismissed", "1");
      } catch (_) {}
    });

    run();
  }

  // ---- виджет оценки --------------------------------------------------------
  // Строгая развилка, и она проговорена пользователю в тексте блока: четыре-пять
  // звёзд ведут в стор, одна-три — в приватную форму. Ничего не агрегируем и
  // никакого «среднего по сайту» не показываем.
  const stars = $$("[data-rate-star]");
  if (stars.length) {
    const label = $("#rate-label");
    const actions = $("#rate-actions");
    const done = $("#rate-done");
    const toStore = $("#rate-store");
    const toForm = $("#rate-form");
    const WORDS = ["", "Not great", "It has problems", "It's fine", "Good", "Love it"];
    let picked = 0;

    const paint = (n) => stars.forEach((s, i) => s.setAttribute("data-on", i < n ? "1" : "0"));

    try {
      const saved = JSON.parse(localStorage.getItem("jb.rated") || "null");
      if (saved && saved.stars) {
        done.textContent = `Thanks! You rated us ${saved.stars} ★`;
        done.hidden = false;
        $("#rate-widget").hidden = true;
      }
    } catch (_) {}

    stars.forEach((s, i) => {
      s.addEventListener("mouseenter", () => {
        paint(i + 1);
        label.textContent = WORDS[i + 1];
      });
      s.addEventListener("focus", () => paint(i + 1));
      s.addEventListener("click", () => {
        picked = i + 1;
        paint(picked);
        label.textContent = WORDS[picked];
        actions.hidden = false;
        toStore.hidden = picked < 4;
        toForm.hidden = picked >= 4;
        toStore.href = cfg.REVIEWS_URL;
        toForm.href = `/feedback/?stars=${picked}`;
        try {
          localStorage.setItem("jb.rated", JSON.stringify({ stars: picked, ts: Date.now() }));
        } catch (_) {}
      });
    });
    $("#rate-widget").addEventListener("mouseleave", () => {
      paint(picked);
      label.textContent = picked ? WORDS[picked] : "";
    });
  }

  const SAMPLE =
    '{"order":{"id":"ord_8123","status":"shipped","placed_at":"2026-07-28T09:14:02.118Z",' +
    '"customer":{"name":"Ada Sample","city":"Rotterdam","vip":false},' +
    '"items":[{"sku":"SKU-114","title":"Mechanical keyboard","qty":1,"price":129},' +
    '{"sku":"SKU-220","title":"USB-C cable, 2 m","qty":2,"price":11.5}],' +
    '"totals":{"subtotal":152,"tax":31.92,"discount":-10,"grand_total":173.92},' +
    '"tracking":{"carrier":"Zumelia Post","delivered":false,"events":["label_created","picked_up","in_transit"]},' +
    '"notes":null}}';
})();
