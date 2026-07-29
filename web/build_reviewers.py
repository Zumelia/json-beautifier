#!/usr/bin/env python3
"""
Страница для тех, кто согласился посмотреть расширение: /reviewers/go/ —
служебная, noindex, ни с чего не слинкована.

Отзыв человек пишет сам и целиком: это его впечатление, и подставлять за него
слова нельзя. Страница даёт только повод — список вопросов, чтобы не сидеть
перед пустым полем в сторе.

Порядок вопросов случайный при каждом заходе. Иначе отвечают на первые три и
все отзывы получаются про одно и то же.

  /reviewers/go/   инструкция и пятнадцать вопросов
  /reviewers/      обзор всего пула + письмо для чата

    python3 build_reviewers.py
"""

import json
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "reviewers"

STORE = "https://chromewebstore.google.com/detail/mpeomjgcmddedcglokpmeideoelaidbn"
SAMPLES = "https://jsonbeautifier.dev/samples/"
GO = "https://jsonbeautifier.dev/reviewers/go/"

# (язык, тема, что попробовать, три вопроса). Вопросы открытые: на «понятно ли»
# и «всё ли верно» единственный естественный ответ — «да», и отзыв выходит
# пустым. Спрашиваем что, как и сколько.
TOPICS = [
    ("ru", "Большие ответы API", "открой /samples/large.json — 2.3 МБ в одну строку",
     ["Что открыл и сколько примерно ждал до появления дерева?",
      "Что делал дальше — сворачивал, искал? Как оно вело себя на таком объёме?",
      "Что на файлах такого размера делали вьюеры, которыми ты пользовался раньше?"]),
    ("ru", "Сломанный JSON", "открой /samples/broken.json — там нет запятой на 7-й строке",
     ["Что именно написало расширение — какие цифры и текст ты увидел?",
      "Сколько времени ушло, чтобы понять, где ошибка?",
      "Что на этом же файле показывают инструменты, которыми ты пользуешься?"]),
    ("ru", "Поиск", "на /samples/orders.json сверни всё и поищи «url»",
     ["Что искал и сколько совпадений нашлось?",
      "Опиши, что произошло со свёрнутыми ветками, когда пошёл поиск",
      "Чего в поиске не хватило?"]),
    ("ru", "Тёмная тема", "переключи тему в попапе",
     ["Опиши тёмную тему: что выглядит продуманным, а что просто перекрашенным?",
      "Как читаются цвета типов — строки, числа, ключи?",
      "На чём глаз спотыкается?"]),
    ("ru", "Номера строк", "открой любой JSON, номера включены по умолчанию",
     ["Зачем номера строк пригодились — или почему не пригодились?",
      "Что происходит с нумерацией, когда сворачиваешь ветки?",
      "Что бы ты в них изменил?"]),
    ("ru", "Права доступа", "посмотри список прав на странице расширения и в /privacy/",
     ["Какие права запрашивает расширение и как ты их оценил?",
      "Что в объяснении прав показалось убедительным, а что нет?",
      "Что бы ты спросил у автора на месте обычного пользователя?"]),
    ("ru", "Не-JSON страницы", "походи по обычным сайтам с включённым расширением",
     ["На каких сайтах ты его погонял?",
      "Что происходило на страницах, где JSON нет?",
      "Какие следы его присутствия ты вообще заметил?"]),
    ("ru", "Юникод и экранирование", "на /samples/orders.json есть японский, эмодзи и escape-последовательности",
     ["Какие символы проверил и что с ними стало?",
      "Что произошло с длинной строкой, которая не влезает в ширину окна?",
      "Что в этом месте обычно ломается у других вьюеров?"]),
    ("ru", "Копирование", "кликни по значению, попробуй «Copy JSON»",
     ["Что копировал и куда вставлял?",
      "В каком виде это пришло — совпало с ожиданием?",
      "Какого способа достать данные наружу не хватило?"]),
    ("ru", "Настройки", "открой попап: тема, отступ, глубина, сортировка, номера строк",
     ["Какие настройки поменял и что изменилось в открытой вкладке?",
      "Какую настройку добавил бы первой?",
      "Что из существующего кажется лишним?"]),
    ("ru", "Сортировка ключей", "включи «Sort object keys» на /samples/orders.json",
     ["Для какой задачи ты бы включал сортировку ключей?",
      "Что изменилось в чтении файла, когда ключи встали по алфавиту?",
      "Когда такая сортировка мешает?"]),
    ("ru", "Raw-режим", "нажми Raw и вернись обратно",
     ["Что показал Raw — совпало с исходником?",
      "На каких файлах проверял переключение и как быстро оно шло?",
      "Зачем вообще Raw в таком инструменте?"]),
    ("ru", "Открытый код", "github.com/Zumelia/json-beautifier — core/core.js и extension-chrome/src/",
     ["Что именно ты посмотрел в репозитории?",
      "Как проверял утверждение про отсутствие сетевых запросов и что нашёл?",
      "Что для тебя как разработчика значит открытый код в такой утилите?"]),
    ("ru", "Первое впечатление", "вспомни момент установки и первый открытый JSON",
     ["Опиши первые минуты — что произошло сразу после установки?",
      "На каком файле проверил и что увидел?",
      "Что было непонятно или показалось лишним?"]),
    ("ru", "Чего не хватает", "поработай с расширением на своих задачах пару дней",
     ["Над какими задачами ты работал, пока им пользовался?",
      "В какой момент захотелось функции, которой нет — какой именно?",
      "Что раздражает при ежедневном использовании?"]),
    ("en", "Deeply nested data", "open /samples/orders.json — six levels deep in places",
     ["How deep did you go, and where did it get hard to follow?",
      "What did the collapse controls do for you at that depth?",
      "How do the key and item counters change the way you move around?"]),
    ("en", "Coming from another viewer", "compare it against whatever you used before",
     ["What were you using before, and for what kind of work?",
      "Describe a moment where the difference between them showed",
      "What does the old one still do better?"]),
    ("en", "No network requests", "open DevTools → Network on a JSON page",
     ["What did you check, and what showed up in the Network tab?",
      "Why does that matter for a tool that reads every page you open?",
      "What else would you want verified before trusting it?"]),
    ("en", "Edge-case values", "in /samples/orders.json: empty objects, null, exponents, negatives",
     ["Which values did you look at, and how were they rendered?",
      "What was hard to tell apart?",
      "What do other viewers get wrong in this area?"]),
    ("en", "Speed on a busy machine", "use it during a normal working day",
     ["What does your normal working setup look like — tabs, machine?",
      "How long from opening a JSON URL to a tree you can use?",
      "Where, if anywhere, did it get in the way?"]),
    ("en", "The online tools", "try jsonbeautifier.dev/json-formatter/ next to the extension",
     ["What did you use the site for, and what the extension?",
      "Describe a moment where one saved you steps over the other",
      "What is confusing about having both?"]),
    ("en", "Copying a path", "click a nested value and copy its path",
     ["What did you copy the path of, and where did you paste it?",
      "What did the path look like — usable as it came?",
      "What format would you have expected instead?"]),
    ("en", "Auto-expand depth", "change the depth setting in the popup and reopen a file",
     ["What depth did you settle on, and for what kind of data?",
      "What happened to the tabs you already had open?",
      "What would you make the default, and why?"]),
    ("en", "Error recovery", "open /samples/broken.json and just read the message",
     ["What did the message tell you, word for word?",
      "How long did it take you to find the problem?",
      "How does that compare with the tools you use?"]),
    ("en", "Honest downside", "use it for a couple of days on real work",
     ["What did you use it for over those days?",
      "Describe the moment it annoyed you most",
      "What would stop you recommending it to a colleague?"]),
]

