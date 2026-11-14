import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Outlet } from "react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NavigationRail } from "@/components/layout/NavigationRail";

export interface WorkspaceNavigation {
  openNavigation: () => void;
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  function openNavigation() {
    returnFocus.current = document.activeElement as HTMLElement;
    setMenuOpen(true);
  }
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <NavigationRail />
      <aside aria-label="Workspace sidebar" className="workspace-sidebar">
        <AppSidebar />
      </aside>
      <main id="main-content" tabIndex={-1} className="workspace-main">
        <Outlet context={{ openNavigation } satisfies WorkspaceNavigation} />
      </main>
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="navigation-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              returnFocus.current?.focus();
            }}
          >
            <Dialog.Title className="sr-only">
              Workspace navigation
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Choose a sample community or channel, or open account settings.
            </Dialog.Description>
            <div className="navigation-dialog-header">
              <span>Navigation</span>
              <Dialog.Close asChild>
                <button className="icon-button" aria-label="Close navigation">
                  <X size={20} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <AppSidebar onNavigate={() => setMenuOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
