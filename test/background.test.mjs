/*
 * Тесты service worker'а (связка курса 2.6 / 3.2 / 5.1 + фиксы от 2026-07-23).
 *
 * Ключевое изменение v0.2.2: реинжект выполняется на КАЖДОМ старте SW
 * (top-level вызов), а не только на onInstalled(install) — это закрывает
 * сценарии Кирилла №4 (вкладка открыта до установки) и №5 (disable→enable).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(__dirname, "../src/background.js"), "utf8");

let pass = 0, fail = 0;
const results = [];
const check = (name, ok, detail = "") => {
  results.push([ok ? "✅" : "❌", name, detail]);
  ok ? pass++ : fail++;
};
const flush = () => new Promise((r) => setTimeout(r, 5));

/** Поднимает изолированный фейковый chrome и выполняет background.js. */
function boot({ tabs = [], failOn = () => false } = {}) {
  const calls = { uninstallURL: null, created: [], css: [], scripts: [], queried: null,
                  onMessage: false, msgHandler: null, popupOpened: false };
  let onInstalled = null;
  const chrome = {
    runtime: {
      onInstalled: { addListener: (fn) => { onInstalled = fn; } },
      onMessage: { addListener: (fn) => { calls.onMessage = true; calls.msgHandler = fn; } },
      setUninstallURL: (u) => { calls.uninstallURL = u; },
      OnInstalledReason: { INSTALL: "install", UPDATE: "update" },
    },
    action: { openPopup: () => { calls.popupOpened = true; return Promise.resolve(); } },
    tabs: {
      query: async (q) => { calls.queried = q; return tabs; },
      create: (o) => { calls.created.push(o.url); },
    },
    scripting: {
      insertCSS: async ({ target, files }) => {
        if (failOn(target.tabId)) throw new Error("cannot inject");
        calls.css.push([target.tabId, ...files]);
      },
      executeScript: async ({ target, files }) => {
        if (failOn(target.tabId)) throw new Error("cannot inject");
        calls.scripts.push([target.tabId, ...files]);
      },
    },
  };
  const fn = new Function("chrome", "module", SRC);
  fn(chrome, undefined);
  return { calls, fire: (details) => onInstalled(details) };
}

// ---- 1. Старт SW (без событий): реинжект во все вкладки --------------------
{
  const { calls } = boot({ tabs: [{ id: 1 }, { id: 2 }, { id: 3 }] });
  await flush();
  check("старт SW: контент-скрипт прокинут во ВСЕ открытые вкладки",
    calls.scripts.length === 3, `инжектов: ${calls.scripts.length}`);
  check("старт SW: CSS прокинут до скрипта",
    calls.css.length === 3 && calls.css[0][1] === "src/viewer.css");
  check("старт SW: запрошены только http/https вкладки",
    JSON.stringify(calls.queried?.url) === JSON.stringify(["http://*/*", "https://*/*"]),
    JSON.stringify(calls.queried));
  check("старт SW: onMessage-приёмник wake-пинга зарегистрирован",
    calls.onMessage === true);
}

// ---- 2. install: Welcome Page + Uninstall URL, без второго реинжекта -------
{
  const { calls, fire } = boot({ tabs: [{ id: 1 }] });
  await flush();
  await fire({ reason: "install" });
  await flush();
  check("install: открыта Welcome Page", calls.created.length === 1, calls.created[0]);
  check("install: задан Uninstall URL", !!calls.uninstallURL, String(calls.uninstallURL));
  check("install: реинжект не задублирован (top-level уже отработал)",
    calls.scripts.length === 1, `инжектов: ${calls.scripts.length}`);
}

// ---- 3. update: без Welcome Page, Uninstall URL переустанавливается --------
{
  const { calls, fire } = boot({ tabs: [{ id: 1 }] });
  await flush();
  await fire({ reason: "update" });
  await flush();
  check("update: Welcome Page НЕ открывается", calls.created.length === 0);
  check("update: Uninstall URL всё равно задан", !!calls.uninstallURL);
  check("update: инжект от старта SW есть, дубля нет", calls.scripts.length === 1);
}

// ---- 4. запрещённые вкладки не роняют процесс ------------------------------
{
  const { calls } = boot({
    tabs: [{ id: 1 }, { id: 2 }, { id: 3 }],
    failOn: (id) => id === 2,
  });
  await flush();
  check("вкладка, куда инжектить нельзя, пропускается без падения",
    calls.scripts.length === 2, `успешных: ${calls.scripts.length}`);
}

// ---- 5. вкладки без id игнорируются ----------------------------------------
{
  const { calls } = boot({ tabs: [{ id: 1 }, {}, { id: undefined }] });
  await flush();
  check("вкладки без id не ломают реинжект", calls.scripts.length === 1);
}

// ---- 6. open-settings из тулбара открывает попап ---------------------------
{
  const { calls } = boot({ tabs: [] });
  await flush();
  calls.msgHandler({ type: "open-settings" });
  check("open-settings: вызван chrome.action.openPopup", calls.popupOpened === true);
  calls.popupOpened = false;
  calls.msgHandler({ type: "something-else" });
  check("чужие сообщения попап не открывают", calls.popupOpened === false);
}

console.log("");
for (const [m, n, d] of results) console.log(`  ${m} ${n}${d ? "  — " + d : ""}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
