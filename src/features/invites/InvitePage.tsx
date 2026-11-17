import { Hash, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { useAppData } from "@/app/app-data-context";
import { ApiNotice } from "@/components/common/ApiNotice";
import { communityHref } from "@/features/community/api/use-community-selection";
import { ApiError } from "@/lib/api/errors";
import { useAcceptInvite, useInvitePreview, useInviteStatus, validInviteCode } from "@/features/invites/api";

const invalidInvite = (error: unknown) => error instanceof ApiError && error.kind === "not_found";
export function InvitePage() {
  const { code = "" } = useParams();
  return <InviteExperience key={code} code={code} />;
}
function InviteExperience({ code }: { code: string }) {
  const auth = useAuth(), data = useAppData(), navigate = useNavigate();
  const preview = useInvitePreview(code), status = useInviteStatus(code), accept = useAcceptInvite(code);
  const openServer = status.data?.already_member && status.data.community_id;
  const invalid = !validInviteCode(code) || (!openServer && (invalidInvite(preview.error) || invalidInvite(status.error) || invalidInvite(accept.error)));
  // New accounts can create their application profile through the existing onboarding endpoint when joining.
  const statusError = status.error instanceof ApiError && status.error.kind === "conflict" ? null : status.error;
  return <main className="invite-page"><section className="invite-card" aria-label="Server invitation" aria-busy={preview.isFetching || auth.pending || accept.isPending}>
    <Link to="/" className="invite-brand">CORE</Link>
    {openServer ? <>
      <h1 className="text-2xl font-bold">Already a member</h1>
      <p className="text-muted-foreground">You already belong to {preview.data?.server.name ?? "this server"}.</p>
      <Button asChild className="w-full"><Link to={communityHref(openServer)}>Open Server</Link></Button>
    </> : invalid ? <>
      <h1 className="text-2xl font-bold">Invite Invalid</h1>
      <p className="text-muted-foreground">This invitation may have expired, been revoked, or reached its maximum number of uses.</p>
      <Button asChild variant="outline"><Link to="/">Back to Home</Link></Button>
    </> : <>
      {preview.isPending && !preview.error && <p role="status">Loading invitation…</p>}
      {preview.error && <ApiNotice error={preview.error} onRetry={() => { void preview.refetch(); }} />}
      {preview.data && <>
        {preview.data.server.banner_url && <img className="invite-banner" src={preview.data.server.banner_url} alt="" referrerPolicy="no-referrer" />}
        <div className="invite-server-icon" aria-hidden="true">{preview.data.server.icon_url ? <img src={preview.data.server.icon_url} alt="" referrerPolicy="no-referrer" /> : <Hash size={32} />}</div>
        <p className="text-sm text-muted-foreground">You've been invited to join a server</p>
        <h1 className="text-3xl font-bold break-words">{preview.data.server.name}</h1>
        {preview.data.server.description && <p className="break-words text-muted-foreground">{preview.data.server.description}</p>}
        <p className="invite-member-count"><Users size={17} aria-hidden="true" />{preview.data.server.member_count.toLocaleString()} Members</p>
        {auth.pending ? <p role="status">Checking your session…</p> : auth.error ? <p role="alert">We couldn't check your session. <button className="text-link underline" onClick={() => { void auth.refresh(); }}>Retry</button></p> : !auth.session ? <div className="space-y-3">
          <Button asChild className="w-full"><Link to="/login" state={{ from: `/invite/${code}` }}>Sign In to Join</Link></Button>
          <p className="text-sm text-muted-foreground">New to Core? <Link to="/register" state={{ from: `/invite/${code}` }} className="text-link underline">Create an account</Link></p>
        </div> : <>
          {statusError && <ApiNotice error={statusError} onRetry={() => { void status.refetch(); }} />}
          {accept.error && !invalidInvite(accept.error) && <ApiNotice error={accept.error} />}
          {!data.configured && <p role="alert">The Core API is not configured.</p>}
          <Button className="w-full" disabled={!data.ready || status.isPending || Boolean(statusError) || accept.isPending} onClick={() => {
            if (accept.isPending) return;
            accept.mutate(undefined, { onSuccess: (id) => navigate(communityHref(id), { replace: true }) });
          }}>{accept.isPending ? "Joining…" : status.isPending ? "Checking membership…" : "Join Server"}</Button>
        </>}
      </>}
    </>}
  </section></main>;
}
