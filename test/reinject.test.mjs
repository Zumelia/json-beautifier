/*
 * Guard от двойного запуска контент-скрипта.
 *
 * После установки service worker инжектит content.js в уже открытые вкладки
 * (курс 2.6). Та же вкладка при следующей навигации получит ещё и декларативный
 * контент-скрипт из manifest. Без защиты вьювер построится дважды: два тулбара,
 * два дерева, поломанный поиск. Это ровно та "детская болячка", ради отлова
 * которых пилот и делается.
 */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = readFileSync(path.join(__dirname, "../src/content.js"), "utf8");

let pass = 0, fail = 0;
const results = [];
const check = (name, ok, detail = "") => {
  results.push([ok ? "✅" : "❌", name, detail]);
  ok ? pass++ : fail++;
};

function makeJsonDoc() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "https://api.example.com/data.json",
    contentType: "text/html",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });
  const { window } = dom;
  const doc = window.document;
  Object.defineProperty(doc, "contentType", { value: "application/json", configurable: true });
  doc.body.innerHTML = `<pre>{"a":1,"b":[1,2,3]}</pre>`;
  const store = {};
  window.chrome = {
    runtime: { getURL: (p) => "chrome-extension://test/" + p, lastError: null, id: "test" },
    storage: { local: {
      get: (defs, cb) => cb({ ...defs, ...store }),
      set: (obj) => Object.assign(store, obj),
    } },
  };
  window.__copied = [];
  window.navigator.clipboard = { writeText: (t) => (window.__copied.push(t), Promise.resolve()) };
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.getComputedStyle = window.getComputedStyle || (() => ({}));
  return { window, doc };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// ---- 1. Одиночный запуск строит ровно один вьювер -------------------------
{
  const { window, doc } = makeJsonDoc();
  window.eval(CONTENT);
  await flush();
  const roots = doc.querySelectorAll("#jsoneat-root").length;
  const bars = doc.querySelectorAll(".jsoneat-toolbar").length;
  check("одиночный инжект: один вьювер", roots === 1 && bars === 1, `root=${roots} toolbar=${bars}`);
}

// ---- 2. Двойной запуск в ТОЙ ЖЕ вкладке не дублирует вьювер ---------------
{
  const { window, doc } = makeJsonDoc();
  window.eval(CONTENT);
  await flush();
  window.eval(CONTENT); // второй инжект: SW + декларативный скрипт
  await flush();
  const roots = doc.querySelectorAll("#jsoneat-root").length;
  const bars = doc.querySelectorAll(".jsoneat-toolbar").length;
  check("двойной инжект: вьювер НЕ продублирован", roots === 1 && bars === 1,
    `root=${roots} toolbar=${bars}`);
  check("двойной инжект: guard выставлен", window.__jsonBeautifierLoaded === true);
}

// ---- 3. Guard не мешает работе на не-JSON странице ------------------------
{
  const dom = new JSDOM(`<!doctype html><html><body><p>обычная страница</p></body></html>`, {
    url: "https://example.com/", contentType: "text/html",
    pretendToBeVisual: true, runScripts: "dangerously",
  });
  const { window } = dom;
  Object.defineProperty(window.document, "contentType", { value: "text/html", configurable: true });
  window.chrome = { runtime: { getURL: (p)=>p, lastError:null, id:"t" },
    storage: { local: { get:(d,cb)=>cb(d), set(){} } } };
  window.eval(CONTENT);
  await flush();
  window.eval(CONTENT);
  await flush();
  check("не-JSON страница остаётся нетронутой после двух инжектов",
    !window.document.getElementById("jsoneat-root") &&
    window.document.querySelector("p")?.textContent === "обычная страница");
}

console.log("");
for (const [m, n, d] of results) console.log(`  ${m} ${n}${d ? "  — " + d : ""}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
