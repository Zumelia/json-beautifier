#!/usr/bin/env python3
"""
Страница для работы с отзывами: /reviewers/ — служебная, noindex, ни с чего не
слинкована.

Готовых текстов отзывов здесь нет и не будет. Двадцать пять правок одного
текста — это одно мнение в двадцати пяти редакциях, и видно это и читателю, и
фильтрам стора. Отзыв — утверждение факта незнакомым людям, и наблюдения в нём
должны приходить от того, кто наблюдал.

Вместо этого страница работает в двух режимах.

  /reviewers/         консоль Кирилла: двадцать пять разных углов, письмо
                      каждому человеку, отметки «отправлен» и «опубликован».
  /reviewers/?c=N     то, что видит человек: только его карточка, три вопроса
                      и сборщик.

Сборщик складывает ответы в связный текст **механически** — расставляет точки,
заглавные буквы и абзац, выкидывает пустые поля. Ни одного слова от себя он не
добавляет: усилие для человека падает до трёх фраз о том, что он только что
видел, а свидетельство остаётся его.

    python3 build_reviewers.py      # → reviewers/index.html
"""

from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "reviewers"

STORE = "https://chromewebstore.google.com/detail/mpeomjgcmddedcglokpmeideoelaidbn"
SAMPLES = "https://jsonbeautifier.dev/samples/"
PAGE = "https://jsonbeautifier.dev/reviewers/"

