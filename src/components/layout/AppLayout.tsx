import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NavigationRail } from "@/components/layout/NavigationRail";
import { PreferencesProvider } from "@/features/settings/preferences";
import { SettingsModal } from "@/features/settings/SettingsPage";
import {
  SettingsModalContext,
  type SettingsSection,
} from "@/features/settings/settings-context";

export interface WorkspaceNavigation {
  openNavigation: () => void;
  openSettings: (section?: SettingsSection) => void;
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("my-account");
  const returnFocus = useRef<HTMLElement | null>(null);
  const settingsReturnFocus = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const modalOpen = settingsOpen || location.pathname === "/app/settings";

  function openNavigation() {
    returnFocus.current = document.activeElement as HTMLElement;
    setMenuOpen(true);
  }

  function openSettings(
    section: SettingsSection = "my-account",
    trigger?: HTMLElement | null,
  ) {
    const active =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    if (
      active &&
      (!active.closest(".navigation-dialog") || !returnFocus.current)
    ) {
      settingsReturnFocus.current = active;
    } else if (returnFocus.current) {
      settingsReturnFocus.current = returnFocus.current;
    }
    setSettingsSection(section);
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    if (location.pathname === "/app/settings") {
      navigate("/app", { replace: true });
    }
  }

  return (
    <PreferencesProvider>
      <SettingsModalContext.Provider
        value={{
          open: modalOpen,
          section: settingsSection,
          openSettings,
          closeSettings,
          selectSection: setSettingsSection,
        }}
      >
        <div className="app-shell">
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <NavigationRail />
          <aside aria-label="Workspace sidebar" className="workspace-sidebar">
            <AppSidebar />
          </aside>
          <main id="main-content" tabIndex={-1} className="workspace-main">
            <Outlet
              context={
                { openNavigation, openSettings } satisfies WorkspaceNavigation
              }
            />
          </main>
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content
                className="navigation-dialog"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  if (!modalOpen) {
                    returnFocus.current?.focus();
                  }
                }}
              >
                <Dialog.Title className="sr-only">
                  Workspace navigation
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Choose a community or channel, or open account settings.
                </Dialog.Description>
                <div className="navigation-dialog-header">
                  <span>Navigation</span>
                  <Dialog.Close asChild>
                    <button
                      className="icon-button"
                      aria-label="Close navigation"
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                <AppSidebar onNavigate={() => setMenuOpen(false)} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <SettingsModal
            open={modalOpen}
            section={settingsSection}
            onSelectSection={setSettingsSection}
            onRequestClose={closeSettings}
            returnFocusRef={settingsReturnFocus}
          />
        </div>
      </SettingsModalContext.Provider>
    </PreferencesProvider>
  );
}
