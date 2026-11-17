// Isolated visual QA for the Discord-style Settings modal overlay.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import { URL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { sessionFixture } from "./auth-fixture.ts";
import {
  channelFixture,
  communityFixture,
  memberPageFixture,
  messageFixture,
  profileFixture,
} from "./api-fixtures.ts";

const base = "http://127.0.0.1:5194";
const { fetch, WebSocket } = globalThis;
const artifacts = new URL("../../.artifacts/settings-modal/", import.meta.url);
await mkdir(artifacts, { recursive: true });

const tab = await (
  await fetch("http://127.0.0.1:9394/json/new?about:blank", { method: "PUT" })
).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) =>
  socket.addEventListener("open", resolve, { once: true }),
);

let seq = 0;
const pending = new Map();
const errors = [];
const requests = [];

const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });

let me = {
  ...profileFixture,
  username: "Ash",
  display_name: "Ash",
  discriminator: "2662",
  email: "ash@core.example",
};

const blockedFriend = {
  ...profileFixture,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  username: "Rival",
  display_name: "Rival Player",
  discriminator: "4455",
};
let blocked = [blockedFriend];

const community = { ...communityFixture, name: "Dragons Den" };
const channels = [
  channelFixture,
  {
    ...channelFixture,
    id: "66666666-6666-4666-8666-666666666666",
    name: "clips",
    position: 1,
  },
];
const messages = Array.from({ length: 18 }, (_, index) => ({
  ...messageFixture,
  id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`,
  client_nonce: `55555555-5555-4555-8555-${String(index + 1).padStart(12, "0")}`,
  body: `Dragons Den message #${index + 1} — preparing strategies for tonight's raid.`,
  created_at: new Date(Date.UTC(2026, 10, 17, 18, index, 0)).toISOString(),
  author: {
    id: me.id,
    display_name: me.display_name,
    username: me.username,
    discriminator: me.discriminator,
    avatar_url: null,
  },
}));

async function intercept({ requestId: interception, request }) {
  const url = new URL(request.url);
  if (url.origin !== base) {
    errors.push(`Unexpected external request: ${url.origin}`);
    await call("Fetch.failRequest", {
      requestId: interception,
      errorReason: "BlockedByClient",
    });
    return;
  }
  if (!url.pathname.startsWith("/api/")) {
    await call("Fetch.continueRequest", { requestId: interception });
    return;
  }
  requests.push({ path: url.pathname, method: request.method });
  let data = {};
  let responseCode = 200;

  if (url.pathname === "/api/auth/get-session") data = sessionFixture;
  else if (url.pathname === "/api/v1/bootstrap")
    data = { profile: me, communities: { items: [community] } };
  else if (url.pathname === "/api/v1/communities")
    data = { items: [community] };
  else if (url.pathname.endsWith("/invite-permissions"))
    data = { create: true, manage: true, manage_channels: true, owner: true };
  else if (url.pathname.endsWith("/event-permissions"))
    data = { create: true, manage: true };
  else if (url.pathname.endsWith("/channels")) data = { items: channels };
  else if (url.pathname.endsWith("/members"))
    data = {
      ...memberPageFixture,
      community_id: community.id,
      channel_id: channelFixture.id,
      items: [{ ...memberPageFixture.items[0], ...me }],
    };
  else if (url.pathname.endsWith("/messages"))
    data = { items: messages, next_cursor: null };
  else if (url.pathname === "/api/v1/me/username" && request.method === "PATCH") {
    const body = JSON.parse(request.postData);
    me = { ...me, username: body.username };
    data = me;
  } else if (url.pathname === "/api/v1/friends/summary")
    data = { friends: 2, incoming: 0, outgoing: 0, blocked: blocked.length };
  else if (url.pathname === "/api/v1/users/blocked")
    data = { items: blocked, next_cursor: null };
  else if (url.pathname.endsWith("/block") && request.method === "DELETE") {
    blocked = [];
    responseCode = 204;
  } else {
    errors.push(`Unexpected API: ${request.method} ${url.pathname}`);
  }

  await call("Fetch.fulfillRequest", {
    requestId: interception,
    responseCode,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body:
      responseCode === 204
        ? ""
        : Buffer.from(JSON.stringify(data)).toString("base64"),
  });
}

socket.addEventListener("message", ({ data }) => {
  const packet = JSON.parse(data);
  if (packet.id) {
    const entry = pending.get(packet.id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    pending.delete(packet.id);
    if (packet.error) entry.reject(new Error(packet.error.message));
    else entry.resolve(packet.result);
  } else if (packet.method === "Fetch.requestPaused") {
    void intercept(packet.params).catch((e) => {
      if (e.message !== "Invalid InterceptionId.") errors.push(e.message);
    });
  } else if (packet.method === "Runtime.exceptionThrown") {
    errors.push(
      packet.params.exceptionDetails.exception?.description ??
        packet.params.exceptionDetails.text,
    );
  } else if (
    packet.method === "Runtime.consoleAPICalled" &&
    packet.params.type === "error"
  ) {
    errors.push(
      packet.params.args.map((arg) => arg.value ?? arg.description).join(" "),
    );
  }
});

const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  }
  return result.result.value;
};

