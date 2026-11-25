// Local browser QA against src/test/permissions-preview.html; no live services.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { Buffer } from "node:buffer";

const output = mkdtempSync(join(tmpdir(), "core-permissions-browser-"));
const profile = join(output, "profile");
const child = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
let socket;
try {
  const portFile = join(profile, "DevToolsActivePort");
  for (let attempt = 0; !existsSync(portFile) && attempt < 100; attempt++) await pause(100);
  const port = readFileSync(portFile, "utf8").split("\n")[0];
  const pages = await (await globalThis.fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new globalThis.WebSocket(pages.find(p => p.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(String(event.data));
    const operation = pending.get(message.id);
    if (operation) { pending.delete(message.id); if (message.error) operation.reject(new Error(JSON.stringify(message.error))); else operation.resolve(message.result); }
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await command("Page.enable");
  for (const [name, width, height] of [["desktop", 1280, 1000], ["mobile", 390, 844]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: name === "mobile" });
    await command("Page.navigate", { url: "http://127.0.0.1:5177/src/test/permissions-preview.html" });
    await command("Runtime.evaluate", { expression: "new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(document.querySelectorAll('.permission-row').length){clearInterval(timer);resolve(true);}else if(++tries>100){clearInterval(timer);reject(new Error('Fixture did not render'));}},100);})", awaitPromise: true });
    const metrics = await command("Runtime.evaluate", { expression: "JSON.stringify({viewport:innerWidth,dialogWidth:document.querySelector('.channel-settings-dialog').clientWidth,scrollWidth:document.querySelector('.channel-settings-dialog').scrollWidth,rows:document.querySelectorAll('.permission-row').length})", returnByValue: true });
    const shot = await command("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(output, `${name}.png`), Buffer.from(shot.data, "base64"));
    globalThis.console.log(name, metrics.result.value, join(output, `${name}.png`));
    await command("Runtime.evaluate", { expression: "document.querySelector('.channel-settings-dialog').scrollTop = document.querySelector('.permission-columns').offsetTop - 12" });
    await pause(100);
    const advanced = await command("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(output, `${name}-advanced.png`), Buffer.from(advanced.data, "base64"));
  }
  await command("Browser.close");
} finally { socket?.close(); child.kill(); }
