import { Fragment } from "react";
import { UserProfilePopover } from "@/features/profiles/UserProfilePopover";
import { visibleMentions, type Mention } from "./model";

export function MentionText({ body, mentions = [], communityId, currentUserId }: { body: string; mentions?: Mention[]; communityId?: string; currentUserId?: string }) {
  const parts = [];
  let position = 0;
  for (const mention of visibleMentions(body, mentions)) {
    parts.push(<Fragment key={`text-${position}`}>{body.slice(position, mention.start)}</Fragment>);
    const own = mention.kind === "user" && mention.id === currentUserId;
    const mass = mention.kind === "everyone" || mention.kind === "here";
    const className = `message-mention${own ? " message-mention--personal" : ""}${mass ? " message-mention--mass" : ""}${mention.kind === "role" ? " message-mention--role" : ""}`;
    const label = mention.label ? `@${mention.label}` : body.slice(mention.start, mention.end);
    parts.push(mention.kind === "user" && mention.profile ? <UserProfilePopover key={`mention-${mention.start}`} profile={mention.profile} communityId={communityId}><span role="button" tabIndex={0} className={className} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>{label}</span></UserProfilePopover> : <span key={`mention-${mention.start}`} className={className} title={mention.kind === "here" ? "Online alerts unavailable" : mention.kind === "role" ? "Server role" : undefined}>{label}</span>);
    position = mention.end;
  }
  parts.push(<Fragment key={`text-${position}`}>{body.slice(position)}</Fragment>);
  return <>{parts}</>;
}
