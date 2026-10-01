# Electron macOS API survey for Glassy

Checked against: Electron **v43.7.7** (GitHub tag `electron/electron@v43.7.7`, the latest patch on the 43.x line; the machine runs 43.7.3, same minor line), VS Code **1.140.0** (installed at `/Applications/Visual Studio Code.app`), macOS 27.0 (26A428). Fetched and read this session, 2026-10-01.

Sources used:
- `raw.githubusercontent.com/electron/electron/v43.7.7/docs/api/*.md` and `docs/breaking-changes.md`, `docs/faq.md` (primary vendor docs at the exact tag we ship)
- `electron/electron` GitHub issues/PRs via `api.github.com` (for the Liquid Glass question, where the docs are silent)
- `code.visualstudio.com/docs/editor/command-line` and `docs/supporting/FAQ` (fetched and cleaned with `defuddle`)
- The installed VS Code binary's own `out/mainImpl.js` and `out/vs/workbench/workbench.desktop.main.js`, read directly with `grep`/`python3` (this is VS Code's own shipped code, not a doc, so it is ground truth for "does VS Code already expose this")
- Context7 (`npx ctx7@latest`) was attempted first and failed with a bare `fetch failed` on `api.context7.com` (502 from that host specifically; `context7.com` itself returned 200). Everything below is sourced from the raw docs/repo instead, not from Context7 or from memory.

## Summary

1. Most of the useful macOS window options (`vibrancy`, `opacity`, `hasShadow`, traffic-light position/visibility, always-on-top level, visible-on-all-workspaces, hidden-in-Mission-Control, sheet offset, simple fullscreen) **do** have a runtime setter, so the existing `browser-window-created` pattern can reach them.
2. A few of the ones that matter most for a "glassy" look (`transparent`, `titleBarStyle`, `visualEffectState`, `roundedCorners`, `tabbingIdentifier`) are **construction-only** — there is no `win.setTransparent()` etc. Reaching those needs construction to be intercepted, not just the post-creation listener Glassy uses today.
3. Electron's built-in classes, including `BrowserWindow`, explicitly **cannot be subclassed** (`extends` does not work on them) — confirmed in Electron's own FAQ. Any construction-time interception has to work by replacing/wrapping the exported constructor function, not by subclassing it, and whether that wrapper is visible to VS Code's own `import { BrowserWindow } from 'electron'` in the same ESM module depends on Node's CJS/ESM interop for the `electron` built-in, which is Node/Electron module-loading behaviour, not something documented in the Electron API docs. I'm flagging this as **unverified from docs** — it needs an empirical test in the real `main.js`, not a doc check.
4. **No Liquid Glass (`NSGlassEffectView`) API exists in Electron 43.** A PR adding `setGlassEffect()` / `glassEffect` / `isGlassEffectSupported()` was opened and explicitly targeted at the 42-x-y and 43-x-y release branches, but it was **closed without being merged** (`merged: false`) on 2026-06-30. So the feature does not exist in any shipped Electron release as of this check.
5. VS Code's own `argv.json` already whitelists a short, fixed list of Chromium/Electron switches, read straight out of the installed `mainImpl.js`: `disable-hardware-acceleration`, `force-color-profile`, `disable-lcd-text`, `proxy-bypass-list`, `remote-debugging-port` (plus `force-renderer-accessibility` and `password-store` on Linux only). Anything outside that list is not configurable via VS Code's own `argv.json` and would be new territory for the fork.

---

## 1. BrowserWindow / BaseWindow macOS options and methods

All rows verified against `docs/api/browser-window.md`, `docs/api/base-window.md`, and `docs/api/structures/base-window-options.md` at `v43.7.7` unless marked inferred.

