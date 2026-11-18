// Browser-only fixtures: UI/accessibility regression checks, separate from real-service integration.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import { URL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { sessionFixture } from "./auth-fixture.ts";
import { profileFixture } from "./api-fixtures.ts";

const base = "http://127.0.0.1:5193";
const { fetch, WebSocket } = globalThis;
const artifacts = new URL("../../.artifacts/dm-dialogs/", import.meta.url);
await mkdir(artifacts, { recursive: true });
const tab = await (await fetch("http://127.0.0.1:9393/json/new?about:blank", { method: "PUT" })).json();
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
const directId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const groupId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const friends = [friend, ...Array.from({ length: 14 }, (_, index) => ({ ...friend, id: `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, "0")}`, username: `Friend${index}`, display_name: `Test Friend ${index}`, discriminator: "1234" }))];
const member = (profile) => ({ id: profile.id, profile, role: "member", joined_at: "2026-11-18T10:00:00Z" });
const direct = { id: directId, type: "direct", name: null, icon_url: null, created_by: me.id, created_at: "2026-11-18T10:00:00Z", updated_at: "2026-11-18T10:00:00Z", last_message_at: "2026-11-18T10:00:00Z", role: "member", hidden: false, last_message: null, members: [member(me), member(friend)] };
let group = null;
async function intercept({ requestId: interception, request }) {
  const url = new URL(request.url);
  if (url.origin !== base) { errors.push(`Unexpected external request: ${url.origin}`); await call("Fetch.failRequest", { requestId: interception, errorReason: "BlockedByClient" }); return; }
  if (!url.pathname.startsWith("/api/")) { await call("Fetch.continueRequest", { requestId: interception }); return; }
  requests.push({ path: url.pathname, method: request.method, body: request.postData ? JSON.parse(request.postData) : null });
  let data;
  if (url.pathname === "/api/auth/get-session") data = sessionFixture;
  else if (url.pathname === "/api/v1/bootstrap") data = { profile: me, communities: { items: [] } };
  else if (url.pathname === "/api/v1/communities") data = { items: [] };
  else if (url.pathname === "/api/v1/friends/summary") data = { friends: friends.length, incoming: 0, outgoing: 0, blocked: 0 };
  else if (url.pathname === "/api/v1/friends") data = { items: [...friends, me, friend], next_cursor: null };
  else if (url.pathname === "/api/v1/conversations/group") {
    const input = JSON.parse(request.postData);
    group = { ...direct, id: groupId, type: "group", role: "owner", members: [member(me), ...friends.filter((item) => input.recipient_ids.includes(item.id)).map(member)] };
    data = group;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  else if (url.pathname === `/api/v1/conversations/${groupId}/members` && request.method === "POST") {
    const input = JSON.parse(request.postData);
    group.members.push(...friends.filter((item) => input.user_ids.includes(item.id)).map(member));
    data = { items: group.members };
  }
  else if (url.pathname === `/api/v1/conversations/${groupId}/members`) data = { items: group.members };
  else if (url.pathname === "/api/v1/conversations") data = { items: group ? [group, direct] : [direct] };
  else if (url.pathname.endsWith("/messages")) data = { items: [], next_cursor: null };
  else if (url.pathname === `/api/v1/conversations/${directId}`) data = direct;
  else if (url.pathname === `/api/v1/conversations/${groupId}`) data = group;
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
  await until("getComputedStyle(document.querySelector('.group-dm-dialog')).opacity==='1'");
  await evaluate("document.fonts.ready.then(() => true)");
  const result = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(new URL(name + ".png", artifacts), Buffer.from(result.data, "base64"));
}

async function key(key) {
  await call("Input.dispatchKeyEvent", { type: "keyDown", key, code: key });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key, code: key });
}
async function bounds(quick = false) {
  const metrics = await evaluate(`(() => { const d=document.querySelector('.group-dm-dialog'); const r=d.getBoundingClientRect();return { x:r.x,y:r.y,width:r.width,height:r.height,iw:innerWidth,ih:innerHeight,position:getComputedStyle(d).position,z:+getComputedStyle(d).zIndex,overlay:+getComputedStyle(document.querySelector('.dialog-overlay')).zIndex,overflow:getComputedStyle(document.body).overflow,focus:d.contains(document.activeElement) }; })()`);
  assert.equal(metrics.position, "fixed");
  assert.ok(Math.abs(metrics.x + metrics.width / 2 - metrics.iw / 2) < 2);
  assert.ok(metrics.x >= 0 && metrics.y >= 0 && metrics.y + metrics.height <= metrics.ih);
  assert.ok(metrics.z > metrics.overlay);
  assert.equal(metrics.overflow, "hidden");
  assert.equal(metrics.focus, true);
  if (quick && metrics.iw > 640) assert.ok(Math.abs(metrics.y + metrics.height / 2 - metrics.ih * .45) < 2);
}
try {
  await call("Page.enable"); await call("Runtime.enable");
  await call("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: base + "/app/friends" });
  await until("document.querySelector('.friend-row')");
  await evaluate("document.querySelector('.personal-search button').focus();document.querySelector('.personal-search button').click()");
  await until("document.querySelector('[role=combobox]') && document.querySelectorAll('[role=option]').length>10");
  assert.equal(await evaluate("document.activeElement.getAttribute('role')"), "combobox");
  await bounds(true); await screenshot("quick-switcher-desktop");
  const before = await evaluate("document.querySelector('[role=combobox]').getAttribute('aria-activedescendant')");
  await key("ArrowDown");
  assert.notEqual(await evaluate("document.querySelector('[role=combobox]').getAttribute('aria-activedescendant')"), before);
  await key("ArrowUp");
  assert.equal(await evaluate("document.querySelector('[role=combobox]').getAttribute('aria-activedescendant')"), before);
  for (const [width,height] of [[800,600],[375,667],[320,480],[1440,900]]) {
    await call("Emulation.setDeviceMetricsOverride", { width,height,deviceScaleFactor:1,mobile:false });
    await bounds(true); await screenshot(`quick-switcher-${width}`);
  }
  for (let count=0;count<6;count++) { await key("Tab"); assert.equal(await evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"), true); }
  await key("Escape"); await until("!document.querySelector('[role=dialog]')");
  await until("document.activeElement===document.querySelector('.personal-search button')");
  await evaluate("document.querySelector('.personal-search button').focus();document.querySelector('.personal-search button').click()");
  await until("document.querySelector('[role=combobox]')");
  await call("Input.dispatchMouseEvent", { type:"mousePressed",x:5,y:5,button:"left",clickCount:1 });
  await call("Input.dispatchMouseEvent", { type:"mouseReleased",x:5,y:5,button:"left",clickCount:1 });
  await until("!document.querySelector('[role=dialog]')");
  await evaluate("document.querySelector('.personal-search button').focus();document.querySelector('.personal-search button').click()");
  await until("document.querySelector('[role=option]')");
  await key("Enter");
  await until(`location.pathname==='/app/messages/${directId}' && !document.querySelector('[role=dialog]')`);
  await until("document.querySelector('[aria-label=\"Add Friends to DM\"]')");
  await evaluate("document.querySelector('[aria-label=\"Add Friends to DM\"]').focus();document.querySelector('[aria-label=\"Add Friends to DM\"]').click()");
  await until("document.querySelector('.group-dm-footer')");
  await bounds();
  assert.equal(await evaluate("document.querySelectorAll('.group-dm-friend-row').length"), friends.length);
  assert.equal(await evaluate("document.querySelector('.group-dm-friend-row').disabled"), true);
  assert.equal(await evaluate("document.querySelector('.group-dm-friends-list').scrollHeight>document.querySelector('.group-dm-friends-list').clientHeight"), true);
  await screenshot("add-to-dm-desktop");
  for (const [width,height] of [[375,667],[320,480],[1440,900]]) {
    await call("Emulation.setDeviceMetricsOverride", { width,height,deviceScaleFactor:1,mobile:false });
    await bounds(); await screenshot(`add-to-dm-${width}`);
    assert.equal(await evaluate("(()=>{const d=document.querySelector('.group-dm-dialog').getBoundingClientRect();const f=document.querySelector('.group-dm-footer').getBoundingClientRect();return f.bottom<=d.bottom&&f.top>=d.top})()"), true);
  }
  await evaluate("document.querySelectorAll('.group-dm-friend-row')[1].click()");
  assert.equal(await evaluate("document.querySelector('.group-dm-counter').textContent.trim()"), "Selected: 1/8");
  await evaluate("document.querySelector('.group-dm-footer button').click();document.querySelector('.group-dm-footer button').click()");
  await until(`location.pathname==='/app/messages/${groupId}' && !document.querySelector('[role=dialog]')`);
  assert.equal(requests.filter((item)=>item.path==='/api/v1/conversations/group').length,1);
  assert.deepEqual(requests.find((item)=>item.path==='/api/v1/conversations/group').body,{recipient_ids:[friend.id,friends[1].id]});
  assert.equal(requests.some((item)=>item.path.includes(directId)&&item.method!=='GET'),false);
  await until("document.querySelector('.dm-sidebar-list').children.length===2");
  await evaluate("document.querySelector('[aria-label=\"Add Members\"]').click()");
  await until("document.querySelector('.group-dm-footer')");
  await evaluate("document.querySelectorAll('.group-dm-friend-row')[2].click()");
  await until("!document.querySelector('.group-dm-footer button').disabled");
  await evaluate("document.querySelector('.group-dm-footer button').click()");
  await until("!document.querySelector('[role=dialog]')");
  assert.equal(requests.filter((item)=>item.path===`/api/v1/conversations/${groupId}/members`&&item.method==='POST').length,1);
  await evaluate("document.querySelector('[aria-label=\"Create Direct Message\"]').click()");
  await until("document.querySelector('.group-dm-footer')");
  assert.equal(await evaluate("document.querySelector('.group-dm-dialog-title').textContent.trim()"),"Create Group DM");
  assert.equal(await evaluate("document.querySelector('.group-dm-counter').textContent.trim()"),"Selected: 0/8");
  await bounds(); await screenshot("create-group-desktop");
  await key("Escape"); await until("!document.querySelector('[role=dialog]')");
  await call("Emulation.setDeviceMetricsOverride", { width:375,height:667,deviceScaleFactor:1,mobile:false });
  await call("Page.navigate", { url: base + "/app/friends" });
  await until("document.querySelector('.friend-row')");
  await evaluate("document.querySelector('[aria-label=\"Open navigation\"]').focus();document.querySelector('[aria-label=\"Open navigation\"]').click()");
  await until("document.querySelector('.navigation-dialog')");
  await evaluate("document.querySelector('.navigation-dialog [aria-label=\"Create Direct Message\"]').focus();document.querySelector('.navigation-dialog [aria-label=\"Create Direct Message\"]').click()");
  await until("document.querySelector('.group-dm-dialog')");
  await bounds(); await screenshot("create-group-mobile-navigation");
  await key("Escape"); await until("!document.querySelector('.group-dm-dialog')");
  assert.equal(await evaluate("document.activeElement===document.querySelector('.navigation-dialog [aria-label=\"Create Direct Message\"]')"), true);
  await evaluate("document.querySelector('.navigation-dialog [aria-label=\"Create Direct Message\"]').click()");
  await until("document.querySelector('.group-dm-friend-row')");
  await evaluate("document.querySelector('.group-dm-friend-row').click()");
  await until("!document.querySelector('.group-dm-footer button').disabled");
  await evaluate("document.querySelector('.group-dm-footer button').click()");
  await until("!document.querySelector('.group-dm-dialog') && !document.querySelector('.navigation-dialog')");
  assert.deepEqual(errors, []);
  await writeFile(new URL("checks.json", artifacts),JSON.stringify({checks:["centered portal layout","resize at 1440/800/375/320px","scroll lock and focus trap","keyboard selection and dismissal","outside click and focus restoration","avatars","self/duplicate exclusion","visible footer and scrollable friends","new group from DM without changing original","single submission","sidebar cache update","add members to existing group","nested mobile navigation and creation dismissal"],errors,requests},null,2));
  console.log("PASS: DM dialogs browser layout, keyboard, resize, focus, scroll, creation, sidebar, and participant checks.");
} finally {
  await call("Fetch.disable").catch(()=>{}); socket.close();
  await fetch(`http://127.0.0.1:9393/json/close/${tab.id}`).catch(()=>{});
}
