import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MentionAutocomplete } from "@/features/mentions/MentionAutocomplete";
import { mentionQuery, reconcileMentionEdit, reconcileMentions, type Mention, type MentionSuggestion } from "@/features/mentions/model";
import { ComposerReplyBanner } from "@/features/community/components/MessageReplyAndForward";
import { parseMentions } from "@/lib/api/contracts";
import type { MessageReplyReference } from "@/lib/api/types";
import { Image, Lock, Plus, SendHorizontal, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Tooltip } from "@/components/ui/tooltip";
import { apiErrorMessage } from "@/lib/api/errors";

interface MessageComposerProps {
  channelName: string;
  placeholder?: string;
  communityId?: string;
  canSendMessages?: boolean;
  disabledReason?: string;
  onSend: (body: string, mentions?: Mention[]) => void | Promise<void>;
  initialBody?: string;
  initialMentions?: Mention[];
  submitLabel?: string;
  mentionSuggestions?: MentionSuggestion[];
  mentionsLoading?: boolean;
  onMentionSearch?: (search: string | null) => void;
  autoFocus?: boolean;
  replyTo?: MessageReplyReference | null;
  replyMention?: boolean;
  onToggleReplyMention?: (enabled: boolean) => void;
  onCancelReply?: () => void;
}

export function MessageComposer({
  channelName,
  placeholder,
  communityId,
  canSendMessages = true,
  disabledReason,
  onSend,
  mentionSuggestions = [],
  mentionsLoading,
  onMentionSearch,
  initialBody = "",
  initialMentions = [],
  submitLabel = "Send message",
  autoFocus = false,
  replyTo = null,
  replyMention = true,
  onToggleReplyMention,
  onCancelReply,
}: MessageComposerProps) {
  const [draft, setDraft] = useState(initialBody);
  const [mentions, setMentions] = useState<Mention[]>(initialMentions);
  const [query, setQuery] = useState<ReturnType<typeof mentionQuery>>(null);
  const [selected, setSelected] = useState(0);
  const popupId = useId();
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const [submitting, setSubmitting] = useState(false);
  const composing = useRef(false);
  const editRange = useRef<{ start: number; end: number } | null>(null);
  const active = Math.min(selected, Math.max(0, mentionSuggestions.length - 1));
  function closeMentions() { setQuery(null); onMentionSearch?.(null); }
  function updateQuery(value: string, start: number, end: number, spans: Mention[]) {
    const next = mentionQuery(value, start, end, spans);
    setQuery(next); setSelected(0); onMentionSearch?.(next?.search ?? null);
  }
  function insertMention(item: MentionSuggestion) {
    if (!query) return;
    const label = `@${item.label}`;
    const value = draft.slice(0, query.start) + label + " " + draft.slice(query.end);
    const retained = reconcileMentions(draft, value, mentions);
    setMentions([...retained, { ...item, start: query.start, end: query.start + label.length }].sort((a, b) => a.start - b.start));
    setDraft(value); closeMentions();
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(query.start + label.length + 1, query.start + label.length + 1); });
  }
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = input.current;
    if ((autoFocus || replyTo) && element) {
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    }
  }, [autoFocus, replyTo]);
  const maximum = 4000;
  const ready = draft.trim().length > 0;
  async function send() {
    if (!ready || locked.current || !canSendMessages) return;
    if (Array.from(draft.trim()).length > maximum || draft.includes("\0")) {
      setError(
        `Enter a message with 1–${maximum} characters and no unsupported control characters.`,
      );
      return;
    }
    locked.current = true;
    setError(null);
    try {
      const leading = draft.length - draft.trimStart().length;
      const trimmedMentions = mentions.map((m) => ({ ...m, start: m.start - leading, end: m.end - leading }));
      const result = trimmedMentions.length ? onSend(draft.trim(), trimmedMentions) : onSend(draft.trim());
      if (result) { setSubmitting(true); await result; }
      setDraft("");
      setMentions([]); closeMentions();
      setAnnouncement("Message queued.");
    } catch (failure) {
      setError(apiErrorMessage(failure));
    } finally {
      setSubmitting(false);
      locked.current = false;
      // Keep keyboard entry ready for the next message.
      requestAnimationFrame(() => input.current?.focus());
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const { selectionStart: start, selectionEnd: end } = event.currentTarget;
    if (event.key === "Backspace" || event.key === "Delete") {
      editRange.current = { start: start === end && event.key === "Backspace" ? Math.max(0, start - 1) : start, end: start === end && event.key === "Delete" ? Math.min(draft.length, end + 1) : end };
    }
    if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (query && onMentionSearch) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMentions(); return; }
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && mentionSuggestions.length) {
        event.preventDefault();
        const next = (active + (event.key === "ArrowDown" ? 1 : -1) + mentionSuggestions.length) % mentionSuggestions.length;
        setSelected(next); document.getElementById(`${popupId}-${next}`)?.scrollIntoView?.({ block: "nearest" }); return;
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        if (mentionSuggestions[active]) { event.preventDefault(); insertMention(mentionSuggestions[active]); return; }
        if (event.key === "Enter" && mentionsLoading) { event.preventDefault(); return; }
        closeMentions();
      }
    }
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
  if (!canSendMessages) {
    return (
      <div className="composer-area">
        <div
          className="message-composer message-composer-disabled"
          role="region"
          aria-label="Messaging disabled"
        >
          <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <span className="text-sm text-muted-foreground select-none">
            {disabledReason ?? `You do not have permission to send messages in #${channelName}.`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="composer-area relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeMentions(); }}>
      {query && onMentionSearch && <MentionAutocomplete id={popupId} items={mentionSuggestions} selected={active} loading={mentionsLoading} onSelect={insertMention} onHighlight={setSelected} />}
      {replyTo && onCancelReply && (
        <ComposerReplyBanner
          replyTo={replyTo}
          mentionEnabled={replyMention}
          onToggleMention={(enabled) => onToggleReplyMention?.(enabled)}
          onCancel={onCancelReply}
        />
      )}
      <form
        className="message-composer"
        aria-label="Message composer"
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
        <label className="sr-only" htmlFor={inputId}>
          {placeholder ?? `Message #${channelName}`}
        </label>
        <textarea
          ref={input}
          id={inputId}
          disabled={submitting}
          rows={1}
          maxLength={maximum * 2}
          placeholder={placeholder ?? `Message #${channelName}`}
          value={draft}
          aria-autocomplete={onMentionSearch ? "list" : undefined}
          aria-expanded={onMentionSearch ? Boolean(query) : undefined}
          aria-controls={query && onMentionSearch ? popupId : undefined}
          aria-activedescendant={query && mentionSuggestions.length ? `${popupId}-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${helpId} ${errorId}` : helpId
          }
          onChange={(event) => {
            const range = editRange.current;
            editRange.current = null;
            const spans = range ? reconcileMentionEdit(draft, event.target.value, mentions, range.start, range.end) : reconcileMentions(draft, event.target.value, mentions);
            setMentions(spans);
            setDraft(event.target.value);
            if (!composing.current) updateQuery(event.target.value, event.target.selectionStart, event.target.selectionEnd, spans);
            setAnnouncement("");
          }}
          onSelect={(event) => { if (!composing.current) updateQuery(draft, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, mentions); }}
          onBeforeInput={(event) => {
            const { selectionStart: start, selectionEnd: end } = event.currentTarget;
            const native = event.nativeEvent as InputEvent;
            editRange.current = { start: start === end && native.inputType === "deleteContentBackward" ? Math.max(0, start - 1) : start, end: start === end && native.inputType === "deleteContentForward" ? Math.min(draft.length, end + 1) : end };
          }}
          onCompositionStart={() => { composing.current = true; closeMentions(); }}
          onCompositionEnd={(event) => { composing.current = false; updateQuery(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, mentions); }}
          onCopy={(event) => {
            const { selectionStart: start, selectionEnd: end } = event.currentTarget;
            const copied = mentions.filter((m) => m.start >= start && m.end <= end).map((m) => ({ ...m, start: m.start - start, end: m.end - start }));
            if (!copied.length) return;
            event.preventDefault();
            const body = draft.slice(start, end);
            event.clipboardData.setData("text/plain", body);
            event.clipboardData.setData("application/x-core-mentions", JSON.stringify({ body, mentions: copied }));
          }}
          onPaste={(event) => {
            const data = event.clipboardData.getData("application/x-core-mentions");
            if (!data) return;
            try {
              const pasted: unknown = JSON.parse(data);
              if (!pasted || typeof pasted !== "object" || !("body" in pasted) || typeof pasted.body !== "string" || !("mentions" in pasted)) return;
              if (pasted.body !== event.clipboardData.getData("text/plain")) return;
              const spans = parseMentions(pasted.mentions, pasted.body);
              const { selectionStart: start, selectionEnd: end } = event.currentTarget;
              const value = draft.slice(0, start) + pasted.body + draft.slice(end);
              if (value.length > maximum * 2) return;
              event.preventDefault();
              setMentions([...reconcileMentionEdit(draft, value, mentions, start, end), ...spans.map((m) => ({ ...m, start: m.start + start, end: m.end + start }))].sort((a, b) => a.start - b.start));
              setDraft(value); closeMentions();
              const caret = start + pasted.body.length;
              requestAnimationFrame(() => input.current?.setSelectionRange(caret, caret));
            } catch { /* Invalid clipboard metadata falls back to ordinary text. */ }
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
            communityId={communityId}
            onSelect={(emoji) => {
              if (locked.current) return;
              const token = emoji.customId ? `:${emoji.label}:` : emoji.value;
              const value = Array.from(`${draft}${token}`).slice(0, maximum).join("");
              setMentions(reconcileMentions(draft, value, mentions));
              setDraft(value); closeMentions();
              input.current?.focus();
            }}
          >
            <Smile size={26} aria-hidden="true" />
          </EmojiPicker>
          <Button
            type="submit"
            size="icon"
            className="send-button"
            disabled={!ready || submitting}
            aria-label={submitLabel}
          >
            <SendHorizontal
                fill="currentColor"
                size={28}
                aria-hidden="true"
              />
          </Button>
        </div>
      </form>
      <div className="composer-help" id={helpId}>
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
          id={errorId}
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
