import { useId, useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, Hash, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiNotice } from "@/components/common/ApiNotice";
import { inviteKeys, useCreateInvite, useInvitePreview, type CreatedInvite } from "@/features/invites/api";
import type { Community } from "@/lib/api/types";

const expirations = [
  [1800, "30 minutes"], [3600, "1 hour"], [21600, "6 hours"],
  [43200, "12 hours"], [86400, "1 day"], [604800, "7 days"], [0, "Never"],
] as const;

function InviteContents({ community }: { community: Community }) {
  const id = useId();
  const create = useCreateInvite(community.id);
  const generating = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const cached = useQuery<CreatedInvite | null>({
    queryKey: inviteKeys.link(community.id), queryFn: () => null, enabled: false,
  });
  const invite = cached.data;
  const preview = useInvitePreview(invite?.code ?? "");
  const [editing, setEditing] = useState(false);
  const [expiration, setExpiration] = useState(604800);
  const [maxUses, setMaxUses] = useState(invite?.max_uses ?? 0);
  const [copyState, setCopyState] = useState("");
  const previousSettings = useRef({ expiration, maxUses });
  const copied = copyState === "Link copied.";
  const canCopy = preview.isSuccess && !preview.isFetching && !create.isPending;

  useLayoutEffect(() => {
    if (mounted.current) title.current?.focus();
    mounted.current = true;
  }, [editing]);

  function generate() {
    if (create.isPending || generating.current) return;
    generating.current = true;
    setCopyState("");
    void create.mutateAsync({ expires_in_seconds: expiration || null, max_uses: maxUses || null })
      .then(() => setEditing(false))
      .catch(() => {})
      .finally(() => { generating.current = false; });
  }

  function editSettings() {
    previousSettings.current = { expiration, maxUses };
    setCopyState("");
    create.reset();
    setEditing(true);
  }

  function cancelSettings() {
    setExpiration(previousSettings.current.expiration);
    setMaxUses(previousSettings.current.maxUses);
    create.reset();
    setEditing(false);
  }

  function copyLink() {
    if (!invite || !canCopy) return;
    setCopyState("");
    if (!navigator.clipboard) {
      setCopyState("Select the link and copy it manually.");
      return;
    }
    void navigator.clipboard.writeText(invite.url).then(
      () => setCopyState("Link copied."),
      () => setCopyState("Copy failed. Select the link and copy it manually."),
    );
  }

  return <>
    <header className="invite-modal-heading">
      <Dialog.Title ref={title} tabIndex={-1} className="invite-modal-title">
        {editing ? "Invite link settings" : `Invite people to ${community.name}`}
      </Dialog.Title>
      <Dialog.Description className="invite-modal-description">
        {editing ? "Choose how long your link lasts and how many people can use it."
          : "Your next great conversation starts with an invite."}
      </Dialog.Description>
    </header>

    {editing ? <form aria-label="Invite link settings" onSubmit={(event) => { event.preventDefault(); generate(); }}>
      <div className="invite-modal-settings">
        <label className="invite-field-label" htmlFor={`${id}-expiration`}>Expiration</label>
        <div className="invite-select-wrap">
          <select className="invite-select" id={`${id}-expiration`} value={expiration} disabled={create.isPending}
            onChange={(event) => setExpiration(Number(event.target.value))}>
            {expirations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <ChevronDown size={20} aria-hidden="true" />
        </div>
        <label className="invite-field-label" htmlFor={`${id}-uses`}>Maximum uses</label>
        <div className="invite-select-wrap">
          <select className="invite-select" id={`${id}-uses`} value={maxUses} disabled={create.isPending}
            onChange={(event) => setMaxUses(Number(event.target.value))}>
            {[0, 1, 5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n ? `${n} ${n === 1 ? "use" : "uses"}` : "No limit"}</option>)}
          </select>
          <ChevronDown size={20} aria-hidden="true" />
        </div>
        <p className="invite-modal-hint">{invite ? "Previous links stay active. Manage them in Server Settings → Invites." : "People can preview your server before choosing to join."}</p>
        {create.error && <ApiNotice error={create.error} />}
      </div>
      <footer className="invite-modal-footer invite-modal-actions">
        <Button variant="ghost" disabled={create.isPending} onClick={cancelSettings}>Cancel</Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Generating…" : invite ? "Generate New Link" : "Generate Invite Link"}
        </Button>
      </footer>
    </form> : <>
      <div className="invite-modal-body">
        <div className="invite-server-preview">
          <div className="invite-server-thumbnail" aria-hidden="true">
            {preview.data?.server.icon_url
              ? <img src={preview.data.server.icon_url} alt="" referrerPolicy="no-referrer" />
              : <Hash size={25} strokeWidth={1.7} />}
          </div>
          <div className="invite-server-details">
            <strong>{community.name}</strong>
            <span>{preview.isSuccess ? `${preview.data.server.member_count.toLocaleString()} members` : "A place for your people"}</span>
          </div>
          <Link2 size={20} className="invite-preview-link-icon" aria-hidden="true" />
        </div>
        <p className="invite-sharing-note">Share your server with friends. Anyone with your link can open the invite and choose to join.</p>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (!invite) generate(); }} className="invite-modal-footer">
        <label htmlFor={`${id}-link`} className="invite-field-label">Send a server invite link</label>
        <div className="invite-link-row">
          <Input id={`${id}-link`} readOnly value={invite?.url ?? ""} placeholder="Generate a link to get started"
            aria-label="Invite link" onFocus={(event) => event.currentTarget.select()} />
          {invite ? <Button className={copied ? "invite-copy-button is-copied" : "invite-copy-button"} disabled={!canCopy}
            aria-label="Copy Link" onClick={copyLink}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button> : <Button type="submit" className="invite-copy-button" aria-label="Generate Invite Link" disabled={create.isPending}>
            {create.isPending ? "Generating…" : "Generate Link"}
          </Button>}
        </div>
        <p className="invite-link-caption">
          <span>{invite ? (invite.expires_at ? `Expires ${new Date(invite.expires_at).toLocaleString()}.` : "Your invite link never expires.") : "Links expire after 7 days by default."}
            {invite?.max_uses ? ` ${invite.max_uses} ${invite.max_uses === 1 ? "use" : "uses"} maximum.` : ""}</span>{" "}
          <button type="button" className="invite-edit-link" disabled={create.isPending} onClick={editSettings}>Edit invite link</button>
        </p>
        {preview.isFetching && invite && <p className="invite-modal-hint" role="status">Checking link…</p>}
        {preview.error && invite && <ApiNotice error={preview.error} onRetry={() => { void preview.refetch(); }} />}
        {create.error && <ApiNotice error={create.error} />}
        <p role="status" className={copyState ? "invite-copy-status" : "sr-only"}>{copyState}</p>
      </form>
    </>}
  </>;
}

export function InviteDialog({ community, children, open, onOpenChange, returnFocusRef }: {
  community: Community; children?: ReactElement; open?: boolean;
  onOpenChange?: (open: boolean) => void; returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  return <Dialog.Root open={open ?? internalOpen} onOpenChange={(value) => { setInternalOpen(value); onOpenChange?.(value); }}>
    {children && <Dialog.Trigger asChild>{children}</Dialog.Trigger>}
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="standard-dialog invite-dialog" onCloseAutoFocus={(event) => {
        if (returnFocusRef?.current) { event.preventDefault(); returnFocusRef.current.focus(); }
      }}>
        <InviteContents key={community.id} community={community} />
        <Dialog.Close asChild><button className="icon-button dialog-close" aria-label="Close invitation dialog"><X size={22} strokeWidth={1.5} aria-hidden="true" /></button></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