# (язык, угол, что попробовать, три вопроса)
CARDS = [
    ("ru", "Большие ответы API",
     "Открой /samples/large.json — 2.3 МБ в одну строку.",
     ["Вкладка осталась отзывчивой или подтормаживала?",
      "Сколько ждал до появления дерева?",
      "Сворачивание веток на таком объёме работает так же быстро?"]),
    ("ru", "Сломанный JSON",
     "Открой /samples/broken.json — там нет запятой на 7-й строке.",
     ["Понятно ли из сообщения, где именно ошибка?",
      "Помогла ли кнопка перехода к строке?",
      "Что показывали другие вьюеры в такой ситуации?"]),
    ("ru", "Поиск по свёрнутым веткам",
     "На /samples/orders.json сверни всё и найди «url».",
     ["Нашлись ли совпадения внутри свёрнутых веток?",
      "Раскрылось ли до нужного места само?",
      "Хватает ли перехода между совпадениями?"]),
    ("ru", "Тёмная тема",
     "Переключи тему в попапе и посмотри дерево и сам попап.",
     ["Это настоящая тёмная тема или инверсия светлой?",
      "Читаются ли цвета типов на тёмном?",
      "Не слепит ли что-нибудь?"]),
    ("ru", "Номера строк",
     "Открой любой JSON — номера включены по умолчанию, выключаются в попапе.",
     ["Мешают или помогают?",
      "Не съезжают ли при сворачивании веток?",
      "Заметно ли влияние на скорость?"]),
    ("ru", "Взгляд разработчика расширений: права",
     "Посмотри список прав на странице расширения и в /privacy/.",
     ["Оправдан ли доступ ко всем страницам тем, что расширение делает?",
      "Понятно ли из описания, зачем каждое право?",
      "Что бы ты спросил на месте пользователя?"]),
    ("ru", "Не-JSON страницы",
     "Походи по обычным сайтам с включённым расширением.",
     ["Что-нибудь сломалось или подтормозило?",
      "Замечал ли ты его вообще там, где оно не нужно?",
      "Были ли ложные срабатывания?"]),
    ("ru", "Юникод и экранирование",
     "На /samples/orders.json найди японский текст, эмодзи и escape-последовательности.",
     ["Всё отрисовалось верно?",
      "Не поехала ли вёрстка на длинных строках?",
      "Как показаны спецсимволы?"]),
    ("ru", "Копирование",
     "Кликни по значению, попробуй «Copy JSON».",
     ["Копируется то, что ожидаешь?",
      "Хватает ли способов достать кусок наружу?",
      "Чего не хватило?"]),
    ("ru", "Настройки",
     "Открой попап: тема, отступ, глубина раскрытия, сортировка ключей, номера строк.",
     ["Применяются ли изменения к уже открытой вкладке?",
      "Каких настроек не хватает?",
      "Есть ли лишние?"]),
    ("ru", "Сортировка ключей",
     "Включи «Sort object keys» на /samples/orders.json.",
     ["Полезно ли для сравнения ответов?",
      "Не путает ли, что порядок больше не как в исходнике?",
      "Пользовался бы постоянно или точечно?"]),
    ("ru", "Raw-режим",
     "Нажми Raw и вернись обратно.",
     ["Показывает исходник как есть, без переформатирования?",
      "Быстро ли переключается туда-обратно?",
      "На большом файле ведёт себя так же?"]),
    ("ru", "Открытый код",
     "Загляни в репозиторий github.com/Zumelia/json-beautifier — файлы core/core.js и extension-chrome/src/.",
     ["Проверяемо ли утверждение «нет сетевых запросов»?",
      "Читается ли код?",
      "Важна ли тебе как разработчику открытость в такой утилите?"]),
    ("ru", "Первое впечатление",
     "Вспомни момент установки: страница приветствия, первый открытый JSON.",
     ["Понятно ли было, что делать дальше?",
      "Сработало ли на первом же файле без настройки?",
      "Что показалось лишним?"]),
    ("ru", "Чего не хватает",
     "Поработай с расширением на своих задачах пару дней.",
     ["Чего не хватило в реальной работе?",
      "Что бы добавил первым?",
      "Есть ли то, что раздражает?"]),
    ("en", "Deeply nested structures",
     "Open /samples/orders.json — six levels deep in places.",
     ["Is the indentation readable that deep?",
      "Do the collapse controls stay usable?",
      "Do the item and key counters help you navigate?"]),
    ("en", "Coming from another viewer",
     "Compare it against whatever you used before.",
     ["What does this one do better?",
      "What does the old one still do better?",
      "Would you actually switch?"]),
    ("en", "No network requests",
     "Open DevTools → Network with the extension active on a JSON page.",
     ["Does the extension make any request at all?",
      "Does that matter to you for a tool that reads every page?",
      "Would you have checked if nobody suggested it?"]),
    ("en", "Edge-case values",
     "In /samples/orders.json look at empty objects, empty arrays, null, exponents, negative numbers.",
     ["Is each type visually distinct?",
      "Is null distinguishable from the string \"null\"?",
      "Anything rendered confusingly?"]),
    ("en", "Speed on a busy machine",
     "Use it during a normal working day, with your usual tabs open.",
     ["Did you notice any slowdown?",
      "How long from opening a JSON URL to a usable tree?",
      "Did it ever get in the way?"]),
    ("en", "The online tools",
     "Try jsonbeautifier.dev/json-formatter/ next to the extension.",
     ["When would you use the site instead of the extension?",
      "Does the extension actually save you steps?",
      "Is the difference between them clear?"]),
    ("en", "Copying a path",
     "Click a nested value and copy its path.",
     ["Is the path in a form you can paste into code?",
      "Does it save you time versus counting brackets?",
      "What format would you have expected?"]),
    ("en", "Auto-expand depth",
     "Change the depth setting in the popup and reopen a file.",
     ["Which depth turned out right for your data?",
      "Should the default be different?",
      "Does it apply to the tab you already had open?"]),
    ("en", "Error recovery",
     "Open /samples/broken.json, then fix nothing and just read the message.",
     ["Could you find the problem from the message alone?",
      "Is line-and-column enough, or do you want more?",
      "How do the tools you use compare?"]),
    ("en", "Honest downside",
     "Use it for a couple of days on real work.",
     ["What is the weakest part?",
      "What would stop you recommending it?",
      "What is missing that you expected?"]),
]

