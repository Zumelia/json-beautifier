#!/usr/bin/env python3
"""
Служебные страницы jsonbeautifier.dev: /welcome/, /uninstall/, /feedback/, /rate/
и текстовый шаблон (/privacy/ и будущие /terms/, /about/).

Шапку, меню и футер берём из build.py — одна общая обвязка на весь сайт.

    python3 build_pages.py
"""

import html
import re
from pathlib import Path

from build import NAV, SHEET, FOOTER

HERE = Path(__file__).resolve().parent
FORMSPREE = "https://formspree.io/f/mwvgrkov"


def shell(slug, title, desc, body, *, noindex=False, scripts=""):
    robots = "noindex,follow" if noindex else "index,follow"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="https://jsonbeautifier.dev/{slug}">
<meta name="robots" content="{robots}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="https://jsonbeautifier.dev/assets/og/default.png">
<meta property="og:site_name" content="JSON Beautifier">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="hdr">
  <div class="wrap">
    <div class="hdr-in">
      <a class="logo" href="/"><span class="mark">{{}}</span> JSON Beautifier</a>
{NAV}
      <span class="spacer"></span>
      <button class="icon-btn" data-theme-toggle aria-label="Switch theme">☾</button>
      <button class="icon-btn burger" data-menu-toggle aria-expanded="false" aria-controls="sheet" aria-label="Menu">☰</button>
      <a class="btn btn-sm" data-cta-slot="header" target="_blank" rel="noopener" href="#">Add to Chrome</a>
    </div>
  </div>
</header>

{SHEET}

<main id="main">
{body}
</main>

{FOOTER}

