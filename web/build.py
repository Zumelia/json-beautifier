#!/usr/bin/env python3
"""
Сборка страниц-инструментов jsonbeautifier.dev.

Главная (index.html) написана руками — она штучная. А /json-formatter/,
/json-validator/ и /json-minifier/ устроены одинаково: та же шапка, тот же
инструмент, тот же футер, отличается содержание. Держать шапку и футер в трёх
копиях значит однажды поправить их в двух местах из трёх, поэтому общая часть
живёт здесь в одном экземпляре.

Страницы обязаны отличаться содержательно, а не только заголовком: тонкие
клоны одного текста поисковик и не станет ранжировать, и нам они не нужны.
У каждой свой режим инструмента, свой текст и свой FAQ.

    python3 build.py        # пишет json-formatter/index.html и остальные
"""

import html
from pathlib import Path

HERE = Path(__file__).resolve().parent
GITHUB = "https://github.com/Zumelia/json-beautifier"

NAV = """      <nav class="nav" aria-label="Main">
        <a href="/json-formatter/">Formatter</a>
        <a href="/json-validator/">Validator</a>
        <a href="/json-minifier/">Minifier</a>
        <a href="/docs/">Docs</a>
        <a href="#" data-href="github" target="_blank" rel="noopener noreferrer">GitHub</a>
      </nav>"""

SHEET = """<div class="sheet" id="sheet" hidden>
  <div class="wrap">
    <div class="sheet-head">
      <a class="logo" href="/"><span class="mark">{}</span> JSON Beautifier</a>
      <span class="spacer"></span>
      <button class="icon-btn" data-menu-toggle aria-label="Close">✕</button>
    </div>
    <a class="item" href="/">JSON Beautifier <small>Format &amp; read</small></a>
    <a class="item" href="/json-formatter/">JSON Formatter <small>Indent styles</small></a>
    <a class="item" href="/json-validator/">JSON Validator <small>Errors with line &amp; column</small></a>
    <a class="item" href="/json-minifier/">JSON Minifier <small>Strip whitespace</small></a>
    <a class="item" href="/docs/">Docs <small>Settings, shortcuts, troubleshooting</small></a>
    <a class="item" href="/changelog/">Changelog <small>What shipped when</small></a>
    <a class="item" href="#" data-href="github" target="_blank" rel="noopener noreferrer">GitHub <small>MIT source</small></a>
    <p><a class="btn" data-cta-slot="mobile-menu" target="_blank" rel="noopener" href="#">Add to Chrome — free</a></p>
  </div>
</div>"""

FOOTER = """<footer class="foot">
  <div class="wrap">
    <div class="foot-cols">
      <div>
        <a class="logo" href="/"><span class="mark">{}</span> JSON Beautifier</a>
        <p style="color:var(--muted);font-size:14.5px;max-width:30ch">A JSON viewer that stays
          out of the way and off the network.</p>
      </div>
      <div><h4>Product</h4><ul>
        <li><a data-cta-slot="footer" target="_blank" rel="noopener" href="#">Chrome extension</a></li>
        <li><a data-cta-slot="footer" target="_blank" rel="noopener" href="#">Edge · via CWS</a></li>
        <li><a data-cta-slot="footer" target="_blank" rel="noopener" href="#">Opera · via CWS</a></li>
        <li><a href="/changelog/">Changelog</a></li>
      </ul></div>
      <div><h4>Tools</h4><ul>
        <li><a href="/">JSON Beautifier</a></li>
        <li><a href="/json-formatter/">JSON Formatter</a></li>
        <li><a href="/json-validator/">JSON Validator</a></li>
        <li><a href="/json-minifier/">JSON Minifier</a></li>
      </ul></div>
      <div><h4>Company</h4><ul>
        <li><a href="/privacy/">Privacy</a></li>
        <li><a href="/feedback/">Contact</a></li>
      </ul></div>
      <div><h4>Resources</h4><ul>
        <li><a href="#" data-href="github" target="_blank" rel="noopener noreferrer">GitHub</a></li>
        <li><a href="/docs/">Docs</a></li>
        <li><a href="/samples/">Samples</a></li>
        <li><a href="/rate/">Rate us</a></li>
      </ul></div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 <a href="https://zumelia.com" rel="noopener" target="_blank">Zumelia</a> · MIT licensed</span>
      <span class="spacer"></span>
      <button class="mini" data-theme-toggle aria-label="Switch theme">☾</button>
    </div>
  </div>
</footer>"""


