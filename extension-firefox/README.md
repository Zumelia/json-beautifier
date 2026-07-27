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

## Open question before this ships

**Host permissions are optional by default in Firefox MV3.** The user grants site
access explicitly through the extensions button. Until this is checked against a
real Firefox, we do not know whether the declared content script runs on first
install or waits for that grant — and that decides whether the product's core
promise ("open a JSON URL and it is already formatted") holds out of the box on
Firefox.

Whatever the answer turns out to be, the AMO listing has to describe what
actually happens on Firefox rather than reuse the Chrome copy. If a grant is
required, the add-on needs its own onboarding step that asks for it.

**This build has not been run in a real Firefox yet.** It is written, it packages
cleanly, and the shared code is covered by the test suite — but "loads and works
in Firefox" is not yet verified.
