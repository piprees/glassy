// [Glassy:START]
import{app as Glassy_app,BrowserWindow as Glassy_BWC}from"electron";import{registerHooks as Glassy_rh}from"node:module";
;(()=>{try{globalThis.Glassy_BW=function(o){const opts={...(o||{}),opacity:.5,titleBarStyle:"hiddenInset",roundedCorners:false};const w=new Glassy_BWC(opts);w.Glassy_opts=opts;return w};Glassy_rh({load(u,c,n){const r=n(u,c);if(!u.endsWith("/out/mainImpl.js"))return r;const s=typeof r.source==="string"?r.source:Buffer.from(r.source).toString("utf8");return{format:r.format,shortCircuit:true,source:s.replace(/new ([A-Za-z_$][\w$]*)\.BrowserWindow\(/g,"new (globalThis.Glassy_BW||$1.BrowserWindow)(")}}})}catch(e){console.log("GLASSY_ERR",e.message)}})();
// [Glassy:END]
console.log("main.js body runs");
await import("./mainImpl.js");