def tool_block(default_tab):
    return f"""    <div class="tool" data-tool-default="{default_tab}" style="margin-top:26px">
      <div class="tool-head">
        <div class="tabs" role="tablist" aria-label="Tool mode">
          <button class="tab" role="tab" data-tool-tab="beautify">Beautify</button>
          <button class="tab" role="tab" data-tool-tab="minify">Minify</button>
          <button class="tab" role="tab" data-tool-tab="validate">Validate</button>
          <button class="tab" role="tab" data-tool-tab="tree">Tree</button>
        </div>
        <div class="opts">
          <label>indent
            <select id="jb-indent" data-tool-indent>
              <option value="2">2</option>
              <option value="4">4</option>
            </select>
          </label>
          <label><input type="checkbox" id="jb-sort" data-tool-sortkeys> Sort keys</label>
        </div>
      </div>
      <div class="tool-grid">
        <div class="pane">
          <div class="pane-head">
            Input<span class="spacer"></span>
            <button class="mini" data-tool-action="upload">Upload</button>
            <button class="mini" data-tool-action="sample">Try a sample</button>
          </div>
          <textarea id="jb-input" spellcheck="false" aria-label="JSON input"
            placeholder="Paste JSON here, or drop a file…"></textarea>
          <input type="file" id="jb-file" accept=".json,application/json,text/plain" hidden>
        </div>
        <div class="pane">
          <div class="pane-head">
            Output<span class="spacer"></span>
            <button class="mini" data-tool-action="format">Format</button>
            <button class="mini" data-tool-action="copy">Copy</button>
            <button class="mini" data-tool-action="download">Download</button>
            <button class="mini" data-tool-action="clear">Clear</button>
          </div>
          <div class="out" id="jb-out"></div>
        </div>
      </div>
      <div class="tool-foot">
        <span class="led"></span>
        Processed locally in your browser. Nothing is uploaded.
        <span class="spacer"></span>
        <span id="jb-status"></span>
      </div>
    </div>

    <p class="hint" id="jb-hint" hidden>
      This is exactly what the extension shows automatically on any JSON URL.
    </p>
    <div class="prompt" id="jb-prompt" hidden>
      <p>You've formatted 3 documents. Install it and never paste again.</p>
      <a class="btn btn-sm" data-cta-slot="tool-prompt" target="_blank" rel="noopener" href="#">Add to Chrome</a>
      <button class="icon-btn" data-prompt-dismiss aria-label="Dismiss">✕</button>
    </div>"""


def faq_block(items):
    rows = "\n".join(
        f'      <details data-faq="{slug}"><summary>{html.escape(q)}</summary>'
        f"<p>{a}</p></details>"
        for slug, q, a in items
    )
    return f"""  <section class="wrap section">
    <h2>Questions about this</h2>
    <div class="faq">
{rows}
    </div>
  </section>"""


def page(slug, title, desc, h1, lead, default_tab, prose, faq, siblings):
    sib = " · ".join(f'<a href="{h}">{t}</a>' for t, h in siblings)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="https://jsonbeautifier.dev/{slug}/">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:url" content="https://jsonbeautifier.dev/{slug}/">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="https://jsonbeautifier.dev/assets/og/{slug.replace('json-', '')}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="JSON Beautifier">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<link rel="alternate" hreflang="x-default" href="https://jsonbeautifier.dev/{slug}/">
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
  <section class="wrap section" id="tool">
    <h1>{html.escape(h1)}</h1>
    <p class="lead">{lead}</p>
{tool_block(default_tab)}
  </section>

  <section class="wrap section">
{prose}
  </section>

  <section class="wrap section">
    <div class="final">
      <h2>Or stop pasting altogether</h2>
      <p class="lead" style="margin-inline:auto;max-width:52ch">The extension does this on any
        JSON URL you open — including internal APIs and localhost, which you can't paste into
        a website anyway.</p>
      <p style="margin-top:24px"><a class="btn" data-cta-slot="tool-prompt" target="_blank" rel="noopener" href="#">Add to Chrome — free</a></p>
      <p class="cta-note">Free · MIT licensed · No account, no ads, no telemetry</p>
    </div>
  </section>

{faq_block(faq)}

  <section class="wrap" style="padding-bottom:56px">
    <p style="color:var(--muted);font-size:14.5px">Other tools: {sib}</p>
  </section>
</main>

{FOOTER}

