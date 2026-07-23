# JSON Beautifier

Format, collapse, search and copy any JSON in your browser. **Fast, local,
open-source. No ads, no telemetry.**

Built as a deliberate answer to what killed the incumbents: the market leader
(JSON Formatter, 2M users) collapsed to a **1.04 recent rating** after it started
injecting ads; others hang the tab on large files or fail silently. JSON Beautifier is
the boring, trustworthy version.

## What it does

- **Auto-formats** any raw JSON page into an interactive tree (syntax-highlighted).
- **Collapse / expand** nodes; **windowed rendering** means a 10 MB / 20k-item
  document opens instantly instead of freezing the tab.
- **Search** keys and values.
- **Copy** any value, or **copy the JSONPath** to any node, in one click.
- **Light / dark** themes (follows your system by default).
- **Raw toggle** and a visible **parse-error** view (never a silent blank page).

## Privacy — the whole point

- **Zero network.** No `fetch`, no XHR, no beacons, no telemetry. Your JSON never
  leaves the tab. Grep the source and confirm.
- **No data collection**, no analytics, no remote code.
- **Permissions:** `storage` (to remember your theme/indent settings) and a content
  script on all pages *only* so it can detect and format raw JSON wherever you open
  it — it early-exits instantly on any page that isn't raw JSON and touches nothing
  else.

## Install (unpacked, for development)

1. `chrome://extensions` → toggle **Developer mode** (top-right).
2. **Load unpacked** → select the `jsoneat/` folder.
3. Open any raw JSON URL (e.g. an API endpoint) — it formats automatically.
4. Click the toolbar icon for settings (theme, indent, auto-expand depth, sort keys).

## Develop & test

```bash
cd jsoneat
npm install          # jsdom for the test harness
node test/harness.mjs
```

The harness loads `content.js` into a simulated Chrome document and asserts the
behaviours that matter for this niche: valid/invalid JSON, non-JSON pages left
untouched, big-file lazy rendering, XSS-safety, copy-to-clipboard. **This is the
reusable regression harness** — every other utility in the portfolio gets its own
version, because "breaks after a Chrome update" is the #1 complaint across all of
them.

## Project layout

```
jsoneat/
├── manifest.json        # MV3
├── src/
│   ├── content.js       # detector + viewer (early-exits fast on non-JSON)
│   ├── viewer.css       # injected on activation only; light+dark
│   ├── popup.html/.js/.css   # settings
├── icons/               # 16/32/48/128
└── test/harness.mjs     # jsdom regression tests
```

## License

MIT (open-source is a trust signal in this niche and a feature, not a giveaway).
