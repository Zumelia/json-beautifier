/* JSON Beautifier — background.
 *
 * Runs as an MV3 service worker in Chrome and as an event page in Firefox
 * (Firefox MV3 has no service_worker). The code is the same in both; only the
 * manifest differs — see extension-firefox/.
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
        // Ядро первым: content.js без globalThis.JSONBeautifierCore молча выходит.
        files: ["src/core.js", "src/content.js"],
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

/*
 * Открыть настройки. Основной путь — chrome.action.openPopup() (Chrome 127+).
 * Он есть не везде: в Chrome до 127 метода нет вовсе, а в Firefox он требует
 * пользовательского жеста, которого у нас нет — клик случился в контент-скрипте,
 * а вызов происходит здесь. Поэтому любой отказ ведёт к запасному варианту:
 * та же страница настроек, открытая обычной вкладкой. Кнопка-шестерёнка
 * обязана срабатывать всегда, иначе она читается как сломанная.
 */
function openSettings() {
  // Запасной путь ТОЛЬКО когда метода нет вовсе (Chrome до 127). Если метод
  // есть, но отклонился — почти всегда это «попап уже открыт»: пользователь
  // нажал шестерёнку второй раз. Открывать в этом случае popup.html отдельной
  // вкладкой неправильно, и Кирилл это поймал 2026-07-28. Молча ничего не делаем.
  if (!chrome.action || typeof chrome.action.openPopup !== "function") {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/popup.html") });
    } catch (_) {}
    return;
  }
  try {
    const p = chrome.action.openPopup();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
}

// Приёмник сообщений. «open-settings» приходит по клику на шестерёнку в
// тулбаре вьювера. Любое сообщение заодно будит SW → top-level ниже делает
// реинжект.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "open-settings") openSettings();
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
