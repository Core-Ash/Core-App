import { useState } from "react";
import { Gamepad2, SmilePlus } from "lucide-react";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { cn } from "@/lib/utils";
import type { PreviewReaction } from "@/features/community/preview/types";

export function MessageReactions({
  reactions,
}: {
  reactions: readonly PreviewReaction[];
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<readonly PreviewReaction[]>([]);
  function toggle(emoji: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(emoji)) next.delete(emoji);
      else next.add(emoji);
      return next;
    });
  }
  return (
    <div className="message-reactions" aria-label="Sample message reactions">
      {[...reactions, ...added]
        .filter(
          (reaction) => reaction.count > 0 || selected.has(reaction.emoji),
        )
        .map((reaction) => {
          const active = selected.has(reaction.emoji);
          const count = reaction.count + (active ? 1 : 0);
          return (
            <button
              key={reaction.emoji}
              className={cn("reaction-button", active && "is-active")}
              aria-label={`${reaction.label}, ${count} ${count === 1 ? "reaction" : "reactions"} (local preview)`}
              aria-pressed={active}
              onClick={() => toggle(reaction.emoji)}
            >
              <span aria-hidden="true">
                {reaction.emoji === "🎮" ? (
                  <Gamepad2 size={21} />
                ) : (
                  reaction.emoji
                )}
              </span>
              <span>{count}</span>
            </button>
          );
        })}
      <EmojiPicker
        label="Add a local reaction"
        onSelect={(emoji) => {
          if (
            ![...reactions, ...added].some(
              (reaction) => reaction.emoji === emoji.value,
            )
          )
            setAdded((previous) => [
              ...previous,
              { emoji: emoji.value, label: emoji.label, count: 0 },
            ]);
          toggle(emoji.value);
        }}
      >
        <SmilePlus size={21} aria-hidden="true" />
      </EmojiPicker>
    </div>
  );
}
