#!/usr/bin/env python3
"""
Страница /docs/ по макету «JSON Beautifier — Docs».

Одна страница с якорями, а не набор подстраниц: так проще давать точные ссылки
в ответах на отзывы в сторе, и при нашем объёме это лучше для индексации.

    python3 build_docs.py
"""

import html
from pathlib import Path

from build import NAV, SHEET, FOOTER

HERE = Path(__file__).resolve().parent

SECTIONS = [
    ("installation", "Installation"),
    ("browsers", "Supported browsers"),
    ("toolbar", "The toolbar"),
    ("settings", "Settings"),
    ("shortcuts", "Keyboard shortcuts"),
    ("local-files", "Local files"),
    ("limits", "Large files and limits"),
    ("permissions", "Permissions explained"),
    ("troubleshooting", "Troubleshooting"),
    ("stuck", "Still stuck?"),
]

TOOLBAR = [
    ("JSON Beautifier", "The name. Not a button."),
    ("Search", "Searches keys and values across the whole document, including collapsed "
               "branches, and expands the tree to each match."),
    ("Collapse all / Expand all", "One toggle. The label is what the click will do, not the "
                                  "current state."),
    ("Copy JSON", "Copies the whole document, using your indent setting."),
    ("Raw / Format", "Switches between the tree and the source text. The label is the action."),
    ("☀ / ☾", "Theme. One click flips to the opposite theme."),
    ("⚙", "Opens settings."),
]

SETTINGS = [
    ("Theme", "Auto (follows your system), Light or Dark."),
    ("Indent", "1, 2 or 4 spaces. Applies to tree indentation and to Copy JSON."),
    ("Auto-expand depth", "Collapsed, 1, 2 or 3 levels open on load."),
    ("Sort object keys", "Orders keys alphabetically instead of document order."),
    ("Line numbers", "Numbers down the left of the tree. In raw mode they appear only on the "
                     "parse-error screen."),
]

BROWSERS = [
    ("Chrome", "Supported", "Chrome Web Store"),
    ("Edge", "Supported", "Installs from the Chrome Web Store"),
    ("Opera", "Supported", "Installs from the Chrome Web Store"),
]

PERMISSIONS = [
    ("storage", "Keeps your settings on this device. Nothing is synced anywhere."),
    ("scripting", "Puts the viewer into the tab you opened."),
    ("tabs", "Finds tabs that are already open, so the viewer can start working in them too."),
    ("access to all sites",
     "Any URL can turn out to return JSON, so the list cannot be written in advance. It reads "
     "the document you opened and nothing else."),
]

LIMITS = [
    "Multi-megabyte documents open: the tree is built in windows, and auto-expand stops at a "
    "node budget instead of trying to draw everything.",
    "Above 25 MB the extension does not parse the file automatically — it offers a button so "
    "you decide when to spend the time.",
    "In raw mode any line longer than 20 000 characters is force-wrapped, because a browser "
    "cannot draw a line millions of pixels wide.",
    "The online tool warns above 5 MB and refuses above 25 MB.",
    "Why the ceilings exist: a browser tab is not a batch processor, and a frozen tab is worse "
    "than an honest refusal.",
]

TROUBLE = [
    ("nothing", "Nothing happened on a JSON page.",
     "The tab was open before the extension was installed, so the viewer was never injected "
     "into it.", "Reload the tab once."),
    ("toggled", "It stopped working after I toggled the extension off and on.",
     "Disabling the extension tears down the viewer in tabs that stay open.",
     "Reload the tab, or open the extension popup — it restores the viewer in open tabs."),
    ("file-urls", "file:// pages don't format.",
     "Chrome withholds file access from extensions until you grant it explicitly.",
     'Turn on "Allow access to file URLs" — see <a href="#local-files">Local files</a> above.'),
    ("looks-like", "The page looks like JSON but is not formatted.",
     "It is a regular web page that happens to display JSON. The extension deliberately leaves "
     "ordinary pages alone.",
     "Nothing to fix — it only steps in when the document itself is JSON."),
    ("too-big", "The file did not open in full.",
     "Above 25 MB the extension stops parsing automatically.",
     'Use the button it offers to format on demand — see <a href="#limits">Large files and '
     "limits</a>."),
]

