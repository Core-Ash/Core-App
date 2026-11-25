"""Run Rust permission integration tests in a fresh loopback-only cluster."""
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import shutil
import uuid

core=Path(__file__).resolve().parents[1].parent/"Core"
base=(core/"target").resolve()
cluster=(base/("permissions-postgres-"+uuid.uuid4().hex)).resolve()
assert cluster.is_relative_to(base) and cluster!=base
cluster.mkdir()
pg=Path(r"C:\Program Files\PostgreSQL\17\bin")
flags=subprocess.CREATE_NO_WINDOW if os.name=="nt" else 0
def run(args, env=None):
    with tempfile.TemporaryFile() as output:
        result=subprocess.run(args,cwd=core,env=env,stdout=output,stderr=subprocess.STDOUT,creationflags=flags)
        output.seek(0)
        print(output.read().decode(errors="replace"),end="",flush=True)
        if result.returncode: raise RuntimeError(f"{Path(args[0]).name} failed ({result.returncode})")
started=False
try:
    run([str(pg/"initdb.exe"),"-D",str(cluster/"data"),"-U","core_permissions_admin","--auth=trust","--encoding=UTF8","--no-locale"])
    with socket.socket() as sock:
        sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
    run([str(pg/"pg_ctl.exe"),"-D",str(cluster/"data"),"-l",str(cluster/"postgres.log"),"-w","start","-o",f"-h 127.0.0.1 -p {port}"])
    started=True
    run([str(pg/"createdb.exe"),"-h","127.0.0.1","-p",str(port),"-U","core_permissions_admin","core_permissions_test_catalog"])
    run([str(pg/"createdb.exe"),"-h","127.0.0.1","-p",str(port),"-U","core_permissions_admin","core_permissions_test_upgrade"])
    upgrade = "CREATE SCHEMA auth; CREATE TABLE auth.\"user\"(id text PRIMARY KEY,name text,image text);\n"
    paths = sorted((core/"migrations").glob("*.sql"))
    upgrade += "\n".join(p.read_text(encoding="utf-8") for p in paths if p.name < "0017")
    upgrade += """
INSERT INTO core.users(id,username,email,display_name) VALUES('00000000-0000-0000-0000-000000000001','owner','owner@test.local','Owner');
INSERT INTO core.communities(id,name,owner_id) VALUES('00000000-0000-0000-0000-000000000002','Upgrade','00000000-0000-0000-0000-000000000001');
INSERT INTO core.memberships(community_id,user_id) VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
INSERT INTO core.roles(id,community_id,name,is_default) VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','@everyone',true);
INSERT INTO core.role_permissions(role_id,permission_key) VALUES('00000000-0000-0000-0000-000000000003','channels.view'),('00000000-0000-0000-0000-000000000003','messages.send');
CREATE TEMP TABLE old_grants ON COMMIT DROP AS SELECT * FROM core.role_permissions;
"""
    upgrade += "\n".join(p.read_text(encoding="utf-8") for p in paths if p.name >= "0017")
    upgrade += """
DO $$ BEGIN
 IF EXISTS ((SELECT * FROM core.role_permissions EXCEPT SELECT * FROM old_grants) UNION ALL (SELECT * FROM old_grants EXCEPT SELECT * FROM core.role_permissions)) THEN RAISE EXCEPTION 'Migration changed existing grants'; END IF;
 IF EXISTS(SELECT 1 FROM core.role_permissions WHERE permission_key='messages.read_history') THEN RAISE EXCEPTION 'Migration granted history implicitly'; END IF;
END $$;
"""
    sql_file=cluster/"upgrade.sql"
    sql_file.write_text(upgrade,encoding="utf-8")
    run([str(pg/"psql.exe"),"-h","127.0.0.1","-p",str(port),"-U","core_permissions_admin","-d","core_permissions_test_upgrade","-v","ON_ERROR_STOP=1","--single-transaction","-q","-f",str(sql_file)])
    print("Migration upgrade preserves existing role grants.",flush=True)
    env=os.environ.copy()
    env["CORE_PERMISSIONS_TEST_DATABASE_URL"]=f"host=127.0.0.1 port={port} user=core_permissions_admin dbname=core_permissions_test_catalog"
    run(["cargo","test","--locked","--target-dir","target/permissions-build","permission_saves_work_without_override_update_privileges","--","--ignored","--nocapture"],env)
    for name, variable, test in [
        ("core_events_test_catalog", "CORE_EVENT_TEST_DATABASE_URL", "postgres_events_permissions_persistence_idempotency_and_scope"),
        ("core_invites_test_catalog", "CORE_INVITE_TEST_DATABASE_URL", "postgres_invitation_transactions_and_permissions"),
    ]:
        run([str(pg/"createdb.exe"),"-h","127.0.0.1","-p",str(port),"-U","core_permissions_admin",name])
        env[variable]=f"host=127.0.0.1 port={port} user=core_permissions_admin dbname={name}"
        run(["cargo","test","--locked","--target-dir","target/permissions-build",test,"--","--ignored","--nocapture"],env)
finally:
    if started:
        run([str(pg/"pg_ctl.exe"),"-D",str(cluster/"data"),"-w","-m","immediate","stop"])
    if cluster.is_relative_to(base) and cluster!=base:
        shutil.rmtree(cluster)
        print("Disposable local permission database removed.")
