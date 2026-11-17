import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "./Brand";

export function ErrorScreen({
  title,
  description,
  onRetry,
  busy = false,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-5 py-12 text-center sm:px-6">
      <Brand className="mb-8 sm:mb-10" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-secondary px-6 py-8 shadow-xl shadow-background/50 sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
        <div role="alert">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <AlertCircle className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          <p className="mt-4 text-pretty text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Button
          className="mt-7 h-11 w-full"
          onClick={onRetry}
          disabled={busy}
          aria-busy={busy}
        >
          <RotateCw aria-hidden="true" className={busy ? "animate-spin" : ""} />
          {busy ? "Trying again…" : "Try again"}
        </Button>
      </div>
    </main>
  );
}