MSG_RU = """Привет! Я запустил своё первое расширение — JSON Beautifier, форматирует любой JSON-URL сразу при открытии.

{store}

Если будет пара минут, глянешь? Не «вообще» — мне интереснее одна конкретная вещь: {angle_low}.

Что попробовать: {try_it}
Файлы для этого: {samples}

Чтобы не тратить время на формулировки, сделал страничку: три вопроса, ответишь по фразе — там же сложится текст, который можно вставить в стор. Слова твои, страница только расставляет точки.

{link}

Честно про минусы: Firefox не поддерживается (мешает его собственный просмотрщик JSON), горячих клавиш нет.

Если расширение не понравится — напиши лучше мне, а не в стор, починю.

Спасибо!"""

MSG_EN = """Hi! I shipped my first extension — JSON Beautifier. It formats any JSON URL the moment you open it.

{store}

If you have a couple of minutes, would you take a look? Not "in general" — I'm after one specific thing: {angle_low}.

What to try: {try_it}
Files for it: {samples}

So you don't have to fight with wording, I made a page: three questions, a sentence each, and it assembles your answers into something you can paste into the store. The words stay yours — it only adds the full stops.

{link}

The honest downsides: no Firefox (its own JSON viewer gets there first), no keyboard shortcuts.

If you don't like it, tell me rather than the store — I'll fix it.

Thanks!"""

UI = {
    "ru": {
        "build": "Собери свой отзыв",
        "hint": "Ответь на вопросы своими словами — по фразе. Ниже сложится текст: "
                "слова твои, страница только расставляет точки и абзац. Правь как хочешь.",
        "ph": "Своими словами",
        "result": "Получилось",
        "copy": "Скопировать отзыв",
        "copied": "Скопировано",
        "short": "Коротковато — две-три фразы читаются лучше",
        "empty": "Ответь хотя бы на один вопрос — текст появится здесь.",
        "intro": "Спасибо, что смотришь. Ниже — одна конкретная вещь, на которую "
                 "было бы полезно взглянуть, и три вопроса о ней.",
        "nope": "Если расширение не понравилось — не пиши отзыв, напиши напрямую: ",
        "nope_link": "форма обратной связи",
        "another": "Другие вопросы для отзыва",
        "swap": "In English",
        "steps_title": "Как оставить отзыв",
        "steps": [
            'Поставь расширение: <a href="{store}" target="_blank" rel="noopener">Chrome Web Store</a>',
            'Открой любой из примеров — <a href="/samples/">jsonbeautifier.dev/samples/</a> — или свой JSON-URL',
            "Посмотри на то, о чём спрашивают вопросы ниже",
            "Ответь на три вопроса — текст соберётся сам, скопируй его",
            'Вернись на страницу расширения в сторе: вкладка <b>Reviews</b> → <b>Write a review</b>, вставь и отправь',
            'Для взаимного отзыва напиши в тг <a href="https://t.me/minisol" target="_blank" rel="noopener">@minisol</a>',
        ],
    },
    "en": {
        "build": "Put your review together",
        "hint": "Answer in your own words, a sentence each. The text below is assembled "
                "from your answers — the page only adds the full stops and the paragraph "
                "break. Edit it however you like.",
        "ph": "In your own words",
        "result": "Result",
        "copy": "Copy review",
        "copied": "Copied",
        "short": "A bit short — two or three sentences read better",
        "empty": "Answer at least one question and the text appears here.",
        "intro": "Thanks for taking a look. Below is one specific thing worth "
                 "checking, and three questions about it.",
        "nope": "If you didn't like it, please don't review it — tell me instead: ",
        "nope_link": "feedback form",
        "another": "Different questions",
        "swap": "По-русски",
        "steps_title": "How to leave a review",
        "steps": [
            'Install it: <a href="{store}" target="_blank" rel="noopener">Chrome Web Store</a>',
            'Open one of the samples — <a href="/samples/">jsonbeautifier.dev/samples/</a> — or any JSON URL of your own',
            "Look at whatever the questions below ask about",
            "Answer the three questions — the text assembles itself, then copy it",
            'Back on the store page: <b>Reviews</b> → <b>Write a review</b>, paste and send',
            'For a review in return, message <a href="https://t.me/minisol" target="_blank" rel="noopener">@minisol</a> on Telegram',
        ],
    },
}

