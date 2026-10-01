import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PATCH_TAG_START = '// [Glassy:START]';
const PATCH_TAG_END = '// [Glassy:END]';
const BACKUP_SUFFIX = '.glassy-backup';
const PATCH_VERSION_PREFIX = '/*glassy-patch:';

/** Bump whenever the injected code changes, so installed patches get replaced. */
export const PATCH_VERSION = 4;

/** Window settings, keyed as Electron names them. Absent keys leave VS Code's own value alone. */
export interface WindowConfig {
    vibrancy?: string | null;
    backgroundColor?: string;
    hasShadow?: boolean;
    windowButtonsVisible?: boolean;
    trafficLightPosition?: { x: number; y: number } | null;
    alwaysOnTop?: string | false;
    visibleOnAllWorkspaces?: boolean;
    hiddenInMissionControl?: boolean;
    titleBarStyle?: string;
    roundedCorners?: boolean;
    transparent?: boolean;
    visualEffectState?: string;
    tabbingIdentifier?: string;
}

export interface GlassyConfig {
    alpha: number;
    window: WindowConfig;
    /** Stylesheet inserted into every window's page; empty inserts nothing. */
    css: string;
}

/**
 * Injection for main.js (Electron main process). Runs before VS Code's own code:
 * - opacity and the live window settings are applied to every window and re-applied
 *   when ~/.glassy-config.json changes (500ms poll);
 * - construction-only settings reach `new BrowserWindow(opts)` through a module load
 *   hook that rewrites that call in out/mainImpl.js in memory. The file on disk is
 *   never written.
 */
export function getMainProcessInjection(configPath: string): string {
    const escaped = configPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    // Static imports are hoisted, so the listener registers before VS Code creates
    // windows. Glassy_ prefixes avoid collisions with VS Code's own top-level names.
    // Windows are primed at .999 once to avoid a macOS flicker on the first setOpacity.
    return `
${PATCH_TAG_START}
${PATCH_VERSION_PREFIX}${PATCH_VERSION}*/
import{app as Glassy_app,BrowserWindow as Glassy_BWC}from"electron";import{readFileSync as Glassy_rf,existsSync as Glassy_ex,watchFile as Glassy_wf}from"fs";import*as Glassy_mod from"module";
;(()=>{try{
const cp='${escaped}';let cfg={};
const read=()=>{try{cfg=Glassy_ex(cp)?(JSON.parse(Glassy_rf(cp,"utf8"))||{}):{}}catch(e){}};
const win=()=>cfg.window&&typeof cfg.window==="object"?cfg.window:{};
const opacity=()=>typeof cfg.alpha==="number"&&cfg.alpha>=10&&cfg.alpha<=255?cfg.alpha/255:1;
const CTOR=["titleBarStyle","roundedCorners","transparent","visualEffectState","tabbingIdentifier","vibrancy","backgroundColor","hasShadow"];
globalThis.Glassy_BW=function(o){read();const w=win(),r={...(o||{})};for(const k of CTOR)if(k in w&&w[k]!==null)r[k]=w[k];if(w.transparent===true&&!w.backgroundColor)r.backgroundColor="#00000000";return new Glassy_BWC(r)};
try{Glassy_mod.registerHooks({load(u,c,n){const res=n(u,c);if(!u.endsWith("/out/mainImpl.js"))return res;const s=typeof res.source==="string"?res.source:Buffer.from(res.source).toString("utf8");return{format:res.format,shortCircuit:true,source:s.replace(/new ([A-Za-z_$][\\w$]*)\\.BrowserWindow\\(/g,"new (globalThis.Glassy_BW||$1.BrowserWindow)(")}}})}catch(e){}
const LIVE={
vibrancy:[null,(w,v)=>w.setVibrancy(v)],
hasShadow:[true,(w,v)=>w.setHasShadow(v)],
windowButtonsVisible:[true,(w,v)=>w.setWindowButtonVisibility(v)],
trafficLightPosition:[null,(w,v)=>w.setWindowButtonPosition(v)],
alwaysOnTop:[false,(w,v)=>v?w.setAlwaysOnTop(true,v):w.setAlwaysOnTop(false)],
visibleOnAllWorkspaces:[false,(w,v)=>w.setVisibleOnAllWorkspaces(v,{skipTransformProcessType:true})],
hiddenInMissionControl:[false,(w,v)=>w.setHiddenInMissionControl(v)]};
const cssState=new WeakMap();
const applyCss=async(wc,reloaded)=>{try{const want=typeof cfg.css==="string"?cfg.css:"";const st=cssState.get(wc);
if(!reloaded&&st&&st.css===want)return;const next={css:want,key:null};cssState.set(wc,next);
if(st&&st.key&&!reloaded)try{await wc.removeInsertedCSS(st.key)}catch(e){}
if(want){const key=await wc.insertCSS(want);if(cssState.get(wc)===next)next.key=key;else try{await wc.removeInsertedCSS(key)}catch(e){}}}catch(e){}};
const applied=new WeakMap(),primed=new WeakSet();
const ownBg=()=>{const x=win();return x.backgroundColor||(x.transparent===true?"#00000000":null)};
const guardBg=w=>{const set=w.setBackgroundColor.bind(w);w.setBackgroundColor=c=>set(ownBg()||c)};
const apply=w=>{try{
if(!primed.has(w)){primed.add(w);guardBg(w);if(opacity()>=1)w.setOpacity(.999)}w.setOpacity(opacity());
if(ownBg())w.setBackgroundColor(ownBg());
const want=win(),prev=applied.get(w)||{},next={};
for(const k in LIVE){const[def,set]=LIVE[k];const has=k in want;if(has)next[k]=want[k];
const changed=has?JSON.stringify(want[k])!==JSON.stringify(prev[k]):k in prev;
if(!changed)continue;const v=has?want[k]:def;if(v===undefined)continue;try{set(w,v)}catch(e){}}
applied.set(w,next);applyCss(w.webContents,false)}catch(e){}};
read();Glassy_app.on("browser-window-created",(e,w)=>{w.webContents.on("did-finish-load",()=>applyCss(w.webContents,true));apply(w)});
const applyAll=()=>{read();Glassy_BWC.getAllWindows().forEach(apply)};
Glassy_app.whenReady().then(()=>{applyAll();Glassy_wf(cp,{interval:500},applyAll)})
}catch(e){}})();
${PATCH_TAG_END}`;
}

