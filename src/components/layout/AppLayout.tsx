import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Outlet } from "react-router";
import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-background md:h-svh md:overflow-hidden">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <aside
        aria-label="Workspace sidebar"
        className="hidden w-64 shrink-0 border-r border-border md:block"
      >
        <AppSidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-18 shrink-0 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur-sm md:hidden">
          <Brand />
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu aria-hidden="true" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/65" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 h-svh w-[min(19rem,90vw)] border-r border-border shadow-2xl outline-none">
                <Dialog.Title className="sr-only">
                  Workspace navigation
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Your Core workspace, profile, and sign-out action.
                </Dialog.Description>
                <AppSidebar onNavigate={() => setMenuOpen(false)} />
                <Dialog.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-5"
                    aria-label="Close navigation"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </header>
        <main
          id="main-content"
          tabIndex={0}
          className="min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 md:overflow-y-auto"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
