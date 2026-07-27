# `extension-firefox/` — Firefox build

**Status: planned.** Nothing here yet.

Known differences from the Chrome build:

- **Background:** Firefox MV3 has no `service_worker` — an event page
  (`background.scripts: [...]`) is used instead.
- **Manifest:** requires `browser_specific_settings.gecko` with an `id` and a
  `strict_min_version`.
- **APIs:** Firefox supports the `chrome.*` namespace with callbacks for most methods, so
  the bulk of the code should carry over unchanged. `chrome.action.openPopup()` (the
  toolbar gear button) needs a capability check and a fallback.
- **Host permissions are optional by default in Firefox MV3** — the user grants them
  explicitly through the extension button. This means the "open a JSON URL and it is
  already formatted" behaviour does not happen out of the box, so the Firefox build needs
  its own onboarding. The store listing must describe what actually happens on Firefox.
