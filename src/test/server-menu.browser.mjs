// Isolated visual QA. Fixtures are intercepted in Chrome and never enter the app or its storage.
// Run against the local QA preview with: node --experimental-strip-types src/test/server-ui.browser.mjs
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { setTimeout, clearTimeout } from "node:timers";
import { URL } from "node:url";
import { sessionFixture } from "./auth-fixture.ts";
import { channelFixture, communityFixture, profileFixture, messageFixture, memberPageFixture, channelAccessFixture } from "./api-fixtures.ts";

const base = "http://127.0.0.1:5187";
const { fetch, WebSocket } = globalThis;
const artifactDirectory = new URL("../../.artifacts/server-menu/", import.meta.url);
await mkdir(artifactDirectory, { recursive: true });
assert.equal((await fetch(base)).status, 200);
const tab = await (await fetch("http://127.0.0.1:9367/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const handlers = new Map();
const errors = [];
const harnessNotes = [];
const apiRequests = [];
const checks = [];
const channels = [channelFixture, { ...channelFixture, id: "66666666-6666-4666-8666-666666666666", name: "a-long-channel-name-for-checking-sidebar-truncation", position: 1 }];
const profile = { ...profileFixture, username: "u_e8d4720993964d8e9559cc1a054bb8" };
const messages = [messageFixture];
const inviteCode = "a".repeat(64);
const secondCommunity = { ...communityFixture, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Second squad" };
const events = [];
let owner = true;
let longNames = false;
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
  pending.set(id, { resolve, reject, timeout });
  socket.send(JSON.stringify({ id, method, params }));
});
socket.addEventListener("message", ({ data }) => {
  const packet = JSON.parse(data);
  if (packet.id) {
    const item = pending.get(packet.id);
    if (!item) return;
    clearTimeout(item.timeout);
    pending.delete(packet.id);
    if (packet.error) item.reject(new Error(packet.error.message)); else item.resolve(packet.result);
  } else for (const handler of handlers.get(packet.method) ?? []) Promise.resolve(handler(packet.params)).catch((error) => {
    // Chrome can discard an intercepted asset when a test reloads/navigates.
    if (error.message === "Invalid InterceptionId.") harnessNotes.push("Chrome cancelled an intercepted request during navigation.");
    else errors.push(error.message);
  });
});
const on = (event, handler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]);
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
async function until(expression) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Browser condition failed: ${expression}`);
}
async function click(selector) {
  await until(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); return element?.getClientRects().length && !element.disabled; })()`);
  const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  assert(point, `Missing control: ${selector}`);
  await call("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
}
async function screenshot(name) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  await evaluate("document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))");
  const result = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(new URL(`${name}.png`, artifactDirectory), Buffer.from(result.data, "base64"));
}
on("Runtime.exceptionThrown", ({ exceptionDetails }) => errors.push(exceptionDetails.exception?.description ?? exceptionDetails.text));
on("Runtime.consoleAPICalled", ({ type, args }) => {
  if (type === "error") errors.push(args.map((arg) => arg.value ?? arg.description).join(" "));
});
on("Fetch.requestPaused", async ({ requestId, request }) => {
  const url = new URL(request.url);
  if (url.origin !== base) {
    errors.push(`Unexpected external request: ${url.origin}`);
    await call("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
    return;
  }
  if (!url.pathname.startsWith("/api/")) {
    await call("Fetch.continueRequest", { requestId });
    return;
  }
  apiRequests.push({ path: url.pathname, method: request.method });
  const currentProfile = { ...profile, display_name: longNames ? "A very long public display name ".repeat(3) : profile.display_name };
  const community = { ...communityFixture, owner_id: owner ? profile.id : "99999999-9999-4999-8999-999999999999" };
  let data;
  let responseCode = 200;
  if (url.pathname === "/api/auth/get-session") data = sessionFixture;
  else if (url.pathname === "/api/v1/bootstrap") data = { profile: currentProfile, communities: { items: [community,secondCommunity] } };
  else if (url.pathname === "/api/v1/communities") data = { items: [community,secondCommunity] };
  else if (url.pathname.endsWith("/invite-permissions")) data = { create: owner, manage: owner, manage_channels: owner, owner };
  else if (url.pathname.endsWith("/event-permissions")) data = { create: owner, manage: owner };
  else if (url.pathname.endsWith("/invites") && request.method === "POST") data = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: inviteCode, url: `${base}/invite/${inviteCode}`, expires_at: null, max_uses: null, uses: 0 };
  else if (url.pathname === `/api/v1/invites/${inviteCode}`) data = { server: { name: community.name, icon_url: null, banner_url: null, description: null, member_count: 42 }, expires_at: null };
  else if (url.pathname === `/api/v1/invites/${inviteCode}/status`) data = { already_member: false, community_id: null };
  else if (/\/events\/[^/]+$/.test(url.pathname)) {
    const found = events.find(event => event.id === url.pathname.split("/").at(-1));
    if (!found) { responseCode = 404; data = {}; }
    else {
      if (request.method === "PATCH") Object.assign(found,JSON.parse(request.postData));
      if (request.method === "DELETE") found.status = "cancelled";
      data = found;
    }
  }
  else if (url.pathname.endsWith("/events")) {
    if (request.method === "POST") {
      const event = { ...JSON.parse(request.postData), id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", community_id: community.id, status: "scheduled", creator: "Ash", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      events.push(event);data = event;responseCode=201;
    } else data = {items:events,next_cursor:null};
  }
  else if (url.pathname.endsWith("/access")) { data = channelAccessFixture; responseCode = owner ? 200 : 403; }
  else if (url.pathname.endsWith("/members")) data = { ...memberPageFixture, community_id: url.pathname.split("/communities/")[1].split("/")[0], channel_id: url.pathname.includes("/channels/") ? url.pathname.split("/channels/")[1].split("/")[0] : null,
    items: [{ ...memberPageFixture.items[0], community_id: url.pathname.split("/communities/")[1].split("/")[0], ...currentProfile }] };
  else if (url.pathname.endsWith("/channels")) {
    if (request.method === "POST") {
      const created = { ...channelFixture, id: "77777777-7777-4777-8777-777777777777", name: JSON.parse(request.postData).name, position: channels.length };
      channels.push(created);
      data = created;
      responseCode = 201;
    } else data = { items: channels };
  } else if (url.pathname.endsWith("/messages")) {
    if (request.method === "POST") {
      data = { ...messageFixture, id: "88888888-8888-4888-8888-888888888888", ...JSON.parse(request.postData), author: currentProfile };
      messages.unshift(data);
      responseCode = 201;
    } else data = { items: messages, next_cursor: null };
  } else { errors.push(`Unexpected fixture route: ${url.pathname}`); responseCode = 404; data = {}; }
  await call("Fetch.fulfillRequest", { requestId, responseCode, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(data)).toString("base64") });
});