async function until(expression) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Condition failed: ${expression}`);
}

async function screenshot(name) {
  await evaluate("document.fonts.ready.then(() => true)");
  const result = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(
    new URL(name + ".png", artifacts),
    Buffer.from(result.data, "base64"),
  );
}

try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Fetch.enable", {
    patterns: [{ urlPattern: "*", requestStage: "Request" }],
  });
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await call("Page.navigate", { url: `${base}/app` });
  await until(
    "document.querySelector('.message-scroll') && document.body.innerText.includes('Dragons Den message #18')",
  );

  await evaluate("(() => { const s = document.querySelector('.message-scroll'); s.scrollTop = 120; })()");
  const initialScrollTop = await evaluate("document.querySelector('.message-scroll').scrollTop");

  await evaluate("document.querySelector('[aria-label=\"Account settings\"]').click()");
  await until("Boolean(document.querySelector('.settings-modal-dialog'))");
  await screenshot("my-account-1440");

  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [800, 768],
    [390, 844],
  ]) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 640,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const bounds = await evaluate(`(() => {
      const dialog = document.querySelector('.settings-modal-dialog').getBoundingClientRect();
      return {
        fitsViewport: dialog.left >= -1 && dialog.top >= -1 && dialog.right <= innerWidth + 1 && dialog.bottom <= innerHeight + 1,
        noOverflow: document.documentElement.scrollWidth <= innerWidth,
        bgMounted: Boolean(document.querySelector('.chat-workspace')),
      };
    })()`);
    assert.equal(bounds.fitsViewport, true, `Modal out of viewport at ${width}x${height}`);
    assert.equal(bounds.noOverflow, true, `Horizontal overflow at ${width}x${height}`);
    assert.equal(bounds.bgMounted, true, `Background chat unmounted at ${width}x${height}`);
    await screenshot(`modal-${width}x${height}`);
  }

  await call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Switch to Voice & Audio
  await evaluate(
    "[...document.querySelectorAll('.settings-nav-item')].find(b => b.textContent.includes('Voice & Audio')).click()",
  );
  await until("document.querySelector('.settings-main-header h1')?.textContent === 'Voice & Audio'");
  await screenshot("voice-audio-1440");

  // Switch to Profiles
  await evaluate(
    "[...document.querySelectorAll('.settings-nav-item')].find(b => b.textContent.includes('Profiles')).click()",
  );
  await until("document.querySelector('.settings-main-header h1')?.textContent === 'Profiles'");
  await screenshot("profiles-1440");

  // Switch to Privacy & Safety
  await evaluate(
    "[...document.querySelectorAll('.settings-nav-item')].find(b => b.textContent.includes('Privacy & Safety')).click()",
  );
  await until("document.querySelector('.settings-main-header h1')?.textContent === 'Privacy & Safety'");
  await screenshot("privacy-safety-1440");

  // Switch to Appearance
  await evaluate(
    "[...document.querySelectorAll('.settings-nav-item')].find(b => b.textContent.includes('Appearance')).click()",
  );
  await until("document.querySelector('.settings-main-header h1')?.textContent === 'Appearance'");
  await screenshot("appearance-1440");

  // Switch back to My Account and test inline username edit
  await evaluate(
    "[...document.querySelectorAll('.settings-nav-item')].find(b => b.textContent.includes('My Account')).click()",
  );
  await until("document.querySelector('.settings-main-header h1')?.textContent === 'My Account'");
  await evaluate(
    "[...document.querySelectorAll('.settings-detail-row button')].find(b => b.textContent === 'Edit').click()",
  );
  await until("Boolean(document.querySelector('#account-username'))");
  await screenshot("my-account-edit-username-1440");

  await evaluate("(() => { const input = document.querySelector('#account-username'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'DragonAsh'); input.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await evaluate("document.querySelector('.settings-username-form').requestSubmit()");
  await until("document.body.innerText.includes('DragonAsh#2662')");

  // Close with Escape
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await until("!document.querySelector('.settings-modal-dialog')");

  // Verify scroll position and active channel preserved
  const afterScrollTop = await evaluate("document.querySelector('.message-scroll').scrollTop");
  assert.equal(afterScrollTop, initialScrollTop, "Chat scroll position must be preserved");
  assert.equal(await evaluate("document.querySelector('.channel-heading h1')?.textContent"), "general");
  assert.equal(await evaluate("document.activeElement?.getAttribute('aria-label')"), "Account settings");

  assert.deepEqual(errors, []);
  console.log("PASS: Settings modal visual and responsive checks succeeded.");
} finally {
  await call("Fetch.disable").catch(() => {});
  socket.close();
  await fetch(`http://127.0.0.1:9394/json/close/${tab.id}`).catch(() => {});
}
