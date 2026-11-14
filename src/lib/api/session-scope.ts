import { QueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/api/client";

// A scope owns one session's memory and transport. It is never persisted.
export class SessionScope {
  private controller = new AbortController();
  private active = true;
  private recheck: Promise<"active" | "expired" | "unavailable"> | null = null;
  readonly queries = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
  readonly api;

  constructor(
    baseUrl: string | null,
    recheck: () => Promise<"active" | "expired" | "unavailable">,
    active = true,
  ) {
    this.active = active;
    this.api = createApiClient({
      baseUrl,
      isActive: () => this.active,
      sessionSignal: () => this.controller.signal,
      onUnauthorized: () => {
        // Concurrent 401s share one official session check; requests are never replayed.
        this.recheck ??= recheck().finally(() => {
          this.recheck = null;
        });
        return this.recheck;
      },
    });
  }

  activate(active = true) {
    if (this.controller.signal.aborted) this.controller = new AbortController();
    this.active = active;
  }

  clear() {
    this.active = false;
    this.controller.abort();
    this.queries.clear();
  }
}
