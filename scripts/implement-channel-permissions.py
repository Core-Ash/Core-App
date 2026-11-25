"""Apply the authorized channel/category backend changes; no database connection."""
import json
from pathlib import Path

core=Path(__file__).resolve().parents[1].parent/"Core"
def edit(name,old,new):
    p=core/name;s=p.read_text(encoding="utf-8");assert old in s,(name,old[:80]);p.write_text(s.replace(old,new),encoding="utf-8")

p=core/"src/permission_catalog.json";catalog=json.loads(p.read_text(encoding="utf-8"))
labels={
 "channels.view":("View Channel","Allows members to view this channel."),
 "channels.manage":("Manage Channel","Allows members to edit or delete this channel."),
 "roles.manage":("Manage Permissions","Allows members to edit permission overrides for this channel."),
 "webhooks.manage":("Manage Webhooks","Allows members to create, edit, and delete webhooks in this channel."),
 "invites.create":("Create Invite","Allows members to create invitations to this server through this channel."),
 "messages.mention_everyone":("Mention @everyone, @here, and All Roles","Notify everyone, online members, and otherwise restricted roles where supported."),
}
for d in catalog:
    if d['key'] in labels:d['channelLabel'],d['channelDesc']=labels[d['key']]
    if d['group']=="General Server Permissions":d['channelGroup']="General Channel Permissions"
    if d['key']=="invites.create":d['resources']=["text","voice","category"];d['overwrite']=True
    if d['key'] in ["messages.embed_links","messages.attach_files","messages.mention_everyone","messages.tts","messages.polls"]:d['dependencies']=["channels.view","messages.send"]
    if d['key']=="messages.voice":d['dependencies']=["channels.view","messages.send","messages.attach_files"]
    if d['key'].startswith('voice.') and d['key'] not in ['voice.connect','voice.status']:d['dependencies']=["channels.view","voice.connect"]
p.write_text(json.dumps(catalog,indent=2)+"\n",encoding="utf-8")

(core/"migrations/0018_channel_invites.sql").write_text('''-- Existing invitations remain server-scoped; no permission grants are changed.
ALTER TABLE core.community_invites ADD COLUMN channel_id uuid;
ALTER TABLE core.community_invites ADD CONSTRAINT community_invites_channel_scope
 FOREIGN KEY (community_id,channel_id) REFERENCES core.channels(community_id,id) ON DELETE CASCADE;
CREATE INDEX community_invites_channel ON core.community_invites(channel_id) WHERE channel_id IS NOT NULL;
''',encoding="utf-8")
edit("src/invites.rs","extract::{Path, Query, State}","extract::{Path, Query, State}")
edit("src/invites.rs","pub(crate) struct Settings {","pub(crate) struct Settings {\n    channel_id: Option<Uuid>,")
# Optional channel context augments the existing endpoint and session contract.
edit("src/invites.rs","pub(crate) async fn permissions(","#[derive(Deserialize)]\n#[serde(deny_unknown_fields)]\npub(crate) struct InviteContext { channel_id: Option<Uuid> }\n\npub(crate) async fn permissions(")
edit("src/invites.rs","    Path(id): Path<Uuid>,\n) -> Result<Json<Value>, ApiError> {","    Path(id): Path<Uuid>,\n    Query(context): Query<InviteContext>,\n) -> Result<Json<Value>, ApiError> {")
edit("src/invites.rs","    let row=db.query_one(\"SELECT COALESCE((SELECT allowed FROM core.permission_decisions($1,NULL,'invites.create'", "    if let Some(channel)=context.channel_id { if authorization::require_channel(&**db,user.id,channel,Permission::ViewChannel).await? != id { return Err(ApiError::not_found()); } }\n    let row=db.query_one(\"SELECT COALESCE((SELECT allowed FROM core.permission_decisions($1,$3,'invites.create'")
edit("src/invites.rs","&[&id,&user.id]).await?;","&[&id,&user.id,&context.channel_id]).await?;")
edit("src/invites.rs","    authorization::require(&**db, user.id, id, None, Permission::CreateInvites).await?;","""    let mut db = db;
    let tx=db.transaction().await?;
    tx.query_opt("SELECT id FROM core.communities WHERE id=$1 FOR UPDATE", &[&id]).await?.ok_or_else(ApiError::not_found)?;
    if let Some(channel)=input.channel_id {
        if authorization::require_channel(&*tx,user.id,channel,Permission::CreateInvites).await? != id { return Err(ApiError::not_found()); }
    } else { authorization::require(&*tx,user.id,id,None,Permission::CreateInvites).await?; }""")
edit("src/invites.rs","let row=db.query_one(\"INSERT INTO core.community_invites(community_id,created_by,code_hash,expires_at,max_uses) VALUES($1,$2,$3,now()+$4::bigint*interval '1 second',$5) RETURNING id,expires_at\", &[&id,&user.id,&digest,&input.expires_in_seconds,&input.max_uses]).await?;","""let row=tx.query_one("INSERT INTO core.community_invites(community_id,created_by,code_hash,expires_at,max_uses,channel_id) VALUES($1,$2,$3,now()+$4::bigint*interval '1 second',$5,$6) RETURNING id,expires_at", &[&id,&user.id,&digest,&input.expires_in_seconds,&input.max_uses,&input.channel_id]).await?;
    tx.commit().await?;""")
