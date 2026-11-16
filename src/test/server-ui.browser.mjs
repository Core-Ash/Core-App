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

const base = "http://127.0.0.1:5186";
const { fetch, WebSocket } = globalThis;
const artifactDirectory = new URL("../../.artifacts/server-polish/", import.meta.url);
await mkdir(artifactDirectory, { recursive: true });
assert.equal((await fetch(base)).status, 200);
const tab = await (await fetch("http://127.0.0.1:9366/json/new?about:blank", { method: "PUT" })).json();
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
  else if (url.pathname === "/api/v1/bootstrap") data = { profile: currentProfile, communities: { items: [community] } };
  else if (url.pathname === "/api/v1/communities") data = { items: [community] };
  else if (url.pathname.endsWith("/access")) { data = channelAccessFixture; responseCode = owner ? 200 : 403; }
  else if (url.pathname.endsWith("/members")) data = { ...memberPageFixture, channel_id: url.pathname.includes("/channels/") ? url.pathname.split("/channels/")[1].split("/")[0] : null,
    items: [{ ...memberPageFixture.items[0], ...currentProfile }] };
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
try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: `${base}/app` });
  await until("!!document.querySelector('.message-body')");
  for (const [width, height] of [[1920,1080],[1440,900],[1280,720],[1000,720],[820,720],[768,800],[390,844],[320,720]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await new Promise((resolve) => setTimeout(resolve, 120));
    const layout = await evaluate(`(() => {
      const panel = document.querySelector('.workspace-sidebar .user-panel');
      const account = panel?.getBoundingClientRect();
      const controls = panel?.querySelector('.user-controls')?.getBoundingClientRect();
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        accountFits: !account?.width || (controls.right <= account.right && controls.left >= account.left),
        mainWidth: document.querySelector('main').getBoundingClientRect().width,
        idsVisible: /u_e8d472|11111111-1111|test-user|test-session/.test(document.body.innerText) };
    })()`);
    assert(layout.scrollWidth <= width, `Horizontal overflow at ${width}`);
    assert(layout.accountFits, `Account controls overflow at ${width}`);
    assert(!layout.idsVisible, `Internal identity visible at ${width}`);
    assert(layout.mainWidth > 200, `Chat too narrow at ${width}`);
    checks.push({ viewport: `${width}x${height}`, ...layout });
    await screenshot(`workspace-${width}`);
  }
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await until("!!document.querySelector('.member-sidebar .member-row')");
  await click('.channel-category-toggle[aria-controls]');
  assert.equal(await evaluate("document.querySelector('.channel-category-toggle').getAttribute('aria-expanded')"), "false");
  await click('.channel-category-add');
  await until("!!document.querySelector('[role=dialog] input')");
  await screenshot("create-channel");
  await click('[role=dialog] .dialog-close');
  await until("!document.querySelector('[role=dialog]')");
  assert.equal(await evaluate("document.querySelector('.channel-category-toggle').getAttribute('aria-expanded')"), "false");
  assert.equal(await evaluate("document.activeElement.classList.contains('channel-category-add')"), true);
  await click('.channel-category-toggle');
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await until("document.querySelector('.channel-category-toggle').getAttribute('aria-expanded') === 'false'");
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await until("document.querySelector('.channel-category-toggle').getAttribute('aria-expanded') === 'true'");
  await click('.channel-category-add');
  await until("!!document.querySelector('#create-channel-name')");
  await click('#create-channel-name');
  await call("Input.insertText", { text: "browser-validation" });
  await click('[role=dialog] button[type=submit]');
  await until("document.querySelector('.channel-heading h1')?.textContent === 'browser-validation'");
  await click('#message-draft');
  await call("Input.insertText", { text: "Browser send validation" });
  await click('.send-button');
  await until("[...document.querySelectorAll('.message-body')].some(p => p.textContent === 'Browser send validation')");
  await click('.channel-link:last-child');
  await click(`.channel-link[title="${channels[1].name}"]`);
  await until("document.querySelector('.channel-heading h1')?.textContent.includes('a-long-channel-name')");
  await click('.community-picker summary');
  await screenshot("server-menu");
  await click('.community-picker-menu a');
  await until("!!document.querySelector('.server-overview')");
  await screenshot("server-overview");
  await click('.server-settings-tabs a:nth-child(2)');
  await until("!!document.querySelector('[aria-label=\"Add community member\"]')");
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Add community member\"] input').type"), "password");
  await screenshot("server-members");
  await click('.server-settings-back');
  await until("!!document.querySelector('.message-body')");
  await click('.member-sidebar .member-identity');
  await until("!!document.querySelector('.member-profile-dialog')");
  assert.equal(await evaluate("/11111111|u_e8d472/.test(document.querySelector('[role=dialog]').innerText)"), false);
  assert.equal(await evaluate("!!document.querySelector('.dialog-overlay')"), false);
  assert.equal(await evaluate("(() => { const card=document.querySelector('.member-profile-dialog').getBoundingClientRect(); const member=document.querySelector('.member-sidebar .member-identity').getBoundingClientRect(); return card.right <= member.left; })()"), true);
  await screenshot("member-profile");
  for (const [width, height] of [[1920,1080],[1280,720],[1280,240]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await until("(() => { const r=document.querySelector('.member-profile-dialog')?.getBoundingClientRect(); return r && r.left>=12 && r.top>=12 && r.right<=innerWidth-12 && r.bottom<=innerHeight-12; })()");
  }
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await click('.member-profile-dialog .dialog-close');
  await until("!document.querySelector('.member-profile-dialog')");
  await click('.member-sidebar .member-identity');
  await until("!!document.querySelector('.member-profile-dialog')");
  await click('.channel-heading h1');
  await until("!document.querySelector('.member-profile-dialog')");
  longNames = true;
  await call("Page.reload");
  await until("document.querySelector('.user-panel-name p')?.textContent.startsWith('A very long')");
  await screenshot("long-names");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await click('.members-toggle');
  await until("!!document.querySelector('.member-dialog .member-identity')");
  await click('.member-dialog .member-identity');
  await until("!!document.querySelector('.member-profile-dialog')");
  await until("(() => { const r=document.querySelector('.member-profile-dialog').getBoundingClientRect();return r.left>=12&&r.top>=12&&r.right<=innerWidth-12&&r.bottom<=innerHeight-12; })()");
  assert.equal(await evaluate("document.querySelectorAll('.dialog-overlay').length"), 1);
  await screenshot("mobile-member-profile");
  await call("Emulation.setDeviceMetricsOverride", { width: 320, height: 720, deviceScaleFactor: 1, mobile: false });
  await until("(() => { const r=document.querySelector('.member-profile-dialog').getBoundingClientRect();return r.left>=12&&r.top>=12&&r.right<=innerWidth-12&&r.bottom<=innerHeight-12; })()");
  await screenshot("mobile-member-profile-320");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await until("!document.querySelector('.member-profile-dialog') && !!document.querySelector('.member-dialog')");
  await until("document.activeElement.matches('.member-dialog .member-identity')");
  await click('.member-dialog .dialog-close');
  await until("!document.querySelector('.member-dialog')");
  await click('.community-menu-toggle');
  await until("!!document.querySelector('.navigation-dialog')");
  await screenshot("mobile-navigation");
  assert.equal(await evaluate("(() => { const p=document.querySelector('.navigation-dialog .user-panel').getBoundingClientRect();const c=document.querySelector('.navigation-dialog .user-controls').getBoundingClientRect();return c.right<=p.right; })()"), true);
  await click('.navigation-dialog .community-picker summary');
  assert.equal(await evaluate("(() => { const r=document.querySelector('.navigation-dialog .community-picker-menu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight; })()"), true);
  owner = false;
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: `${base}/app?community=${communityFixture.id}&view=members` });
  await until("!!document.querySelector('.server-settings-tabs') && !!document.querySelector('.member-row')");
  assert.equal(await evaluate("!!document.querySelector('.channel-category-add') || !!document.querySelector('[aria-label=\"Add community member\"]')"), false);
  await screenshot("regular-member-settings");
  assert.deepEqual(errors, []);
  await writeFile(new URL("report.json", artifactDirectory), JSON.stringify({ checks, errors, harnessNotes, apiRequests, note: "Browser fixtures only; live authentication and service integration are not verified." }, null, 2));
  process.stdout.write(JSON.stringify({ viewports: checks.length, errors, artifacts: artifactDirectory.pathname }));
} finally {
  socket.close();
  await fetch(`http://127.0.0.1:9366/json/close/${tab.id}`);
}
