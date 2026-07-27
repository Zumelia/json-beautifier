# `extension-firefox/` — Firefox build

The Firefox add-on is the Chrome tree plus an overlay. Only files that genuinely
differ live here, and today that is the manifest alone — the extension code is
byte-identical between the two browsers. Two copies of `content.js` would drift
apart within a release, so there is only ever one.

```bash
npm run build:firefox      # assembles dist/firefox/ and zips it
```

Load it in Firefox with `about:debugging` → This Firefox → Load Temporary Add-on
→ pick `dist/firefox/manifest.json`.

## What differs from Chrome

- **Background.** Firefox MV3 has no `service_worker`; the same `background.js`
  is declared as an event page (`background.scripts`). The code itself is
  unchanged — Firefox supports the `chrome.*` namespace with callbacks.
- **`browser_specific_settings.gecko`** — add-on id and `strict_min_version`
  (115.0, the ESR baseline).
- **Opening the settings popup.** `action.openPopup()` requires a user gesture in
  Firefox, and our call is triggered from a content script, so the gesture is not
  attributed to it. `background.js` therefore falls back to opening the same
  settings page in a tab. That fallback also covers Chrome below 127, where the
  method does not exist at all.

## Verified in a real Firefox (153, headless, 2026-07-27)

What works: the package installs as a temporary add-on, the event page starts,
content scripts run, `chrome.storage` works, and the viewer builds correctly —
tree present, keys rendered, page body replaced by our root element. Host
permissions came back granted (`origins: http://*/*, https://*/*, file:///*`),
so the optional-permission worry did not materialise on this install path. A
store install may still differ.

`web-ext lint --self-hosted`: **0 errors, 0 warnings.**

## The blocker: Firefox ships its own JSON viewer

Firefox has a built-in JSON viewer (`devtools.jsonview.enabled`, **on by
default**) that takes over every `application/json` document. It is a privileged
page, and **extension content scripts do not run in it at all**. Measured
directly: with the pref at its default, a JSON page produced no content-script
execution whatsoever; the same page with `devtools.jsonview.enabled=false`
rendered our tree perfectly.

So on a default Firefox this add-on is invisible on exactly the pages it exists
for. This is a product problem, not a bug in the code.

### What has been tried

Rewriting `Content-Type: application/json` → `text/plain` from a blocking
`webRequest.onHeadersReceived` listener, so the document never reaches the
built-in viewer. The listener **registers** — `webRequestBlocking` is still
supported in Firefox MV3, and the permission is granted — but it never fired for
the JSON main-frame request, so the page still went to the built-in viewer.
Unresolved; would need more digging before it can be called a solution.

### Remaining options

1. Make the header rewrite actually work (needs investigation), or intercept the
   body with `webRequest.filterResponseData` (Firefox-only). Both cost heavier
   permissions and a worse install-consent screen, which cuts against this
   product's "minimal permissions" pitch.
2. Ship anyway and tell users to turn off the built-in viewer in `about:config`.
   Honest, but a poor first run. Extensions cannot flip that pref themselves —
   it is not exposed to WebExtensions.
3. Do not ship on Firefox. Unlike Chrome, Firefox already gives users a
   competent JSON viewer, so the gap this product fills is much smaller there.

Until one of those is settled, the Firefox badge on the website stays honest as
"Coming soon".