| Setting | Kind | Values | Runtime setter? | Notes | Source |
| -- | -- | -- | -- | -- | -- |
| `vibrancy` | ctor option + runtime | `titlebar`, `selection`, `menu`, `popover`, `sidebar`, `header`, `sheet`, `window`, `hud`, `fullscreen-ui`, `tooltip`, `content`, `under-window`, `under-page` (ctor also still lists `appearance-based`, see risk note below) | Yes, `win.setVibrancy(type[, options])`, with an optional `animationDuration` for fade. `null`/`''` removes it. | Reachable from the existing `browser-window-created` listener. | browser-window.md L1705-1715, base-window-options.md L113-116 |
| `visualEffectState` | **ctor only** | `followWindow` (default), `active`, `inactive` | No runtime setter found anywhere in browser-window.md or base-window.md. | Must be used together with `vibrancy`. Construction-only — intercepting `new BrowserWindow(opts)` is the only way to change it. | base-window-options.md L80-85 |
| `transparent` | **ctor only** | boolean, default `false` | No runtime setter. | On Windows requires frameless; not relevant here. Conflicts directly with VS Code's own `backgroundColor` handling (VS Code sets a solid `backgroundColor` for its custom title bar / `window.nativeTabs`/`window.titleBarStyle` logic — see §1 conflict note below). | base-window-options.md L67-73 |
| `backgroundColor` | ctor option + runtime | Hex/RGB/RGBA/HSL/HSLA/CSS name | Yes, `win.setBackgroundColor(color)` / `win.getBackgroundColor()`. | Fine to touch post-creation. | browser-window.md L794-883 |
| `hasShadow` | ctor option (`hasShadow`) + runtime property `shadow` | boolean, default `true` | Yes, `win.setHasShadow(bool)` / `win.hasShadow()`, also the `win.shadow` property. | Reachable post-creation. | browser-window.md L552, L1381-1389 |
| `roundedCorners` | **ctor only** | boolean, default `true` | No runtime setter in the docs. | On Windows <11 Build 22000, no effect; on Linux, drawn only when the DE supports client-side decorations. As of 43, this now also applies on Linux by default (see breaking-changes). Construction-only on macOS too. | base-window-options.md L108-112, breaking-changes.md "Behavior Changed: Rounded corners on Linux" |
| `titleBarStyle` | **ctor only** | `default`, `hidden`, `hiddenInset` (macOS), `customButtonsOnHover` (macOS, experimental) | No runtime setter. | VS Code already has its own `window.titleBarStyle` setting (`native`/`custom`) that drives this at window-creation time — confirmed present in the installed `workbench.desktop.main.js` (`window.titleBarStyle` string literal, with schema `type:"boolean"` nearby for a related key). A fork forcing a different `titleBarStyle` would fight VS Code's own custom-titlebar rendering. | base-window-options.md L86-96; installed VS Code bundle grep, this session |
| `trafficLightPosition` | ctor option, runtime via method | `Point` | Yes, `win.setWindowButtonPosition(position)` / `win.getWindowButtonPosition()`. `null` resets to default. | Note the ctor key is `trafficLightPosition` but the runtime method is named `setWindowButtonPosition`, not `setTrafficLightPosition` — easy naming trap. | base-window-options.md L109-110; browser-window.md L1733-1744 |
| `setWindowButtonVisibility(visible)` | runtime only (macOS) | boolean | Yes — this is a method, no construction equivalent. | Reachable any time post-creation. | browser-window.md L1536-1541 |
| `opacity` | ctor option + runtime | 0.0-1.0 | Yes, `win.setOpacity()/getOpacity()` — what Glassy already uses. | Already implemented. Clamped to [0,1], not available on Linux. | base-window-options.md L63-66; browser-window.md L1391-1401 |
| `tabbingIdentifier` | **ctor only**, readonly at runtime | string | No setter; `win.tabbingIdentifier` is explicitly `Readonly`. | Construction-only, must be set at `new BrowserWindow()` time. | base-window-options.md L126-129; browser-window.md L522-524 |
| `simpleFullscreen` | ctor option (`simpleFullscreen`) + runtime property `simpleFullScreen` | boolean | Yes, `win.setSimpleFullScreen(flag)` / `win.isSimpleFullScreen()`. | Note the capitalisation difference between the ctor key (`simpleFullscreen`) and the property/method (`simpleFullScreen`/`setSimpleFullScreen`). | base-window-options.md L36-37; browser-window.md L752-762 |
| `setHiddenInMissionControl(hidden)` | ctor option `hiddenInMissionControl` + runtime | boolean | Yes, `win.setHiddenInMissionControl(hidden)` / `win.isHiddenInMissionControl()`. | Reachable post-creation. | base-window-options.md L41; browser-window.md L1034-1042 |
| `setVisibleOnAllWorkspaces(visible[, options])` | runtime only | boolean + `{visibleOnFullScreen, skipTransformProcessType}` | Yes — method only, no matching ctor option. | `skipTransformProcessType` avoids a brief dock/window flicker on every call if the window is already `UIElementApplication` type. | browser-window.md L1572-1597 |
| `alwaysOnTop` + levels | ctor option (`alwaysOnTop` boolean only) + runtime | `win.setAlwaysOnTop(flag[, level][, relativeLevel])`; `level` one of `normal`, `floating`, `torn-off-menu`, `modal-panel`, `main-menu`, `status`, `pop-up-menu`, `screen-saver` (`dock` is deprecated) | Yes, runtime method takes the full level control; the ctor option is boolean-only. | Apple discourages levels higher than 1 above `screen-saver`. | base-window-options.md L29-30; browser-window.md L1044-1065 |
| `setSheetOffset(offsetY[, offsetX])` | runtime only (macOS) | Float | Yes — no ctor equivalent, by nature (needs toolbar geometry known after layout). | Reachable post-creation, this is already how it's meant to be used. | browser-window.md L1118-1134 |

