import { useState, type SubmitEvent } from "react";
import { Menu, RefreshCw, Users, UserPlus } from "lucide-react";
import { useOutletContext } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiNotice } from "@/components/common/ApiNotice";
import type { WorkspaceNavigation } from "@/components/layout/AppLayout";
import { MemberIdentity } from "@/features/community/members/MemberIdentity";
import { ApplicationProfileState } from "@/features/community/components/ApplicationProfile";
import { useCurrentUser } from "@/features/community/api/hooks";
import { useFriendAction, useFriendCounts, useFriendList, type FriendRequest, type ListKind } from "@/features/friends/api";
import { RelationshipActions } from "@/features/friends/RelationshipActions";
import { apiErrorMessage, ApiError } from "@/lib/api/errors";
import { fullUsername, validUserTag } from "@/lib/display-name";
import type { PublicProfile } from "@/lib/api/types";

type Tab = ListKind | "add";
export function FriendsPage() {
  const me = useCurrentUser();
  const counts = useFriendCounts();
  const [tab, setTab] = useState<Tab>("friends");
  const navigation = useOutletContext<WorkspaceNavigation | undefined>();
  if (!me.isSuccess) return <ApplicationProfileState />;
  return <div className="friends-page">
    <header className="friends-header">
      {navigation && <button className="icon-button community-menu-toggle" aria-label="Open navigation" onClick={navigation.openNavigation}><Menu size={20} aria-hidden="true" /></button>}
      <h1><Users size={20} aria-hidden="true" />Friends</h1>
      <nav aria-label="Friends filters">
        <button disabled title="Presence is not available yet">Online</button>
        {([ ["friends", "All"], ["requests", "Pending"], ["blocked", "Blocked"], ["add", "Add Friend"] ] as const).map(([key, label]) =>
          <button key={key} aria-current={tab === key ? "page" : undefined} className={key === "add" ? "friends-add-tab" : ""} onClick={() => setTab(key)}>{label}{key === "requests" && counts.data && counts.data.incoming + counts.data.outgoing > 0 ? ` (${counts.data.incoming + counts.data.outgoing})` : ""}</button>)}
      </nav>
    </header>
    <div className="friends-workspace">
      <div className="friends-content">{tab === "add" ? <AddFriend /> : <FriendList key={tab} kind={tab} />}</div>
      {tab !== "add" && <aside className="friends-activity" aria-label="Friend activity"><h2>Active Now</h2><div><h3>A little quiet in here</h3><p>Live friend activity will appear here when presence is available.</p></div></aside>}
    </div>
  </div>;
}

function AddFriend() {
  const [username, setUsername] = useState("");
  const [validation, setValidation] = useState("");
  const mutation = useFriendAction();
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    if (!validUserTag(username)) { setValidation("Enter a complete Core username, such as Ash#0007."); return; }
    setValidation(""); mutation.mutate({ action: "send", username });
  }
  let error = mutation.error ? apiErrorMessage(mutation.error) : "";
  if (mutation.error instanceof ApiError) {
    if (mutation.error.status === 404) error = "User not found. Check the full username and all four digits.";
    if (mutation.error.status === 409) error = "You are already friends or a request is already pending. Check All and Pending.";
    if (mutation.error.status === 403) error = "Cannot send a friend request to this user.";
    if (mutation.error.status === 400) error = "Check the username. You cannot add yourself.";
  }
  return <section className="friends-add-section">
    <div className="friends-section-heading"><UserPlus size={22} aria-hidden="true" /><h2>Add Friend</h2></div>
    <p>You can add friends using their complete Core username.</p>
    <form onSubmit={submit} className="friends-add-form" aria-busy={mutation.isPending}>
      <label className="sr-only" htmlFor="friend-username">Full username</label>
      <Input id="friend-username" placeholder="Ash#6321" value={username} maxLength={37} autoComplete="off" spellCheck={false} aria-describedby="friend-feedback" aria-invalid={Boolean(validation)} onChange={(event) => { setUsername(event.target.value); setValidation(""); mutation.reset(); }} disabled={mutation.isPending} />
      <Button disabled={mutation.isPending || !username.trim()} type="submit">{mutation.isPending ? "Sending…" : "Send Friend Request"}</Button>
    </form>
    <div id="friend-feedback" className="mt-3 text-sm">
      {(validation || error) && <p role="alert" className="text-destructive">{validation || error}</p>}
      {mutation.isSuccess && <p role="status">{mutation.data === "accepted" ? "Friend request accepted. You’re now friends." : "Friend request sent."}</p>}
    </div>
    <p className="mt-4 text-xs text-muted-foreground">Usernames are matched exactly, ignoring capitalization. Include the # and all four digits.</p>
  </section>;
}

