# `core/` — shared JSON engine

Plain JavaScript. No `chrome.*` APIs, no page hijacking, no dependencies, no build step.
Every other package in this repository is a thin wrapper around this one: the Chrome
extension, the Firefox extension and the website.

**Status: not yet extracted.** The engine currently lives inside
`extension-chrome/src/content.js`, mixed together with the raw-JSON page detector and the
extension plumbing. Pulling it out is the next piece of work.

Planned surface:

```
parse(text)                              → { ok, data, error: { message, line, col, pos, context } }
prettyPrint(data, { indent, sortKeys })  → string
minify(text)                             → string
renderTree(container, data, settings)    → { search(q), collapseAll(), expandAll(), destroy() }
```

It will be a **plain script** that assigns `globalThis.JSONBeautifierCore`, not an ES
module: MV3 content scripts cannot be modules, and this way the exact same file is loaded
by the extensions (first entry in `content_scripts.js`, order is guaranteed) and by the
website (`<script src>`) with no bundler in between.
