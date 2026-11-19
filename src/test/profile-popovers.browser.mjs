// Browser-only fixtures: validates layout and interactions, not live integration.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { setTimeout, clearTimeout } from "node:timers";
import process from "node:process";
import { URL } from "node:url";
import { profileFixture, communityFixture, channelFixture, memberPageFixture, messageFixture } from "./api-fixtures.ts";
import { sessionFixture } from "./auth-fixture.ts";
const { fetch, WebSocket } = globalThis;
const base = "http://127.0.0.1:5187";
const debug = "http://127.0.0.1:9368";
const artifacts = new URL("../../.artifacts/profile-popovers/", import.meta.url);
await mkdir(artifacts, { recursive: true });
const tab = await (await fetch(`${debug}/json/new?about:blank`, { method: "PUT" })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const handlers = new Map();
const errors = [];
const harnessNotes = [];
const checks = [];
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method)); }, 15000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
}
socket.addEventListener("message", ({ data }) => {
  const packet = JSON.parse(data);
  if (packet.id) {
    const item = pending.get(packet.id); if (!item) return;
    clearTimeout(item.timeout); pending.delete(packet.id);
    if (packet.error) item.reject(new Error(packet.error.message)); else item.resolve(packet.result);
  } else handlers.get(packet.method)?.(packet.params)?.catch?.((error) => {
    // Strict Mode and navigation can abort requests before CDP fulfills them.
    // Record that harness cancellation separately from browser runtime errors.
    if (error.message === "Invalid InterceptionId.") harnessNotes.push("Chrome cancelled an intercepted request.");
    else errors.push(error.message);
  });
});
async function evaluate(expression) {
  const response = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function until(expression) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error(`Condition failed: ${expression}`);
}
async function click(selector) {
  await until(`!!document.querySelector(${JSON.stringify(selector)})?.getClientRects().length`);
  const point = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await call("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
}
async function escape() {
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await until("!document.querySelector('.member-profile-dialog')");
  await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
}
async function checkCard(label) {
  await until("!!document.querySelector('.member-profile-dialog')");
  await until("(() => {const r=document.querySelector('.member-profile-dialog')?.getBoundingClientRect();return r && r.width>0 && r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})()");
  assert.equal(await evaluate("document.querySelectorAll('.member-profile-dialog').length"), 1);
  checks.push(label);
}
async function screenshot(name) {
  const shot = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(new URL(`${name}.png`, artifacts), Buffer.from(shot.data, "base64"));
}
const me = { ...profileFixture, username: "Ash", discriminator: "6321", display_name: "Ash" };
const friend = { ...me, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", username: "Dragon", discriminator: "0024", display_name: "Dragon Slayer" };
const conv = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", type: "direct", name: null, icon_url: null, created_by: me.id, created_at: messageFixture.created_at, updated_at: messageFixture.created_at, last_message_at: messageFixture.created_at, role: "member", hidden: false, last_message: null, members: [me, friend].map((profile) => ({id:profile.id,profile,role:"member",joined_at:messageFixture.created_at})) };
const group = { ...conv, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", type: "group", name: "Squad chat" };
const messages = [{...messageFixture,author_id:friend.id,author:friend}, {...messageFixture,id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",client_nonce:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",author_id:me.id,author:me}];
handlers.set("Runtime.exceptionThrown", ({exceptionDetails}) => errors.push(exceptionDetails.exception?.description ?? exceptionDetails.text));
handlers.set("Runtime.consoleAPICalled", ({type,args}) => {if(type==="error") errors.push(args.map(arg=>arg.value??arg.description).join(" "));});
handlers.set("Fetch.requestPaused", async ({requestId,request}) => {
  const url = new URL(request.url);
  if (url.origin !== base) { errors.push(`External request: ${url.origin}`); await call("Fetch.failRequest",{requestId,errorReason:"BlockedByClient"});return; }
  if (!url.pathname.startsWith("/api/")) {await call("Fetch.continueRequest",{requestId});return;}
  const path = url.pathname;
  let data;
  if(path==="/api/auth/get-session") data=sessionFixture;
  else if(path.endsWith("/bootstrap")) data={profile:me,communities:{items:[communityFixture]}};
  else if(path.endsWith("/communities")) data={items:[communityFixture]};
  else if(path.endsWith("/channels")) data={items:[channelFixture]};
  else if(path.includes("/communities/")&&path.endsWith("/members")) data={...memberPageFixture,channel_id:path.includes("/channels/")?channelFixture.id:null,total:2,items:[me,friend].map(profile=>({...memberPageFixture.items[0],...profile}))};
  else if(path.endsWith("/invite-permissions")) data={create:true,manage:true,manage_channels:true,owner:true};
  else if(path.endsWith("/event-permissions")) data={create:true,manage:true};
  else if(path.endsWith("/messages")) data={items:messages,next_cursor:null};
  else if(path.endsWith("/conversations")) data={items:[conv,group]};
  else if(path===`/api/v1/conversations/${conv.id}`) data=conv;
  else if(path===`/api/v1/conversations/${group.id}`) data=group;
  else if(path.endsWith("/relationship")) data={state:"friends",request_id:null};
  else if(path.endsWith("/friends/summary")) data={friends:1,incoming:0,outgoing:0,blocked:0};
  else if(path.endsWith("/friends")) data={items:[friend],next_cursor:null};
  else {errors.push(`Unknown fixture route: ${path}`);data={};}
  await call("Fetch.fulfillRequest", {requestId,responseCode:200,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from(JSON.stringify(data)).toString("base64")});
});
try {
  await call("Page.enable"); await call("Runtime.enable"); await call("Fetch.enable",{patterns:[{urlPattern:"*"}]});
  await call("Browser.grantPermissions",{origin:base,permissions:["clipboardReadWrite","clipboardSanitizedWrite"]});
  await call("Emulation.setDeviceMetricsOverride",{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await call("Page.navigate",{url:`${base}/app`});
  await until("!!document.querySelector('.message-body')");
  const before=await evaluate("JSON.stringify(document.querySelector('.message-list-container').getBoundingClientRect().toJSON())");
  await click('.member-list [aria-label="View profile for Dragon Slayer"]');await checkCard("member left placement");
  assert.equal(await evaluate("document.querySelector('.member-profile-dialog').dataset.side"),"left");
  assert.equal(await evaluate("JSON.stringify(document.querySelector('.message-list-container').getBoundingClientRect().toJSON())"),before);
  await screenshot("member-profile");
  await click('.member-profile-actions button');
  await until("document.querySelector('.member-profile-dialog')?.textContent.includes('Username copied.')");
  await checkCard("internal action preserves profile");await escape();
  await click('.message-profile-trigger');await checkCard("message avatar collision");await escape();
  await click('.message-meta .member-identity');await checkCard("message author name");
  await click('.user-panel [aria-label="View profile for Ash"]');await checkCard("self replaces author");
  assert.equal(await evaluate("document.querySelector('.member-profile-name').textContent"),"Ash");await escape();
  await call("Page.navigate",{url:`${base}/app/messages/${conv.id}`});
  await until("!!document.querySelector('.conversation-header-user')");
  await click('.conversation-header-user .member-identity');await checkCard("direct header");await screenshot("dm-header-profile");await escape();
  await click('.message-profile-trigger');await checkCard("DM author avatar");
  await click('.conversation-search input');
  await until("!document.querySelector('.member-profile-dialog')");checks.push("outside click dismisses");
  await call("Page.navigate",{url:`${base}/app/messages/${group.id}`});
  await until("!!document.querySelector('.group-members-list')");
  await click('.group-members-list [aria-label="View profile for Dragon Slayer"]');await checkCard("group participant");await escape();
  for(const [width,height] of [[390,844],[320,568],[800,600]]) {
    await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
    await click('.message-profile-trigger');await checkCard(`viewport ${width}x${height}`);await screenshot(`profile-${width}`);await escape();
  }
  assert.deepEqual(errors,[]);
  const development = await evaluate("!!document.querySelector('script[src^=\"/src/main.tsx\"]')");
  await writeFile(new URL("report.json",artifacts),JSON.stringify({checks,errors,harnessNotes,development,note:"Isolated browser fixtures; live services unverified."},null,2));
  process.stdout.write(JSON.stringify({checks,errors,development,cancelledFixtureRequests:harnessNotes.length}));
} catch(error) { await screenshot("failed"); process.stderr.write(JSON.stringify({checks,errors,body:await evaluate("document.body.innerText.slice(0,2000)"),rect:await evaluate("(() => {const c=document.querySelector('.member-profile-dialog'); return {width:innerWidth,height:innerHeight,rect:c?.getBoundingClientRect().toJSON(),css:c&&getComputedStyle(c).maxWidth,parent:c?.parentElement.getBoundingClientRect().toJSON()};})()")})); throw error;
} finally {socket.close();await fetch(`${debug}/json/close/${tab.id}`);}
