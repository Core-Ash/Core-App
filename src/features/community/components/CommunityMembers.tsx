import { useId, useRef, useState } from "react";
import { MemberDirectory } from "@/features/community/members/MemberDirectory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddMember } from "@/features/community/api/hooks";
import type { Community, Profile } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/api/errors";

export function CommunityMembers({
  community,
  profile,
}: {
  community: Community;
  profile: Profile;
}) {
  return (
    <section aria-label={`${community.name} membership`}>
      <h2 className="px-6 pt-6 text-xl font-semibold">Community members</h2>
      <MemberDirectory key={community.id} communityId={community.id} />
      {community.owner_id === profile.id && (
        <AddMemberForm key={community.id} communityId={community.id} />
      )}
    </section>
  );
}

function AddMemberForm({ communityId }: { communityId: string }) {
  const add = useAddMember(communityId);
  const id = useId();
  const locked = useRef(false);
  const [userId, setUserId] = useState("");
  const [validation, setValidation] = useState("");
  const [success, setSuccess] = useState(false);
  const error = validation || (add.error ? apiErrorMessage(add.error) : "");
  return (
    <form
      className="settings-panel mx-auto max-w-xl space-y-4"
      aria-label="Add community member"
      aria-busy={add.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (locked.current) return;
        setSuccess(false);
        const targetId = userId.trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
          setValidation("Enter a valid application member ID (UUID).");
          return;
        }
        setValidation("");
        locked.current = true;
        void add.mutateAsync(targetId)
          .then(() => {
            setUserId("");
            setSuccess(true);
          })
          .catch(() => {})
          .finally(() => { locked.current = false; });
      }}
    >
      <h2 className="text-lg font-semibold">Add a member</h2>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        As the owner, you can give an existing Core member access to this community.
        Ask them for the application member ID shown in their account settings.
      </p>
      <label htmlFor={id} className="block text-sm">Application member ID</label>
      <Input
        id={id}
        value={userId}
        disabled={add.isPending}
        required
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        onChange={(event) => {
          setUserId(event.target.value);
          setValidation("");
          setSuccess(false);
          add.reset();
        }}
      />
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={add.isPending}>
        {add.isPending ? "Adding member…" : "Add member"}
      </Button>
      <p role="status" className="text-sm">{success ? "Member added to the community." : ""}</p>
    </form>
  );
}
