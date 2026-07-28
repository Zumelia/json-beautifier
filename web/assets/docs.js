/*
 * Поведение /docs/: подсветка текущего раздела, копирование якоря, «Contents»
 * на узком экране. Всё работает и без этого файла — навигация остаётся набором
 * обычных ссылок с якорями, скрипт только добавляет удобства.
 */
(() => {
  "use strict";

  const links = [...document.querySelectorAll(".docs-nav-list a")];
  const heads = links
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);

  /*
   * Текущий раздел — это последний заголовок, который проехал над линией чтения,
   * а не тот, что сейчас попадает в какую-то полосу.
   *
   * Первая версия висела на IntersectionObserver с узким rootMargin, и между
   * заголовками в полосу не попадало ничего: подсветка гасла целиком и
   * появлялась рывками. Проверка в браузере это и показала.
   *
   * Чтение позиций стоит недорого: заголовков десяток, и опрос ограничен
   * requestAnimationFrame, то есть не чаще кадра и только во время прокрутки.
   */
  if (heads.length) {
    const LINE = 100; // линия чтения от верха окна, ниже липкой шапки
    const update = () => {
      let current = heads[0];
      for (const h of heads) {
        if (h.getBoundingClientRect().top <= LINE) current = h;
        else break;
      }
      links.forEach((a) =>
        a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + current.id))
      );
    };

    /* Троттлинг по времени, а не через requestAnimationFrame. rAF выглядит
       уместнее для визуального обновления, но в фоновой вкладке он не
       выполняется вовсе — из-за этого поведение невозможно проверить
       автоматически, а необнаружимая регрессия дороже пары миллисекунд.
       Пересчёт десяти позиций раз в 80 мс во время прокрутки стоит пустяк. */
    let last = 0;
    let trailing = null;
    const schedule = () => {
      const now = Date.now();
      clearTimeout(trailing);
      if (now - last >= 80) {
        last = now;
        update();
      }
      // Хвостовой вызов, чтобы зафиксировать конечное положение прокрутки.
      trailing = setTimeout(() => {
        last = Date.now();
        update();
      }, 90);
    };

    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule, { passive: true });
    update();
  }

  // Клик по «#» копирует ссылку на раздел. Сама ссылка остаётся ссылкой:
  // без JS она просто перейдёт к якорю, как и должна.
  document.querySelectorAll("a.anchor").forEach((a) =>
    a.addEventListener("click", (e) => {
      if (!navigator.clipboard) return;
      e.preventDefault();
      const url = location.origin + location.pathname + a.getAttribute("href");
      navigator.clipboard.writeText(url).then(() => {
        history.replaceState(null, "", a.getAttribute("href"));
        const was = a.textContent;
        a.textContent = "copied";
        a.classList.add("anchor-done");
        setTimeout(() => {
          a.textContent = was;
          a.classList.remove("anchor-done");
        }, 1600);
      });
    })
  );

  // «Contents» на узком экране — та же механика, что у переключателя языка.
  const btn = document.querySelector("[data-docs-contents]");
  const list = document.getElementById("docs-nav-list");
  if (btn && list) {
    btn.addEventListener("click", () => {
      const open = !list.classList.contains("is-open");
      list.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Contents ▴" : "Contents ▾";
    });
    list.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        list.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = "Contents ▾";
      }
    });
  }
})();