<script src="/assets/site-config.js"></script>
<script src="/assets/core.js"></script>
<script src="/assets/site.js" defer></script>
</body>
</html>
"""


PAGES = [
    dict(
        slug="json-formatter",
        title="JSON Formatter — Indent, Sort and Read JSON Online",
        desc="Free online JSON formatter. Choose 2 or 4 spaces, sort keys alphabetically, and read the result as a tree. Runs in your browser — nothing is uploaded.",
        h1="JSON Formatter",
        lead="Paste a response, pick an indent, get something a human can read. Nothing leaves the page.",
        default_tab="beautify",
        siblings=[("JSON Validator", "/json-validator/"), ("JSON Minifier", "/json-minifier/")],
        prose="""    <h2>What formatting actually changes</h2>
    <p class="lead">Nothing about your data — only the whitespace between it.</p>
    <p style="max-width:70ch;color:var(--muted)">A JSON formatter re-prints the same values with
      newlines and indentation. Keys keep their order unless you ask for them to be sorted,
      strings keep their exact contents, and numbers keep their exact text — with one caveat
      worth knowing, described below. The output parses to precisely the same value as the
      input; if it didn't, the formatter would be broken.</p>
    <p style="max-width:70ch;color:var(--muted)">Two spaces or four is a house-style question,
      not a technical one. Two is the more common default in JavaScript ecosystems and keeps
      deeply nested documents from marching off the right edge of the screen; four reads more
      clearly when nesting is shallow. Tabs are legal in JSON and some teams prefer them for
      accessibility reasons, since the reader controls the visible width.</p>
    <p style="max-width:70ch;color:var(--muted)"><b>Sorting keys</b> is a different operation and
      worth treating carefully. JSON objects are unordered by specification, so sorting is
      always safe with respect to meaning — but it is not safe with respect to <em>diffs</em>.
      Sorted output will not line up with an unsorted file in version control. Sort when you
      want to compare two documents by content; leave it off when you want to keep the shape
      the server sent.</p>
    <p style="max-width:70ch;color:var(--muted)">One real caveat: formatting parses your document
      into JavaScript values and prints them again. Integers larger than 2⁵³ cannot be
      represented exactly in JavaScript, so a value like <code>9007199254740993</code> comes back
      as <code>9007199254740992</code>. If your document carries very large IDs, format it here to
      read it — but keep the original bytes as the source of truth.</p>""",
        faq=[
            ("difference", "What's the difference between a formatter and a beautifier?",
             "Nothing. Both mean re-printing JSON with indentation so a person can read it. "
             "The two words exist because two different communities coined them."),
            ("indent", "Should I use 2 spaces, 4 spaces, or tabs?",
             "All three are valid JSON. Two spaces is the common default and survives deep "
             "nesting best; four is easier to scan when nesting is shallow."),
            ("order", "Does formatting change the order of my keys?",
             "Not unless you tick “Sort keys”. Left alone, the output keeps the order the input "
             "had."),
            ("valid", "My JSON won't format — what now?",
             'It doesn\'t parse. Switch to the <a href="/json-validator/">validator</a>: it '
             "points at the exact line and column where the document stops being valid."),
        ],
    ),
    dict(
        slug="json-validator",
        title="JSON Validator — Find the Error, With Line and Column",
        desc="Free online JSON validator that tells you where the problem is: the line, the column, and the offending text. Runs entirely in your browser.",
        h1="JSON Validator",
        lead="Not just “invalid” — the line, the column, and the character your parser choked on.",
        default_tab="validate",
        siblings=[("JSON Formatter", "/json-formatter/"), ("JSON Minifier", "/json-minifier/")],
        prose="""    <h2>Why JSON breaks, in order of frequency</h2>
    <p class="lead">Almost every invalid document fails for one of six reasons.</p>
    <p style="max-width:70ch;color:var(--muted)"><b>A trailing comma.</b>
      <code>{"a": 1,}</code> is valid JavaScript and invalid JSON. This is the single most
      common failure, and it is why the error usually points at the closing brace rather than
      at the comma itself — the parser only knows something is wrong when it arrives at
      <code>}</code> and finds no key.</p>
    <p style="max-width:70ch;color:var(--muted)"><b>Single quotes.</b> JSON strings must use
      double quotes. <code>{'a': 1}</code> fails immediately at the apostrophe.</p>
    <p style="max-width:70ch;color:var(--muted)"><b>Unquoted keys.</b> <code>{a: 1}</code> is an
      object literal in JavaScript, not JSON. Every key is a string and every string is
      quoted.</p>
    <p style="max-width:70ch;color:var(--muted)"><b>Comments.</b> JSON has none. Neither
      <code>//</code> nor <code>/* */</code> is allowed, no matter how helpful it would be.
      Configuration formats that permit them — JSON5, JSONC — are different languages that
      merely look similar.</p>
    <p style="max-width:70ch;color:var(--muted)"><b>Special numbers.</b> <code>NaN</code>,
      <code>Infinity</code>, <code>-Infinity</code> and hexadecimal literals are not JSON
      numbers. Neither is a leading <code>+</code>, nor <code>.5</code> without its zero.</p>
    <p style="max-width:70ch;color:var(--muted)"><b>An unterminated string.</b> A missing closing
      quote makes the parser swallow everything after it, so the reported position is often far
      from the real mistake. When the column looks nonsensical, look upward for an unclosed
      quote.</p>
    <p style="max-width:70ch;color:var(--muted)">Duplicate keys are the odd one out: they are
      <em>valid</em> JSON, and the specification does not say what should happen. Most parsers,
      including this one, keep the last occurrence and silently discard the earlier ones — so a
      document can validate cleanly and still lose data.</p>""",
        faq=[
            ("comments", "Can JSON have comments?",
             "No. The format has no comment syntax at all. JSON5 and JSONC do, but they are "
             "separate formats — a parser expecting JSON will reject them."),
            ("trailing", "Are trailing commas allowed?",
             "No. <code>[1, 2, 3,]</code> is invalid, even though JavaScript accepts it."),
            ("duplicate", "Are duplicate keys valid?",
             "Technically yes, and that is the danger. The specification leaves the behaviour "
             "undefined; most parsers keep the last one and drop the rest without warning."),
            ("position", "The reported line looks wrong.",
             "Usually an unterminated string. The parser keeps reading until the next quote, so "
             "it reports where it gave up, not where you slipped."),
            ("bigint", "Is a huge integer valid?",
             "Valid, yes — but reading it in a browser is lossy above 2⁵³. The document is fine; "
             "JavaScript's number type is the limitation."),
        ],
    ),
    dict(
        slug="json-minifier",
        title="JSON Minifier — Strip Whitespace, See the Saving",
        desc="Free online JSON minifier. Removes every unnecessary byte and shows how much you saved. Runs in your browser — nothing is uploaded.",
        h1="JSON Minifier",
        lead="Remove every byte a machine doesn't need, and see exactly how many that was.",
        default_tab="minify",
        siblings=[("JSON Formatter", "/json-formatter/"), ("JSON Validator", "/json-validator/")],
        prose="""    <h2>What minifying is worth, and what it isn't</h2>
    <p class="lead">It removes whitespace. That is the whole operation — and it matters less
      than people expect.</p>
    <p style="max-width:70ch;color:var(--muted)">Minified JSON is the same document with every
      optional space, newline and indent removed. Nothing else changes: no key is renamed, no
      value is rounded, no structure is altered. On a pretty-printed document the saving is
      typically 15–30% of the raw byte count, and more on deeply nested data where indentation
      dominates.</p>
    <p style="max-width:70ch;color:var(--muted)"><b>If you already serve with gzip or brotli,
      minifying buys far less than the raw numbers suggest.</b> Compression handles repeated
      whitespace extremely well — it is exactly the pattern those algorithms exist for. Measure
      the compressed size before deciding that minification is worth the loss of readability in
      your logs and error reports.</p>
    <p style="max-width:70ch;color:var(--muted)">Where it does earn its keep: payloads that are
      never compressed, storage where you pay per byte, embedded contexts with tight limits, and
      anything shipped inside another document where the outer format has no compression of its
      own.</p>
    <p style="max-width:70ch;color:var(--muted)">One caveat that applies to every browser-based
      minifier, including this one: the document is parsed into JavaScript values and printed
      again. Integers beyond 2⁵³ lose precision — <code>9007199254740993</code> becomes
      <code>9007199254740992</code>. If your payload carries snowflake IDs or similar, minify it
      server-side where the number type is wide enough, or leave it alone.</p>""",
        faq=[
            ("howmuch", "How much smaller will it get?",
             "Usually 15–30% of a pretty-printed document, depending on how deeply it nests. "
             "The tool shows the exact saving for your input."),
            ("data", "Does minifying change my data?",
             "Only whitespace is removed — with one exception worth knowing: integers larger "
             "than 2⁵³ lose precision, because the browser parses them into JavaScript numbers."),
            ("gzip", "Should I minify if I already gzip?",
             "Usually not worth it. Compression already handles repeated whitespace very well. "
             "Compare compressed sizes before giving up readable payloads."),
            ("reverse", "Can I get the formatting back?",
             'Yes — minifying loses no information. Paste the result into the '
             '<a href="/json-formatter/">formatter</a> and it comes back readable.'),
        ],
    ),
]


def main():
    for p in PAGES:
        out = HERE / p["slug"]
        out.mkdir(exist_ok=True)
        (out / "index.html").write_text(page(**p), encoding="utf-8")
        print(f"  /{p['slug']}/  {len(page(**p)):>7,} B  режим по умолчанию: {p['default_tab']}")


if __name__ == "__main__":
    main()