CSS = """
  .rev { margin-bottom: 18px; }
  .rev-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .rev-head h3 { margin: 0; font-size: 20px; }
  .tag { font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em;
         padding: 3px 8px; border-radius: var(--pill); background: var(--chip); color: var(--accent); }
  .rev-try { margin: 12px 0 0; color: var(--muted); }
  .rev-act { display: flex; align-items: center; gap: 14px; margin-top: 16px; flex-wrap: wrap; }
  .rev-sent { color: var(--ok); font-weight: 600; font-size: 14px; }
  .rev-pub { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }
  .rev.is-pub { opacity: .55; }
  .rev-count { font-family: var(--font-mono); color: var(--faint); font-size: 14px; }

  .asm { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--border-soft); }
  .asm h4 { margin: 0 0 6px; font-size: 16px; }
  .asm-hint { margin: 0 0 22px; color: var(--muted); font-size: 14.5px; }
  .asm-q { display: block; margin-bottom: 14px; }
  .asm-q span { display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; }
  .asm-q textarea { width: 100%; min-height: 60px; padding: 11px 13px; resize: vertical;
                    border: 1px solid var(--border); border-radius: var(--radius-sm);
                    background: var(--surface-2); color: var(--text);
                    font: 15px/1.55 var(--font-body); }
  .asm-out { margin-top: 6px; padding: 16px 18px; border: 1px solid var(--border);
             border-radius: var(--radius); background: var(--surface-2);
             white-space: pre-wrap; min-height: 60px; }
  .asm-out.is-empty { color: var(--faint); }
  .asm-foot { display: flex; align-items: center; gap: 14px; margin-top: 12px; flex-wrap: wrap; }
  .asm-note { color: var(--faint); font-size: 13.5px; }
  .asm-ok { color: var(--ok); font-weight: 600; font-size: 14px; }
  body.one-card .rev-act, body.one-card .rev-count, body.one-card .console-only { display: none; }

  /* Тема и кнопки живут прямо на песочном фоне страницы, в белую карточку
     завёрнуты только вопросы: белое пятно = «здесь надо что-то делать». */
  .asm-title { margin: 34px 0 0; font-size: clamp(24px, 3vw, 30px); }
  .topic { margin: 18px 0 14px; }
  .topic h3 { margin: 8px 0 0; font-size: 21px; }
  .pick { display: flex; gap: 10px; margin: 0 0 16px; flex-wrap: wrap; }
  .steps { margin: 24px 0 0; padding-left: 22px; }
  .steps li { margin-bottom: 9px; }
  .steps-box { margin-top: 30px; }
  .steps-box h2 { font-size: clamp(22px, 2.6vw, 26px); margin: 0; }
  .visitor-only { display: none; }
  body.one-card .visitor-only { display: block; }
  body.one-card .pick.visitor-only { display: flex; }
"""

