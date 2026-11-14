import { useRef, useState, type KeyboardEvent } from "react";
import { Image, LoaderCircle, Plus, SendHorizontal, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Tooltip } from "@/components/ui/tooltip";

interface MessageComposerProps {
  channelName: string;
  onSend: (body: string) => void;
  sending?: boolean;
}

export function MessageComposer({
  channelName,
  onSend,
  sending = false,
}: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const ready = draft.trim().length > 0 && !sending;
  function send() {
    if (!ready) return;
    onSend(draft.trim());
    setDraft("");
    setAnnouncement("Message added to the local preview. Only you can see it.");
    input.current?.focus();
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.nativeEvent.keyCode !== 229
    ) {
      event.preventDefault();
      send();
    }
  }
  return (
    <div className="composer-area">
      <form
        className="message-composer"
        aria-label="Local preview message composer"
        aria-busy={sending}
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <Tooltip content="Attachments are unavailable in preview">
          <button
            type="button"
            className="icon-button attachment-button"
            disabled
            aria-label="Attachments unavailable in preview"
          >
            <Plus size={27} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </Tooltip>
        <span className="composer-divider" />
        <label className="sr-only" htmlFor="message-draft">
          Message #{channelName} (local preview)
        </label>
        <textarea
          ref={input}
          id="message-draft"
          rows={1}
          maxLength={2000}
          placeholder={`Message #${channelName}`}
          value={draft}
          disabled={sending}
          aria-describedby="composer-help"
          onChange={(event) => {
            setDraft(event.target.value);
            setAnnouncement("");
          }}
          onKeyDown={onKeyDown}
        />
        <div className="composer-tools">
          <Tooltip content="Image uploads are unavailable in preview">
            <button
              type="button"
              className="icon-button image-button"
              disabled
              aria-label="Image uploads unavailable in preview"
            >
              <Image size={25} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="GIFs are unavailable in preview">
            <button
              type="button"
              className="icon-button gif-button"
              disabled
              aria-label="GIFs unavailable in preview"
            >
              <span aria-hidden="true">GIF</span>
            </button>
          </Tooltip>
          <EmojiPicker
            label="Choose an emoji"
            disabled={sending}
            onSelect={(emoji) => {
              setDraft((previous) =>
                `${previous}${emoji.value}`.slice(0, 2000),
              );
              input.current?.focus();
            }}
          >
            <Smile size={26} aria-hidden="true" />
          </EmojiPicker>
          <Button
            type="submit"
            size="icon"
            className="send-button"
            disabled={!ready}
            aria-label={
              sending ? "Sending message" : "Send local preview message"
            }
          >
            {sending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <SendHorizontal
                fill="currentColor"
                size={28}
                aria-hidden="true"
              />
            )}
          </Button>
        </div>
      </form>
      <div className="composer-help" id="composer-help">
        <span>
          Design preview · sample conversations and activity. Messages aren’t
          sent or saved.
        </span>
        {draft.length > 1800 && <span>{draft.length}/2000</span>}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
