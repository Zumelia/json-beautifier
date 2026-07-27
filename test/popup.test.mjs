/*
 * Тест попапа: главный сценарий v0.2.5 — попап при открытии инжектит
 * контент-скрипт в открытые вкладки НАПРЯМУЮ (не полагаясь на service
 * worker, который Chrome не стартует после disable→enable).
 */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POPUP = readFileSync(path.join(__dirname, "../extension-chrome/src/popup.js"), "utf8");

let pass = 0, fail = 0;
const results = [];
const check = (name, ok, detail = "") => {
  results.push([ok ? "✅" : "❌", name, detail]);
  ok ? pass++ : fail++;
};
const flush = () => new Promise((r) => setTimeout(r, 5));

function boot({ tabs = [] } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <select id="theme"><option value="auto">auto</option><option value="dark">dark</option></select>
    <select id="indent"><option value="2">2</option><option value="4">4</option></select>
    <select id="expandDepth"><option value="2">2</option></select>
    <input type="checkbox" id="sortKeys">
  </body></html>`, { runScripts: "dangerously" });
  const { window } = dom;
  const calls = { css: [], scripts: [], stored: null, msgs: [] };
  const store = {};
  window.chrome = {
    runtime: {
      lastError: null,
      sendMessage: (m, cb) => { calls.msgs.push(m); cb && cb(); },
    },
    storage: { local: {
      get: (defs, cb) => cb({ ...defs, ...store }),
      set: (obj) => { Object.assign(store, obj); calls.stored = { ...store }; },
    } },
    tabs: {
      query: (q, cb) => cb(tabs),
      sendMessage: (id, msg, cb) => { calls.msgs.push({ toTab: id, ...msg }); cb && cb(); },
    },
    scripting: {
      insertCSS: (opts, cb) => { calls.css.push(opts.target.tabId); cb && cb(); },
      executeScript: (opts, cb) => { calls.scripts.push(opts.target.tabId); cb && cb(); },
    },
  };
  window.eval(POPUP);
  // jsdom сам стреляет DOMContentLoaded асинхронно после конструирования —
  // слушатель, повешенный в eval выше, его поймает. Вручную не диспатчим,
  // иначе событие придёт дважды.
  return { window, calls };
}

// ---- 1. Открытие попапа инжектит во все открытые вкладки -------------------
{
  const { calls } = boot({ tabs: [{ id: 7 }, { id: 9 }] });
  await flush();
  check("попап: инжект в обе вкладки напрямую",
    calls.scripts.length === 2 && calls.css.length === 2,
    `scripts=${JSON.stringify(calls.scripts)}`);
  check("попап: CSS раньше скрипта (на первой вкладке)",
    calls.css[0] === 7 && calls.scripts.includes(7));
}

// ---- 2. Вкладки без id пропускаются ----------------------------------------
{
  const { calls } = boot({ tabs: [{ id: 3 }, {}, { id: undefined }] });
  await flush();
  check("попап: вкладки без id не ломают инжект", calls.scripts.length === 1);
}

// ---- 3. Смена настройки рассылает live-сообщение во вкладки ----------------
{
  const { window, calls } = boot({ tabs: [{ id: 5 }] });
  await flush();
  const themeSel = window.document.getElementById("theme");
  themeSel.value = "dark";
  themeSel.dispatchEvent(new window.Event("change"));
  await flush();
  const live = calls.msgs.find((m) => m && m.type === "jsoneat-settings");
  check("попап: change рассылает jsoneat-settings",
    !!live && live.settings?.theme === "dark",
    JSON.stringify(live));
  check("попап: настройки сохранены в storage", calls.stored?.theme === "dark");
}

console.log("");
for (const [m, n, d] of results) console.log(`  ${m} ${n}${d ? "  — " + d : ""}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
