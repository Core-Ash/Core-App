import { useRef, useState, type Ref, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Hash,
  Menu,
  Pin,
  Search,
  Users,
  X,
} from "lucide-react";
import { useOutletContext } from "react-router";
import type { WorkspaceNavigation } from "@/components/layout/AppLayout";
import { Tooltip } from "@/components/ui/tooltip";
import type { CommunityView } from "@/features/community/types";

interface ChatHeaderProps {
  name: string;
  communityName: string;
  view: CommunityView;
  search: string;
  onSearch: (value: string) => void;
  membersOpen: boolean;
  onToggleMembers: () => void;
  membersButtonRef: Ref<HTMLButtonElement>;
  settings?: ReactNode;
}

export function ChatHeader({
  name,
  communityName,
  view,
  search,
  onSearch,
  membersOpen,
  onToggleMembers,
  membersButtonRef,
  settings,
}: ChatHeaderProps) {
  const [mobileSearch, setMobileSearch] = useState(false);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const navigation = useOutletContext<WorkspaceNavigation | null>();
  const Icon =
    view === "channel" ? Hash : view === "events" ? CalendarDays : Users;
  return (
    <>
      <header className="chat-header">
        <div className="channel-heading">
          <button
            className="icon-button community-menu-toggle"
            aria-label="Open community navigation"
            onClick={() => navigation?.openNavigation()}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <Icon size={27} strokeWidth={1.7} aria-hidden="true" />
          <h1>{name}</h1>
        </div>
        <div className="chat-header-tools">
          {settings}
          <Tooltip content="Notifications unavailable">
            <button
              className="icon-button notification-control"
              disabled
              aria-label="Notifications unavailable"
            >
              <Bell size={25} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Pinned messages unavailable">
            <button
              className="icon-button pin-control"
              disabled
              aria-label="Pinned messages unavailable"
            >
              <Pin size={25} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content={membersOpen ? "Hide members" : "Show members"}>
            <button
              ref={membersButtonRef}
              className="icon-button members-toggle"
              aria-label={membersOpen ? "Hide members" : "Show members"}
              aria-expanded={membersOpen}
              aria-controls={membersOpen ? "community-members" : undefined}
              onClick={onToggleMembers}
            >
              <Users size={25} aria-hidden="true" />
              <ChevronDown size={11} aria-hidden="true" />
            </button>
          </Tooltip>
          {view === "channel" && (
            <>
              <label className="header-search">
                <Search size={21} aria-hidden="true" />
                <span className="sr-only">
                  Search loaded messages in this channel
                </span>
                <input
                  type="search"
                  placeholder={`Search in ${communityName}...`}
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                />
              </label>
              <button
                ref={searchToggle}
                className="icon-button mobile-search-toggle"
                aria-label="Toggle message search"
                aria-expanded={mobileSearch}
                onClick={() => setMobileSearch((open) => !open)}
              >
                <Search size={22} aria-hidden="true" />
              </button>
            </>
          )}
          <Dialog.Root>
            <Tooltip content="About Core">
              <Dialog.Trigger asChild>
                <button
                  className="icon-button help-control"
                  aria-label="About Core"
                >
                  <CircleHelp size={25} aria-hidden="true" />
                </button>
              </Dialog.Trigger>
            </Tooltip>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content className="standard-dialog preview-help">
                <Dialog.Title>
                  Core Gaming
                </Dialog.Title>
                <Dialog.Description>
                  A place for your communities and conversations.
                </Dialog.Description>
                <p>
                  Messages update periodically. Search covers loaded history.
                  Member profiles are available from the member list. Presence, reactions, and instant updates are unavailable.{" "}
                  Voice, uploads, GIFs, pinned messages, and notifications are
                  unavailable.
                </p>
                <p>
                  Press Enter to send a message, or
                  Shift+Enter for a new line. Account settings include sign out.
                </p>
                <Dialog.Close asChild>
                  <button
                    className="icon-button dialog-close"
                    aria-label="Close information"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>
      {mobileSearch && view === "channel" && (
        <div
          className="mobile-search-row"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMobileSearch(false);
              searchToggle.current?.focus();
            }
          }}
        >
          <Search size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="mobile-message-search">
            Search messages
          </label>
          <input
            id="mobile-message-search"
            type="search"
            placeholder="Search this channel"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            autoFocus
          />
          <button
            className="icon-button"
            aria-label="Close search"
            onClick={() => {
              setMobileSearch(false);
              onSearch("");
              searchToggle.current?.focus();
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