JS = """
(() => {
  "use strict";
  const KEY = (n, k) => "jb-rev-" + n + "-" + k;
  const only = new URLSearchParams(location.search).get("c");
  const cards = [...document.querySelectorAll(".rev")];
  const counter = document.querySelector("[data-count]");

  const visitor = document.body.dataset.mode === "visitor";

  // Общий вход: одна ссылка на всех. Тему страница выдаёт сама и запоминает —
  // иначе перезагрузка меняла бы вопросы и стирала уже написанные ответы.
  // Совпадения у разных людей возможны, поэтому рядом кнопка «другая тема».
  const PICK = "jb-rev-pick";
  const byLang = (lang) => cards.filter((c) => c.dataset.lang === lang).map((c) => c.dataset.n);
  // Скобки здесь не косметика: `a || b ? x : y` — это `(a || b) ? x : y`, и
  // сохранённый «en» как непустая строка отправлял бы всех обратно в русский.
  const prefLang = () => {
    const saved = localStorage.getItem("jb-rev-lang");
    if (saved) return saved;
    return (navigator.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
  };
  const draw = (lang, avoid) => {
    const pool = byLang(lang).filter((n) => n !== avoid);
    return pool[Math.floor(Math.random() * pool.length)];
  };

  let assigned = null;
  if (visitor) {
    assigned = localStorage.getItem(PICK);
    if (!assigned || !document.getElementById("c" + assigned)) {
      assigned = draw(prefLang(), null);
      localStorage.setItem(PICK, assigned);
    }
  }

  if (only || visitor) {
    const pickOne = only || assigned;
    cards.forEach((c) => { if (c.dataset.n !== pickOne) c.hidden = true; });
    document.body.classList.add("one-card");
    const card = document.getElementById("c" + pickOne);
    const intro = document.querySelector("[data-intro]");
    if (card && intro) {
      // «Работа с отзывами» — заголовок для владельца страницы; человеку,
      // пришедшему по ссылке, он ничего не говорит.
      document.querySelector("h1").textContent = "JSON Beautifier";
      document.title = "JSON Beautifier";
      document.documentElement.lang = card.dataset.lang;
      intro.textContent = card.dataset.intro;
      document.querySelector("[data-lede]").remove();
      document.querySelector("[data-strip]").innerHTML =
        card.dataset.nope + '<a href="/feedback/">' + card.dataset.nopeLink + "</a>.";
    }

    // Инструкция — на языке выданной карточки.
    const steps = document.querySelector('[data-steps="' + card.dataset.lang + '"]');
    if (steps) steps.hidden = false;

    if (visitor && card) {
      const another = card.querySelector("[data-another]");
      const swap = card.querySelector("[data-lang-switch]");
      const take = (lang, avoid) => {
        const n = draw(lang, avoid);
        if (!n) return;
        localStorage.setItem(PICK, n);
        localStorage.setItem("jb-rev-lang", lang);
        location.reload();
      };
      another.addEventListener("click", () => take(card.dataset.lang, card.dataset.n));
      swap.addEventListener("click", () => take(card.dataset.lang === "ru" ? "en" : "ru", null));
    }
  }

  const recount = () => {
    if (!counter) return;
    const sent = cards.filter((c) => localStorage.getItem(KEY(c.dataset.n, "sent"))).length;
    const pub = cards.filter((c) => localStorage.getItem(KEY(c.dataset.n, "pub"))).length;
    counter.textContent = "отправлено " + sent + " из " + cards.length + " · опубликовано " + pub;
  };

  // Склейка чисто механическая: обрезали, поставили заглавную, закрыли точкой,
  // выкинули пустые. Ни одного своего слова — иначе это уже не его отзыв.
  const tidy = (s) => {
    s = s.trim().replace(/\\s+/g, " ");
    if (!s) return "";
    s = s[0].toUpperCase() + s.slice(1);
    return /[.!?…]$/.test(s) ? s : s + ".";
  };

  document.querySelectorAll(".rev").forEach((card) => {
    const n = card.dataset.n;

    const btn = card.querySelector("[data-copy]");
    const sent = card.querySelector(".rev-sent");
    const pub = card.querySelector("[data-pub]");
    if (btn) {
      const markSent = () => { btn.disabled = true; sent.hidden = false; };
      if (localStorage.getItem(KEY(n, "sent"))) markSent();
      btn.addEventListener("click", () => {
        const text = card.querySelector(".rev-msg").value;
        navigator.clipboard.writeText(text).then(() => {
          localStorage.setItem(KEY(n, "sent"), "1");
          markSent();
          recount();
        }).catch(() => {
          btn.textContent = "Не удалось скопировать — выдели текст вручную";
          card.querySelector(".rev-msg").hidden = false;
        });
      });
    }
    if (pub) {
      if (localStorage.getItem(KEY(n, "pub"))) { pub.checked = true; card.classList.add("is-pub"); }
      pub.addEventListener("change", () => {
        if (pub.checked) localStorage.setItem(KEY(n, "pub"), "1");
        else localStorage.removeItem(KEY(n, "pub"));
        card.classList.toggle("is-pub", pub.checked);
        recount();
      });
    }

    const fields = [...card.querySelectorAll(".asm-q textarea")];
    const out = card.querySelector(".asm-out");
    const note = card.querySelector(".asm-note");
    const copyBtn = card.querySelector("[data-copy-review]");
    const okMsg = card.querySelector(".asm-ok");
    if (!fields.length) return;

    const assemble = () => {
      const parts = fields.map((f) => tidy(f.value)).filter(Boolean);
      if (!parts.length) {
        out.textContent = card.dataset.empty;
        out.classList.add("is-empty");
        note.textContent = "";
        copyBtn.disabled = true;
        return "";
      }
      // Первый ответ отдельным абзацем: он про то, что человек делал, и в
      // магазине первая строка — это всё, что видно без разворачивания.
      const text = parts.length > 1
        ? parts[0] + "\\n\\n" + parts.slice(1).join(" ")
        : parts[0];
      out.textContent = text;
      out.classList.remove("is-empty");
      note.textContent = text.length < 80 ? card.dataset.short : text.length + " / 2000";
      copyBtn.disabled = false;
      return text;
    };

    fields.forEach((f) => {
      f.addEventListener("input", () => {
        assemble();
        localStorage.setItem(KEY(n, "a" + fields.indexOf(f)), f.value);
      });
      const saved = localStorage.getItem(KEY(n, "a" + fields.indexOf(f)));
      if (saved) f.value = saved;
    });

    copyBtn.addEventListener("click", () => {
      const text = assemble();
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        okMsg.textContent = card.dataset.copied;
      }).catch(() => {
        const r = document.createRange();
        r.selectNodeContents(out);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      });
    });

    assemble();
  });

  recount();
})();
"""

