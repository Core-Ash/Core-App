import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRenameUsername } from "@/features/friends/api";
import { validUsername } from "@/lib/display-name";
import { apiErrorMessage } from "@/lib/api/errors";
import type { PublicProfile } from "@/lib/api/types";

export function UsernameSettings({ profile }: { profile: PublicProfile }) {
  const [username, setUsername] = useState(profile.username);
  const [validation, setValidation] = useState("");
  const mutation = useRenameUsername();
  return <form className="mt-5 space-y-3" aria-busy={mutation.isPending} onSubmit={(event) => {
    event.preventDefault();
    if (mutation.isPending) return;
    if (!validUsername(username)) { setValidation("Use 2–32 letters, numbers or underscores. System names are reserved."); return; }
    setValidation(""); mutation.mutate(username);
  }}>
    <label htmlFor="account-username" className="text-sm font-medium">Change username</label>
    <Input id="account-username" maxLength={32} value={username} onChange={(event) => { setUsername(event.target.value); setValidation(""); mutation.reset(); }} disabled={mutation.isPending} aria-describedby="username-help" aria-invalid={Boolean(validation)} />
    <p id="username-help" className="text-xs text-muted-foreground">Use 2–32 letters, numbers or underscores. Your four-digit user tag stays the same.</p>
    <Button type="submit" size="sm" disabled={mutation.isPending || username.trim() === profile.username}>{mutation.isPending ? "Saving…" : "Save username"}</Button>
    {(validation || mutation.error) && <p role="alert" className="text-sm text-destructive">{validation || apiErrorMessage(mutation.error)}</p>}
    {mutation.isSuccess && <p role="status" className="text-sm">Username updated.</p>}
  </form>;
}
