#!/usr/bin/env python3
"""
Страница для работы с отзывами: /reviewers/ — служебная, noindex, ни с чего не
слинкована.

Что здесь НЕ лежит: готовых текстов отзывов. Двадцать пять отредактированных
копий одного текста — это одно мнение в двадцати пяти редакциях, и видно это и
читателю, и фильтрам стора. У людей, которые правда попробовали, совпадают
выводы, но не формулировки и не то, ЧТО ИМЕННО они заметили.

Что лежит вместо: двадцать пять разных углов. Каждому человеку — свой, под его
опыт: одному про большие файлы, другому про права доступа, третьему про то, как
ведёт себя расширение на не-JSON страницах. Барьер «не знаю, с чего начать»
снимается, а мнение остаётся его. Побочный эффект — двадцать пять человек
напишут о двадцати пяти разных вещах, и это и честнее, и полезнее для листинга,
чем двадцать пять раз «удобно и быстро».

    python3 build_reviewers.py      # → reviewers/index.html
"""

from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "reviewers"

STORE = "https://chromewebstore.google.com/detail/mpeomjgcmddedcglokpmeideoelaidbn"
SAMPLES = "https://jsonbeautifier.dev/samples/"

# (язык, угол, что попробовать, о чём спросить)
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
     "Загляни в репозиторий: github.com/Zumelia/json-beautifier, файлы core/core.js и extension-chrome/src/.",
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

Если будет пара минут, глянешь? Не нужно писать «вообще» — мне интереснее одна конкретная вещь: {angle_low}.

Что попробовать: {try_it}
Файлы для этого: {samples}

О чём было бы полезно услышать:
{questions}

Честно про минусы, чтобы не тратил время: Firefox не поддерживается (мешает его собственный просмотрщик JSON), горячих клавиш нет.

Если решишь оставить отзыв в сторе — только своими словами и только если правда попробовал. Если не понравится, напиши лучше мне напрямую, а не в стор: починю.

Спасибо!"""

MSG_EN = """Hi! I shipped my first extension — JSON Beautifier. It formats any JSON URL the moment you open it.

{store}

If you have a couple of minutes, would you take a look? No need to review it "in general" — I'm after one specific thing: {angle_low}.

What to try: {try_it}
Files for it: {samples}

What would be useful to hear:
{questions}

The honest downsides, so you don't waste time: no Firefox (its own JSON viewer gets there first), no keyboard shortcuts.

If you do leave a review, please use your own words, and only if you actually tried it. If you don't like it, tell me directly rather than the store — I'll fix it.

Thanks!"""


def build():
    cards = []
    for i, (lang, angle, try_it, questions) in enumerate(CARDS, 1):
        tpl = MSG_RU if lang == "ru" else MSG_EN
        msg = tpl.format(store=STORE, samples=SAMPLES, try_it=try_it,
                         angle_low=angle[0].lower() + angle[1:],
                         questions="\n".join("— " + q for q in questions))
        qs = "".join(f"<li>{escape(q)}</li>" for q in questions)
        cards.append(f"""
<article class="card rev" data-n="{i}">
  <div class="rev-head">
    <span class="num">{i:02d}</span>
    <span class="tag">{lang.upper()}</span>
    <h3>{escape(angle)}</h3>
  </div>
  <p class="rev-try">{escape(try_it)}</p>
  <ul class="rev-q">{qs}</ul>
  <div class="rev-act">
    <button class="btn btn-sm" data-copy>Скопировать и отметить отправленным</button>
    <span class="rev-sent" hidden>Уже отправлен</span>
    <label class="rev-pub"><input type="checkbox" data-pub> отзыв опубликован</label>
  </div>
  <textarea class="rev-msg" hidden>{escape(msg)}</textarea>