TEMPLATE = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>JSON Beautifier — обратная связь</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<style>__CSS__</style>
</head>
<body data-mode="__MODE__">
<main id="main">
  <section class="wrap section" style="max-width:820px">
    <p class="eyebrow console-only">служебная страница · не индексируется · ниоткуда не слинкована</p>
    <h1>__H1__</h1>
    <p class="lead" data-intro>__INTRO__</p>
    <p class="lead" data-lede>__LEDE__</p>


    <div class="steps-box visitor-only" data-steps="ru" hidden>__STEPS_RU__</div>
    <div class="steps-box visitor-only" data-steps="en" hidden>__STEPS_EN__</div>

    <p class="note-strip" style="margin-top:22px" data-strip>__STRIP__</p>

    <p class="rev-count console-only" style="margin-top:26px" data-count></p>
    __CARDS__
  </section>
</main>
<script>__JS__</script>
</body>
</html>
"""


def steps_html(lang):
    u = UI[lang]
    items = "".join(
        "<li>" + step.format(store=STORE, samples=SAMPLES) + "</li>" for step in u["steps"])
    return f'<h2>{escape(u["steps_title"])}</h2><ol class="steps">{items}</ol>'


def build():
    cards = []
    for i, (lang, angle, try_it, questions) in enumerate(CARDS, 1):
        u = UI[lang]
        tpl = MSG_RU if lang == "ru" else MSG_EN
        msg = tpl.format(store=STORE, samples=SAMPLES, try_it=try_it,
                         link=f"{PAGE}?c={i}",
                         angle_low=angle[0].lower() + angle[1:])
        qs = "".join(
            f'<label class="asm-q"><span>{escape(q)}</span>'
            f'<textarea rows="2" placeholder="{escape(u["ph"])}"></textarea></label>'
            for q in questions)
        cards.append(f"""