UI = {
    "ru": {
        "title": "Вопросы для вдохновения",
        "sub": "Отвечать на все не надо — выбери то, что зацепило, и напиши своими словами.",
        "swap": "In English",
        "intro": "Спасибо, что смотришь. Поставь, погоняй на своих задачах — а ниже "
                 "вопросы на случай, если не знаешь, с чего начать отзыв.",
        "nope": "Если расширение не понравилось — не пиши отзыв, напиши напрямую: ",
        "nope_link": "форма обратной связи",
        "steps_title": "Как оставить отзыв",
        "steps": [
            'Поставь расширение: <a href="{store}" target="_blank" rel="noopener">Chrome Web Store</a>',
            'Открой любой из примеров — <a href="/samples/" target="_blank" rel="noopener">jsonbeautifier.dev/samples/</a> — или свой JSON-URL',
            "Ниже есть список вопросов для вдохновения для отзыва",
            'Вернись на страницу расширения в сторе: вкладка <b>Reviews</b> → <b>Write a review</b>, напиши своими словами и отправь',
            'Для взаимного отзыва напиши в тг <a href="https://t.me/minisol" target="_blank" rel="noopener">@minisol</a> — и сюда же, если нашёл баг :)',
        ],
    },
    "en": {
        "title": "Questions for inspiration",
        "sub": "No need to answer them all — pick whatever struck you and write it your way.",
        "swap": "По-русски",
        "intro": "Thanks for taking a look. Install it, use it on your own work — the "
                 "questions below are there in case you don't know where to start.",
        "nope": "If you didn't like it, please don't review it — tell me instead: ",
        "nope_link": "feedback form",
        "steps_title": "How to leave a review",
        "steps": [
            'Install it: <a href="{store}" target="_blank" rel="noopener">Chrome Web Store</a>',
            'Open one of the samples — <a href="/samples/" target="_blank" rel="noopener">jsonbeautifier.dev/samples/</a> — or any JSON URL of your own',
            "Below is a list of questions to give you something to write about",
            'Back on the store page: <b>Reviews</b> → <b>Write a review</b>, write it in your own words and send',
            'For a review in return, message <a href="https://t.me/minisol" target="_blank" rel="noopener">@minisol</a> on Telegram — and the same place if you found a bug :)',
        ],
    },
}

