from pathlib import Path
core=Path(__file__).resolve().parents[1].parent/"Core"
p=core/"src/channel_permissions.rs";s=p.read_text(encoding="utf-8")
needle="        // A server-granted invite permission is still constrained by channel overrides and visibility."
assert needle in s
s=s.replace(needle,'''        // Sync cannot be used as an alternative path to grant oneself a denied permission.
        let category=Uuid::new_v4(); let independent=Uuid::new_v4();
        admin.execute("INSERT INTO core.channel_categories(id,community_id,name) VALUES($1,$2,'Workflow category')", &[&category,&community]).await.unwrap();
        admin.execute("INSERT INTO core.category_role_permissions(community_id,category_id,role_id,permission_key,allowed) VALUES($1,$2,$3,'messages.send',true)", &[&community,&category,&everyone]).await.unwrap();
        admin.execute("UPDATE core.channels SET category_id=$2,sync_with_category=false WHERE id=$1", &[&channel,&category]).await.unwrap();
        admin.execute("INSERT INTO core.channels(id,community_id,name,category_id,sync_with_category) VALUES($1,$2,'Independent',$3,false)", &[&independent,&community,&category]).await.unwrap();
        admin.execute("INSERT INTO core.channel_role_permissions(community_id,channel_id,role_id,permission_key,allowed) VALUES($1,$2,$3,'messages.send',false)", &[&community,&channel,&everyone]).await.unwrap();
        let Json(before_sync)=ok(get(State(state.clone()),User{id:editor},Path((community,"channels".into(),channel))).await);
        assert_eq!(save(State(state.clone()),User{id:editor},Path((community,"channels".into(),channel)),Json(Save{version:before_sync["version"].as_str().unwrap().into(),sync:Some(true),changes:vec![]})).await.unwrap_err().status(),axum::http::StatusCode::FORBIDDEN);
        assert!(!admin.query_one("SELECT sync_with_category FROM core.channels WHERE id=$1", &[&channel]).await.unwrap().get::<_,bool>(0));
        // Owner synchronization succeeds; category edits affect only synced children.
        let Json(owner_sync)=ok(get(State(state.clone()),User{id:owner},Path((community,"channels".into(),channel))).await);
        let _=ok(save(State(state.clone()),User{id:owner},Path((community,"channels".into(),channel)),Json(Save{version:owner_sync["version"].as_str().unwrap().into(),sync:Some(true),changes:vec![]})).await);
        let Json(category_snapshot)=ok(get(State(state.clone()),User{id:owner},Path((community,"categories".into(),category))).await);
        let _=ok(save(State(state.clone()),User{id:owner},Path((community,"categories".into(),category)),Json(Save{version:category_snapshot["version"].as_str().unwrap().into(),sync:None,changes:vec![Change{kind:"role".into(),id:everyone,permission:"messages.send".into(),state:Some(false)}]})).await);
        assert!(!admin.query_one("SELECT allowed FROM core.permission_decisions($1,$2,'messages.send',$3)", &[&community,&channel,&editor]).await.unwrap().get::<_,bool>(0));
        assert!(admin.query_one("SELECT allowed FROM core.permission_decisions($1,$2,'messages.send',$3)", &[&community,&independent,&editor]).await.unwrap().get::<_,bool>(0));
        let Json(synced_snapshot)=ok(get(State(state.clone()),User{id:owner},Path((community,"channels".into(),channel))).await);
        let _=ok(save(State(state.clone()),User{id:owner},Path((community,"channels".into(),channel)),Json(Save{version:synced_snapshot["version"].as_str().unwrap().into(),sync:Some(false),changes:vec![Change{kind:"role".into(),id:everyone,permission:"messages.send".into(),state:None}]})).await);
        assert!(!admin.query_one("SELECT sync_with_category FROM core.channels WHERE id=$1", &[&channel]).await.unwrap().get::<_,bool>(0));
        assert!(admin.query_one("SELECT allowed FROM core.permission_decisions($1,$2,'messages.send',$3)", &[&community,&channel,&editor]).await.unwrap().get::<_,bool>(0));
        // A server-granted invite permission is still constrained by channel overrides and visibility.''')
p.write_text(s,encoding="utf-8")
