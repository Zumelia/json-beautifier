// Test harness: load content.js into a jsdom document that simulates Chrome's
// raw-JSON rendering, then assert the viewer behaves. Covers the "childhood
// bugs" the niche pain map warns about: silent failure, big-file hang,
// touching non-JSON pages, broken copy, theme, search.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE = readFileSync(path.join(__dirname, "../core/core.js"), "utf8");
const CONTENT = readFileSync(path.join(__dirname, "../extension-chrome/src/content.js"), "utf8");

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; results.push(["✓", name, ""]); }
  else { fail++; results.push(["✗", name, detail]); }
}

// Build a jsdom that mimics how Chrome renders a given raw body.
function makeDoc({ contentType, bodyHTML, bodyText, store: initStore }) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "https://api.example.com/data.json",
    contentType: "text/html",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });
  const { window } = dom;
  const doc = window.document;
  Object.defineProperty(doc, "contentType", { value: contentType, configurable: true });
  if (bodyHTML != null) doc.body.innerHTML = bodyHTML;
  if (bodyText != null) doc.body.textContent = bodyText;

  // Minimal chrome shim
  const store = { ...(initStore||{}) };
  window.chrome = {
    runtime: {
      getURL: (p) => "chrome-extension://test/" + p, lastError: null, id: "test",
      onMessage: { addListener: (fn) => { window.__onMsg = fn; } },
      sendMessage: (m, cb) => { (window.__sent = window.__sent || []).push(m); cb && cb(); },
    },
    storage: { local: {
      get: (defs, cb) => cb({ ...defs, ...store }),
      set: (obj) => Object.assign(store, obj),
    } },
  };
  // clipboard shim capturing writes
  window.__copied = [];
  window.navigator.clipboard = { writeText: (t) => (window.__copied.push(t), Promise.resolve()) };
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.getComputedStyle = window.getComputedStyle || (() => ({}));
  return { window, doc };
}

async function run(ctx) {
  const { window } = ctx;
  window.eval(CORE); // ядро — как первый файл в content_scripts
  window.eval(CONTENT);
  // render() is deferred to a microtask; flush micro + one macro task.
  await new Promise((r) => setTimeout(r, 0));
  return ctx;
}

// ---- Case 1: valid JSON object renders a tree, leaves normal page alone ---
{
  const json = JSON.stringify({
    name: "Ada", age: 36, active: true, tags: ["x", "y"],
    nested: { a: 1, b: { c: null } }, "weird key": 5,
  });
  const { window, doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${json}</pre>` }));
  check("valid JSON: root mounts", !!doc.getElementById("jsoneat-root"));
  check("valid JSON: tree built", !!doc.getElementById("jsoneat-tree"));
  check("valid JSON: toolbar present", !!doc.querySelector(".jsoneat-toolbar"));
  check("valid JSON: keys rendered", doc.querySelectorAll(".jsoneat-key").length >= 4,
    "keys=" + doc.querySelectorAll(".jsoneat-key").length);
  check("valid JSON: string value class", !!doc.querySelector(".jsoneat-v-string"));
  check("valid JSON: original <pre> removed", !doc.querySelector("body > pre.original") && doc.querySelectorAll("pre").length === 0);
  // copy path
  const key = doc.querySelector(".jsoneat-key");
  key.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("copy path writes to clipboard", window.__copied.length >= 1, JSON.stringify(window.__copied));
}

// ---- Case 2: invalid JSON with json content-type → visible error, not silent
{
  const bad = '{"a": 1, "b": }';
  const { doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${bad}</pre>` }));
  check("invalid JSON: error surfaced (not silent)", !!doc.querySelector(".jsoneat-error"));
  check("invalid JSON: raw preserved", !!doc.querySelector(".jsoneat-raw"));
}

// ---- Case 3: normal HTML page is NOT touched -------------------------------
{
  const { doc } = await run(makeDoc({ contentType: "text/html", bodyHTML: `<h1>Hello</h1><p>Not JSON</p>` }));
  check("HTML page untouched", !doc.getElementById("jsoneat-root"));
  check("HTML page keeps its DOM", !!doc.querySelector("h1"));
}

// ---- Case 4: untyped text that isn't JSON is left alone --------------------
{
  const { doc } = await run(makeDoc({ contentType: "text/plain", bodyHTML: `<pre>just some log line, not json</pre>` }));
  check("plain text (non-JSON) untouched", !doc.getElementById("jsoneat-root"));
}