CSS = """
  .steps-box { margin-top: 30px; }
  .steps-box h2 { font-size: clamp(22px, 2.6vw, 26px); margin: 0; }
  .steps { margin: 20px 0 0; padding-left: 22px; }
  .steps li { margin-bottom: 9px; }

  .qs-title { margin: 38px 0 8px; font-size: clamp(24px, 3vw, 30px); }
  .qs-sub { margin: 0 0 18px; color: var(--muted); }
  .pick { display: flex; gap: 10px; margin: 0 0 18px; flex-wrap: wrap; }
  .qs { margin: 0; padding: 0; list-style: none; }
  .qs li { padding: 15px 0; border-bottom: 1px solid var(--border-soft); }
  .qs li:last-child { border-bottom: 0; }
  .qs-q { font-size: 16.5px; }
  .qs-topic { display: block; margin-top: 5px; font-family: var(--font-mono);
              font-size: 12px; letter-spacing: .04em; color: var(--faint); }
"""

JS = """
(() => {
  "use strict";
  const POOL = __POOL__;
  const UI = __UI__;
  const HOW_MANY = 15;

  const lang = (() => {
    const saved = localStorage.getItem("jb-rev-lang");
    if (saved === "ru" || saved === "en") return saved;
    return (navigator.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
  })();
  const t = UI[lang];

  document.documentElement.lang = lang;
  document.querySelector("[data-intro]").textContent = t.intro;
  document.querySelector("[data-strip]").innerHTML =
    t.nope + '<a href="/feedback/">' + t.nope_link + "</a>.";
  document.querySelector("[data-qs-title]").textContent = t.title;
  document.querySelector("[data-qs-sub]").textContent = t.sub;
  const swap = document.querySelector("[data-lang-switch]");
  swap.textContent = t.swap;
  swap.addEventListener("click", () => {
    localStorage.setItem("jb-rev-lang", lang === "ru" ? "en" : "ru");
    location.reload();
  });
  const steps = document.querySelector('[data-steps="' + lang + '"]');
  if (steps) steps.hidden = false;

  // Порядок случайный при каждом заходе и НЕ запоминается: иначе человек
  // отвечает на первые три, и все отзывы выходят про одно и то же.
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Сначала по одному вопросу из каждой темы, и только потом добираем: пятнадцать
  // вопросов из пяти тем — это те же пять вопросов, сказанные по-разному.
  const mine = POOL.filter((q) => q.lang === lang);
  const byTopic = new Map();
  mine.forEach((q) => {
    if (!byTopic.has(q.topic)) byTopic.set(q.topic, []);
    byTopic.get(q.topic).push(q);
  });
  const buckets = shuffle([...byTopic.values()].map((qs) => shuffle(qs.slice())));
  const chosen = [];
  for (let round = 0; chosen.length < HOW_MANY && round < 3; round++) {
    for (const b of buckets) {
      if (chosen.length >= HOW_MANY) break;
      if (b[round]) chosen.push(b[round]);
    }
  }

  const list = document.querySelector("[data-qs]");
  shuffle(chosen).forEach((q) => {
    const li = document.createElement("li");
    const main = document.createElement("span");
    main.className = "qs-q";
    main.textContent = q.q;
    const sub = document.createElement("span");
    sub.className = "qs-topic";
    sub.textContent = q.topic + " · " + q.try;
    li.append(main, sub);
    list.appendChild(li);
  });
})();
"""

GO_TEMPLATE = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>JSON Beautifier</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<style>__CSS__</style>
</head>
<body>
<main id="main">
  <section class="wrap section" style="max-width:820px">
    <h1>JSON Beautifier</h1>
    <p class="lead" data-intro></p>

    <div class="steps-box" data-steps="ru" hidden>__STEPS_RU__</div>
    <div class="steps-box" data-steps="en" hidden>__STEPS_EN__</div>

    <p class="note-strip" style="margin-top:26px" data-strip></p>

    <h2 class="qs-title" data-qs-title></h2>
    <p class="qs-sub" data-qs-sub></p>
    <div class="pick"><button class="btn btn-sm btn-ghost" data-lang-switch></button></div>
    <div class="card"><ul class="qs" data-qs></ul></div>
  </section>
