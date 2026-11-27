import * as Menu from "@radix-ui/react-dropdown-menu";
import { Bookmark, ChevronRight, Copy, EyeOff, Flag, Forward, Hash, MessagesSquare, Pencil, Pin, Reply, SmilePlus, Trash2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const item = "core-context-menu-item";
const sep = "core-context-menu-separator";

// Backend support for these does not exist yet; they stay visibly unavailable instead of faking behaviour.
function Unavailable({ icon: Icon, children, chevron }: { icon: LucideIcon; children: ReactNode; chevron?: boolean }) {
  return (
    <Menu.Item className={item} disabled title="Not available yet">
      <Icon aria-hidden="true" />
      <span className="core-context-menu-label">{children}</span>
      {chevron ? <ChevronRight className="core-context-menu-chevron" aria-hidden="true" /> : <span className="message-menu-soon">Soon</span>}
    </Menu.Item>
  );
}

export function MessageContextMenu({ position, canCopyText, canCopyId, canEdit, canDelete, onCopyText, onCopyId, onEdit, onDelete, onDismiss, returnFocus }: {
  position: { x: number; y: number }; canCopyText: boolean; canCopyId: boolean; canEdit: boolean; canDelete: boolean;
  onCopyText: () => void; onCopyId: () => void; onEdit: () => void; onDelete: () => void;
  onDismiss: () => void; returnFocus: HTMLElement | null;
}) {
  return (
    <Menu.Root open onOpenChange={(open) => { if (!open) onDismiss(); }} modal={false}>
      <Menu.Trigger aria-label="Message actions" tabIndex={-1} style={{ position: "fixed", left: position.x, top: position.y, width: 0, height: 0 }} />
      <Menu.Portal>
        <Menu.Content aria-label="Message actions" align="start" sideOffset={0} collisionPadding={8} className="core-context-menu message-context-menu"
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus?.focus(); }}>
          <div className="message-quick-reactions" role="group" aria-label="Quick reactions (unavailable)">
            {["😂", "✅", "👍", "💀"].map((emoji) => <button key={emoji} type="button" disabled title="Reactions are not available yet" aria-label={`React with ${emoji} (unavailable)`}>{emoji}</button>)}
          </div>
          <Unavailable icon={SmilePlus} chevron>Add Reaction</Unavailable>
          <Menu.Separator className={sep} />
          <Unavailable icon={Reply}>Reply</Unavailable>
          <Unavailable icon={Forward}>Forward</Unavailable>
          <Unavailable icon={MessagesSquare}>Create Thread</Unavailable>
          <Menu.Separator className={sep} />
          {canCopyText && <Menu.Item className={item} onSelect={onCopyText}><Copy aria-hidden="true" />Copy Text</Menu.Item>}
          <Unavailable icon={Pin}>Pin Message</Unavailable>
          <Unavailable icon={Bookmark}>Save Message</Unavailable>
          <Unavailable icon={EyeOff}>Mark as Unread</Unavailable>
          {(canEdit || canDelete) && <Menu.Separator className={sep} />}
          {canEdit && <Menu.Item className={item} onSelect={onEdit}><Pencil aria-hidden="true" />Edit Message</Menu.Item>}
          {canDelete && <Menu.Item className={item} data-tone="danger" onSelect={onDelete}><Trash2 aria-hidden="true" />Delete Message</Menu.Item>}
          <Unavailable icon={Flag}>Report Message</Unavailable>
          {canCopyId && <><Menu.Separator className={sep} /><Menu.Item className={item} onSelect={onCopyId}><Hash aria-hidden="true" />Copy Message ID</Menu.Item></>}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
