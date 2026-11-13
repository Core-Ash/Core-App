import type { ReactNode } from "react";
import { AudioLines, MessageCircle } from "lucide-react";
import { Brand } from "@/components/common/Brand";
import { Card } from "@/components/ui/card";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth-page relative isolate flex min-h-svh flex-col overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-6 py-7 sm:px-10 lg:px-14">
        <Brand />
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" /> A place for your
          people
        </span>
      </header>
      <main
        id="main-content"
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-10 sm:pb-24"
      >
        <div className="mb-7 flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs text-primary">
          <MessageCircle className="size-3.5" aria-hidden="true" /> Good
          conversations start here
        </div>
        <Card className="auth-card w-full max-w-[440px] p-7 sm:p-10">
          <div className="mb-8">
            <div className="mb-6 flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <AudioLines className="size-5" aria-hidden="true" />
            </div>
            <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-0.04em]">
              {title}
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          {children}
          <div className="mt-7 border-t border-border pt-5 text-center text-xs leading-relaxed text-muted-foreground">
            {footer}
          </div>
        </Card>
        <p className="mt-7 text-center text-xs text-muted-foreground">
          One space. More connection.
        </p>
      </main>
      <footer className="relative z-10 flex items-center justify-between px-6 pb-6 text-[11px] text-muted-foreground/75 sm:px-10 lg:px-14">
        <span>Core · Built for connection</span>
        <span>Web application</span>
      </footer>
    </div>
  );
}