// ---- Case 5: untyped text that IS json ({...}) gets formatted --------------
{
  const { doc } = await run(makeDoc({ contentType: "text/plain", bodyHTML: `<pre>{"ok":true}</pre>` }));
  check("plain-text JSON gets formatted", !!doc.getElementById("jsoneat-tree"));
}

// ---- Case 6: top-level array -----------------------------------------------
{
  const arr = JSON.stringify([1, 2, { x: 3 }]);
  const { doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${arr}</pre>` }));
  check("top-level array renders", !!doc.getElementById("jsoneat-tree"));
  check("array bracket present", !!doc.querySelector(".jsoneat-bracket"));
}

// ---- Case 7: big file → lazy, doesn't render every node up front -----------
{
  const big = JSON.stringify({ items: Array.from({ length: 20000 }, (_, i) => ({ id: i, v: "row" + i })) });
  const t0 = Date.now();
  const { doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${big}</pre>` }));
  const ms = Date.now() - t0;
  const nodesRendered = doc.querySelectorAll(".jsoneat-node").length;
  check("big file: mounts quickly (<1500ms)", ms < 1500, ms + "ms");
  check("big file: lazy — not all 20k rows rendered up front", nodesRendered < 5000,
    "rendered=" + nodesRendered);
}

// ---- Case 8: XSS — malicious strings are text, never HTML ------------------
{
  const evil = JSON.stringify({ h: "<img src=x onerror=alert(1)>", k: "</pre><script>bad()</script>" });
  const { doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${evil.replace(/</g, "&lt;")}</pre>` }));
  check("XSS: no <img> injected", doc.querySelectorAll("#jsoneat-tree img").length === 0);
  check("XSS: no rogue <script>", doc.querySelectorAll("#jsoneat-tree script").length === 0);
}

// ---- Case 9: empty body / edge inputs don't throw --------------------------
{
  let threw = false;
  try { await run(makeDoc({ contentType: "application/json", bodyHTML: `` })); }
  catch (e) { threw = true; }
  check("empty body: no throw", !threw);
}

// ---- Case 10: deep+wide auto-expand is budget-bounded (the found BLOCKER) ---
{
  // wide (60) x deep (3) — naive auto-expand at depth 3 would be ~60^3=216k nodes.
  const wide = (d) => d === 0 ? 1 : Object.fromEntries(Array.from({length:60},(_,i)=>["k"+i, wide(d-1)]));
  const deepWide = JSON.stringify(wide(3));
  const t0 = Date.now();
  const { doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${deepWide}</pre>` }));
  const ms = Date.now() - t0;
  const nodes = doc.querySelectorAll(".jsoneat-node").length;
  check("deep+wide: mounts fast (<1500ms)", ms < 1500, ms + "ms");
  check("deep+wide: node count bounded (<3000, no 60^3 blow-up)", nodes < 3000, "nodes=" + nodes);
}

// ---- Case 11: search finds a value BEYOND the first render window ----------
{
  const arr = JSON.stringify(Array.from({length:500},(_,i)=>({id:i,label:"row_"+i})));
  const { window, doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${arr}</pre>` }));
  const search = doc.querySelector(".jsoneat-search");
  search.value = "row_450";               // item 450 — well past the 100 window
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await new Promise((r)=>setTimeout(r, 250)); // debounce + reveal
  const hits = doc.querySelectorAll(".jsoneat-hit");
  const found = [...hits].some((l)=>l.textContent.includes("row_450"));
  check("search: finds match beyond first window", found, "hits=" + hits.length);
}

// ---- Case 12: non-identifier keys display as the real name ----------------
{
  const j = JSON.stringify({ "content-type": "application/json", "user name": 1, "café": 2 });
  const { doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${j}</pre>` }));
  const keyTexts = [...doc.querySelectorAll(".jsoneat-key")].map((k)=>k.textContent);
  check("keys: 'content-type' shown as name, not [\"content-type\"]",
    keyTexts.includes("content-type"), JSON.stringify(keyTexts));
  check("keys: unicode key 'café' shown raw", keyTexts.includes("café"), JSON.stringify(keyTexts));
}