</main>
<script>__JS__</script>
</body>
</html>
"""

CHAT_MSG = """Ребят, кто недавно запустился — предлагаю обмен тестированием. Я ставлю ваше расширение, полчаса гоняю по-настоящему и пишу разбор: что сломалось, что непонятно в листинге, где права выглядят подозрительно. Взамен прошу того же.

Моё — JSON Beautifier, форматирует любой JSON-URL сразу при открытии:
{store}

Если не знаешь, с чего начать отзыв, — вот страничка с вопросами для вдохновения:
{go}

Отзыв не обязателен и не в обмен: если не понравится — лучше напиши мне, починю."""


def steps_html(lang):
    u = UI[lang]
    items = "".join("<li>" + s.format(store=STORE) + "</li>" for s in u["steps"])
    return f'<h2>{escape(u["steps_title"])}</h2><ol class="steps">{items}</ol>'


def build_go(pool):
    html = (GO_TEMPLATE
            .replace("__CSS__", CSS)
            .replace("__STEPS_RU__", steps_html("ru"))
            .replace("__STEPS_EN__", steps_html("en"))
            .replace("__JS__", JS
                     .replace("__POOL__", json.dumps(pool, ensure_ascii=False))
                     .replace("__UI__", json.dumps(UI, ensure_ascii=False))))
    (OUT / "go").mkdir(parents=True, exist_ok=True)
    (OUT / "go" / "index.html").write_text(html, encoding="utf-8")
    return len(html)


def build_console(pool):
    rows = []
    for lang in ("ru", "en"):
        items = []
        for topic, tryit, qs in [(t[1], t[2], t[3]) for t in TOPICS if t[0] == lang]:
            lis = "".join(f"<li>{escape(q)}</li>" for q in qs)
            items.append(f"<div class='card' style='margin-bottom:14px'><h3>{escape(topic)}</h3>"
                         f"<p style='color:var(--muted);margin:8px 0 10px'>{escape(tryit)}</p>"
                         f"<ul style='margin:0;padding-left:20px;color:var(--muted)'>{lis}</ul></div>")
        n = sum(1 for t in TOPICS if t[0] == lang)
        combos = (n * (n - 1) * (n - 2) // 6) * 27
        rows.append(f"<h2 style='margin-top:38px'>{lang.upper()} — {n} тем, "
                    f"{n * 3} вопросов, {combos:,} наборов по три</h2>" + "".join(items))

    html = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Пул вопросов — служебная страница</title>
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="/assets/fonts.css"><link rel="stylesheet" href="/assets/site.css">
</head><body><main><section class="wrap section" style="max-width:820px">
<p class="eyebrow">служебная · не индексируется · ниоткуда не слинкована</p>
<h1>Пул вопросов</h1>
<p class="lead">Рабочая страница для людей — <a href="/reviewers/go/">/reviewers/go/</a>.
Она выдаёт три вопроса из трёх разных тем; у каждого своя кнопка «другой вопрос».</p>
<div class="card" style="margin-top:26px">
  <h3>Сообщение для чата</h3>
  <textarea id="chat" rows="12" style="width:100%;margin-top:12px;padding:12px;
    border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);
    color:var(--text);font:15px/1.55 var(--font-body)">{escape(CHAT_MSG.format(store=STORE, go=GO))}</textarea>
  <p style="margin-top:12px"><button class="btn btn-sm" id="copy">Скопировать</button>
  <span id="ok" style="margin-left:12px;color:var(--ok);font-weight:600"></span></p>
</div>
{"".join(rows)}
</section></main>
<script>
document.getElementById("copy").addEventListener("click", () => {{
  const t = document.getElementById("chat");
  navigator.clipboard.writeText(t.value)
    .then(() => {{ document.getElementById("ok").textContent = "Скопировано"; }})
    .catch(() => t.select());
}});
</script>
</body></html>
"""
    (OUT / "index.html").write_text(html, encoding="utf-8")


def main():
    pool = [{"lang": lang, "topic": topic, "try": tryit, "q": q}
            for lang, topic, tryit, qs in TOPICS for q in qs]
    size = build_go(pool)
    build_console(pool)
    ru = sum(1 for p in pool if p["lang"] == "ru")
    print(f"  reviewers/go/index.html  {len(pool)} вопросов ({ru} ru / {len(pool) - ru} en) "
          f"из {len(TOPICS)} тем, {size:,} B")
    print(f"  reviewers/index.html     обзор пула + письмо для чата")


if __name__ == "__main__":
    main()
