import { useRef, type ReactNode } from "react";

const emojis = [
  { value: "🎮", label: "Game controller" },
  { value: "🔥", label: "Fire" },
  { value: "🫡", label: "Saluting face" },
  { value: "🙌", label: "Raised hands" },
  { value: "❤️", label: "Red heart" },
  { value: "😂", label: "Laughing face" },
  { value: "👍", label: "Thumbs up" },
  { value: "👀", label: "Eyes" },
] as const;

interface EmojiPickerProps {
  label: string;
  onSelect: (emoji: { value: string; label: string }) => void;
  children: ReactNode;
  disabled?: boolean;
}

export function EmojiPicker({
  label,
  onSelect,
  children,
  disabled = false,
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
      <div className="emoji-picker-menu" role="group" aria-label="Emojis">
        {emojis.map((emoji) => (
          <button
            key={emoji.label}
            type="button"
            aria-label={emoji.label}
            disabled={disabled}
            onClick={() => {
              onSelect(emoji);
              if (picker.current) {
                picker.current.open = false;
                if (picker.current.contains(document.activeElement))
                  picker.current.querySelector("summary")?.focus();
              }
            }}
          >
            {emoji.value}
          </button>
        ))}
      </div>
    </details>
  );
}
