from pathlib import Path
core=Path(__file__).resolve().parents[1].parent/"Core"
p=core/"src/channel_permissions.rs";s=p.read_text(encoding="utf-8")
start=s.index('    let mut prior = Vec::new();')
end=s.index('    for change in input.changes {',start)
s=s[:start]+'''    let keys:Vec<String>=crate::permission_registry::catalog().iter().filter(|p|p.overwrite&&p.status=="enforced").map(|p|p.key.clone()).collect();
    let prior:Vec<(Uuid,String,bool)>=if owner {vec![]} else {
        tx.query("SELECT ch.id,p.key,d.allowed FROM core.channels ch CROSS JOIN core.permissions p JOIN LATERAL core.permission_decisions($1,ch.id,p.key,$4) d ON true WHERE ch.id=ANY($2::uuid[]) AND p.key=ANY($3::text[])", &[&community,&affected,&keys,&user.id]).await?.iter().map(|r|(r.get(0),r.get(1),r.get(2))).collect()
    };
'''+s[end:]
start=s.index('    // Neutral and category sync can reveal grants')
end=s.index('    tx.commit().await?;',start)
s=s[:start]+'''    // Neutral and category sync can reveal grants, so guard those paths too.
    let denied_channels:Vec<Uuid>=prior.iter().filter(|(_,_,allowed)| !allowed).map(|(channel,_,_)|*channel).collect();
    let denied_keys:Vec<String>=prior.iter().filter(|(_,_,allowed)| !allowed).map(|(_,key,_)|key.clone()).collect();
    if !owner && tx.query_one("SELECT EXISTS(SELECT 1 FROM unnest($2::uuid[],$3::text[]) AS p(channel,key) JOIN LATERAL core.permission_decisions($1,p.channel,p.key,$4) d ON d.allowed)", &[&community,&denied_channels,&denied_keys,&user.id]).await?.get::<_,bool>(0) {return Err(ApiError::forbidden());}
    let result = snapshot(&*tx, community, id, &kind, user.id).await?;
    if !owner && input.sync==Some(true) {
        let old=before["entries"].as_array().unwrap();
        let next=result["entries"].as_array().unwrap();
        for entry in old.iter().chain(next.iter()) {
            let matches=|other: &&Value|other["kind"]==entry["kind"]&&other["id"]==entry["id"]&&other["permission"]==entry["permission"];
            let old_state=old.iter().find(matches).map(|e|e["state"].clone()).unwrap_or(Value::Null);
            let new_state=next.iter().find(matches).map(|e|e["state"].clone()).unwrap_or(Value::Null);
            if old_state==new_state {continue;}
            let target:Uuid=entry["id"].as_str().unwrap().parse().map_err(|_|ApiError::internal())?;
            if entry["kind"]=="role" {
                if !authorization::can_manage_role(&*tx,user.id,community,Some(target),None).await? {return Err(ApiError::forbidden());}
            } else {
                authorization::require_member(&*tx,target,community).await?;
                if authorization::get_highest_role(&*tx,target,community).await?.unwrap_or(0)>=highest {return Err(ApiError::forbidden());}
            }
            if new_state==true && !prior.iter().any(|(channel,key,allowed)|*channel==id&&entry["permission"]==*key&&*allowed) {return Err(ApiError::forbidden());}
        }
    }
'''+s[end:]
p.write_text(s,encoding="utf-8")
p=core/"src/invites.rs";s=p.read_text(encoding="utf-8").replace("core.permission_decisions($1,NULL,'channels.manage',$2)","core.permission_decisions($1,$3,'channels.manage',$2)");p.write_text(s,encoding="utf-8")
