from pathlib import Path
core=Path(__file__).resolve().parents[1].parent/"Core"
p=core/"src/channel_permissions.rs";s=p.read_text(encoding="utf-8")
needle='        exercise_catalog_permissions(&state, &admin, community, channel, owner, member, role).await;'
assert needle in s
s=s.replace(needle,needle+'\n        exercise_channel_workflow(&state, &admin, community, channel, owner, role).await;')
pos=s.rfind('\n}')
s=s[:pos]+'''
    async fn exercise_channel_workflow(state:&AppState, admin:&tokio_postgres::Client, community:Uuid, channel:Uuid, owner:Uuid, everyone:Uuid) {
        let editor=Uuid::new_v4();let editor_role=Uuid::new_v4();
        admin.execute("INSERT INTO core.users(id,username,email,display_name) VALUES($1,'editor','editor@core.test','Editor')", &[&editor]).await.unwrap();
        admin.execute("INSERT INTO core.memberships(community_id,user_id) VALUES($1,$2)", &[&community,&editor]).await.unwrap();
        admin.execute("INSERT INTO core.roles(id,community_id,name,position) VALUES($1,$2,'Editor',10)", &[&editor_role,&community]).await.unwrap();
        admin.execute("INSERT INTO core.member_roles(community_id,user_id,role_id) VALUES($1,$2,$3)", &[&community,&editor,&editor_role]).await.unwrap();
        for key in ["channels.view","roles.manage","messages.send","messages.read_history","invites.create"] {
            admin.execute("INSERT INTO core.role_permissions(role_id,permission_key) VALUES($1,$2)", &[&editor_role,&key]).await.unwrap();
        }
        admin.execute("INSERT INTO core.channel_role_permissions(community_id,channel_id,role_id,permission_key,allowed) VALUES($1,$2,$3,'messages.send',false)", &[&community,&channel,&everyone]).await.unwrap();
        let Json(before)=ok(get(State(state.clone()),User{id:editor},Path((community,"channels".into(),channel))).await);
        assert!(before["grantable"].as_array().unwrap().iter().all(|p|p!="messages.send"));
        // Removing a Deny would grant the editor a missing privilege: roll back atomically.
        assert_eq!(save(State(state.clone()),User{id:editor},Path((community,"channels".into(),channel)),Json(Save{version:before["version"].as_str().unwrap().into(),sync:Some(false),changes:vec![Change{kind:"role".into(),id:everyone,permission:"messages.send".into(),state:None}]})).await.unwrap_err().status(),axum::http::StatusCode::FORBIDDEN);
        assert!(!admin.query_one("SELECT allowed FROM core.channel_role_permissions WHERE channel_id=$1 AND role_id=$2 AND permission_key='messages.send'", &[&channel,&everyone]).await.unwrap().get::<_,bool>(0));
        // Actual message creation uses the central channel decision.
        assert!(crate::api::send_message(State(state.clone()),User{id:editor},Path(channel),Json(serde_json::from_value(json!({"body":"Denied","client_nonce":Uuid::new_v4()})).unwrap())).await.is_err());
        let Json(owner_before)=ok(get(State(state.clone()),User{id:owner},Path((community,"channels".into(),channel))).await);
        let Json(updated)=ok(save(State(state.clone()),User{id:owner},Path((community,"channels".into(),channel)),Json(Save{version:owner_before["version"].as_str().unwrap().into(),sync:Some(false),changes:vec![Change{kind:"role".into(),id:everyone,permission:"messages.send".into(),state:None}]})).await);
        assert!(crate::api::send_message(State(state.clone()),User{id:editor},Path(channel),Json(serde_json::from_value(json!({"body":"Allowed","client_nonce":Uuid::new_v4()})).unwrap())).await.is_ok());
        assert_eq!(save(State(state.clone()),User{id:owner},Path((community,"channels".into(),channel)),Json(Save{version:owner_before["version"].as_str().unwrap().into(),sync:Some(false),changes:vec![]})).await.unwrap_err().status(),axum::http::StatusCode::CONFLICT);
        let repeated=Change{kind:"role".into(),id:everyone,permission:"messages.send".into(),state:Some(true)};
        assert_eq!(save(State(state.clone()),User{id:owner},Path((community,"channels".into(),channel)),Json(Save{version:updated["version"].as_str().unwrap().into(),sync:Some(false),changes:vec![Change{kind:repeated.kind.clone(),id:repeated.id,permission:repeated.permission.clone(),state:repeated.state},repeated]})).await.unwrap_err().status(),axum::http::StatusCode::BAD_REQUEST);
        // A server-granted invite permission is still constrained by channel overrides and visibility.
        let mut security=SecurityConfig::new(BetterAuthConfig::new("http://127.0.0.1:1/api/auth").unwrap());security.frontend_origin=Some("https://core.test".into());
        let invites=AppState::new(state.pool.clone(),security).unwrap();
        let input=||serde_json::from_value(json!({"channel_id":channel,"expires_in_seconds":3600,"max_uses":5})).unwrap();
        let (_,Json(created))=ok(crate::invites::create(State(invites.clone()),User{id:editor},Path(community),Json(input())).await);
        let invite_id:Uuid=created["id"].as_str().unwrap().parse().unwrap();
        assert_eq!(admin.query_one("SELECT channel_id FROM core.community_invites WHERE id=$1", &[&invite_id]).await.unwrap().get::<_,Uuid>(0),channel);
        admin.execute("INSERT INTO core.channel_role_permissions(community_id,channel_id,role_id,permission_key,allowed) VALUES($1,$2,$3,'invites.create',false)", &[&community,&channel,&everyone]).await.unwrap();
        assert_eq!(crate::invites::create(State(invites.clone()),User{id:editor},Path(community),Json(input())).await.unwrap_err().status(),axum::http::StatusCode::FORBIDDEN);
        admin.execute("DELETE FROM core.channel_role_permissions WHERE channel_id=$1 AND permission_key='invites.create'", &[&channel]).await.unwrap();
        admin.execute("INSERT INTO core.channel_member_permissions(community_id,channel_id,user_id,permission_key,allowed) VALUES($1,$2,$3,'channels.view',false)", &[&community,&channel,&editor]).await.unwrap();
        assert!(crate::invites::create(State(invites.clone()),User{id:editor},Path(community),Json(input())).await.is_err());
        assert!(crate::invites::create(State(invites),User{id:owner},Path(Uuid::new_v4()),Json(input())).await.is_err());
        assert_eq!(admin.query_one("SELECT count(*) FROM core.community_invites WHERE channel_id=$1", &[&channel]).await.unwrap().get::<_,i64>(0),1);
    }
'''+s[pos:]
p.write_text(s,encoding="utf-8")
