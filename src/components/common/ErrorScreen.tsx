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
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
      <Brand className="mb-12" />
      <div role="alert" className="max-w-md">
        <AlertCircle
          className="mx-auto mb-5 size-8 text-primary"
          aria-hidden="true"
        />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Button className="mt-7" onClick={onRetry} disabled={busy}>
        <RotateCw aria-hidden="true" className={busy ? "animate-spin" : ""} />
        {busy ? "Trying again…" : "Try again"}
      </Button>
    </main>
  );
}
