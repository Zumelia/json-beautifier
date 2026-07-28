/*
 * Юнит-тесты ядра.
 *
 * До выноса core.js эти проверки были невозможны: движок жил внутри
 * контент-скрипта и запускался только через симуляцию целой JSON-страницы.
 * Теперь функции проверяются напрямую — и ровно этим же кодом будет
 * пользоваться сайт, поэтому цена ошибки здесь выше, чем раньше.
 */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE = readFileSync(path.join(__dirname, "../core/core.js"), "utf8");

let pass = 0, fail = 0;
const results = [];
const check = (name, ok, detail = "") => {
  results.push([ok ? "✅" : "❌", name, detail]);
  ok ? pass++ : fail++;
};

const dom = new JSDOM(`<!doctype html><html><body><div id="host"></div></body></html>`, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
const { window } = dom;
window.eval(CORE);
const core = window.JSONBeautifierCore;
const host = () => window.document.getElementById("host");

// ---- 1. Экспорт ------------------------------------------------------------
{
  const api = ["parse", "prettyPrint", "minify", "sortDeep", "valueType", "count",
    "renderScalar", "safeChildKey", "fmtBytes", "el", "btn", "copyText", "flash", "renderTree"];
  const missing = api.filter((k) => typeof core?.[k] !== "function");
  check("ядро экспортировано целиком", missing.length === 0, "нет: " + missing.join(", "));

  // Проверяем КОД, а не комментарии: в шапке файла «chrome.*» упоминается словами.
  const codeOnly = CORE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  check("ядро не обращается к API расширений (chrome.* / browser.*)",
    !/\b(chrome|browser)\s*\.\s*[a-z]/.test(codeOnly));
  check("ядро не ходит в сеть (обещание zero network)",
    !/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/.test(codeOnly));
}

// ---- 2. parse: успех -------------------------------------------------------
{
  const r = core.parse('{"a":[1,2,{"b":null}]}');
  check("parse: валидный JSON разобран",
    r.ok === true && r.data.a[2].b === null, JSON.stringify(r).slice(0, 80));
}

// ---- 3. parse: ошибка несёт позицию, строку, колонку и контекст ------------
{
  const bad = '{\n  "a": 1\n  "b": 2\n}'; // пропущена запятая — ошибка на 3-й строке
  const r = core.parse(bad);
  check("parse: ошибка не бросает исключение", r.ok === false && !!r.error);
  check("parse: есть текст сообщения", typeof r.error.message === "string" && r.error.message.length > 0,
    r.error?.message);
  check("parse: позиция вычислена", typeof r.error.pos === "number", String(r.error?.pos));
  check("parse: строка ошибки — 3-я, а не 1-я",
    r.error.line === 3, `line=${r.error?.line} column=${r.error?.column}`);
  check("parse: колонка положительная", r.error.column >= 1, String(r.error?.column));
  check("parse: контекст с указателем", String(r.error.context).includes("▸"), r.error?.context);
}

// ---- 3b. parse: сообщение очищено от «at position N» -----------------------
// Сырой текст V8 — «… in JSON at position 282 (line 7 column 5)». Смещение в
// символах человеку не говорит ничего, строку и колонку мы показываем отдельно.
{
  const bad = '{\n  "id": "ord_8126"\n  "status": "pending"\n}';
  const r = core.parse(bad);
  check("сообщение: без «at position N»", !/at position/i.test(r.error.message), r.error.message);
  check("сообщение: без «(line N column N)»", !/\(line \d+ column \d+\)/i.test(r.error.message),
    r.error.message);
  check("сообщение: без хвоста «in JSON»", !/\bin JSON$/i.test(r.error.message), r.error.message);
  check("сообщение: смысл сохранён", r.error.message.length > 5, r.error.message);
  check("сырое сообщение доступно отдельно", /at position/i.test(r.error.rawMessage || ""),
    r.error.rawMessage);
  check("отдана сама строка с ошибкой", r.error.lineText === '  "status": "pending"',
    JSON.stringify(r.error.lineText));
}

// ---- 4. parse: ошибка без позиции не ломает разбор -------------------------
{
  const r = core.parse("");
  check("parse: пустая строка → честная ошибка, не исключение", r.ok === false && !!r.error.message);
}

// ---- 5. prettyPrint --------------------------------------------------------
{
  const data = { b: 1, a: { d: 2, c: 3 } };
  const two = core.prettyPrint(data, { indent: 2 });
  const four = core.prettyPrint(data, { indent: 4 });
  check("prettyPrint: отступ 2", two.includes('\n  "b"'), JSON.stringify(two.slice(0, 24)));
  check("prettyPrint: отступ 4", four.includes('\n    "b"'), JSON.stringify(four.slice(0, 24)));
  check("prettyPrint: порядок ключей сохранён без sortKeys",
    two.indexOf('"b"') < two.indexOf('"a"'));
  const sorted = core.prettyPrint(data, { indent: 2, sortKeys: true });
  check("prettyPrint: sortKeys сортирует на всех уровнях",
    sorted.indexOf('"a"') < sorted.indexOf('"b"') && sorted.indexOf('"c"') < sorted.indexOf('"d"'));
  check("prettyPrint: undefined → null, без исключения", core.prettyPrint(undefined) === null);
  const cyclic = {};
  cyclic.self = cyclic;
  check("prettyPrint: цикл → null, без исключения", core.prettyPrint(cyclic) === null);
}

// ---- 6. sortDeep не теряет __proto__ (ловушка сеттера) ---------------------
{
  const parsed = core.parse('{"__proto__":{"a":1},"b":2}');
  const out = core.prettyPrint(parsed.data, { indent: 0, sortKeys: true });
  check("sortKeys: ключ __proto__ не потерян", out.includes("__proto__"), out.slice(0, 60));
}

// ---- 7. minify -------------------------------------------------------------
{
  const r = core.minify('{\n  "a" : [1, 2],\n  "b": "x"\n}');
  check("minify: пробелы убраны", r.ok === true && r.text === '{"a":[1,2],"b":"x"}', r.text);
  const bad = core.minify("{oops}");
  check("minify: битый вход → ошибка, а не исключение", bad.ok === false && !!bad.error.message);
}

// ---- 8. Мелкие помощники ---------------------------------------------------
{
  check("valueType различает null/array/object",
    core.valueType(null) === "null" && core.valueType([]) === "array" && core.valueType({}) === "object");
  check("count: массив и объект", core.count([1, 2, 3]) === 3 && core.count({ a: 1 }) === 1);
  check("count: скаляр → 0", core.count(5) === 0 && core.count(null) === 0);
  check("safeChildKey: идентификатор через точку", core.safeChildKey("abc") === ".abc");
  check("safeChildKey: дефис — через скобки и кавычки",
    core.safeChildKey("content-type") === '["content-type"]', core.safeChildKey("content-type"));
  check("fmtBytes: B/KB/MB",
    core.fmtBytes(512) === "512 B" && core.fmtBytes(2048) === "2.0 KB" && core.fmtBytes(3145728) === "3.0 MB");
}

// ---- 9. renderTree: базовая отрисовка --------------------------------------
{
  host().textContent = "";
  const h = core.renderTree(host(), { name: "Ada", tags: ["x", "y"] }, { treeId: "t1" });
  check("renderTree: элемент возвращён и вставлен",
    h.element.parentNode === host() && h.element.id === "t1");
  check("renderTree: класс дерева", h.element.classList.contains("jsoneat-treeview"));
  check("renderTree: ключи отрисованы", h.element.querySelectorAll(".jsoneat-key").length >= 2);
  check("renderTree: строковое значение помечено типом",
    !!h.element.querySelector(".jsoneat-v-string"));
  h.destroy();
  check("renderTree: destroy убирает дерево из DOM", host().children.length === 0);
}

// ---- 10. renderTree: отступ зависит от indent ------------------------------
{
  host().textContent = "";
  const h2 = core.renderTree(host(), { outer: { inner: 1 } }, { indent: 2 });
  const pad2 = h2.element.querySelectorAll(".jsoneat-line")[1]?.style.paddingLeft;
  h2.destroy();
  const h4 = core.renderTree(host(), { outer: { inner: 1 } }, { indent: 4 });
  const pad4 = h4.element.querySelectorAll(".jsoneat-line")[1]?.style.paddingLeft;
  h4.destroy();
  check("renderTree: indent 2 → 24px на первом уровне", pad2 === "24px", String(pad2));
  check("renderTree: indent 4 → 40px", pad4 === "40px", String(pad4));
}

// ---- 11. renderTree: большой массив ленив ----------------------------------
{
  host().textContent = "";
  const big = Array.from({ length: 5000 }, (_, i) => ({ id: i, label: "row_" + i }));
  const t0 = Date.now();
  const h = core.renderTree(host(), big, {});
  const ms = Date.now() - t0;
  const nodes = h.element.querySelectorAll(".jsoneat-node").length;
  check("renderTree: 5000 элементов монтируются быстро (<1500ms)", ms < 1500, ms + "ms");
  check("renderTree: отрисовано окно, а не весь массив", nodes < 1000, "nodes=" + nodes);

  // ---- 12. search находит за пределами первого окна ------------------------
  const hits = h.search("row_4999");
  const marked = h.element.querySelectorAll(".jsoneat-hit").length;
  check("search: находит совпадение за пределами окна рендера",
    hits >= 1 && marked >= 1, `hits=${hits} marked=${marked}`);
  check("search: пустой запрос снимает подсветку",
    h.search("") === 0 && h.element.querySelectorAll(".jsoneat-hit").length === 0);
  h.destroy();
}

// ---- 12b. Бюджет разметки на строку ----------------------------------------
// Скорость вьювера упирается в то, сколько всего умножается на число строк.
// Любое «украшение», которое добавит узел в КАЖДУЮ строку, умножится на тысячи
// и оплатится раскладкой и отрисовкой. Этот тест ловит такую правку: сам он
// краску не измеряет (jsdom её не делает), но структурный рост поймает.
{
  host().textContent = "";
  const data = { items: Array.from({ length: 5000 }, (_, i) => ({ id: i, name: "row " + i })) };

  const plain = core.renderTree(host(), data, { lineNumbers: false });
  const plainRows = plain.element.querySelectorAll(".jsoneat-line").length;
  const plainNodes = plain.element.querySelectorAll("*").length;
  const perRow = plainNodes / plainRows;
  check("разметка: не больше 12 узлов на строку", perRow <= 12, perRow.toFixed(1) + " узла/строка");
  plain.destroy();

  const numbered = core.renderTree(host(), data, { lineNumbers: true });
  const numberedNodes = numbered.element.querySelectorAll("*").length;
  check("нумерация строк не добавляет ни одного узла (CSS-счётчики, не <span>)",
    numberedNodes === plainNodes, `${plainNodes} → ${numberedNodes}`);
  check("нумерация включается классом на дереве, а не разметкой строк",
    numbered.element.classList.contains("jsoneat-lines"));
  numbered.destroy();
}

// ---- 13. setAllCollapsed ---------------------------------------------------
{
  host().textContent = "";
  const h = core.renderTree(host(), { a: { b: { c: 1 } } }, {});
  const root = () => h.element.querySelector(".jsoneat-node");
  check("setAllCollapsed(true): корень свёрнут",
    (h.setAllCollapsed(true), root().classList.contains("jsoneat-collapsed")));
  check("setAllCollapsed(false): корень развёрнут",
    (h.setAllCollapsed(false), !root().classList.contains("jsoneat-collapsed")));
  h.destroy();
}

// ---- 14. Экранирование: значения остаются текстом, а не HTML ---------------
{
  host().textContent = "";
  const h = core.renderTree(host(), { h: "<img src=x onerror=alert(1)>" }, {});
  check("XSS: значение не превратилось в разметку",
    h.element.querySelectorAll("img").length === 0 &&
    h.element.textContent.includes("<img"));
  h.destroy();
}

// ---- 15. Два дерева на одной странице не мешают друг другу -----------------
// Для сайта это обязательное свойство: поиск не должен цеплять чужое дерево.
{
  host().textContent = "";
  const a = core.renderTree(host(), { alpha: "match_me" }, {});
  const b = core.renderTree(host(), { beta: "match_me" }, {});
  a.search("match_me");
  check("две независимые копии дерева: подсветка только в своём",
    a.element.querySelectorAll(".jsoneat-hit").length >= 1 &&
    b.element.querySelectorAll(".jsoneat-hit").length === 0);
  a.destroy();
  b.destroy();
}

console.log("");
for (const [m, n, d] of results) console.log(`  ${m} ${n}${d ? "  — " + d : ""}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
