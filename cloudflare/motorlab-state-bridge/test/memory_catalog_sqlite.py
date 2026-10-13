"""LAB01 isolated SQLite smoke test; no Cloudflare API or production database."""
import re
import sqlite3
from pathlib import Path

module=(Path(__file__).parent.parent/'src'/'memory-catalog.mjs').read_text()
# The SQL constant is a JS string array: extract only the SQL statements.
lines=re.findall(r'^"(CREATE (?:TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS .+?)",?
assert len(lines)==5, 'unexpected schema count: '+str(len(lines))
schema='\n'.join(s+';' if not s.endswith(';') else s for s in lines)
with sqlite3.connect(':memory:') as db:
    db.execute('PRAGMA foreign_keys = ON')
    db.executescript("CREATE TABLE projects (project_id TEXT PRIMARY KEY); INSERT INTO projects VALUES ('MotorLab');")
    db.executescript("CREATE TABLE operation_events (event_id TEXT PRIMARY KEY); INSERT INTO operation_events VALUES ('baseline-event');")
    db.executescript("CREATE TABLE velocity_lessons (lesson_id TEXT PRIMARY KEY); INSERT INTO velocity_lessons VALUES ('baseline-lesson');")
    db.executescript(schema)
    db.executescript(schema)  # idempotent
    fields=('memory_id','project_id','scope','kind','memory_key','content','state','source_class','evidence_ref','approval_ref','valid_at','recorded_at')
    stmt='INSERT INTO memory_records ('+','.join(fields)+') VALUES ('+','.join('?' for _ in fields)+')'
    def record(i,t):
        return (i,'MotorLab','PROJECT','DECISION','infra.providers','Synthetic record '+i,'APPROVED','AUTHORITATIVE','lab01://test','lab01://approval',t,'2026-10-14T00:02:00Z')
    db.execute(stmt,record('old','2026-10-13T00:00:00Z'))
    db.execute(stmt,record('new','2026-10-14T00:01:00Z'))
    db.execute(stmt,record('third','2026-10-14T00:01:01Z'))
    db.execute("INSERT INTO memory_links VALUES ('new','old','REPLACES','lab01://test')")
    assert db.execute("SELECT COUNT(*) FROM memory_links").fetchone()[0]==1
    for sql in [
        "INSERT INTO memory_links VALUES ('old','old','RELATED_TO','lab01://test')",
        "INSERT INTO memory_links VALUES ('third','old','REPLACES','lab01://test')",
        "INSERT INTO memory_links VALUES ('unknown','old','RELATED_TO','lab01://test')"
    ]:
        try:
            db.execute(sql)
            raise AssertionError('invalid link allowed: '+sql)
        except sqlite3.IntegrityError:
            pass
    try:
        db.execute(stmt,('missing','unknown','PROJECT','DECISION','infra.providers','x','APPROVED','AUTHORITATIVE','lab01://x','lab01://x','2026-10-14T00:00:00Z','2026-10-14T00:00:00Z'))
        raise AssertionError('unknown project accepted')
    except sqlite3.IntegrityError:
        pass
    assert db.execute('SELECT event_id FROM operation_events').fetchone()[0]=='baseline-event'
    assert db.execute('SELECT lesson_id FROM velocity_lessons').fetchone()[0]=='baseline-lesson'
    print('PASS: SQLite schema idempotent, foreign keys, replacements, old operational data preserved')
,module,re.M)
assert len(lines)==5, 'unexpected schema count: '+str(len(lines))
schema='\n'.join(s+';' if not s.endswith(';') else s for s in lines)
with sqlite3.connect(':memory:') as db:
    db.execute('PRAGMA foreign_keys = ON')
    db.executescript("CREATE TABLE projects (project_id TEXT PRIMARY KEY); INSERT INTO projects VALUES ('MotorLab');")
    db.executescript("CREATE TABLE operation_events (event_id TEXT PRIMARY KEY); INSERT INTO operation_events VALUES ('baseline-event');")
    db.executescript("CREATE TABLE velocity_lessons (lesson_id TEXT PRIMARY KEY); INSERT INTO velocity_lessons VALUES ('baseline-lesson');")
    db.executescript(schema)
    db.executescript(schema)  # idempotent
    fields=('memory_id','project_id','scope','kind','memory_key','content','state','source_class','evidence_ref','approval_ref','valid_at','recorded_at')
    stmt='INSERT INTO memory_records ('+','.join(fields)+') VALUES ('+','.join('?' for _ in fields)+')'
    def record(i,t):
        return (i,'MotorLab','PROJECT','DECISION','infra.providers','Synthetic record '+i,'APPROVED','AUTHORITATIVE','lab01://test','lab01://approval',t,'2026-10-14T00:02:00Z')
    db.execute(stmt,record('old','2026-10-13T00:00:00Z'))
    db.execute(stmt,record('new','2026-10-14T00:01:00Z'))
    db.execute(stmt,record('third','2026-10-14T00:01:01Z'))
    db.execute("INSERT INTO memory_links VALUES ('new','old','REPLACES','lab01://test')")
    assert db.execute("SELECT COUNT(*) FROM memory_links").fetchone()[0]==1
    for sql in [
        "INSERT INTO memory_links VALUES ('old','old','RELATED_TO','lab01://test')",
        "INSERT INTO memory_links VALUES ('third','old','REPLACES','lab01://test')",
        "INSERT INTO memory_links VALUES ('unknown','old','RELATED_TO','lab01://test')"
    ]:
        try:
            db.execute(sql)
            raise AssertionError('invalid link allowed: '+sql)
        except sqlite3.IntegrityError:
            pass
    try:
        db.execute(stmt,('missing','unknown','PROJECT','DECISION','infra.providers','x','APPROVED','AUTHORITATIVE','lab01://x','lab01://x','2026-10-14T00:00:00Z','2026-10-14T00:00:00Z'))
        raise AssertionError('unknown project accepted')
    except sqlite3.IntegrityError:
        pass
    assert db.execute('SELECT event_id FROM operation_events').fetchone()[0]=='baseline-event'
    assert db.execute('SELECT lesson_id FROM velocity_lessons').fetchone()[0]=='baseline-lesson'
    print('PASS: SQLite schema idempotent, foreign keys, replacements, old operational data preserved')
