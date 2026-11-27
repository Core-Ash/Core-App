import { useContext, useMemo, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { useOptionalAppData } from "@/app/app-data-context";
import { serverSettingsKeys } from "@/features/community/server-settings/api";
import type { ServerEmojiData } from "@/features/community/server-settings/types";

const STANDARD_EMOJIS = [
  { value: "🎮", label: "Game controller" },
  { value: "🔥", label: "Fire" },
  { value: "🫡", label: "Saluting face" },
  { value: "🙌", label: "Raised hands" },
  { value: "❤️", label: "Red heart" },
  { value: "😂", label: "Laughing face" },
  { value: "👍", label: "Thumbs up" },
  { value: "👀", label: "Eyes" },
  { value: "✅", label: "Check mark" },
  { value: "💀", label: "Skull" },
  { value: "🎉", label: "Party popper" },
  { value: "🚀", label: "Rocket" },
  { value: "💯", label: "Hundred points" },
  { value: "🙏", label: "Folded hands" },
  { value: "🤔", label: "Thinking face" },
  { value: "😭", label: "Loudly crying face" },
] as const;

const RECENT_STORAGE_KEY = "core.recent_emojis";

export interface SelectedEmoji {
  value: string;
  label: string;
  customId?: string;
  customUrl?: string;
}

function getRecentEmojis(): SelectedEmoji[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SelectedEmoji =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as SelectedEmoji).value === "string" &&
          typeof (item as SelectedEmoji).label === "string",
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

function saveRecentEmoji(emoji: SelectedEmoji) {
  try {
    const current = getRecentEmojis().filter((item) => item.value !== emoji.value);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify([emoji, ...current].slice(0, 8)));
  } catch {
    // Ignore storage quota errors
  }
}