# Existing settings struct literals keep their previous server-scoped semantics.
for name in ["src/invites.rs","src/invites_tests.rs"]:
    p=core/name;s=p.read_text(encoding="utf-8");s=s.replace("Settings {\n                        expires_in_seconds", "Settings {\n                        channel_id: None,\n                        expires_in_seconds").replace("Settings {\n                    expires_in_seconds", "Settings {\n                    channel_id: None,\n                    expires_in_seconds").replace("Settings {\n            expires_in_seconds", "Settings {\n            channel_id: None,\n            expires_in_seconds");p.write_text(s,encoding="utf-8")

p=core/"src/channel_permissions.rs";s=p.read_text(encoding="utf-8")
s=s.replace('#[derive(Deserialize)]\npub struct Change','#[derive(Deserialize)]\n#[serde(deny_unknown_fields)]\npub struct Change').replace('#[derive(Deserialize)]\npub struct Save','#[derive(Deserialize)]\n#[serde(deny_unknown_fields)]\npub struct Save')
s=s.replace('    if input.changes.len() > 1000 {','''    let mut unique=std::collections::HashSet::new();
    if input.sync == Some(true) && !input.changes.is_empty() { return Err(ApiError::bad("Sync cannot include independent changes")); }
    if input.changes.iter().any(|c| !unique.insert((&c.kind,c.id,&c.permission))) { return Err(ApiError::bad("Duplicate permission change")); }
    if input.changes.len() > 1000 {''')
s=s.replace('    for change in input.changes {','''    let affected:Vec<Uuid>=if kind == "categories" {
        tx.query("SELECT id FROM core.channels WHERE community_id=$1 AND category_id=$2 AND sync_with_category", &[&community,&id]).await?.iter().map(|r|r.get(0)).collect()
    } else { vec![id] };
    let mut prior=Vec::new();
    if !owner {
        for channel in &affected {
            for p in crate::permission_registry::catalog().iter().filter(|p|p.overwrite && p.status=="enforced") {
                let allowed:bool=tx.query_one("SELECT allowed FROM core.permission_decisions($1,$2,$3,$4)", &[&community,channel,&p.key,&user.id]).await?.get(0);
                prior.push((*channel,p.key.clone(),allowed));
            }
        }
    }
    for change in input.changes {''')
# Neutral can remove a legacy incompatible entry, but never creates an incompatible overwrite.
s=s.replace('''        ) || !["role", "member"].contains(&change.kind.as_str())''','''        ) && !(change.state.is_none() && crate::permission_registry::catalog().iter().any(|p|p.key==change.permission && p.overwrite)) || !["role", "member"].contains(&change.kind.as_str())''')
s=s.replace('    let result = snapshot(&*tx, community, id, &kind).await?;', '''    // Neutral and category sync can reveal grants, so guard those paths too.
    for (channel,key,was_allowed) in prior {
        if !was_allowed && tx.query_one("SELECT allowed FROM core.permission_decisions($1,$2,$3,$4)", &[&community,&channel,&key,&user.id]).await?.get::<_,bool>(0) { return Err(ApiError::forbidden()); }
    }
    let result = snapshot(&*tx, community, id, &kind).await?;''')
# Advertise target management and grant capabilities directly from Rust.
s=s.replace('    let roles:Vec<Value>=', '''    let owner:bool=db.query_one("SELECT owner_id=$2 FROM core.communities WHERE id=$1", &[&community,&actor]).await?.get(0);
    let highest=authorization::get_highest_role(db,actor,community).await?.unwrap_or(0);
    let grantable:Vec<String>=db.query("SELECT p.key FROM core.permissions p JOIN LATERAL core.permission_decisions($1,$2,p.key,$3) d ON d.allowed", &[&community,&if kind=="channels" {Some(id)} else {None},&actor]).await?.iter().map(|r|r.get(0)).collect();
    let roles:Vec<Value>=''')
s=s.replace('"is_default":r.get::<_,bool>(4)', '"is_default":r.get::<_,bool>(4),"manageable":owner||r.get::<_,bool>(4)||r.get::<_,i32>(3)<highest')
s=s.replace('u.avatar_url FROM core.public_profiles', 'u.avatar_url,COALESCE((SELECT max(r.position) FROM core.member_roles mr JOIN core.roles r ON r.id=mr.role_id AND r.community_id=mr.community_id WHERE mr.community_id=$1 AND mr.user_id=u.id),0),EXISTS(SELECT 1 FROM core.communities c WHERE c.id=$1 AND c.owner_id=u.id) FROM core.public_profiles')
s=s.replace('"avatar_url":r.get::<_,Option<String>>(3)', '"avatar_url":r.get::<_,Option<String>>(3),"manageable":owner||(!r.get::<_,bool>(5)&&r.get::<_,i32>(4)<highest)')
s=s.replace('"children":children,"resource":info', '"grantable":grantable,"children":children,"resource":info')
s=s.replace('    kind: &str,\n) -> Result<Value, ApiError> {','    kind: &str,\n    actor: Uuid,\n) -> Result<Value, ApiError> {')
s=s.replace('snapshot(&**db, community, id, &kind)', 'snapshot(&**db, community, id, &kind, user.id)').replace('snapshot(&*tx, community, id, &kind)', 'snapshot(&*tx, community, id, &kind, user.id)')
p.write_text(s,encoding="utf-8")