async function key(key, code = key, windowsVirtualKeyCode = 0) {
  await call("Input.dispatchKeyEvent", {type:"keyDown",key,code,windowsVirtualKeyCode});
  await call("Input.dispatchKeyEvent", {type:"keyUp",key,code,windowsVirtualKeyCode});
}
async function fill(selector,value) {
  await click(selector);
  await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)}); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
try {
  await call("Page.enable");await call("Runtime.enable");
  await call("Browser.grantPermissions", {origin:base,permissions:["clipboardReadWrite","clipboardSanitizedWrite"]});
  await call("Fetch.enable", {patterns:[{urlPattern:"*"}]});
  await call("Emulation.setDeviceMetricsOverride", {width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await call("Page.navigate", {url:`${base}/app`});
  await until("document.querySelectorAll('.server-menu-action').length===5 && !!document.querySelector('.message-body')");
  await click('[aria-label="Add server"]');
  await until("!!document.querySelector('.add-server-choices')");
  await screenshot('add-server-choices');
  await click('.add-server-choice[aria-label="Create a server"]');
  await until("document.activeElement?.id==='create-community-name'");
  await screenshot('create-server');
  await click('.create-resource-dialog .dialog-close');
  await until("document.activeElement?.getAttribute('aria-label')==='Add server'");
  await click('[aria-label="Add server"]');
  await click('.add-server-choice[aria-label="Join a server"]');
  await until("document.activeElement?.matches('.add-server-dialog input')");
  await fill('.add-server-dialog input',`${base}/invite/${inviteCode}`);
  await screenshot('join-server');
  await click('.add-server-dialog button[type=submit]');
  await until("!!document.querySelector('.invite-card') && document.querySelector('.invite-card h1')?.textContent==='Test Squad'");
  assert.equal(apiRequests.some(request=>request.path.endsWith('/accept')),false);
  await screenshot('join-server-preview');
  await call("Page.navigate", {url:`${base}/app`});
  await until("document.querySelectorAll('.server-menu-action').length===5 && !!document.querySelector('.message-body')");
  await click('.server-header-trigger');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=menuitem]')].map(x=>x.textContent)"),["Invite People","Server Settings","Create Channel","Create Event","Copy Server ID"]);
  assert.equal(await evaluate("document.body.innerText.includes('Your communities')"),false);
  await screenshot('desktop-menu');
  await key("End","End",35);await until("document.activeElement.textContent==='Copy Server ID'");
  await key("Escape","Escape",27);await until("document.activeElement.matches('.server-header-trigger') && document.querySelector('[role=menu]').hidden");
  await click('.server-header-trigger');await click('[role=menuitem]:last-child');
  await until("document.body.innerText.includes('Server ID copied')");
  assert.equal(await evaluate("navigator.clipboard.readText()"),communityFixture.id);
  await click('.server-header-trigger');await click('[role=menuitem]:nth-child(1)');
  await until("!!document.querySelector('.invite-dialog')");
  await screenshot('invite-empty');
  await click('.invite-dialog button[type=submit]');
  
  await until("!!document.querySelector('.invite-dialog button[aria-label=\"Copy Link\"]:not(:disabled)')");
  await screenshot('invite-dialog');
  await click('.invite-edit-link');
  await until("document.querySelector('.invite-modal-title')?.textContent==='Invite link settings'");
  await screenshot('invite-link-settings');
  await click('.invite-modal-actions button:first-child');
  await click('.invite-dialog .dialog-close');await until("document.activeElement.matches('.server-header-trigger')");
  await click('.server-header-trigger');await click('[role=menuitem]:nth-child(4)');
  await until("!!document.querySelector('[aria-label=\"Create server event\"]')");
  await fill('input[id$="-name"]','Browser event');
  await fill('input[id$="-startDate"]','2031-11-20');
  await fill('input[id$="-startTime"]','19:00');
  await fill('input[id$="-location"]','Our gaming cafe');
  await screenshot('create-event');
  await click('.event-dialog button[type=submit]');
  await until("!!document.querySelector('.server-events') && !!document.querySelector('[role=dialog]') && document.body.innerText.includes('Event created')");
  await screenshot('event-details');
  await click('[aria-label="Close event details"]');
  await until("!document.querySelector('[role=dialog]')");
  await screenshot('events-list');
  await click('.rail-links a[aria-label="Second squad"]');
  await until("document.querySelector('.server-header-trigger strong')?.textContent==='Second squad'");
  await click('.server-header-trigger');await click('[role=menuitem]:last-child');
  await until("document.body.innerText.includes('Server ID copied')");
  assert.equal(await evaluate("navigator.clipboard.readText()"),secondCommunity.id);
  for (const [width,height] of [[390,844],[320,720]]) {
    await call("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:false});
    await click('.community-menu-toggle');await until("!!document.querySelector('.navigation-dialog')");
    await click('.navigation-dialog .server-header-trigger');
    const fitExpression="(() => {const r=document.querySelector('.navigation-dialog [role=menu]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;})()";
    await until(fitExpression);
    const fits=await evaluate(fitExpression);
    assert.equal(fits,true);checks.push({width,height,fits});await screenshot(`mobile-menu-${width}`);
    await click('.navigation-dialog [role=menuitem]:first-child');
    await until("!!document.querySelector('.invite-dialog')");
    await screenshot(`mobile-invite-${width}`);
    await click('.invite-edit-link');
    await screenshot(`mobile-invite-settings-${width}`);
    assert.equal(await evaluate("(() => { const r=document.querySelector('.invite-dialog').getBoundingClientRect(); return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight; })()"),true);
    await click('.invite-dialog .dialog-close');
    await key('Escape','Escape',27);await key('Escape','Escape',27);await until("!document.querySelector('.navigation-dialog')");
  }
  assert.deepEqual(errors,[]);
  await writeFile(new URL('report.json',artifactDirectory),JSON.stringify({checks,errors,apiRequests,note:'Browser fixtures only; production authentication and deployment are unverified.'},null,2));
  process.stdout.write(JSON.stringify({checks,errors,artifacts:artifactDirectory.pathname}));
} finally {
  socket.close();await fetch(`http://127.0.0.1:9367/json/close/${tab.id}`);
}
