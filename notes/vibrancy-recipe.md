# Vibrant background recipe

A frosted-glass VS Code, verified by eye on VS Code 1.140, Electron 43.7.3, macOS 27 (2026-10-01).

## Settings

```jsonc
"glassy.vibrancy": "under-window",
  "glassy.windowButtonsVisible": false,
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
.monaco-workbench { background: rgba(0, 0, 0, 0) !important; --vscode-editor-background: transparent !important; --vscode-editorGutter-background: transparent !important; --vscode-minimap-background: transparent !important; --vscode-editorStickyScroll-background: transparent !important; --vscode-breadcrumb-background: transparent !important; --vscode-editorGroupHeader-tabsBackground: transparent !important; --vscode-tab-activeBackground: rgba(0, 0, 0, 0.06) !important; --vscode-tab-inactiveBackground: transparent !important; --vscode-tab-unfocusedActiveBackground: transparent !important; --vscode-tab-unfocusedInactiveBackground: transparent !important; --vscode-sideBar-background: transparent !important; --vscode-sideBarSectionHeader-background: transparent !important; --vscode-activityBar-background: transparent !important; --vscode-panel-background: transparent !important; --vscode-terminal-background: transparent !important; --vscode-statusBar-background: transparent !important; --vscode-titleBar-activeBackground: transparent !important; --vscode-titleBar-inactiveBackground: transparent !important; }
.monaco-workbench .monaco-grid-view, .monaco-workbench .part.editor > .content, .monaco-workbench .editor-container { background-color: transparent !important; }
.monaco-workbench .part.titlebar, .monaco-workbench .tabs-and-actions-container { background-color: transparent !important; }
.monaco-workbench .part.editor, .monaco-workbench .sticky-widget, .monaco-workbench .agent-status-pill { border-color: transparent !important; }
.monaco-workbench .sticky-widget, .monaco-workbench .scroll-decoration, .monaco-workbench .tab-fill::after { box-shadow: none !important; }
.monaco-workbench .agent-status-badge-section::before { background-color: transparent !important; }
.monaco-workbench .sticky-widget { background-color: rgba(0, 0, 0, 0.06) !important; }
.monaco-workbench .part { --modern-ui-floating-card-stroke-color: transparent !important; --modern-ui-floating-card-border-color: transparent !important; --modern-ui-floating-card-top-border-color: transparent !important; --modern-ui-floating-card-left-border-color: transparent !important; --modern-ui-floating-card-right-border-color: transparent !important; --modern-ui-floating-card-edge-color: transparent !important; --modern-ui-editor-border-color: transparent !important; }
.monaco-workbench { --vscode-sideBarTitle-background: transparent !important; }
.monaco-workbench, .monaco-workbench.mac { font-family: 'Fira Code', monospace !important;  font-size: 12px !important; }
.monaco-icon-label .label-name { font-size: 0.6rem !important; }
.monaco-icon-label.file-icon::before { font-size: 0.6rem !important; width: 8px; }
```

## Why each part is there

- `glassy.alpha` stays 255: alpha fades the whole window, text included. The glass comes from transparent backgrounds over vibrancy.
- `glassy.transparent`: VS Code repaints every window with its theme colour after creation; patch v4 keeps `#00000000` while this is on.
- Vibrancy material matters: `window` is Apple's opaque window-background material and looks solid. `under-window`, `hud`, `fullscreen-ui` blur.
- Theme colours VS Code reads in JavaScript (tabs, borders, minimap) ignore CSS variables, so they go in `workbench.colorCustomizations`.
- `.monaco-grid-view`, `.part.editor > .content`, `.editor-container`, `.part.titlebar`, `.tabs-and-actions-container` set their background directly and need `!important` rules.
- Floating-panel card frames are drawn from `--modern-ui-floating-card-*` variables, partly with `!important` borders, so overriding the variables with `!important` is the only thing that clears them.
- `backdrop-filter` on the sticky header was tested and did not cause opacity; it was dropped anyway.
- Two console sweeps found every culprit: an `elementsFromPoint` stack for backgrounds, and a full-window border/shadow/pseudo-element sweep.
