import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  Bookmark,
  ChevronRight,
  Copy,
  EyeOff,
  Flag,
  Forward,
  Hash,
  MessagesSquare,
  Pencil,
  Pin,
  Reply,
  SmilePlus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const item = "core-context-menu-item";
const sep = "core-context-menu-separator";

const QUICK_REACTIONS = [
  { value: "😂", label: "Laughing face" },
  { value: "✅", label: "Check mark" },
  { value: "👍", label: "Thumbs up" },
  { value: "💀", label: "Skull" },
] as const;

// Backend support for these does not exist yet; they stay visibly unavailable instead of faking behaviour.
function Unavailable({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <Menu.Item className={item} disabled title="Not available yet">
      <Icon aria-hidden="true" />
      <span className="core-context-menu-label">{children}</span>
      <span className="message-menu-soon">Soon</span>
    </Menu.Item>
  );
}

export function MessageContextMenu({
  position,
  canReact = true,
  canReply = true,
  canForward = true,
  showCreateThread = false,
  canCreateThread = false,
  hasThread = false,
  canCopyText,
  canCopyId,
  canEdit,
  canDelete,
  onQuickReact,
  onOpenReactionPicker,
  onReply,
  onForward,
  onCreateThread,
  onOpenThread,
  onCopyText,
  onCopyId,
  onEdit,
  onDelete,
  onDismiss,
  returnFocus,
}: {
  position: { x: number; y: number };
  canReact?: boolean;
  canReply?: boolean;
  canForward?: boolean;
  showCreateThread?: boolean;
  canCreateThread?: boolean;
  hasThread?: boolean;
  canCopyText: boolean;
  canCopyId: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onQuickReact?: (emoji: { value: string; label: string }) => void;
  onOpenReactionPicker?: (anchor: { x: number; y: number }) => void;
  onReply?: () => void;
  onForward?: () => void;
  onCreateThread?: () => void;
  onOpenThread?: () => void;
  onCopyText: () => void;
  onCopyId: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDismiss: () => void;
  returnFocus: HTMLElement | null;
}) {
  return (
    <Menu.Root open onOpenChange={(open) => { if (!open) onDismiss(); }} modal={false}>
      <Menu.Trigger
        aria-label="Message actions"
        tabIndex={-1}
        style={{ position: "fixed", left: position.x, top: position.y, width: 0, height: 0 }}
      />
      <Menu.Portal>
        <Menu.Content
          aria-label="Message actions"
          align="start"
          sideOffset={0}
          collisionPadding={8}
          className="core-context-menu message-context-menu"
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus?.focus();
          }}
        >
          <div className="message-quick-reactions" role="group" aria-label="Quick reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji.value}
                type="button"
                disabled={!canReact}
                title={canReact ? `React with ${emoji.value}` : "Reactions unavailable"}
                aria-label={`React with ${emoji.value}`}
                onClick={() => {
                  onQuickReact?.(emoji);
                  onDismiss();
                }}
              >
                {emoji.value}
              </button>
            ))}
          </div>
          <Menu.Item
            className={item}
            disabled={!canReact}
            onSelect={() => {
              onOpenReactionPicker?.(position);
            }}
          >
            <SmilePlus aria-hidden="true" />
            <span className="core-context-menu-label">Add Reaction</span>
            <ChevronRight className="core-context-menu-chevron" aria-hidden="true" />
          </Menu.Item>
          <Menu.Separator className={sep} />
          <Menu.Item
            className={item}
            disabled={!canReply}
            onSelect={() => {
              onReply?.();
            }}
          >
            <Reply aria-hidden="true" />
            <span className="core-context-menu-label">Reply</span>
          </Menu.Item>
          <Menu.Item
            className={item}
            disabled={!canForward}
            onSelect={() => {
              onForward?.();
            }}
          >
            <Forward aria-hidden="true" />
            <span className="core-context-menu-label">Forward</span>
          </Menu.Item>
          {showCreateThread && (
            <Menu.Item
              className={item}
              disabled={!hasThread && !canCreateThread}
              onSelect={() => {
                if (hasThread) onOpenThread?.();
                else onCreateThread?.();
              }}
            >
              <MessagesSquare aria-hidden="true" />
              <span className="core-context-menu-label">
                {hasThread ? "View Thread" : "Create Thread"}
              </span>
            </Menu.Item>
          )}
          <Menu.Separator className={sep} />
          {canCopyText && (
            <Menu.Item className={item} onSelect={onCopyText}>
              <Copy aria-hidden="true" />
              Copy Text
            </Menu.Item>
          )}
          <Unavailable icon={Pin}>Pin Message</Unavailable>
          <Unavailable icon={Bookmark}>Save Message</Unavailable>
          <Unavailable icon={EyeOff}>Mark as Unread</Unavailable>
          {(canEdit || canDelete) && <Menu.Separator className={sep} />}
          {canEdit && (
            <Menu.Item className={item} onSelect={onEdit}>
              <Pencil aria-hidden="true" />
              Edit Message
            </Menu.Item>
          )}
          {canDelete && (
            <Menu.Item className={item} data-tone="danger" onSelect={onDelete}>
              <Trash2 aria-hidden="true" />
              Delete Message
            </Menu.Item>
          )}
          <Unavailable icon={Flag}>Report Message</Unavailable>
          {canCopyId && (
            <>
              <Menu.Separator className={sep} />
              <Menu.Item className={item} onSelect={onCopyId}>
                <Hash aria-hidden="true" />
                Copy Message ID
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
