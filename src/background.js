/* JSON Beautifier — service worker.
 *
 * Закрывает три требования курса одной связкой:
 *   2.6  контент-скрипт обязан отработать во вкладках, открытых ДО установки,
 *        иначе юзер не видит эффекта -> удаляет -> возврат в SERP -> падение
 *        поведенческих -> падение ранга;
 *   3.2  Welcome Page открывается на install и объясняет, где найти расширение;
 *   5.1  Uninstall Page собирает причину удаления.
 *
 * Само расширение сетевых запросов НЕ делает. Аналитика установок живёт на
 * Welcome Page (обычная веб-страница), поэтому обещание "zero network" в
 * PRIVACY.md остаётся честным.
 */

// Хостится на ops-de (Германия), TLS от Let's Encrypt, автопродление certbot.
// Слэш в конце — канонический путь: без него nginx отдаёт лишний 301.
const WELCOME_URL = "https://jsonbeautifier.dev/welcome/";
const UNINSTALL_URL = "https://jsonbeautifier.dev/uninstall/";

const INJECTABLE = ["http://*/*", "https://*/*"];

/** Прокидывает вьювер во все уже открытые вкладки. */
async function reinjectExistingTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: INJECTABLE });
  } catch (e) {
    return { injected: 0, skipped: 0 };
  }

  let injected = 0;
  let skipped = 0;
  for (const tab of tabs) {
    if (!tab || typeof tab.id !== "number") {
      skipped++;
      continue;
    }
    try {
      // CSS первым: иначе на долю секунды видно неоформленное дерево.
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["src/viewer.css"],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"],
      });
      injected++;
    } catch (e) {
      // chrome://, страницы CWS, PDF-вьювер и прочее, куда инжектить нельзя.
      skipped++;
    }
  }
  return { injected, skipped };
}

chrome.runtime.onInstalled.addListener((details) => {
  // Ставим всегда: на install и на update, иначе после апдейта URL слетает.
  try {
    chrome.runtime.setUninstallURL(UNINSTALL_URL);
  } catch (e) {
    /* не критично */
  }

  if (!details || details.reason !== "install") return;

  try {
    chrome.tabs.create({ url: WELCOME_URL });
  } catch (e) {
    /* не критично */
  }
});

// Приёмник сообщений. «open-settings» приходит по клику на название в
// тулбаре вьювера — открываем попап (chrome.action.openPopup, Chrome 127+).
// Любое сообщение заодно будит SW → top-level ниже делает реинжект.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "open-settings") {
    try {
      const p = chrome.action.openPopup();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }
});

// Реинжект — на КАЖДОМ старте service worker'а, не только на install.
// SW стартует при установке, обновлении и при пробуждении любым событием
// (включая wake-пинг попапа выше). Повторный запуск в уже обработанной
// вкладке дешёв: гварды в content.js выходят мгновенно.
reinjectExistingTabs();

// Экспорт для тестов (в браузере globalThis.module отсутствует).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { reinjectExistingTabs, WELCOME_URL, UNINSTALL_URL };
}