<script src="/assets/site-config.js"></script>
<script src="/assets/site.js" defer></script>
{scripts}
</body>
</html>
"""


FORM_JS = '<script src="/assets/forms.js" defer></script>'

REASONS = [
    "Didn't work on my pages",
    "Too slow or heavy",
    "Missing a feature I needed",
    "Found something better",
    "Installed it by mistake",
    "Something else",
]

TYPES = ["Bug", "Feature request", "Question", "Something else"]


def radios():
    rows = []
    for i, r in enumerate(REASONS):
        req = " required" if i == 0 else ""
        rows.append(
            '        <label class="row-opt"><input type="radio" name="Reason" '
            f'value="{html.escape(r)}"{req}> {html.escape(r)}</label>'
        )
    return "\n".join(rows)


def options():
    return "\n".join(f"          <option>{html.escape(t)}</option>" for t in TYPES)


# --------------------------------------------------------------------------
# /welcome/ — открывается расширением при установке.
# URL менять нельзя: по обращениям к нему считаются установки, точка отсчёта
# уже зафиксирована в metrics/.
WELCOME = """  <section class="wrap section">
    <p class="eyebrow">✓ Installed</p>
    <h1>You're all set</h1>
    <p class="lead">One quick step so you can always find it — then open a sample and watch it work.</p>

    <div class="grid-3" style="margin-top:34px">
      <div class="card">
        <span class="num">Step 1</span><h3>Pin it to your toolbar</h3>
        <p>Click the puzzle-piece icon at the top right of Chrome, find JSON Beautifier,
           and click the pin. Chrome hides new extensions behind that icon.</p>
      </div>
      <div class="card">
        <span class="num">Step 2</span><h3>Open any JSON URL</h3>
        <p>An API endpoint, a localhost port, a staging server. It formats itself —
           there is no button to press.</p>
        <p style="margin-top:14px"><a class="btn btn-sm" href="/samples/orders.json">Open a sample →</a></p>
      </div>
      <div class="card">
        <span class="num">Step 3</span><h3>Make it yours</h3>
        <p>Click the toolbar icon for theme, indent width, how deep it expands,
           whether keys are sorted, and line numbers.</p>
      </div>
    </div>

    <p class="note-strip" style="margin-top:26px"><b>Already have JSON tabs open?</b>
      Reload them once. A tab opened before the install is still running the old page.</p>

    <h2 style="margin-top:56px">Two more worth opening</h2>
    <div class="grid-3" style="margin-top:22px">
      <div class="card"><h3>A big one</h3>
        <p>2.3 MB on a single line, the way a real endpoint sends it. The tree stays
           scrollable instead of freezing the tab.</p>
        <p style="margin-top:14px"><a class="mini" href="/samples/large.json">large.json</a></p>
      </div>
      <div class="card"><h3>A broken one</h3>
        <p>A comma is missing on line 7. You get the line, the column and a caret under
           the exact character — not a blank page.</p>
        <p style="margin-top:14px"><a class="mini" href="/samples/broken.json">broken.json</a></p>
      </div>
      <div class="card"><h3>Something wrong?</h3>
        <p>Say so and it gets fixed. The person who reads it wrote the code.</p>
        <p style="margin-top:14px"><a class="mini" href="/feedback/">Send feedback</a>
           <a class="mini" href="#" data-href="github" target="_blank" rel="noopener noreferrer">GitHub issues</a></p>
      </div>
    </div>
  </section>"""


UNINSTALL = f"""  <section class="wrap section" style="max-width:780px">
    <h1>Sorry to see you go</h1>
    <p class="lead">If something was wrong, one click tells us what. No account, and no reply
      unless you ask for one.</p>

    <form class="form" data-form action="{FORMSPREE}" method="post" style="margin-top:28px">
      <input type="hidden" name="_subject" value="jsonbeautifier.dev: Uninstall">
      <input type="hidden" name="Page" value="">
      <input type="hidden" name="Browser" value="">
      <input type="hidden" name="Extension version" value="">

      <fieldset class="opts-list form-row">
        <legend class="form-legend">Why did you remove it?</legend>
{radios()}
      </fieldset>

      <div class="form-row">
        <label for="u-comment">Anything else? <span class="opt-note">optional</span></label>
        <textarea id="u-comment" name="Comment" rows="4" class="field" placeholder="What went wrong?"></textarea>
      </div>

      <div class="form-row">
        <label for="u-email">Email <span class="opt-note">optional — only if you want an answer</span></label>
        <input id="u-email" type="email" name="email" class="field" placeholder="you@example.com">
      </div>

      <div class="form-foot">
        <button class="btn" type="submit">Send</button>
        <span class="hintline">Goes straight to the person who wrote the code.</span>
      </div>
    </form>

    <div class="form-ok" id="form-ok" tabindex="-1" hidden style="margin-top:28px">
      <h2 style="font-size:24px">Thanks — this actually gets read.</h2>
      <p style="color:var(--muted)">If it was a bug or a missing feature, it goes on the list.
        What ships lands in the <a href="/changelog/">changelog</a>.</p>
      <p style="margin-top:18px"><a class="btn btn-sm" data-cta-slot="footer" target="_blank" rel="noopener" href="#">Reinstall</a></p>
    </div>
    <p class="warn" id="form-fail" hidden>Couldn't send that — your text is still here.
      Try again, or open an issue on <a href="#" data-href="github" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
  </section>"""


FEEDBACK = f"""  <section class="wrap section" style="max-width:780px">
    <h1>Tell us what's broken</h1>
    <p class="lead">No account, no ticket number. This goes to the person who wrote the code.</p>
    <p id="stars-badge" hidden style="font-size:28px;color:var(--sun);margin:12px 0 0"></p>

    <form class="form" data-form action="{FORMSPREE}" method="post" style="margin-top:28px">
      <input type="hidden" name="_subject" value="jsonbeautifier.dev: Feedback">
      <input type="hidden" name="Page" value="">
      <input type="hidden" name="Browser" value="">
      <input type="hidden" name="Extension version" value="">
      <input type="hidden" name="Rating" value="">

      <div class="form-row">
        <label for="f-type">What is it?</label>
        <select id="f-type" name="Type" class="field">
{options()}
        </select>
      </div>

      <div class="form-row">
        <label for="f-msg">What happened?</label>
        <textarea id="f-msg" name="Message" rows="6" class="field" required
          placeholder="What you did, what you expected, what happened instead. A URL helps if the page is public."></textarea>
      </div>

      <div class="form-row">
        <label for="f-email">Email <span class="opt-note">optional</span></label>
        <input id="f-email" type="email" name="email" class="field" placeholder="you@example.com">
      </div>

      <div class="form-row">
        <label class="row-check"><input type="checkbox" name="May we reply" value="yes"> You may reply to me</label>
      </div>

      <div class="form-foot">
        <button class="btn" type="submit">Send</button>
        <span class="hintline">No account, no ticket number.</span>
      </div>
    </form>

    <div class="form-ok" id="form-ok" tabindex="-1" hidden style="margin-top:28px">
      <h2 style="font-size:24px">Sent — this actually gets read.</h2>
      <p style="color:var(--muted)">If it's a bug, it usually turns into a line in the
        <a href="/changelog/">changelog</a>.</p>
    </div>
    <p class="warn" id="form-fail" hidden>Couldn't send that — your text is still here.
      Try again, or open an issue on <a href="#" data-href="github" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>

    <p style="margin-top:26px;color:var(--muted);font-size:14.5px">Prefer GitHub?
      <a href="#" data-href="github" target="_blank" rel="noopener noreferrer">Open an issue</a> — the same person reads both.</p>
  </section>"""


RATE = """  <section class="wrap section">
    <div class="rate" style="max-width:780px;margin:0 auto">
      <h1>Using the extension? Rate it.</h1>
      <p class="lead" style="margin-inline:auto;max-width:52ch">Four or five stars go to the
        Chrome Web Store. One to three come to us privately, where a fix can actually happen.</p>
      <div id="rate-widget">
        <div class="stars" role="radiogroup" aria-label="Rate JSON Beautifier">
          <button class="star" data-rate-star="1" role="radio" aria-checked="false" aria-label="1 star">★</button>
          <button class="star" data-rate-star="2" role="radio" aria-checked="false" aria-label="2 stars">★</button>
          <button class="star" data-rate-star="3" role="radio" aria-checked="false" aria-label="3 stars">★</button>
          <button class="star" data-rate-star="4" role="radio" aria-checked="false" aria-label="4 stars">★</button>
          <button class="star" data-rate-star="5" role="radio" aria-checked="false" aria-label="5 stars">★</button>
        </div>
        <p class="rate-label" id="rate-label"></p>
        <div class="rate-actions" id="rate-actions" hidden>
          <a class="btn" id="rate-store" href="#" rel="noopener" hidden>Rate on the Chrome Web Store →</a>
          <a class="btn btn-ghost" id="rate-form" href="/feedback/" hidden>Tell us what's wrong →</a>
        </div>
      </div>
      <p id="rate-done" hidden></p>
      <p style="margin-top:26px;color:var(--muted);font-size:14.5px">Not ready to rate?
        <a href="/feedback/">Tell us why</a> instead.</p>
    </div>
  </section>"""


def changelog_body():
    """Собирает /changelog/ из changelog.json.

    Записи выведены из истории git, но написаны для людей: заголовок коммита
    сообщает, что мы двигали в репозитории, а пользователю нужно знать, что
    изменилось в продукте. Сверять с `git log v0.2.7..HEAD -- extension-chrome core`.
    """
    import json

    data = json.loads((HERE / "changelog.json").read_text(encoding="utf-8"))
    blocks = []
    for rel in data["releases"]:
        when = rel["date"] or "unreleased"
        badge = ' <span class="pill-tag">in development</span>' if rel["date"] is None else ""
        groups = []
        for name, items in rel["groups"].items():
            if not items:
                continue
            lis = "\n".join("        <li>" + i + "</li>" for i in items)
            groups.append(
                '      <h3 class="cl-group">' + name + "</h3>\n"
                '      <ul class="cl-list">\n' + lis + "\n      </ul>"
            )
        anchor = "v" + rel["version"].replace(".", "-")
        # status и note есть только у записей, которые ещё не вышли: у них надо
        # объяснить, почему версии нет в сторе. У вышедшего релиза объяснять
        # нечего — дата и есть весь статус, а пустая строка «· » выглядит
        # обрывом. Раньше поля были обязательными, и сборка падала на первом же
        # релизе, с которого сняли черновую пометку.
        status = rel.get("status")
        note = rel.get("note")
        blocks.append(
            '    <article class="card cl-item" id="' + anchor + '">\n'
            '      <header class="cl-head">\n'
            "        <h2>" + rel["version"] + badge + "</h2>\n"
            '        <p class="cl-meta"><time>' + when + "</time>"
            + (" &middot; " + status if status else "") + "</p>\n"
            "      </header>\n"
            + ('      <p class="cl-note">' + note + "</p>\n" if note else "")
            + "\n".join(groups) + "\n    </article>"
        )
    return (
        '  <section class="wrap section" style="max-width:860px">\n'
        "    <h1>Changelog</h1>\n"
        '    <p class="lead">What shipped, when, and what it fixed. Written for the person using\n'
        "      the extension — the commit history is on\n"
        '      <a href="#" data-href="github" target="_blank" rel="noopener noreferrer">GitHub</a> if you want the other kind.</p>\n'
        '    <div class="cl" style="margin-top:34px">\n'
        + "\n".join(blocks)
        + "\n    </div>\n  </section>"
    )


SAMPLES = """  <section class="wrap section" style="max-width:860px">
    <h1>Sample JSON files</h1>
    <p class="lead">Open any of these to see what the extension does with a real response.
      All the data is invented — no third-party APIs, no real people. Copy it, break it, use
      it in your own tests.</p>

    <div class="grid-3" style="margin-top:38px">
      <div class="card">
        <span class="num">37 KB · one line</span>
        <h3><a href="/samples/orders.json">orders.json</a></h3>
        <p>A nested API response: objects six levels deep, an array of 140 log events,
          hyphenated header keys, Japanese and accented text, escapes, empty structures and
          every scalar type.</p>
        <p style="margin-top:12px"><b>Minified, exactly as a real endpoint would send it</b> —
          which is the point: this is what JSON looks like before anything formats it.</p>
      </div>
      <div class="card">
        <span class="num">2.3 MB · one line</span>
        <h3><a href="/samples/large.json">large.json</a></h3>
        <p>Twelve thousand records. Shows that a large document stays scrollable and
          collapsible instead of freezing the tab.</p>
        <p style="margin-top:12px">In raw view a line this long is force-wrapped — a browser
          cannot draw a line millions of pixels wide.</p>
      </div>
      <div class="card">
        <span class="num">327 B</span>
        <h3><a href="/samples/broken.json">broken.json</a></h3>
        <p>Deliberately invalid: a comma is missing on line 7.</p>
        <p style="margin-top:12px">A viewer should tell you where the problem is — line,
          column and the offending character — not show you a blank page.</p>
      </div>
    </div>

    <p class="note-strip" style="margin-top:28px">Without the extension these open as raw
      text, which is the honest before-and-after. With it, the first two become trees and the
      third becomes a readable error.</p>

    <div class="final" style="margin-top:40px">
      <h2>See the difference</h2>
      <p class="lead" style="margin-inline:auto;max-width:46ch">Install it, then open the
        first file again. Nothing to press.</p>
      <p style="margin-top:22px"><a class="btn" data-cta-slot="samples" href="#">Add to Chrome — free</a></p>
    </div>
  </section>"""


NOT_FOUND = """  <section class="wrap section" style="max-width:760px">
    <p class="eyebrow">Error 404</p>
    <h1>This page doesn't exist</h1>
    <p class="lead">Either the address has a typo in it, or something here moved and we left a
      stale link behind. If it was our link, <a href="/feedback/">tell us</a> — that is a bug
      like any other.</p>

    <div class="grid-3" style="margin-top:38px">
      <div class="card">
        <h3>Format some JSON</h3>
        <p>Paste, drop a file or load a sample. Runs in the page — nothing is uploaded.</p>
        <p style="margin-top:14px"><a class="mini" href="/">Beautifier</a>
          <a class="mini" href="/json-validator/">Validator</a>
          <a class="mini" href="/json-minifier/">Minifier</a></p>
      </div>
      <div class="card">
        <h3>Read the documentation</h3>
        <p>What each control does, which permissions the extension asks for, and what to try
          when something looks wrong.</p>
        <p style="margin-top:14px"><a class="mini" href="/docs/">Docs</a>
          <a class="mini" href="/changelog/">Changelog</a></p>
      </div>
      <div class="card">
        <h3>Try it on real data</h3>
        <p>Our own sample files: an ordinary response, a 2.3 MB one, and one that is
          deliberately broken.</p>
        <p style="margin-top:14px"><a class="mini" href="/samples/">Samples</a></p>
      </div>
    </div>

    <div class="final" style="margin-top:40px">
      <h2>Or get the extension</h2>
      <p class="lead" style="margin-inline:auto;max-width:46ch">Then JSON formats itself
        wherever you open it, and you stop visiting pages like this one.</p>
      <p style="margin-top:22px"><a class="btn" data-cta-slot="404" href="#">Add to Chrome — free</a></p>
    </div>
  </section>"""


def text_page(title, body_html):
    """Шаблон текстовой страницы: /privacy/, дальше /terms/ и /about/."""
    return f"""  <section class="wrap section" style="max-width:760px">
{body_html}
  </section>"""


def privacy_page():
    """Собирает /privacy/ из privacy-content.html.

    Раньше эта функция читала ЖИВУЮ страницу и заворачивала её в обвязку
    заново — то есть каждая пересборка вкладывала предыдущую страницу внутрь
    новой. За несколько выкладок получилось двенадцать шапок и 32 КБ.
    Источник обязан быть неизменяемым файлом, а не результатом прошлой сборки.

    Юридический текст не переписываем: он опубликован, и на него ссылается
    листинг в сторе."""
    content = (HERE / "privacy-content.html").read_text(encoding="utf-8")
    return shell(
        "privacy/",
        "Privacy — JSON Beautifier",
        "What JSON Beautifier collects (nothing), what it stores locally, and why it asks for the permissions it asks for.",
        '  <section class="wrap section" style="max-width:760px">\n' + content + "\n  </section>",
    )


def main():
    pages = [
        ("welcome", shell("welcome/", "JSON Beautifier is installed",
                          "JSON Beautifier is installed. Pin it, open a sample, and see what it does.",
                          WELCOME, noindex=True)),
        ("uninstall", shell("uninstall/", "Sorry to see you go — JSON Beautifier",
                            "Tell us why you removed JSON Beautifier. One click, and it actually gets read.",
                            UNINSTALL, noindex=True, scripts=FORM_JS)),
        ("feedback", shell("feedback/", "Tell us what's broken — JSON Beautifier",
                           "Report a bug or ask for a feature. Read by the person who wrote the code.",
                           FEEDBACK, noindex=True, scripts=FORM_JS)),
        ("samples", shell("samples/", "Sample JSON files for testing — JSON Beautifier",
                          "Free sample JSON endpoints: a nested API response, a 2.3 MB one, and one that is deliberately broken. All invented data.",
                          SAMPLES)),
        ("changelog", shell("changelog/", "Changelog — JSON Beautifier",
                            "Every release of JSON Beautifier: what was added, what changed, what was fixed.",
                            changelog_body())),
        ("rate", shell("rate/", "Rate JSON Beautifier",
                       "Four or five stars go to the Chrome Web Store, one to three come to us privately.",
                       RATE, noindex=True)),
    ]
    Path(HERE / "404.html").write_text(
        shell("404.html", "Page not found — JSON Beautifier",
              "That page does not exist. Here is where everything else lives.",
              NOT_FOUND, noindex=True),
        encoding="utf-8")
    print("  /404.html")

    pages.append(("privacy", privacy_page()))

    for slug, content in pages:
        out = HERE / slug
        out.mkdir(exist_ok=True)
        (out / "index.html").write_text(content, encoding="utf-8")
        print(f"  /{slug}/  {len(content):>7,} B")


if __name__ == "__main__":
    main()
