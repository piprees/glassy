# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Glassy is a VS Code extension for macOS that enables adjustable window transparency. It works by patching VS Code's Electron main process (`out/main.js`) to inject opacity control code before windows are created.

This is a fork, published as `piprees.glassy` and never to a registry. The dotfiles (`~/.dotfiles/shell/glassy.zsh`) build the committed HEAD into a .vsix and install it on bootstrap and `update`. `notes/electron-macos-api.md` maps the Electron 43 window APIs reachable from the patch.

## Commands

```bash
npm run compile          # Production build (minified, no sourcemaps)
npm run watch            # Development watch mode (sourcemaps enabled)
npm run package          # Package as .vsix for local testing
npm run install-local    # Package the working tree and install it into VS Code (reload windows after)
```

There are no tests or linter configured — the TypeScript compiler serves as the primary static check.

## Architecture

The extension has two main source files:

### `src/extension.ts`
Runs in VS Code's extension host process. Handles all user-facing behavior:
- Registers 6 commands (`glassy.install`, `glassy.uninstall`, `glassy.increase`, `glassy.decrease`, `glassy.maximize`, `glassy.minimize`)
- Manages status bar, settings sync, debounced opacity writes (50ms), and auto-repair after VS Code updates
- Writes opacity to both VS Code settings (`glassy.alpha`) and `~/.glassy-config.json`

### `src/patcher.ts`
Handles the actual file patching of VS Code internals:
- Locates VS Code's `out/main.js` across supported editors (VS Code, Insiders, Cursor, VSCodium, Antigravity, Windsurf)
- Prepends minified Electron code wrapped in `PATCH_TAG_START`/`PATCH_TAG_END` markers to `main.js`
- The injected code applies opacity and the live window settings to every window and re-applies them when `~/.glassy-config.json` changes (500ms poll)
- Construction-only settings reach `new BrowserWindow()` through a `module.registerHooks` load hook that rewrites that call in `out/mainImpl.js` in memory; `notes/spike-bw-intercept/` is the proof
- `PATCH_VERSION` is stamped into the patch; bump it whenever the injected code changes so installed patches get replaced
- Uses atomic writes (temp file + rename) for `~/.glassy-config.json` to prevent corruption
- Backs up original `main.js` before patching; restore on uninstall

### Build

`esbuild.js` bundles `src/extension.ts` → `dist/extension.js` as CommonJS with `vscode` externalized. No other runtime dependencies.

## Publishing

Dual-registry workflow documented in `PUBLISHING.md`:
1. Bump version in `package.json`, update `CHANGELOG.md`, commit and push
2. `npx @vscode/vsce publish` → VS Code Marketplace
3. `npx ovsx publish -p <token>` → Open VSX (for Cursor, VSCodium, Antigravity users)
