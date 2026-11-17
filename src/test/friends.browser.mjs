// Browser-only fixtures: UI/accessibility regression checks, separate from real-service integration.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import { URL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { sessionFixture } from "./auth-fixture.ts";
import { profileFixture } from "./api-fixtures.ts";

const base = "http://127.0.0.1:5192";
const { fetch, WebSocket } = globalThis;
const artifacts = new URL("../../.artifacts/friends/", import.meta.url);
await mkdir(artifacts, { recursive: true });
const tab = await (await fetch("http://127.0.0.1:9392/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let seq = 0;
const pending = new Map();
const errors = [];
const requests = [];
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
  pending.set(id, { resolve, reject, timeout });
  socket.send(JSON.stringify({ id, method, params }));
});
const friend = { ...profileFixture, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", username: "Ash", display_name: "Ashley", discriminator: "0007" };
const me = { ...profileFixture, username: "Player", discriminator: "0024" };
const requestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let state = "friends";
async function intercept({ requestId: interception, request }) {
  const url = new URL(request.url);
  if (url.origin !== base) { errors.push(`Unexpected external request: ${url.origin}`); await call("Fetch.failRequest", { requestId: interception, errorReason: "BlockedByClient" }); return; }
  if (!url.pathname.startsWith("/api/")) { await call("Fetch.continueRequest", { requestId: interception }); return; }
  requests.push({ path: url.pathname, method: request.method });
  let data;
  if (url.pathname === "/api/auth/get-session") data = sessionFixture;
  else if (url.pathname === "/api/v1/bootstrap") data = { profile: me, communities: { items: [] } };
  else if (url.pathname === "/api/v1/communities") data = { items: [] };
  else if (url.pathname === "/api/v1/friends/summary") data = { friends: state === "friends" ? 1 : 0, incoming: state === "incoming" ? 1 : 0, outgoing: state === "outgoing" ? 1 : 0, blocked: state === "blocked" ? 1 : 0 };
  else if (url.pathname.endsWith("/relationship")) data = { state, request_id: ["incoming", "outgoing"].includes(state) ? requestId : null };
  else if (url.pathname === "/api/v1/friends/requests" && request.method === "POST") { state = "outgoing"; data = { id: requestId, status: "pending" }; }
  else if (url.pathname === "/api/v1/friends/requests") data = { items: ["incoming", "outgoing"].includes(state) ? [{ id: requestId, incoming: state === "incoming", created_at: "2026-11-17T10:00:00Z", profile: friend }] : [], next_cursor: null };
  else if (url.pathname === "/api/v1/friends") data = { items: state === "friends" ? [friend] : [], next_cursor: null };
  else if (url.pathname === "/api/v1/users/blocked") data = { items: state === "blocked" ? [friend] : [], next_cursor: null };
  else { errors.push(`Unexpected API: ${request.method} ${url.pathname}`); data = {}; }
  await call("Fetch.fulfillRequest", { requestId: interception, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(data)).toString("base64") });
}
socket.addEventListener("message", ({ data }) => {
  const packet = JSON.parse(data);
  if (packet.id) { const entry = pending.get(packet.id); if (!entry) return; clearTimeout(entry.timeout); pending.delete(packet.id); if (packet.error) entry.reject(new Error(packet.error.message)); else entry.resolve(packet.result); }
  else if (packet.method === "Fetch.requestPaused") void intercept(packet.params).catch((e) => { if (e.message !== "Invalid InterceptionId.") errors.push(e.message); });
  else if (packet.method === "Runtime.exceptionThrown") errors.push(packet.params.exceptionDetails.exception?.description ?? packet.params.exceptionDetails.text);
  else if (packet.method === "Runtime.consoleAPICalled" && packet.params.type === "error") errors.push(packet.params.args.map((arg) => arg.value ?? arg.description).join(" "));
});
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
async function until(expression) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error(`Condition failed: ${expression}`);
}
async function screenshot(name) {
  await evaluate("document.fonts.ready.then(() => true)");
  const result = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(new URL(name + ".png", artifacts), Buffer.from(result.data, "base64"));
}
async function tabButton(label) { await evaluate(`[...document.querySelectorAll('.friends-header button')].find(b=>b.textContent.startsWith(${JSON.stringify(label)})).click()`); }
try {
  await call("Page.enable"); await call("Runtime.enable");
  await call("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: base + "/app/friends" });
  await until("document.querySelector('.friend-row')?.textContent.includes('Ashley')");
  assert.equal(await evaluate("document.body.innerText.includes('Ash#0007')"), true);
  assert.equal(requests.some((r) => r.path.endsWith("/relationship")), false, "Closed menus must not cause per-row queries");
  await screenshot("all-desktop");
  for (const [width, height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[800,768]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await screenshot(`all-${width}`);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Overflow at ${width}`);
  }
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const searchRequests = requests.length;
  await evaluate("(()=>{const input=document.querySelector('#friends-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'nobody');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await until("document.body.innerText.includes('No matching friends')");
  await screenshot("search-no-results");
  await evaluate("(()=>{const input=document.querySelector('#friends-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'ash#0007');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await until("document.querySelector('.friend-row')?.textContent.includes('Ashley')");
  assert.equal(requests.length, searchRequests, "Friend filtering must not issue API requests");
  await evaluate("(()=>{const input=document.querySelector('#friends-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await evaluate("document.querySelector('.friend-options summary').click()");
  await until("document.querySelector('.friend-options')?.textContent.includes('Remove Friend')");
  await evaluate("document.querySelector('.friend-options .member-identity').click()");
  await until("document.querySelector('[role=dialog]')?.textContent.includes('Copy Username')");
  await screenshot("profile-desktop");
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
  await tabButton("Add Friend");
  await until("document.querySelector('#friend-username')");
  await screenshot("add-desktop");
  await evaluate("(()=>{const input=document.querySelector('#friend-username');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Ash#0007');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await evaluate("document.querySelector('.friends-add-form').requestSubmit()");
  await until("document.body.innerText.includes('Friend request sent.')");
  await tabButton("Pending");
  await until("document.body.innerText.includes('Cancel Request')");
  await screenshot("pending-desktop");
  await call("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await screenshot("pending-mobile");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "Mobile page overflow");
  await tabButton("Add Friend"); await screenshot("add-mobile");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await call("Emulation.setDeviceMetricsOverride", { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
  await screenshot("add-small-mobile");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  assert.deepEqual(errors, []);
  await writeFile(new URL("checks.json", artifacts), JSON.stringify({ checks: ["desktop list", "lazy menus", "profile and copy action", "send request", "pending request", "mobile list and form", "no horizontal overflow", "no browser exceptions"], errors, requests }, null, 2));
  console.log("PASS: Friends browser checks at 1440px and 375px; menus/profiles, add/pending, no overflow or browser errors.");
} finally {
  await call("Fetch.disable").catch(() => {});
  socket.close();
  await fetch(`http://127.0.0.1:9392/json/close/${tab.id}`).catch(() => {});
}