function CommunityEmojiSection({
  communityId,
  term,
  disabled,
  onPick,
}: {
  communityId: string;
  term: string;
  disabled: boolean;
  onPick: (emoji: SelectedEmoji) => void;
}) {
  const appData = useOptionalAppData();
  const serverEmojis = useQuery<{ items: ServerEmojiData[] }>({
    queryKey: serverSettingsKeys.emojis(communityId),
    queryFn: ({ signal }) =>
      appData!.api.get(`/communities/${communityId}/emojis`, { signal }),
    enabled: Boolean(appData?.ready && communityId),
  });
  const filteredCustom = useMemo(() => {
    const items = serverEmojis.data?.items ?? [];
    return term ? items.filter((e) => e.name.toLowerCase().includes(term)) : items;
  }, [serverEmojis.data?.items, term]);

  if (filteredCustom.length === 0) return null;

  return (
    <div className="emoji-picker-section">
      <div className="emoji-picker-section-title">Server Emojis</div>
      <div className="emoji-picker-menu" role="group" aria-label="Server emojis">
        {filteredCustom.map((emoji) => (
          <button
            key={emoji.id}
            type="button"
            aria-label={`:${emoji.name}:`}
            title={`:${emoji.name}:`}
            disabled={disabled}
            onClick={() =>
              onPick({
                value: `custom:${emoji.id}`,
                label: emoji.name,
                customId: emoji.id,
                customUrl: emoji.url,
              })
            }
          >
            <img src={emoji.url} alt={emoji.name} className="size-5 object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function EmojiGrid({
  communityId,
  disabled = false,
  onSelect,
}: {
  communityId?: string;
  disabled?: boolean;
  onSelect: (emoji: SelectedEmoji) => void;
}) {
  const [search, setSearch] = useState("");
  const appData = useOptionalAppData();
  const queryClient = useContext(QueryClientContext);
  const canLoadCustom = Boolean(communityId && appData?.ready && queryClient);
  const recents = useMemo(() => getRecentEmojis(), []);

  const term = search.trim().toLowerCase();
  const filteredStandard = useMemo(
    () =>
      term
        ? STANDARD_EMOJIS.filter(
            (e) =>
              e.label.toLowerCase().includes(term) || e.value.toLowerCase().includes(term),
          )
        : STANDARD_EMOJIS,
    [term],
  );

  function pick(emoji: SelectedEmoji) {
    saveRecentEmoji(emoji);
    onSelect(emoji);
  }

  return (
    <div className="emoji-picker-panel">
      <div className="emoji-picker-search-row">
        <input
          type="search"
          className="emoji-picker-search"
          placeholder="Search emojis…"
          aria-label="Search emojis"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {!term && recents.length > 0 && (
        <div className="emoji-picker-section">
          <div className="emoji-picker-section-title">Recently Used</div>
          <div className="emoji-picker-menu" role="group" aria-label="Recently used emojis">
            {recents.map((emoji) => (
              <button
                key={`recent-${emoji.value}`}
                type="button"
                aria-label={`Recent ${emoji.label}`}
                title={emoji.label}
                disabled={disabled}
                onClick={() => pick(emoji)}
              >
                {emoji.customUrl ? (
                  <img src={emoji.customUrl} alt={emoji.label} className="size-5 object-contain" />
                ) : (
                  emoji.value
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="emoji-picker-section">
        <div className="emoji-picker-menu" role="group" aria-label="Emojis">
          {filteredStandard.map((emoji) => (
            <button
              key={emoji.label}
              type="button"
              aria-label={emoji.label}
              title={emoji.label}
              disabled={disabled}
              onClick={() => pick(emoji)}
            >
              {emoji.value}
            </button>
          ))}
        </div>
      </div>
      {canLoadCustom && communityId && (
        <CommunityEmojiSection
          communityId={communityId}
          term={term}
          disabled={disabled}
          onPick={pick}
        />
      )}
      {filteredStandard.length === 0 && !canLoadCustom && (
        <p className="emoji-picker-empty" role="status">
          No matching emojis
        </p>
      )}
    </div>
  );
}

interface EmojiPickerProps {
  label: string;
  onSelect: (emoji: SelectedEmoji) => void;
  children: ReactNode;
  disabled?: boolean;
  communityId?: string;
}

export function EmojiPicker({
  label,
  onSelect,
  children,
  disabled = false,
  communityId,
}: EmojiPickerProps) {
  const picker = useRef<HTMLDetailsElement>(null);
  return (
    <details
      className="emoji-picker"
      ref={picker}
      onKeyDown={(event) => {
        if (event.key === "Escape" && picker.current) {
          event.stopPropagation();
          picker.current.open = false;
          picker.current.querySelector("summary")?.focus();
        }
      }}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node | null) &&
          picker.current
        )
          picker.current.open = false;
      }}
    >
      <summary
        className="icon-button"
        aria-label={label}
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        {children}
      </summary>
      <EmojiGrid
        communityId={communityId}
        disabled={disabled}
        onSelect={(emoji) => {
          onSelect(emoji);
          if (picker.current) {
            picker.current.open = false;
            if (picker.current.contains(document.activeElement))
              picker.current.querySelector("summary")?.focus();
          }
        }}
      />
    </details>
  );
}

export function FloatingEmojiPicker({
  open,
  position,
  communityId,
  onSelect,
  onClose,
}: {
  open: boolean;
  position: { x: number; y: number } | null;
  communityId?: string;
  onSelect: (emoji: SelectedEmoji) => void;
  onClose: () => void;
}) {
  if (!open || !position) return null;
  return (
    <Popover.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Popover.Anchor
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          width: 0,
          height: 0,
        }}
      />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          collisionPadding={12}
          className="floating-emoji-popover"
          aria-label="Reaction emoji picker"
          onEscapeKeyDown={() => onClose()}
        >
          <EmojiGrid
            communityId={communityId}
            onSelect={(emoji) => {
              onSelect(emoji);
              onClose();
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
