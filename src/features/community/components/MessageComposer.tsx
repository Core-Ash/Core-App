import { useRef, useState, type KeyboardEvent } from "react";
import { Image, LoaderCircle, Plus, SendHorizontal, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Tooltip } from "@/components/ui/tooltip";
import { apiErrorMessage } from "@/lib/api/errors";

interface MessageComposerProps {
  channelName: string;
  onSend: (body: string) => void | Promise<void>;
  sending?: boolean;
}

export function MessageComposer({
  channelName,
  onSend,
  sending = false,
}: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const locked = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const busy = sending || submitting;
  const maximum = 4000;
  const ready = draft.trim().length > 0 && !busy;
  async function send() {
    if (!ready || locked.current) return;
    if (Array.from(draft.trim()).length > maximum || draft.includes("\0")) {
      setError(
        `Enter a message with 1–${maximum} characters and no unsupported control characters.`,
      );
      return;
    }
    locked.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = onSend(draft.trim());
      if (result) await result;
      setDraft("");
      setAnnouncement("Message sent.");
    } catch (failure) {
      setError(apiErrorMessage(failure));
    } finally {
      locked.current = false;
      setSubmitting(false);
      // Focus after React re-enables the input following an async send.
      requestAnimationFrame(() => input.current?.focus());
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.nativeEvent.keyCode !== 229
    ) {
      event.preventDefault();
      void send();
    }
  }
  return (
    <div className="composer-area">
      <form
        className="message-composer"
        aria-label="Message composer"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Tooltip content="Attachments are unavailable">
          <button
            type="button"
            className="icon-button attachment-button"
            disabled
            aria-label="Attachments unavailable"
          >
            <Plus size={27} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </Tooltip>
        <span className="composer-divider" />
        <label className="sr-only" htmlFor="message-draft">
          Message #{channelName}
        </label>
        <textarea
          ref={input}
          id="message-draft"
          rows={1}
          maxLength={maximum * 2}
          placeholder={`Message #${channelName}`}
          value={draft}
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? "composer-help composer-error" : "composer-help"
          }
          onChange={(event) => {
            setDraft(event.target.value);
            setAnnouncement("");
          }}
          onKeyDown={onKeyDown}
        />
        <div className="composer-tools">
          <Tooltip content="Image uploads are unavailable">
            <button
              type="button"
              className="icon-button image-button"
              disabled
              aria-label="Image uploads unavailable"
            >
              <Image size={25} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="GIFs are unavailable">
            <button
              type="button"
              className="icon-button gif-button"
              disabled
              aria-label="GIFs unavailable"
            >
              <span aria-hidden="true">GIF</span>
            </button>
          </Tooltip>
          <EmojiPicker
            label="Choose an emoji"
            disabled={busy}
            onSelect={(emoji) => {
              setDraft((previous) =>
                Array.from(`${previous}${emoji.value}`)
                  .slice(0, maximum)
                  .join(""),
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
              busy ? "Sending message" : "Send message"
            }
          >
            {busy ? (
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
          Enter to send · Shift+Enter for a new line
        </span>
        {Array.from(draft).length > maximum - 200 && (
          <span>
            {Array.from(draft).length}/{maximum}
          </span>
        )}
      </div>
      {error && (
        <p
          id="composer-error"
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {error} Your draft has been kept.
        </p>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