// ---- Case 13: __proto__ key preserved when Copy JSON with sortKeys ---------
{
  const j = '{"__proto__":{"a":1},"b":2}';
  const { window, doc } = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${j}</pre>`, store: { sortKeys: true } }));
  const copyBtn = [...doc.querySelectorAll(".jsoneat-btn")].find((b)=>b.textContent==="Copy JSON");
  window.__copied = [];
  copyBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r)=>setTimeout(r, 20));
  const copied = window.__copied.join("");
  check("Copy JSON (sorted): __proto__ key not dropped", copied.includes("__proto__"), copied.slice(0,80));
}

// ---- Case 14: text/html page whose body is one <pre> of JSON is NOT hijacked
{
  const { doc } = await run(makeDoc({ contentType: "text/html", bodyHTML: `<pre>{"a":1}</pre>` }));
  check("text/html single-pre JSON not hijacked", !doc.getElementById("jsoneat-root"));
}

// ---- Case 15: modern Chrome DOM — pre + native json-formatter-container ----
// Chrome 2025+ добавляет <div class="json-formatter-container"> (чекбокс
// "Автоформатировать" в закрытом shadow root) РЯДОМ с <pre>. Гейт обязан
// принимать эту пару как raw-JSON страницу — иначе расширение мертво во всём
// современном Chrome (найдено Кириллом при ручном тесте 2026-07-23).
{
  const { doc } = await run(makeDoc({
    contentType: "application/json",
    bodyHTML: `<pre>{"a":1,"b":[1,2]}</pre><div class="json-formatter-container"></div>`,
  }));
  check("modern Chrome: pre + native viewer container → наш вьювер строится",
    !!doc.getElementById("jsoneat-root"));
  check("modern Chrome: нативный контейнер удалён при монтировании",
    !doc.querySelector(".json-formatter-container"));
}

// ---- Case 16: pre + ОБЫЧНЫЙ div → это настоящая страница, не трогаем -------
{
  const { doc } = await run(makeDoc({
    contentType: "text/html",
    bodyHTML: `<pre>{"a":1}</pre><div class="sidebar">menu</div>`,
  }));
  check("pre + обычный div: страница НЕ захвачена",
    !doc.getElementById("jsoneat-root"));
}

// ---- Case 17: два pre → не raw-JSON страница, не трогаем -------------------
{
  const { doc } = await run(makeDoc({
    contentType: "text/html",
    bodyHTML: `<pre>{"a":1}</pre><pre>{"b":2}</pre>`,
  }));
  check("два pre: страница НЕ захвачена", !doc.getElementById("jsoneat-root"));
}

// ---- Case 18: живые настройки — сообщение из попапа применяется сразу ------
{
  const { window, doc } = await run(makeDoc({
    contentType: "application/json",
    bodyHTML: `<pre>{"b":1,"a":2}</pre>`,
  }));
  const firstKeyBefore = doc.querySelector(".jsoneat-key")?.textContent;
  window.__onMsg({ type: "jsoneat-settings",
    settings: { theme: "dark", indent: 2, expandDepth: 2, sortKeys: true } });
  await new Promise((r) => setTimeout(r, 10));
  const firstKeyAfter = doc.querySelector(".jsoneat-key")?.textContent;
  check("live settings: тема применена без перезагрузки",
    doc.documentElement.getAttribute("data-jsoneat") === "dark");
  check("live settings: sortKeys перестроил дерево (b→a)",
    firstKeyBefore === "b" && firstKeyAfter === "a",
    `до=${firstKeyBefore} после=${firstKeyAfter}`);
  check("live settings: вьювер один, не задублирован",
    doc.querySelectorAll("#jsoneat-root").length === 1);
}

// ---- Case 18b: indent реально меняет отступ дерева (баг v0.2.2) ------------
// Раньше отступ был захардкожен depth*14px, настройка Indent не делала ничего.
{
  const { window, doc } = await run(makeDoc({
    contentType: "application/json",
    bodyHTML: `<pre>{"outer":{"inner":1}}</pre>`,
    store: { indent: 2 },
  }));
  const nested = () => {
    // Строка глубины 1 ("outer"). Отступ висит на первом потомке, а не на самой
    // строке: иначе номер строки уезжал бы вправо вместе с отступом.
    const lines = [...doc.querySelectorAll(".jsoneat-line")];
    return lines[1] ? lines[1].querySelector(".jsoneat-twisty").style.marginLeft : null;
  };
  const before = nested();
  window.__onMsg({ type: "jsoneat-settings",
    settings: { theme: "auto", indent: 4, expandDepth: 2, sortKeys: false } });
  await new Promise((r) => setTimeout(r, 10));
  const after = nested();
  check("indent: 2 → 24px на 1-м уровне", before === "24px", `факт=${before}`);
  check("indent: живая смена на 4 → 40px", after === "40px", `факт=${after}`);
}

// ---- Case 19: DOM-guard — свежий isolated world над старым вьювером --------
// disable→enable: Chrome пересоздаёт isolated world (флаг window пуст), но
// вьювер прошлой жизни остался в DOM. Повторный запуск обязан молча выйти,
// а не превратить страницу в parse-ошибку.
{
  const { window, doc } = await run(makeDoc({
    contentType: "application/json",
    bodyHTML: `<pre>{"a":1}</pre>`,
  }));
  delete window.__jsonBeautifierLoaded; // имитация нового isolated world
  window.eval(CONTENT);
  await new Promise((r) => setTimeout(r, 10));
  check("DOM-guard: вьювер не задублирован и не сломан",
    doc.querySelectorAll("#jsoneat-root").length === 1 &&
    !doc.querySelector(".jsoneat-error"));
}

// ---- Case 20: тулбар v0.2.5 — brand-клик, collapse-toggle, raw-toggle, тема справа
{
  const { window, doc } = await run(makeDoc({
    contentType: "application/json",
    bodyHTML: `<pre>{"a":{"b":1}}</pre>`,
  }));
  const bar = doc.querySelector(".jsoneat-toolbar");
  check("тулбар: название — первый элемент",
    bar.firstElementChild?.classList.contains("jsoneat-brand"));
  check("тулбар: шестерёнка — самый правый элемент",
    bar.lastElementChild?.classList.contains("jsoneat-settings"));
  check("тулбар: тема — предпоследняя (перед шестерёнкой)",
    bar.children[bar.children.length - 2]?.classList.contains("jsoneat-theme"));

  // клик по названию больше НЕ шлёт open-settings (v0.2.6)
  bar.firstElementChild.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("brand-клик: ничего не отправляет",
    !(window.__sent || []).some((m) => m && m.type === "open-settings"));

  // а клик по шестерёнке — шлёт
  bar.lastElementChild.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("шестерёнка: отправлен open-settings",
    (window.__sent || []).some((m) => m && m.type === "open-settings"));
  check("шестерёнка: SVG-иконка 18px, не текстовый глиф",
    !!bar.lastElementChild.querySelector('svg[width="18"]'));

  // тема — двухшаговый переключатель (баг v0.2.6: «пустой» клик через auto)
  const themeBtn = doc.querySelector(".jsoneat-theme");
  const attr = () => doc.documentElement.getAttribute("data-jsoneat");
  const before20 = attr();
  themeBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  const after1 = attr();
  themeBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  check("тема: каждый клик видимо меняет тему (light⇄dark, без пустого шага)",
    before20 === "light" && after1 === "dark" && attr() === "light",
    `${before20}→${after1}→${attr()}`);

  // collapse/expand — один toggle
  const ex = doc.querySelector(".jsoneat-exptoggle");
  const rootNode = () => doc.querySelector(".jsoneat-node");
  check("exp-toggle: исходная подпись 'Collapse all'", ex.textContent === "Collapse all");
  ex.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  check("exp-toggle: после клика всё свёрнуто, подпись 'Expand all'",
    ex.textContent === "Expand all" && rootNode().classList.contains("jsoneat-collapsed"),
    `label=${ex.textContent}`);
  ex.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  check("exp-toggle: обратно 'Collapse all', корень развёрнут",
    ex.textContent === "Collapse all" && !rootNode().classList.contains("jsoneat-collapsed"));

  // raw-toggle как раньше
  const toggle = doc.querySelector(".jsoneat-rawtoggle");
  const tree = () => doc.getElementById("jsoneat-tree");
  check("raw-toggle: исходная подпись 'Raw'", toggle.textContent === "Raw");
  toggle.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  check("raw-toggle: после клика подпись 'Format', дерево скрыто",
    toggle.textContent === "Format" && tree().style.display === "none");
  toggle.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  check("raw-toggle: обратно 'Raw', дерево видно",
    toggle.textContent === "Raw" && tree().style.display !== "none");
}

// ---- Case 21: экран ошибки — номер строки, переход и каретка ---------------
// Жалоба Кирилла (2026-07-28): «position 282» читается неудобно, а ошибка может
// быть на 200-й строке — сообщение наверху, сама ошибка далеко внизу за экраном.
{
  const bad = '{\n  "a": 1,\n  "b": {\n    "c": 2\n    "d": 3\n  }\n}';
  const { window, doc } = await run(makeDoc({
    contentType: "application/json", bodyHTML: `<pre>${bad}</pre>`,
  }));

  const msg = doc.querySelector(".jsoneat-error-msg")?.textContent || "";
  check("ошибка: в тексте нет «at position N»", !/at position/i.test(msg), msg);

  const jump = doc.querySelector(".jsoneat-error-jump");
  check("ошибка: есть кнопка перехода к строке", !!jump, jump ? jump.textContent : "нет");
  check("ошибка: кнопка называет строку и колонку",
    /line\s*5,\s*column\s*\d+/i.test(jump?.textContent || ""), jump?.textContent);

  const ctx = doc.querySelector(".jsoneat-error-ctx");
  check("ошибка: показан фрагмент исходника с кареткой",
    !!ctx && ctx.textContent.includes('"d": 3') && ctx.textContent.includes("^"),
    JSON.stringify(ctx?.textContent || "").slice(0, 90));

  // Переход подсвечивает нужную строку
  check("ошибка: до перехода ничего не подсвечено", !doc.querySelector(".jsoneat-rawrow-hit"));
  jump.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  const hit = doc.querySelector(".jsoneat-rawrow-hit");
  check("ошибка: после перехода подсвечена именно 5-я строка",
    !!hit && hit.querySelector(".jsoneat-rawnum")?.textContent === "5",
    hit ? hit.textContent.slice(0, 40) : "нет подсветки");

  // Управление, которому нужно дерево, гасится — и у каждой кнопки в подсказке
  // своя причина, иначе неактивность читается как поломка. Прятать пробовали,
  // Кириллу так менее понятно (2026-07-28).
  const rawToggle = doc.querySelector(".jsoneat-rawtoggle");
  const searchInput = doc.querySelector(".jsoneat-search");
  const expToggle = doc.querySelector(".jsoneat-exptoggle");
  check("ошибка: поиск и сворачивание погашены", searchInput.disabled && expToggle.disabled);
  check("ошибка: у поиска и сворачивания объяснена причина",
    /didn’t parse/.test(searchInput.title) && /didn’t parse/.test(expToggle.title));
  check("ошибка: элементы на месте, а не спрятаны",
    searchInput.style.display !== "none" && rawToggle.style.display !== "none");

  // Исходник есть всегда, поэтому Raw не «недоступен» — он уже показан.
  check("ошибка: Raw помечен как нажатый, а не просто погашенный",
    rawToggle.getAttribute("aria-pressed") === "true" && rawToggle.disabled);
  check("ошибка: подсказка у Raw объясняет «вы уже здесь»",
    /Already showing the source/.test(rawToggle.title), rawToggle.title);

  const copyBtn = [...doc.querySelectorAll(".jsoneat-btn")].find((b) => b.textContent === "Copy JSON");
  check("ошибка: Copy JSON и настройки работают",
    !copyBtn.disabled && !doc.querySelector(".jsoneat-settings").disabled);
  rawToggle.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  check("ошибка: raw остался на экране после клика по отключённой кнопке",
    doc.querySelector(".jsoneat-rawwrap").style.display !== "none");
}

// ---- Case 21b: минифицированный JSON — перенос обязателен ------------------
// Реальный raw-JSON почти всегда в одну строку. Запрет переноса ради ровных
// номеров означал бы строку шириной в миллионы пикселей, которую браузер
// просто не рисует (баг, найденный Кириллом на large.json 2026-07-28).
{
  const rows = Array.from({ length: 300 }, (_, i) => `{"id":${i},"t":"x"}`).join(",");
  const min = `{"rows":[${rows}]}`;
  const { window, doc } = await run(makeDoc({
    contentType: "application/json", bodyHTML: `<pre>${min}</pre>`,
  }));
  doc.querySelector(".jsoneat-rawtoggle").dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));

  const raw = doc.querySelector(".jsoneat-raw");
  check("минифицированный: содержимое raw на месте целиком",
    !!raw && raw.textContent.length === min.length,
    `${raw ? raw.textContent.length : 0} из ${min.length}`);
  check("минифицированный: одна строка → нумерации нет",
    doc.querySelectorAll(".jsoneat-rawnum").length === 0);
  check("минифицированный: короткая строка показана как есть, без переноса",
    !!doc.querySelector(".jsoneat-raw-plain"));
}

// ---- Case 21d: строка, которую браузер не в силах нарисовать ---------------
// На large.json (2,3 МБ в одну строку) Chrome заводил область прокрутки, но
// текст не рисовал вовсе: пустой экран со скроллбаром (скриншот Кирилла).
// Пустота хуже переноса, поэтому за порогом переносим и объясняем почему.
{
  const huge = '{"blob":"' + "x".repeat(60000) + '"}';
  const { window, doc } = await run(makeDoc({
    contentType: "application/json", bodyHTML: `<pre>${huge}</pre>`,
  }));
  doc.querySelector(".jsoneat-rawtoggle").dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));

  check("сверхдлинная строка: включён перенос вместо пустого экрана",
    !!doc.querySelector(".jsoneat-raw-wrapped") && !doc.querySelector(".jsoneat-raw-plain"));
  check("сверхдлинная строка: текст отдан целиком",
    doc.querySelector(".jsoneat-raw")?.textContent.length === huge.length);
  const note = doc.querySelector(".jsoneat-rawnote");
  check("сверхдлинная строка: объяснено, почему перенесли",
    !!note && /characters long/.test(note.textContent), note ? note.textContent.slice(0, 60) : "нет");
}

// ---- Case 21c: нумерация строк в ДЕРЕВЕ ------------------------------------
// Уточнение Кирилла 2026-07-28: номера нужны в отформатированном виде, а не в
// raw. Сама нумерация — CSS-счётчики (jsdom их не считает), поэтому здесь
// проверяем контракт: дерево помечено классом, по которому работает CSS.
{
  const src = '{"a": {"b": 1}}';
  const on = await run(makeDoc({ contentType: "application/json", bodyHTML: `<pre>${src}</pre>` }));
  check("дерево: нумерация включена по умолчанию",
    on.doc.getElementById("jsoneat-tree").classList.contains("jsoneat-lines"));

  const off = await run(makeDoc({
    contentType: "application/json", bodyHTML: `<pre>${src}</pre>`,
    store: { lineNumbers: false },
  }));
  check("дерево: настройка lineNumbers=false снимает нумерацию",
    !off.doc.getElementById("jsoneat-tree").classList.contains("jsoneat-lines"));

  // Живая смена настройки должна перестраивать дерево с новым режимом
  off.window.__onMsg({ type: "jsoneat-settings",
    settings: { theme: "auto", indent: 2, expandDepth: 2, sortKeys: false, lineNumbers: true } });
  await new Promise((r) => setTimeout(r, 10));
  check("дерево: нумерация включается живьём, без перезагрузки",
    off.doc.getElementById("jsoneat-tree").classList.contains("jsoneat-lines"));
}

// ---- Case 22: обычный raw-режим — БЕЗ номеров ------------------------------
// Уточнение Кирилла 2026-07-28: в raw номера не нужны, там смотрят исходник как
// есть. Номера живут в дереве; в raw они остаются только на экране ошибки.
{
  const src = '{\n  "a": 1,\n  "b": 2\n}';
  const { window, doc } = await run(makeDoc({
    contentType: "application/json", bodyHTML: `<pre>${src}</pre>`,
  }));
  doc.querySelector(".jsoneat-rawtoggle").dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));

  check("raw: номеров нет — они живут в дереве",
    doc.querySelectorAll(".jsoneat-rawnum").length === 0);
  check("raw: исходный текст отдан дословно",
    doc.querySelector(".jsoneat-raw")?.textContent === src);
  check("raw: используется вариант с переносом строк",
    !!doc.querySelector(".jsoneat-raw-plain"));
  check("raw: второй экземпляр не создан",
    doc.querySelectorAll(".jsoneat-rawwrap").length === 1);
}

// ---- Report ---------------------------------------------------------------
console.log("");
for (const [m, name, d] of results) console.log(`  ${m} ${name}${d ? "  — " + d : ""}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