function getHomePath(): string {
    return os.homedir();
}

function getAppBasePath(): string {
    // Derive from running process — works for VS Code, Insiders, Cursor, any Electron fork
    const execPath = process.execPath;
    const contentsIdx = execPath.indexOf('/Contents/');
    if (contentsIdx !== -1) {
        const appResourcePath = path.join(execPath.substring(0, contentsIdx), 'Contents', 'Resources', 'app');
        if (fs.existsSync(path.join(appResourcePath, 'out', 'main.js'))) {
            return appResourcePath;
        }
    }

    // Fallback: check known locations
    const home = getHomePath();
    const candidates = [
        '/Applications/Visual Studio Code.app/Contents/Resources/app',
        '/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app',
        '/Applications/Cursor.app/Contents/Resources/app',
        '/Applications/VSCodium.app/Contents/Resources/app',
        '/Applications/Antigravity.app/Contents/Resources/app',
        '/Applications/Windsurf.app/Contents/Resources/app',
        path.join(home, 'Applications/Visual Studio Code.app/Contents/Resources/app'),
        path.join(home, 'Applications/Visual Studio Code - Insiders.app/Contents/Resources/app'),
        path.join(home, 'Applications/Cursor.app/Contents/Resources/app'),
        path.join(home, 'Applications/VSCodium.app/Contents/Resources/app'),
        path.join(home, 'Applications/Antigravity.app/Contents/Resources/app'),
        path.join(home, 'Applications/Windsurf.app/Contents/Resources/app'),
    ];

    for (const p of candidates) {
        if (fs.existsSync(path.join(p, 'out', 'main.js'))) {
            return p;
        }
    }

    throw new Error('Could not find VS Code installation.');
}

function getMainJsPath(): string {
    return path.join(getAppBasePath(), 'out', 'main.js');
}

function getPermissionDeniedMessage(mainPath: string): string {
    return [
        'Permission denied.',
        'Move VS Code to ~/Applications or grant write access only to your user, then try again.',
        `Example:\nsudo chown "$(whoami)" "${mainPath}" && chmod u+w "${mainPath}"`
    ].join('\n');
}

function isPermissionError(error: any): boolean {
    return error?.code === 'EACCES' || error?.code === 'EPERM';
}

export function getConfigPath(): string {
    return path.join(getHomePath(), '.glassy-config.json');
}

export function isPatched(): boolean {
    try {
        const content = fs.readFileSync(getMainJsPath(), 'utf8');
        const startIdx = content.indexOf(PATCH_TAG_START);
        if (startIdx === -1) return false;

        return content.indexOf(PATCH_TAG_END, startIdx + PATCH_TAG_START.length) !== -1;
    } catch {
        return false;
    }
}

/** Version of the installed patch; 1 for patches that predate the version marker, 0 if unpatched. */
export function installedPatchVersion(): number {
    try {
        const content = fs.readFileSync(getMainJsPath(), 'utf8');
        if (!content.includes(PATCH_TAG_START)) return 0;
        const idx = content.indexOf(PATCH_VERSION_PREFIX);
        if (idx === -1) return 1;
        return parseInt(content.substring(idx + PATCH_VERSION_PREFIX.length), 10) || 1;
    } catch {
        return 0;
    }
}