### Construction-only options and ESM interception feasibility

`transparent`, `titleBarStyle`, `visualEffectState`, `roundedCorners`, and `tabbingIdentifier` have no runtime setter anywhere in the v43.7.7 docs. To change these the patch needs to see them at `new BrowserWindow(options)`, which the current `browser-window-created` hook does not do (that event fires after construction).

Verified facts relevant to reaching construction:
- Electron's built-in classes (`BrowserWindow` included) **cannot be subclassed** with `extends` — Electron FAQ, `docs/faq.md`, section "Class inheritance does not work with Electron built-in modules", quoted: *"Electron classes cannot be subclassed with the `extends` keyword... This feature was never implemented in Electron due to the added complexity it would add to C++/JavaScript interop in Electron's internals."* (links `electron/electron#23`)
- That rules out the obvious `class PatchedWindow extends BrowserWindow` approach.
- The remaining route is wrapping/monkey-patching the exported `BrowserWindow` reference itself (e.g. replacing the property on the CommonJS `electron` module's `exports` object with a function that mutates `options` before calling the real constructor) before VS Code's own `import { BrowserWindow } from 'electron'` resolves. **Whether this actually works is not something the Electron docs answer** — it depends on how Node's ESM/CJS interop binds named imports from the `electron` built-in module, and on whether both the prepended Glassy block and VS Code's own code resolve the *same* live module object in a way a mutation can reach. This is Minh's territory (what the actual patched `main.js` does at runtime), not something I can settle from vendor documentation — flagging it rather than asserting an answer either way. It would need an actual empirical test against the patched file.

---

## 2. "Liquid Glass" (macOS 26/27) in Electron

**Verified: no such API ships in Electron 43 (or 42).**

- `docs/api/browser-window.md`, `docs/api/base-window.md`, and `docs/breaking-changes.md` at `v43.7.7` contain zero matches for "glass", "Liquid Glass", or "NSGlassEffectView".
- A real PR exists: [`electron/electron#50415`](https://github.com/electron/electron/pull/50415), *"feat: add native Liquid Glass support on macOS 26+"*. It proposed exactly this: `win.setGlassEffect(options)` + `glassEffect` constructor option (an `NSGlassEffectView` behind the web contents, like `vibrancy`), `win.setGlassEffectRegions(regions)` (overlay glass regions above web contents, with per-region `style`/`cornerRadius`/`tintColor`/`contentImage`), and `win.isGlassEffectSupported()`.
- Checked via GitHub API this session: the PR carries labels `target/42-x-y` and `target/43-x-y` (so it was intended to land in exactly the versions we ship) but its state is **`closed`, `merged: false`**, closed 2026-06-30. It did not land.
- Conclusion: if the owner wants a genuine Liquid Glass look, there is currently no Electron API for it at all on 42.x or 43.x — the only paths are CSS/`backdrop-filter`-style tricks in the renderer (not a native effect) or waiting on a future Electron release, or a custom native Swift/Obj-C addon calling `NSGlassEffectView` directly, which is out of scope for a prepended JS patch.

---

## 3. App-level / process-level knobs

Verified against `docs/api/app.md`, `docs/api/system-preferences.md`, `docs/api/native-theme.md`, `docs/api/command-line-switches.md` at v43.7.7, plus the installed VS Code binary's own `mainImpl.js` for what VS Code already consumes.

| Setting | Kind | Values | Already in VS Code? | Notes | Source |
| -- | -- | -- | -- | -- | -- |
| `app.commandLine.appendSwitch(switch[, value])` | pre/post-ready, main process | Arbitrary Chromium/Electron switch name | Partially — see whitelist below | Must generally be called before `app.whenReady()` for GPU/rendering switches to take effect; some (like `remote-debugging-port`) work at any time. | app.md L1809-1812 |
| `app.disableHardwareAcceleration()` | pre-ready only | n/a | **Yes** — VS Code's `argv.json` whitelist includes `disable-hardware-acceleration` and calls exactly this method when it's `true`. | Confirmed by reading VS Code's own `mainImpl.js`, function `o6`: `l==="disable-hardware-acceleration"?it.disableHardwareAcceleration():it.commandLine.appendSwitch(l)`. Don't duplicate. | app.md L1327-1332; installed `mainImpl.js`, this session |
| `force-color-profile` switch | commandLine switch | string (e.g. `srgb`) | **Yes** — in VS Code's `argv.json` whitelist. | Same `o6` function in `mainImpl.js`. Don't duplicate. | installed `mainImpl.js`, this session |
| `disable-lcd-text` switch | commandLine switch | boolean | **Yes** — in VS Code's `argv.json` whitelist. | Same source. | installed `mainImpl.js`, this session |
| `proxy-bypass-list` switch | commandLine switch | string | **Yes** — in VS Code's `argv.json` whitelist. | Same source. | installed `mainImpl.js`, this session |
| `remote-debugging-port` switch | commandLine switch | string/number | **Yes** — in VS Code's `argv.json` whitelist. | Same source. | installed `mainImpl.js`, this session |
| `force-renderer-accessibility`, `password-store` | commandLine switches | n/a | **Yes, Linux only** — same `argv.json` whitelist, gated on `process.platform === 'linux'`. | Not applicable to this macOS-only fork. | installed `mainImpl.js`, this session |
| `--disable-gpu` CLI flag | top-level CLI switch (not an `argv.json` key, a real `code --disable-gpu` flag) | n/a | **Yes**, documented on VS Code's own troubleshooting page. | `code --disable-gpu` is VS Code's own documented workaround for GPU issues. | VS Code FAQ, fetched and cleaned this session |
| `enable-features` / `disable-features` / `disable-blink-features` switches | commandLine switches, set internally | n/a | **Yes, VS Code sets these itself** for its own feature flags (confirmed by `appendSwitch("enable-features"...)` etc. literally present in the installed `mainImpl.js`). | A fork touching these for GPU rasterisation/overlay scrollbars risks clobbering VS Code's own feature-flag string if it does a naive `appendSwitch` rather than reading-and-merging the existing value. | installed `mainImpl.js`, this session |
| `js-flags` switch | commandLine switch | string (V8 flags) | **Yes, VS Code sets this itself internally** too (separately from the `argv.json` key of the same name that's user-facing for the CLI, per `argv.ts`). | Same clobber risk as above if a fork also calls `appendSwitch('js-flags', ...)` without reading the existing value first. | installed `mainImpl.js`, VS Code `src/vs/platform/environment/node/argv.ts` L238 |
| Overlay scrollbars / smooth scrolling / GPU rasterisation switches (e.g. `enable-smooth-scrolling`, `overlay-scrollbars`) | commandLine switches | n/a | **No** — not found anywhere in VS Code's `argv.json` whitelist or its own internal `appendSwitch` calls. | These are genuinely new territory for the fork; nothing in VS Code reserves or sets them today (as far as this check reached — I did not exhaustively grep every switch name, only the ones named in the brief). | inferred from the whitelist/appendSwitch sweep above, not individually confirmed absent |
| `app.dock` | main process, macOS only, `Dock` object | bounce, badge, menu, icon, etc. | Partially — VS Code uses dock badge/progress for its own purposes (not verified in detail this session) | Readonly property exposing the `Dock` API object. | app.md L1814-1817 |
| `app.setActivationPolicy(policy)` | main process, macOS only | `regular`, `accessory`, `prohibited` | Not found in the areas I checked | `'prohibited'` prevents creating windows entirely — dangerous if misapplied after windows already exist. | app.md L1189-1198 |
| `nativeTheme.*` | main process, cross-platform | `shouldUseDarkColors`, `themeSource` (writable: `system`/`light`/`dark`), `shouldUseHighContrastColors`, `prefersReducedTransparency`, etc. | VS Code has its own `window.autoDetectColorScheme`/theme machinery (not traced to `nativeTheme` specifically this session) | `prefersReducedTransparency` is directly relevant: a glass/vibrancy feature should probably respect it rather than override it. | native-theme.md L22-88 |
| `systemPreferences.getAccentColor()` / `getColor()` / `getEffectiveAppearance()` | main process, macOS/Windows | Returns current OS accent colour, named system colours, light/dark | Not found in the areas checked | Useful if the owner wants a glass tint to follow the system accent colour. | system-preferences.md L185-310 |

---

## 4. Renderer-reachable methods from the main process

Verified against `docs/api/web-contents.md` at v43.7.7.

| Setting | Kind | Values | Fights VS Code? | Notes | Source |
| -- | -- | -- | -- | -- | -- |
| `webContents.setZoomFactor(factor)` | runtime | 0.25-5.0, clamped | **Yes, directly** — VS Code has its own `window.zoomLevel` setting and zoom machinery; a fork also calling `setZoomFactor` would race or get overwritten by VS Code's own zoom logic. | Not independently confirmed where VS Code applies its zoom (not traced this session), flagging by inference from the existence of `window.zoomLevel`. | web-contents.md L1560-1569 |
| `webContents.insertCSS(css[, options])` | runtime, async | returns a key for later removal via `removeInsertedCSS(key)` | Not directly conflicting, but runs in the renderer's main world and would need `did-finish-load` or later — can't be done from the pre-window-created main-process block alone, needs a `webContents` reference per window. | Lowest-risk way to push cosmetic CSS (e.g. for a glass tint) without touching Electron window chrome at all. | web-contents.md L1380-1392 |
| `webContents.setBackgroundThrottling(allowed)` | runtime | boolean | Possible conflict — changing this **affects all WebContents in the host BrowserWindow** as of a breaking change noted in `breaking-changes.md` (PR electron/electron#38924), not just the one you called it on. | Could change VS Code's own background-tab CPU/battery behaviour app-wide if misused. | web-contents.md L2349-2358; breaking-changes.md changelog note at that method |
| `webContents.setFrameRate(fps)` | runtime | 1-240 | **Not applicable** — only has an effect when *offscreen rendering* is enabled. VS Code does not run with `offscreen: true`, so this is a dead end for a normal VS Code window. | Confirmed from the doc text itself: "If offscreen rendering is enabled sets the frame rate..." | web-contents.md L2226-2232 |

---

## 5. Risks and deprecations (37 to 43)

- **`BrowserView` is fully deprecated** (deprecated in Electron 30, several of its static methods **removed** entirely later: `BrowserView.destroy/fromId/fromWebContents/getAllViews` and its `id` property). Not relevant to Glassy directly (it uses `BrowserWindow`, not `BrowserView`), but worth knowing if any future patch touches multi-view windows — use `WebContentsView` instead. Source: breaking-changes.md, "Deprecated: `BrowserView`" and "Removed: `BrowserView.{destroy, fromId, fromWebContents, getAllViews}`".
- **Vibrancy value list discrepancy in the docs themselves.** `breaking-changes.md` (under the Electron 27 section) says the vibrancy values `light`, `medium-light`, `dark`, `ultra-dark`, and `appearance-based` were **removed**, because Apple deprecated/removed the underlying `NSVisualEffectView` material constants in macOS 10.15. But the *current* `docs/api/structures/base-window-options.md` at v43.7.7 still lists `appearance-based` as a valid ctor `vibrancy` value. This is a genuine inconsistency between two parts of Electron's own docs at the same tag, not something I can resolve from the docs alone — treat `appearance-based` as untrustworthy and don't rely on it; test rather than assume it still does anything.
- **`roundedCorners` behaviour changed between versions** — it is now `true` by default on all platforms including Linux (previously Linux didn't support it at all). Not directly a macOS risk, but shows this option's defaults have moved under this code recently; re-verify rather than assuming the Electron-36-era doc you might remember still applies.
- **`webContents.setBackgroundThrottling` has an app-wide-per-window blast radius** since a documented breaking change (electron/electron#38924): setting it `false` on one `webContents` now affects *all* `webContents` hosted in that `BrowserWindow`, not just the one it was called on. Misusing this against a VS Code window (which can host many webviews/extension hosts) could change background CPU behaviour broadly.
- **`app.setActivationPolicy('prohibited')`** will prevent the app creating windows at all — a config-driven misfire here (e.g. a bad value falling through) is a full outage, not a cosmetic glitch.
- **Electron's built-in classes cannot be subclassed** (see §1) — any design that assumes `class Foo extends BrowserWindow {}` will simply not work; confirmed directly from Electron's own FAQ, not inferred.
- **No Liquid Glass API exists** in 42.x or 43.x (see §2) — don't build a feature around an API that was proposed and then closed unmerged.
- I did not find, and did not go looking exhaustively for, a full enumeration of *every* Chromium commandLine switch Electron 43 forwards (there is no single doc page listing them all — Electron forwards most Chromium switches transparently). `docs/api/command-line-switches.md` only documents the small set of switches **Electron itself** interprets specially (e.g. `remote-debugging-port`, `disable-color-correct-rendering`-style flags); it is not a reference for every possible value. Treat any switch not in that file as Chromium-level and verify it against Chromium's own `//chrome/common/chrome_switches.cc` if you need certainty, which I did not fetch this session.

---

## Unresolved / needs follow-up

- Construction interception, partly settled by `notes/spike-bw-intercept/` against Electron 43.7.3 (verified 2026-10-01):
  - Replacing the export is impossible: `lib/common/define-properties.ts` at v43.7.3 defines each `electron` export as a getter with no setter and `configurable` left false.
  - VS Code 1.140 builds windows in `out/mainImpl.js` as `new Jn.BrowserWindow(...)` (`Jn` is the default import of `electron`), and `out/main.js` loads it with `await import("./mainImpl.js")` after the Glassy block has run.
  - So the block registers `module.registerHooks` (Node 24.21) with a load hook that rewrites `new X.BrowserWindow(` to `new (globalThis.Glassy_BW||X.BrowserWindow)(` in memory. Verified: the compiled function source carries the rewrite, and a control run without the hook does not. The file on disk is never written.
  - Verified outside the sandbox: the wrapper's options reach the native window. A window requested at full opacity reported `getOpacity() === 0.5`, set only by the wrapper, and is still `instanceof BrowserWindow`.
  - The spike's `mainImpl.js` must not `await app.whenReady()` at top level: Electron starts up only after the entry module finishes evaluating, so that deadlocks. VS Code registers a handler instead.
- `api.context7.com` returned a bare `502` this session (while `context7.com` itself returned `200`), so the `ctx7` CLI could not be used at all; everything above came from `raw.githubusercontent.com` and `code.visualstudio.com` directly.
- I did not locate a public VS Code wiki/doc page enumerating every `window.*` setting or every `argv.json` key as prose documentation — `github.com/microsoft/vscode/wiki/Available-Arguments` 404'd. The `argv.json` whitelist in §3 came from reading the installed binary's own `mainImpl.js`, which is stronger evidence than a doc page would have been, but it means I only know what the *current installed build* does, not what every past/future VS Code version has documented.
