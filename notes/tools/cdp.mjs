// Usage: node cdp.mjs targets | node cdp.mjs eval '<js expression>' | node cdp.mjs screenshot <out.png>
// Talks to VS Code's renderer over the DevTools protocol on 127.0.0.1:9222.
import { writeFileSync } from 'node:fs';

const [, , cmd, arg] = process.argv;
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
if (cmd === 'targets') {
  for (const t of targets) console.log(t.type.padEnd(8), t.title.slice(0, 60).padEnd(62), t.url.slice(0, 80));
  process.exit(0);
}

const page = process.env.TARGET ? targets.find(t => t.url.includes(process.env.TARGET)) : targets.find(t => t.type === 'page' && t.url.includes('workbench'));
if (!page) throw new Error('no workbench page among targets');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
let id = 0;
const send = (method, params = {}) => new Promise((ok, fail) => {
  const my = ++id;
  ws.addEventListener('message', function on(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id !== my) return;
    ws.removeEventListener('message', on);
    msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
  });
  ws.send(JSON.stringify({ id: my, method, params }));
});

if (cmd === 'eval') {
  const r = await send('Runtime.evaluate', { expression: arg, returnByValue: true, awaitPromise: true });
  console.log(r.exceptionDetails ? `ERROR ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}` : typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value, null, 2));
} else if (cmd === 'screenshot') {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(arg, Buffer.from(r.data, 'base64'));
  console.log(`saved ${arg}`);
}
ws.close();