ON_THIS_PAGE = [
    ("Reload open tabs once", "#installation"),
    ("Nothing happened", "#nothing"),
    ("After toggling off and on", "#toggled"),
    ("file:// URLs", "#file-urls"),
    ("Files over 25 MB", "#too-big"),
]


def h2(anchor, title):
    return (
        f'      <h2 id="{anchor}">{html.escape(title)}'
        f'<a class="anchor" href="#{anchor}" aria-label="Link to this section">#</a></h2>'
    )


def table(headers, rows):
    head = "".join(f"<th>{html.escape(h)}</th>" for h in headers)
    body = "\n".join(
        "          <tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows
    )
    return (
        '      <div class="table-wrap">\n        <table>\n'
        f"          <thead><tr>{head}</tr></thead>\n          <tbody>\n{body}\n          </tbody>\n"
        "        </table>\n      </div>"
    )


def body():
    nav = "\n".join(
        f'        <a href="#{a}">{html.escape(t)}</a>' for a, t in SECTIONS
    )
    toc = "\n".join(f'        <a href="{h}">{html.escape(t)}</a>' for t, h in ON_THIS_PAGE)

    trouble_rows = "\n".join(
        f'      <div class="tr-item" id="{aid}">\n'
        f"        <h3>{html.escape(sym)}</h3>\n"
        f'        <p><span class="tr-tag">cause</span> {html.escape(cause)}</p>\n'
        f'        <p><span class="tr-tag">do</span> {fix}</p>\n'
        "      </div>"
        for aid, sym, cause, fix in TROUBLE
    )

    return f"""  <div class="wrap section">
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> <span aria-hidden="true">›</span> <span>Documentation</span>
    </nav>

    <div class="docs">
      <nav class="docs-nav" aria-label="Documentation sections">
        <button class="mini docs-contents" data-docs-contents aria-expanded="false">Contents ▾</button>
        <div class="docs-nav-list" id="docs-nav-list">
{nav}
        </div>
      </nav>

      <article class="docs-body">
        <h1>Documentation</h1>
        <p class="lead">How the extension behaves, what each control does, which permissions it
          asks for and why, and what to try when something looks wrong.</p>

{h2("installation", "Installation")}
        <p>Install from the Chrome Web Store, open any URL that returns JSON, and it is already
          a tree. There is no button to press and no account to create.</p>
        <p><a class="btn btn-sm" data-cta-slot="docs-install" target="_blank" rel="noopener" href="#">Add to Chrome — free</a></p>
        <div class="callout callout--warn">
          <span aria-hidden="true">!</span>
          <div><b>Tabs opened before installing need one reload.</b> The viewer is injected when a
            page loads, so it will not appear in tabs that were already open.</div>
        </div>

{h2("browsers", "Supported browsers")}
{table(["Browser", "Status", "How to install"], [(html.escape(n), s, hw) for n, s, hw in BROWSERS])}
        <p>Firefox is not supported. It ships its own JSON viewer, and that viewer takes over
          every JSON page as a privileged document where extensions are not allowed to run. A
          Firefox build exists and passes Mozilla's checks, but on a default Firefox it would
          never appear — so we do not ship it.</p>

{h2("toolbar", "The toolbar")}
        <p>The toolbar sits above the tree on every JSON page.</p>
{table(["Element", "What it does"], [(html.escape(e), html.escape(w)) for e, w in TOOLBAR])}
        <p>Clicking a key copies its JSONPath; clicking a value copies the value itself. Prefer
          pasting into a page? <a href="/json-formatter/">/json-formatter/</a>,
          <a href="/json-validator/">/json-validator/</a> and
          <a href="/json-minifier/">/json-minifier/</a> do the same work in the browser.</p>
        <div class="callout">
          <span aria-hidden="true">i</span>
          <div><b>When a document does not parse</b>, search, collapse and Raw are disabled with
            an explanation in their tooltip, and Raw is marked as already active — the source is
            all there is to show, so it is not unavailable, you are already looking at it.</div>
        </div>

{h2("settings", "Settings")}
        <p>The popup, opened from the toolbar icon.</p>
{table(["Setting", "Values"], [(html.escape(n), html.escape(b)) for n, b in SETTINGS])}
        <p>Changes apply immediately to every open tab. No reload needed.</p>

{h2("shortcuts", "Keyboard shortcuts")}
        <p>There are none yet — no custom chords are registered, so anything listed here would
          be untrue. What does work is <kbd>Ctrl</kbd> + <kbd>F</kbd> for the browser's own find,
          and <kbd>Tab</kbd> to move through the toolbar.</p>
        <p>Want a specific shortcut? Ask for it on <a href="/feedback/">/feedback/</a> and it
          gets read.</p>

{h2("local-files", "Local files")}
        <p>JSON opened from disk works on <code>file://</code> URLs, but you have to turn it on
          yourself: <code>chrome://extensions</code> → JSON Beautifier → <b>Details</b> →
          <b>Allow access to file URLs</b>.</p>
        <p>Chrome requires this explicit action — the extension cannot flip the switch for you.</p>

{h2("limits", "Large files and limits")}
        <ul class="docs-list">
{chr(10).join("          <li>" + html.escape(x) + "</li>" for x in LIMITS)}
        </ul>

{h2("permissions", "Permissions explained")}
{table(["Permission", "Why it is needed"], [("<code>" + html.escape(n) + "</code>", html.escape(w)) for n, w in PERMISSIONS])}
        <div class="callout">
          <span aria-hidden="true">i</span>
          <div>The extension makes <b>no network requests at all</b>. Open the Network panel and
            watch it stay empty, or read the source — it is
            <a href="#" data-href="github" target="_blank" rel="noopener noreferrer">MIT on GitHub</a>.</div>
        </div>

{h2("troubleshooting", "Troubleshooting")}
{trouble_rows}

{h2("stuck", "Still stuck?")}
        <p>Both of these are read by the person who wrote the code.</p>
        <p><a class="btn btn-sm" href="/feedback/">Tell us what's broken →</a>
           <a class="mini" href="#" data-href="github" target="_blank" rel="noopener noreferrer">GitHub issues</a></p>
      </article>

      <nav class="docs-toc" aria-label="On this page">
        <h4>On this page</h4>
{toc}
      </nav>
    </div>
  </div>"""


def page():
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>JSON Beautifier — Documentation</title>
<meta name="description" content="How JSON Beautifier works: the toolbar, settings, keyboard shortcuts, permissions, file limits and troubleshooting.">
<link rel="canonical" href="https://jsonbeautifier.dev/docs/">
<meta name="robots" content="index,follow">
<meta property="og:title" content="JSON Beautifier — Documentation">
<meta property="og:image" content="https://jsonbeautifier.dev/assets/og/default.png">
<meta property="og:site_name" content="JSON Beautifier">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://jsonbeautifier.dev/" }},
    {{ "@type": "ListItem", "position": 2, "name": "Documentation", "item": "https://jsonbeautifier.dev/docs/" }}
  ]
}}
</script>
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
{body()}
</main>

{FOOTER}

<script src="/assets/site-config.js"></script>
<script src="/assets/site.js" defer></script>
<script src="/assets/docs.js" defer></script>
</body>
</html>
"""


if __name__ == "__main__":
    out = HERE / "docs"
    out.mkdir(exist_ok=True)
    (out / "index.html").write_text(page(), encoding="utf-8")
    print(f"  /docs/  {len(page()):>7,} B")
