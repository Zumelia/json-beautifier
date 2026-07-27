"use strict";
const DEFAULTS = { theme: "auto", indent: 2, expandDepth: 2, sortKeys: false };

const $ = (id) => document.getElementById(id);

function load() {
  chrome.storage.local.get(DEFAULTS, (got) => {
    const s = { ...DEFAULTS, ...(chrome.runtime.lastError ? {} : got) };
    $("theme").value = s.theme;
    $("indent").value = String(s.indent);
    $("expandDepth").value = String(s.expandDepth);
    $("sortKeys").checked = !!s.sortKeys;
  });
}

function save() {
  const s = {
    theme: $("theme").value,
    indent: parseInt($("indent").value, 10),
    expandDepth: parseInt($("expandDepth").value, 10),
    sortKeys: $("sortKeys").checked,
  };
  chrome.storage.local.set(s);
  // Живое применение: рассылаем во все вкладки, где вьювер уже построен.
  // Вкладки без нашего контент-скрипта ответят ошибкой — глушим её.
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs || []) {
      if (typeof t.id !== "number") continue;
      try {
        chrome.tabs.sendMessage(t.id, { type: "jsoneat-settings", settings: s }, () => {
          void chrome.runtime.lastError; // "no receiving end" — норма
        });
      } catch (_) {}
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  ["theme", "indent", "expandDepth", "sortKeys"].forEach((id) =>
    $(id).addEventListener("change", save)
  );
  // Инжект в открытые вкладки — НАПРЯМУЮ из попапа, не через service worker.
  // Тест Кирилла (v0.2.3) показал: цепочка «пинг будит SW → SW реинжектит»
  // на практике не срабатывает после включения расширения. У попапа есть
  // полный доступ к chrome.scripting — делаем сами, детерминированно.
  // Гварды в content.js делают повторный инжект дешёвым и безопасным.
  injectIntoOpenTabs();
});

function injectIntoOpenTabs() {
  try {
    chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
      void chrome.runtime.lastError;
      for (const t of tabs || []) {
        if (typeof t.id !== "number") continue;
        try {
          chrome.scripting.insertCSS(
            { target: { tabId: t.id }, files: ["src/viewer.css"] },
            () => {
              void chrome.runtime.lastError; // chrome:// и т.п. — пропускаем
              chrome.scripting.executeScript(
                // Ядро первым: content.js без него молча выходит.
                { target: { tabId: t.id }, files: ["src/core.js", "src/content.js"] },
                () => void chrome.runtime.lastError
              );
            }
          );
        } catch (_) {}
      }
    });
  } catch (_) {}
}
