# JSON Beautifier — Privacy Policy

_Last updated: 2026-07-21_

**JSON Beautifier does not collect your data. The JSON you view never leaves your
device.**

## Data we collect

None from inside the extension. JSON Beautifier does not read, transmit, sell, or
share the content you view. There is no telemetry, no crash reporting, and no
identifiers tied to you.

## What the extension can access, and why

- **The content of pages you open** — only so it can detect when a page is raw
  JSON and format it. On any page that isn't raw JSON, JSON Beautifier exits
  immediately and does nothing. The JSON it formats is read **in the page, in
  your browser**, and is never sent off your device.
- **Local storage (`storage` permission)** — used only to remember your own
  settings (theme, indent width, auto-expand depth, sort-keys). This never leaves
  your device.

## Network

**The extension itself makes no network requests.** Its code contains no `fetch`,
`XMLHttpRequest`, `sendBeacon`, tracking pixels, or remote scripts — you can
verify this in the open-source code. The JSON you view is never uploaded.

There are exactly two moments when your browser opens one of our ordinary web
pages in a tab:

- **Right after you install**, a short welcome page opens explaining where to
  find the extension and how to pin it.
- **Right after you uninstall**, Chrome opens a one-question feedback page asking
  why you removed it. Answering is entirely optional.

Those are normal web pages. Like most websites they may count anonymous page
views so we know how many people installed or removed the extension. They do not
receive any of your JSON, browsing history, or personal information, and they set
no advertising cookies.

## Permissions justification (for reviewers)

- **Host access (`http`, `https`, `file`)**: MV3 content scripts are matched by
  URL, not by content type. To detect raw JSON (`application/json`, `+json`,
  etc.) on any endpoint or domain, the content script must run broadly — but it
  early-exits instantly on anything that isn't raw JSON and touches nothing else.
- **`storage`**: local settings only, as above.
- **`scripting`** and **`tabs`**: used once, at install time only. Tabs you
  already had open before installing would otherwise show unformatted JSON until
  you reloaded them, so the extension injects the same viewer into those
  already-open tabs. It queries tab URLs solely to skip pages it cannot inject
  into. No tab data is stored or transmitted.

## Contact

Open an issue on the source repository.