function FriendList({ kind }: { kind: ListKind }) {
  const query = useFriendList(kind);
  const counts = useFriendCounts();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const unique = [...new Map(items.map((item) => [item.id, item])).values()];
  const label = kind === "friends" ? "All friends" : kind === "blocked" ? "Blocked users" : "Pending requests";
  if (query.isPending) return <ApiNotice loading={`Loading ${label.toLowerCase()}…`} />;
  if (query.isError && !query.data) return <ApiNotice error={query.error} onRetry={() => void query.refetch()} />;
  const requests = kind === "requests" ? unique as FriendRequest[] : [];
  return <section aria-label={label}>
    <div className="friends-list-heading"><h2>{label} <span>— {counts.data ? (kind === "requests" ? counts.data.incoming + counts.data.outgoing : counts.data[kind]) : `${unique.length}${query.hasNextPage ? "+" : ""}`}</span></h2><Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => { void query.refetch(); void counts.refetch(); }}><RefreshCw size={14} aria-hidden="true" />Refresh</Button></div>
    {query.error && <ApiNotice error={query.error} onRetry={() => void query.refetch()} />}
    {!unique.length && <div className="friends-empty"><Users size={48} aria-hidden="true" /><h3>{kind === "friends" ? "Your people are out there" : kind === "requests" ? "You’re all caught up" : "No blocked users"}</h3><p>{kind === "friends" ? "Open Add Friend and send someone a request with their Core username." : kind === "requests" ? "Incoming and outgoing friend requests will appear here." : "You can manage blocked accounts here."}</p></div>}
    {kind === "requests" ? <>
      <RequestSection title="Incoming Friend Requests" total={counts.data?.incoming} requests={requests.filter((request) => request.incoming)} />
      <RequestSection title="Outgoing Friend Requests" total={counts.data?.outgoing} requests={requests.filter((request) => !request.incoming)} />
    </> : <ul className="friends-list">{(unique as PublicProfile[]).map((profile) => <FriendRow key={profile.id} profile={profile} blocked={kind === "blocked"} />)}</ul>}
    {query.hasNextPage && <Button variant="outline" className="mt-4" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetching ? "Loading…" : "Load more"}</Button>}
  </section>;
}

function RequestSection({ title, requests, total }: { title: string; requests: FriendRequest[]; total?: number }) {
  return <section className="friends-request-section" aria-label={title}><h3>{title} — {total ?? requests.length}</h3><ul className="friends-list">{requests.map((request) => <RequestRow key={request.id} request={request} />)}</ul></section>;
}
function RequestRow({ request }: { request: FriendRequest }) {
  const mutation = useFriendAction();
  return <li className="friend-row"><div className="friend-row-main"><MemberIdentity profile={request.profile} /><p className="friend-row-detail">{request.incoming ? `${fullUsername(request.profile)} wants to be your friend.` : "Outgoing · Pending"} <time dateTime={request.created_at}>{new Date(request.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></p></div><div className="friend-row-actions">
    {request.incoming && <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "accept", id: request.id })}>Accept</Button>}
    <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: request.incoming ? "decline" : "cancel", id: request.id })}>{request.incoming ? "Decline" : "Cancel Request"}</Button>
    {mutation.error && <p role="alert" className="text-xs text-destructive">{apiErrorMessage(mutation.error)}</p>}
  </div></li>;
}
function FriendRow({ profile, blocked }: { profile: PublicProfile; blocked: boolean }) {
  const mutation = useFriendAction();
  const [open, setOpen] = useState(false);
  return <li className="friend-row"><MemberIdentity profile={profile} />{blocked ? <div><Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "unblock", id: profile.id })}>Unblock</Button>{mutation.error && <p role="alert">{apiErrorMessage(mutation.error)}</p>}</div> : <details className="friend-options" onToggle={(event) => setOpen(event.currentTarget.open)}><summary aria-label={`More options for ${fullUsername(profile)}`} title="More options">•••</summary>{open && <div><MemberIdentity profile={profile} avatar={false} username={false} label="View Profile" /><RelationshipActions profile={profile} /></div>}</details>}</li>;
}
