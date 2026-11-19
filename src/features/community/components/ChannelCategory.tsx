import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Lock, VolumeX } from "lucide-react";

export function ChannelCategory({
  name,
  action,
  children,
  expanded: controlledExpanded,
  onToggleExpanded,
  onContextMenu,
  isPrivate,
  isMuted,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  name: string;
  action?: ReactNode;
  children: ReactNode;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isPrivate?: boolean;
  isMuted?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const id = useId();

  function handleToggle() {
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }

  return (
    <section
      className="channel-section"
      aria-label={name}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className="channel-category-header select-none group"
        onContextMenu={onContextMenu}
      >
        <button
          type="button"
          className="channel-category-toggle"
          aria-expanded={isExpanded}
          aria-controls={id}
          onClick={handleToggle}
        >
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform duration-150 shrink-0 ${
              isExpanded ? "" : "-rotate-90"
            }`}
          />
          <span className="flex items-center gap-1.5 truncate">
            {isPrivate && <Lock size={12} className="text-muted-foreground shrink-0" aria-label="Private category" />}
            {isMuted && <VolumeX size={12} className="text-muted-foreground shrink-0" aria-label="Muted category" />}
            <span className="truncate">{name}</span>
          </span>
        </button>
        {action}
      </div>
      <div id={id} hidden={!isExpanded}>
        {children}
      </div>
    </section>
  );
}
