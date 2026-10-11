#!/usr/bin/env python3
"""Offline compatibility test. No Cloudflare deployment or billable calls."""
import sqlite3,re
from pathlib import Path
base=Path(__file__).resolve().parents[1]
source=(base/"src/schema.js").read_text()
tick=chr(96)
m=re.search("export const SCHEMA_SQL = "+tick+"(.+?)"+tick+";",source,re.S)
assert m,"Existing core schema unavailable"
db=sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(m.group(1))
sql=(base/"migrations/motorlab-global-memory-v1.sql").read_text()
db.executescript(sql)
db.executescript(sql) # safe and idempotent
db.execute("INSERT INTO projects(project_id,repository,lifecycle_stage,updated_at) VALUES(?,?,?,?)",("musiclab","Br174/MusicLab","LAB","2026-10-11"))
for k,c in (("defect","PROBLEM"),("fix","FIX"),("proof","TEST")):
 db.execute("INSERT INTO knowledge_items(id,project_id,category,summary,source_repo,source_ref,source_sha,content_hash,observed_at,valid_from,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
 (k,"musiclab",c,k,"Br174/MusicLab","lab/x","sha-"+k,"hash-"+k,"2026-10-11","2026-10-11","2026-10-11","2026-10-11"))
db.execute("INSERT INTO knowledge_links(id,from_id,to_id,relation,created_at) VALUES(?,?,?,?,?)",("e","defect","fix","FIXED_BY","2026-10-11"))
assert db.execute("SELECT verification FROM knowledge_links WHERE id='e'").fetchone()[0]=="PROPOSED"
db.execute("INSERT INTO knowledge_timeline(id,item_id,event_type,actor,reason,created_at) VALUES(?,?,?,?,?,?)",("t","fix","REVIEWED","human","needs test","2026-10-11"))
db.execute("INSERT INTO team_rooms(id,project_id,name,created_at) VALUES('r','musiclab','MusicLab','2026-10-11')")
db.execute("INSERT INTO team_members(room_id,principal_id,role,joined_at) VALUES('r','user','OWNER','2026-10-11')")
db.execute("INSERT INTO team_messages(id,room_id,run_id,author_id,target_id,kind,body,source,created_at) VALUES('m1','r','run1','user','Analista','USER','Question','USER','2026-10-11')")
db.execute("INSERT INTO team_messages(id,room_id,run_id,author_id,target_id,kind,body,source,parent_id,created_at) VALUES('m2','r','run1','Analista','Tester','HANDOFF','Proposal','GEMINI','m1','2026-10-11')")
assert db.execute("SELECT parent_id FROM team_messages WHERE id='m2'").fetchone()[0]=="m1"
def must_fail(query):
 try: db.execute(query)
 except sqlite3.IntegrityError:return
 raise AssertionError("Integrity control failed")
must_fail("INSERT INTO knowledge_links(id,from_id,to_id,relation,created_at) VALUES('bad','defect','defect','SIMILAR_TO','2026')")
must_fail("INSERT INTO team_messages(id,room_id,run_id,author_id,target_id,kind,body,source,created_at) VALUES('bad','missing','run','x','y','AGENT','x','x','2026')")
must_fail("UPDATE knowledge_items SET valid_to='2010-01-01' WHERE id='fix'")
print("GLOBAL MEMORY SCHEMA PASS: original D1 schema, additive idempotency, relations, temporal integrity, agent handoff and foreign keys.")
