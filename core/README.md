# `core/` — shared JSON engine

`core.js` is the engine: parsing with real error positions, pretty-printing,
minifying, and the interactive tree with its lazy/windowed rendering and
data-model search. Plain JavaScript, no dependencies, no build step, no
`chrome.*`, no page detection — it does not know or care whether it is running
inside an extension or on a web page.

Every other package in this repository is a thin wrapper around this file. That
is the point: the tree the Chrome extension draws, the tree the Firefox
extension draws and the tree jsonbeautifier.dev draws cannot drift apart,
because there is only one of them.

## API

`core.js` assigns `globalThis.JSONBeautifierCore`:

```js
parse(text)
  → { ok: true, data }
  → { ok: false, error: { message, pos, line, column, context } }   // never throws

prettyPrint(data, { indent = 2, sortKeys = false })  → string | null
minify(text)                                         → { ok, text } | { ok: false, error }
sortDeep(value)                                      → deep-sorted copy

renderTree(container, data, {
  indent = 2, expandDepth = 2, sortKeys = false, treeId
}) → {
  element,                  // the tree node, already appended to container
  search(query),            // walks the DATA MODEL, expands matches, → hit count
  setAllCollapsed(bool),
  destroy(),
}
```

Plus the small helpers the wrappers share: `valueType`, `count`, `renderScalar`,
`safeChildKey`, `fmtBytes`, `el`, `btn`, `copyText`, `flash`.

Several trees can live on one page — `search()` only ever touches its own.

## Why a plain script and not an ES module

MV3 content scripts cannot be modules. A plain script that assigns one global is
the only form that loads unchanged in a content script, in a background page and
via `<script src>` on the website — no bundler anywhere in the chain. Inside an
extension this runs in the isolated world, so nothing is added to the page.

## The generated copy

A manifest cannot reference files outside its package root, so
`extension-chrome/src/core.js` exists as a **generated copy** of this file.
Refresh it with:

```bash
npm run sync
```

`test/sync.test.mjs` fails if the copy and the source ever differ, so the
duplication cannot rot quietly. Both build scripts run the sync first, so a
stale copy cannot ship. The Firefox package is assembled from the Chrome tree
and needs no copy of its own.
