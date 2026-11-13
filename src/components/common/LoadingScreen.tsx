import { LoaderCircle } from "lucide-react";
import { Brand } from "./Brand";

export function LoadingScreen() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-7 bg-background px-6">
      <Brand />
      <p
        role="status"
        className="flex items-center gap-2.5 text-sm text-muted-foreground"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{" "}
        Restoring your session…
      </p>
    </main>
  );
}