<article class="rev" id="c{i}" data-n="{i}" data-lang="{lang}"
  data-empty="{escape(u['empty'])}" data-short="{escape(u['short'])}"
  data-copied="{escape(u['copied'])}" data-intro="{escape(u['intro'])}"
  data-nope="{escape(u['nope'])}" data-nope-link="{escape(u['nope_link'])}"
  data-another="{escape(u['another'])}" data-swap="{escape(u['swap'])}">

  <h2 class="asm-title visitor-only">{escape(u['build'])}</h2>

  <div class="topic">
    <div class="rev-head">
      <span class="num console-only">{i:02d}</span>
      <span class="tag">{lang.upper()}</span>
      <h3>{escape(angle)}</h3>
    </div>
    <p class="rev-try">{escape(try_it)}</p>
    <div class="rev-act">
      <button class="btn btn-sm" data-copy>Скопировать и отметить отправленным</button>
      <span class="rev-sent" hidden>Уже отправлен</span>
      <label class="rev-pub"><input type="checkbox" data-pub> отзыв опубликован</label>
    </div>
    <textarea class="rev-msg" hidden>{escape(msg)}</textarea>
  </div>

  <div class="pick visitor-only">
    <button class="btn btn-sm btn-ghost" data-another>{escape(u['another'])}</button>
    <button class="btn btn-sm btn-ghost" data-lang-switch>{escape(u['swap'])}</button>
  </div>

  <div class="card asm">
    <p class="asm-hint">{escape(u['hint'])}</p>
    {qs}
    <p class="asm-q"><span>{escape(u['result'])}</span></p>
    <div class="asm-out is-empty">{escape(u['empty'])}</div>
    <div class="asm-foot">
      <button class="btn btn-sm" data-copy-review disabled>{escape(u['copy'])}</button>
      <span class="asm-ok"></span>
      <span class="asm-note"></span>
    </div>
  </div>
</article>""")

    ru = sum(1 for c in CARDS if c[0] == "ru")
    html = (TEMPLATE
            .replace("__CSS__", CSS)
            .replace("__JS__", JS)
            .replace("__H1__", "Работа с отзывами")
            .replace("__INTRO__", "")
            .replace("__LEDE__",
                     f"Двадцать пять разных углов — по одному на человека. "
                     f"{ru} на русском, {len(CARDS) - ru} на английском. Ссылка каждому "
                     f"своя: <code>/reviewers/?c=N</code> открывает только его карточку, "
                     f"без этих отметок.")
            .replace("__STRIP__",
                     "Кнопка копирует <b>письмо человеку</b>. Отзыв он пишет сам — "
                     "сборщик внизу карточки только расставляет точки и абзац, "
                     "ни одного слова от себя не добавляет.")
            .replace("__STEPS_RU__", steps_html("ru"))
            .replace("__STEPS_EN__", steps_html("en"))
            .replace("__CARDS__", "".join(cards)))

    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(html.replace("__MODE__", "console"), encoding="utf-8")

    # Общий вход. Отдельный адрес, а не параметр: ссылку кидают в чат, и там не
    # должно быть ни отметок владельца, ни двадцати четырёх чужих углов.
    (OUT / "go").mkdir(exist_ok=True)
    (OUT / "go" / "index.html").write_text(html.replace("__MODE__", "visitor"), encoding="utf-8")

    print(f"  reviewers/index.html    консоль — {len(CARDS)} карточек "
          f"({ru} ru / {len(CARDS) - ru} en)")
    print(f"  reviewers/go/index.html общий вход — тема выдаётся сама")


if __name__ == "__main__":
    build()