export function installPatch(): { success: boolean; message: string } {
    let mainPath = '';
    try {
        mainPath = getMainJsPath();
        const backupPath = mainPath + BACKUP_SUFFIX;
        let content = fs.readFileSync(mainPath, 'utf8');
        let restoredFromBackup = false;

        // Remove old patch if present (loop protects against corrupted duplicates)
        while (content.includes(PATCH_TAG_START)) {
            const nextContent = removePatchFromContent(content);
            if (nextContent === content) {
                if (!restoredFromBackup && fs.existsSync(backupPath)) {
                    content = fs.readFileSync(backupPath, 'utf8');
                    restoredFromBackup = true;
                    continue;
                }

                return {
                    success: false,
                    message: 'Found a partial or malformed Glassy patch in VS Code. Restore the original file and try again.'
                };
            }
            content = nextContent;
        }

        // Save backup of the clean (unpatched) content
        fs.writeFileSync(backupPath, content, 'utf8');

        // Prepend injection — code must run BEFORE VS Code creates windows
        const configPath = getConfigPath();
        content = getMainProcessInjection(configPath) + '\n' + content;
        fs.writeFileSync(mainPath, content, 'utf8');

        return { success: true, message: 'Patch installed successfully.' };
    } catch (e: any) {
        if (isPermissionError(e)) {
            return {
                success: false,
                message: getPermissionDeniedMessage(mainPath || getMainJsPath())
            };
        }
        return { success: false, message: e.message };
    }
}

export function uninstallPatch(): { success: boolean; message: string } {
    let mainPath = '';
    try {
        mainPath = getMainJsPath();
        const backupPath = mainPath + BACKUP_SUFFIX;

        // Always prefer stripping by tags — safe across VS Code updates
        let content = fs.readFileSync(mainPath, 'utf8');
        let didRemove = false;
        while (content.includes(PATCH_TAG_START)) {
            const nextContent = removePatchFromContent(content);
            if (nextContent === content) {
                if (fs.existsSync(backupPath)) {
                    fs.copyFileSync(backupPath, mainPath);
                    fs.unlinkSync(backupPath);
                    return { success: true, message: 'Patch removed (restored from backup).' };
                }

                return {
                    success: false,
                    message: 'Found a partial or malformed Glassy patch in VS Code. Restore the original file and try again.'
                };
            }
            content = nextContent;
            didRemove = true;
        }

        if (didRemove) {
            fs.writeFileSync(mainPath, content, 'utf8');
            // Clean up backup if it exists
            try { fs.unlinkSync(backupPath); } catch {}
            return { success: true, message: 'Patch removed.' };
        }

        // If tags are gone but a backup remains, treat it as stale and remove it
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            return { success: true, message: 'No patch found. Removed stale Glassy backup.' };
        }

        return { success: true, message: 'No patch found.' };
    } catch (e: any) {
        if (isPermissionError(e)) {
            return {
                success: false,
                message: getPermissionDeniedMessage(mainPath || getMainJsPath())
            };
        }
        return { success: false, message: e.message };
    }
}

function removePatchFromContent(content: string): string {
    const startIdx = content.indexOf(PATCH_TAG_START);
    if (startIdx === -1) return content;

    const endIdx = content.indexOf(PATCH_TAG_END, startIdx + PATCH_TAG_START.length);
    if (endIdx === -1) return content;

    const removeStart = startIdx === 0 ? 0 : content.lastIndexOf('\n', startIdx);
    let removeEnd = endIdx + PATCH_TAG_END.length;
    // Also strip the newline after the patch
    if (content[removeEnd] === '\n') removeEnd++;
    return content.substring(0, removeStart >= 0 ? removeStart : 0) + content.substring(removeEnd);
}

/** Atomic write — write to temp file then rename to avoid corruption from concurrent writes */
export function writeConfig(config: GlassyConfig): void {
    const configPath = getConfigPath();
    const tmpPath = configPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(config), 'utf8');

    try {
        fs.renameSync(tmpPath, configPath);
    } catch (e: any) {
        if (e.code === 'EXDEV') {
            fs.copyFileSync(tmpPath, configPath);
            fs.unlinkSync(tmpPath);
            return;
        }

        try { fs.unlinkSync(tmpPath); } catch {}
        throw e;
    }
}

export function removeConfig(): void {
    try { fs.unlinkSync(getConfigPath()); } catch {}
    try { fs.unlinkSync(getConfigPath() + '.tmp'); } catch {}
}
