import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRenameUsername } from "@/features/friends/api";
import { validUsername } from "@/lib/display-name";
import { apiErrorMessage } from "@/lib/api/errors";
import type { PublicProfile } from "@/lib/api/types";

export function UsernameSettings({
  profile,
  onSuccess,
  onCancel,
  onDirtyChange,
  compact = false,
}: {
  profile: PublicProfile;
  onSuccess?: () => void;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  compact?: boolean;
}) {
  const [username, setUsername] = useState(profile.username);
  const [validation, setValidation] = useState("");
  const mutation = useRenameUsername();
  const dirty = username.trim() !== profile.username;
  return <form className={compact ? "settings-username-form" : "mt-5 space-y-3"} aria-busy={mutation.isPending} onSubmit={(event) => {
    event.preventDefault();
    if (mutation.isPending) return;
    if (!validUsername(username)) { setValidation("Use 2–32 letters, numbers or underscores. System names are reserved."); return; }
    setValidation("");
    mutation.mutate(username, {
      onSuccess: () => {
        onDirtyChange?.(false);
        onSuccess?.();
      },
    });
  }}>
    <label htmlFor="account-username" className="text-sm font-medium">Change username</label>
    <Input id="account-username" maxLength={32} value={username} onChange={(event) => {
      const next = event.target.value;
      setUsername(next);
      setValidation("");
      mutation.reset();
      onDirtyChange?.(next.trim() !== profile.username);
    }} disabled={mutation.isPending} aria-describedby="username-help" aria-invalid={Boolean(validation)} />
    <p id="username-help" className="text-xs text-muted-foreground">Use 2–32 letters, numbers or underscores. Your four-digit user tag stays the same.</p>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={mutation.isPending || !dirty}>{mutation.isPending ? "Saving…" : "Save username"}</Button>
      {onCancel && <Button type="button" variant="outline" size="sm" disabled={mutation.isPending} onClick={() => {
        onDirtyChange?.(false);
        onCancel();
      }}>Cancel</Button>}
    </div>
    {(validation || mutation.error) && <p role="alert" className="text-sm text-destructive">{validation || apiErrorMessage(mutation.error)}</p>}
    {mutation.isSuccess && <p role="status" className="text-sm">Username updated.</p>}
  </form>;
}
