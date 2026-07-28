/*
 * Формы обратной связи. Отдельным файлом, потому что site.js сознательно не
 * делает ни одного сетевого запроса — инструмент работает целиком в странице.
 * Форма запрос делает, но только по явному нажатию и только с тем, что человек
 * сам написал. Разные вещи, и держать их в разных файлах честнее.
 *
 * Прогрессивное улучшение: разметка — обычная <form method=post> на Formspree,
 * и она работает без JavaScript. Скрипт лишь перехватывает отправку, чтобы
 * показать результат на месте, без ухода на чужую страницу.
 */
(() => {
  "use strict";
  const form = document.querySelector("form[data-form]");
  if (!form) return;

  // Контекст, который человеку не нужно вводить руками, а нам полезен при
  // разборе: с какой страницы пришёл, какой браузер, какая версия расширения.
  const params = new URLSearchParams(location.search);
  // Имена полей человеческие, потому что Formspree подставляет их в письмо как
  // подписи: «Extension version» читается, «ext_version» — нет.
  const set = (name, value) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (el && !el.value) el.value = value;
  };
  set("Page", document.referrer || location.href);
  set("Browser", navigator.userAgent);
  if (params.get("v")) set("Extension version", params.get("v"));

  // Оценка приходит из виджета на сайте: /feedback/?stars=2
  const stars = parseInt(params.get("stars") || "", 10);
  if (stars >= 1 && stars <= 5) {
    set("Rating", String(stars) + " of 5");
    const badge = document.getElementById("stars-badge");
    if (badge) {
      badge.textContent = "★".repeat(stars) + "☆".repeat(5 - stars);
      badge.hidden = false;
    }
  }

  const btn = form.querySelector("[type=submit]");
  const ok = document.getElementById("form-ok");
  const fail = document.getElementById("form-fail");

  form.addEventListener("submit", (e) => {
    if (!form.reportValidity()) return;
    e.preventDefault();
    fail.hidden = true;
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "Sending…";

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        form.hidden = true;
        ok.hidden = false;
        ok.focus();
      })
      .catch(() => {
        // Текст пользователя остаётся в полях: заставлять набирать заново
        // из-за чужого сбоя — худшее, что можно сделать в форме жалобы.
        fail.hidden = false;
        btn.disabled = false;
        btn.textContent = was;
      });
  });
})();
