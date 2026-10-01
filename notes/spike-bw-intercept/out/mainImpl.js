import Jn from "electron";
function makeWindow() { return new Jn.BrowserWindow({ show: false, width: 400, height: 300 }); }
console.log("REWRITTEN " + makeWindow.toString().includes("globalThis.Glassy_BW"));
if (process.env.SPIKE_COMPILE_ONLY) process.exit(0);
// No top-level await on ready: Electron waits for the entry module to finish
// evaluating before it starts up, so awaiting here deadlocks. VS Code doesn't.
setTimeout(() => { console.log("TIMEOUT: ready never fired"); process.exit(3); }, 20000).unref();
Jn.app.whenReady().then(() => {
  const w = makeWindow();
  console.log("RESULT " + JSON.stringify({
    wrapped: !!w.Glassy_opts,
    instanceOfBW: w instanceof Jn.BrowserWindow,
    opacityFromNative: w.getOpacity(),
    passedOpts: w.Glassy_opts,
  }));
  Jn.app.quit();
});
