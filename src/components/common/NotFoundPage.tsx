import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Brand } from "./Brand";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="auth-page flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <Brand className="mb-12" />
      <p className="mb-4 font-mono text-xs tracking-[0.2em] text-primary">
        404 · OFF THE MAP
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        A little too far from home.
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
        This page doesn’t exist. Let’s get you back to your space.
      </p>
      <Button asChild className="mt-7">
        <Link to="/">
          <ArrowLeft aria-hidden="true" /> Back to Core
        </Link>
      </Button>
    </main>
  );
}