</article>""")

    ru = sum(1 for c in CARDS if c[0] == "ru")
    html = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Работа с отзывами — служебная страница</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<style>
  .rev {{ margin-bottom: 18px; }}
  .rev-head {{ display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }}
  .rev-head h3 {{ margin: 0; font-size: 20px; }}
  .tag {{ font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em;
          padding: 3px 8px; border-radius: var(--pill); background: var(--chip); color: var(--accent); }}
  .rev-try {{ margin: 12px 0 0; color: var(--muted); }}
  .rev-q {{ margin: 10px 0 0; padding-left: 20px; color: var(--muted); font-size: 15px; }}
  .rev-q li {{ margin-bottom: 4px; }}
  .rev-act {{ display: flex; align-items: center; gap: 14px; margin-top: 16px; flex-wrap: wrap; }}
  .rev-sent {{ color: var(--ok); font-weight: 600; font-size: 14px; }}
  .rev-pub {{ display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }}
  .rev.is-pub {{ opacity: .55; }}
  .rev-count {{ font-family: var(--font-mono); color: var(--faint); font-size: 14px; }}
</style>
</head>
<body>
<main id="main">
  <section class="wrap section" style="max-width:820px">
    <p class="eyebrow">служебная страница · не индексируется · ниоткуда не слинкована</p>
    <h1>Работа с отзывами</h1>
    <p class="lead">Двадцать пять разных углов — по одному на человека. Каждому достаётся
      своя тема, поэтому люди пишут о разном, а не пересказывают один и тот же текст.
      {ru} на русском, {len(CARDS) - ru} на английском.</p>

    <p class="note-strip" style="margin-top:22px">Кнопка копирует <b>письмо человеку</b>, а не
      текст отзыва. Отзыв он пишет сам — иначе это не двадцать пять мнений, а одно
      в двадцати пяти редакциях, что видно и читателю, и стору.</p>

    <p class="rev-count" style="margin-top:26px" data-count></p>
    {"".join(cards)}
  </section>
</main>

<script>
(() => {{
  "use strict";
  const KEY = (n, k) => `jb-rev-${{n}}-${{k}}`;
  const cards = [...document.querySelectorAll(".rev")];
  const counter = document.querySelector("[data-count]");

  const recount = () => {{
    const sent = cards.filter(c => localStorage.getItem(KEY(c.dataset.n, "sent"))).length;
    const pub = cards.filter(c => localStorage.getItem(KEY(c.dataset.n, "pub"))).length;
    counter.textContent = `отправлено ${{sent}} из ${{cards.length}} · опубликовано ${{pub}}`;
  }};

  cards.forEach((card) => {{
    const n = card.dataset.n;
    const btn = card.querySelector("[data-copy]");
    const sent = card.querySelector(".rev-sent");
    const pub = card.querySelector("[data-pub]");

    const markSent = () => {{ btn.disabled = true; sent.hidden = false; }};
    if (localStorage.getItem(KEY(n, "sent"))) markSent();
    if (localStorage.getItem(KEY(n, "pub"))) {{ pub.checked = true; card.classList.add("is-pub"); }}

    btn.addEventListener("click", () => {{
      const text = card.querySelector(".rev-msg").value;
      // Состояние ставим только после реального успеха: пометить отправленным
      // письмо, которое не попало в буфер, — верный способ пропустить человека.
      navigator.clipboard.writeText(text).then(() => {{
        localStorage.setItem(KEY(n, "sent"), "1");
        markSent();
        recount();
      }}).catch(() => {{
        btn.textContent = "Не удалось скопировать — выдели текст вручную";
        card.querySelector(".rev-msg").hidden = false;
      }});
    }});

    pub.addEventListener("change", () => {{
      if (pub.checked) localStorage.setItem(KEY(n, "pub"), "1");
      else localStorage.removeItem(KEY(n, "pub"));
      card.classList.toggle("is-pub", pub.checked);
      recount();
    }});
  }});

  recount();
}})();
</script>
</body>
</html>
"""
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(html, encoding="utf-8")
    print(f"  reviewers/index.html — {len(CARDS)} карточек ({ru} ru / {len(CARDS) - ru} en), "
          f"{len(html):,} B")


if __name__ == "__main__":
    build()
