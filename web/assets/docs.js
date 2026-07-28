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

  // Текущий раздел — через IntersectionObserver, а не через scroll-обработчик:
  // тот считал бы позиции на каждом кадре прокрутки.
  if (heads.length && "IntersectionObserver" in window) {
    const seen = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
        let best = null;
        let bestVal = 0;
        seen.forEach((v, id) => {
          if (v > bestVal) {
            bestVal = v;
            best = id;
          }
        });
        links.forEach((a) =>
          a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + best))
        );
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 0.5, 1] }
    );
    heads.forEach((h) => io.observe(h));
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
