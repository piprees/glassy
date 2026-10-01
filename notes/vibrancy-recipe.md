# Vibrant background recipe

Frosted-glass VS Code with the tabs as the top row and no title bar, verified by eye on VS Code 1.140, Electron 43.7.3, macOS 27 (2026-10-02).

## Settings

```jsonc
"window.titleBarStyle": "native",
"window.customTitleBarVisibility": "never",
"window.commandCenter": false,
"window.density.layout": "compact",
"workbench.editor.editorActionsLocation": "hidden",
"workbench.editor.empty.hint": "hidden",
"glassy.vibrancy": "under-window",
  "glassy.windowButtonsVisible": false,
  "glassy.titleBarStyle": "hidden",
  "glassy.transparent": true,
  "glassy.visualEffectState": "active",
  "glassy.tabbingIdentifier": "glassy",
"glassy.alpha": 255,
"workbench.colorCustomizations": {
    "minimap.background": "#00000000",
    // current tab: a faint lift instead of a solid block
    "tab.activeBackground": "#ffffff0f",
    "tab.unfocusedActiveBackground": "#ffffff0a",
    "tab.selectedBackground": "#ffffff0f",
    // borders
    "window.activeBorder": "#00000000",
    "window.inactiveBorder": "#00000000",
    "titleBar.border": "#00000000",
    "tab.border": "#00000000",
    "tab.activeBorder": "#00000000",
    "tab.activeBorderTop": "#00000000",
    "tab.unfocusedActiveBorder": "#00000000",
    "tab.unfocusedActiveBorderTop": "#00000000",
    "editorGroupHeader.tabsBorder": "#00000000",
    "editorGroupHeader.border": "#00000000",
    "editorGroup.border": "#00000000",
    "sideBar.border": "#00000000",
    "sideBarSectionHeader.border": "#00000000",
    "activityBar.border": "#00000000",
    "panel.border": "#00000000",
    "statusBar.border": "#00000000",
  },
```

## glassy.customCSS

```css
html, body { background: transparent !important; }
.monaco-workbench { background: rgba(0,0,0,0.32) !important; --vscode-editor-background: transparent !important; --vscode-editorGutter-background: transparent !important; --vscode-minimap-background: transparent !important; --vscode-editorStickyScroll-background: transparent !important; --vscode-breadcrumb-background: transparent !important; --vscode-editorGroupHeader-tabsBackground: transparent !important; --vscode-tab-activeBackground: rgba(0,0,0,0.32) !important; --vscode-tab-inactiveBackground: transparent !important; --vscode-tab-unfocusedActiveBackground: transparent !important; --vscode-tab-unfocusedInactiveBackground: transparent !important; --vscode-sideBar-background: transparent !important; --vscode-sideBarSectionHeader-background: transparent !important; --vscode-activityBar-background: transparent !important; --vscode-panel-background: transparent !important; --vscode-terminal-background: transparent !important; --vscode-statusBar-background: transparent !important; --vscode-titleBar-activeBackground: transparent !important; --vscode-titleBar-inactiveBackground: transparent !important; }
.monaco-workbench .monaco-grid-view, .monaco-workbench .part.editor > .content, .monaco-workbench .editor-container { background-color: transparent !important; }
.monaco-workbench .part.titlebar, .monaco-workbench .tabs-and-actions-container { background-color: transparent !important; }
.monaco-workbench .part.editor, .monaco-workbench .sticky-widget, .monaco-workbench .agent-status-pill { border-color: transparent !important; }
.monaco-workbench .sticky-widget, .monaco-workbench .scroll-decoration, .monaco-workbench .tab-fill::after { box-shadow: none !important; }
.monaco-workbench .agent-status-badge-section::before { background-color: transparent !important; }
.monaco-workbench .sticky-widget { background-color: rgba(0,0,0,0.32) !important; }
.monaco-workbench .part { --modern-ui-floating-card-stroke-color: transparent !important; --modern-ui-floating-card-border-color: transparent !important; --modern-ui-floating-card-top-border-color: transparent !important; --modern-ui-floating-card-left-border-color: transparent !important; --modern-ui-floating-card-right-border-color: transparent !important; --modern-ui-floating-card-edge-color: transparent !important; --modern-ui-editor-border-color: transparent !important; }
.monaco-workbench { --vscode-sideBarTitle-background: transparent !important; }
.monaco-workbench, .monaco-workbench.mac { font-family: 'Fira Code', monospace !important;  font-size: 12px !important; }
.monaco-icon-label .label-name { font-size: 0.6rem !important; }
.monaco-icon-label.file-icon::before { font-size: 0.6rem !important; width: 8px; }
.monaco-workbench .part.editor > .content .editor-group-container > .title .tab, .monaco-workbench .part.editor > .content .editor-group-container > .title .action-item { -webkit-app-region: no-drag; }
.monaco-workbench .part.editor .tabs-container > .tab > .tab-actions .action-label { opacity: 1 !important; }
.workbench-hover, .monaco-hover { --vscode-editorHoverWidget-background: rgba(20, 16, 32, 0.6) !important; backdrop-filter: blur(16px) saturate(140%) !important; }
.monaco-workbench .tabs-container .tab-actions .action-label:hover { background-color: rgba(255, 255, 255, 0.08) !important; }
.monaco-workbench .tabs-and-actions-container { -webkit-app-region: drag; }
.monaco-workbench .tabs-container .tab:not(.active) .tab-fill, .monaco-workbench .part.sidebar .header-or-footer, .monaco-workbench .part.auxiliarybar .header-or-footer, .monaco-workbench .part.statusbar { background-color: transparent !important; }
.monaco-workbench .part.statusbar { box-shadow: none !important; }
```

## Why each part is there

- `glassy.alpha` stays 255: alpha fades the whole window, text included. The glass is transparent backgrounds over vibrancy.
- `glassy.transparent`: VS Code repaints every window with its theme colour after creation; patch v4 keeps `#00000000` while this is on.
- Vibrancy `window` is Apple's opaque window-background material and looks solid; `under-window`, `hud` and `fullscreen-ui` blur.
- No title bar without a gap: VS Code sizes the editor in JavaScript, so CSS can only move the tabs, never give the editor the height. `window.customTitleBarVisibility: never` is honoured only with `window.titleBarStyle: native`; `glassy.titleBarStyle: hidden` then stops macOS drawing its own strip. The tab strip becomes the drag region (`-webkit-app-region: drag`), tabs stay `no-drag`.
- Webviews (Claude Code and other panels) only see theme colours, so `sideBar.background` and `editor.background` go in `workbench.colorCustomizations`.
- Tabs, borders and the minimap read theme colours in JavaScript and ignore CSS variables: `workbench.colorCustomizations` again.
- Elements whose colour is set inline or by a direct rule (`.monaco-grid-view`, `.part.editor > .content`, `.editor-container`, `.tab-fill`, `.header-or-footer`, `.part.statusbar`) need `!important` rules.
- Floating-panel card frames come from `--modern-ui-floating-card-*` variables, partly with `!important` borders; only overriding the variables clears them.
- The status bar fades its background over 0.15s, so a computed style read straight after a change shows the old colour.

## Inspecting live

`notes/tools/cdp.mjs` drives VS Code over the DevTools protocol: `targets`, `eval '<js>'`, `screenshot <file>`, with `TARGET=<url fragment>` for a webview frame. Needs `"remote-debugging-port": "9222"` in `~/.vscode/argv.json`; VS Code ignores the number form silently. Remove it afterwards: any local process can drive VS Code while it is open.
