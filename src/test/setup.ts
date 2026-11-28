import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// HTTP fixture tests have no websocket server. Transport tests install their own socket.
Object.defineProperty(globalThis, "WebSocket", { value: undefined, writable: true, configurable: true });

afterEach(() => {
  cleanup();
});
