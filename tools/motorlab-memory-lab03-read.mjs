// Memory CORE LAB03: NEW PROCESS read-only recovery of local persistent SQLite.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {buildMemoryView,hotCapsule,masterBookChapters} from '../cloudflare/motorlab-state-bridge/src/memory-catalog.mjs';
import {recallVerifiedMemory} from '../cloudflare/motorlab-state-bridge/src/memory-github-lab02.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const dbPath=process.argv[2];
if(!dbPath||!resolve(dbPath).startsWith('/'))throw Error('absolute_local_db_required');
const py=resolve(here,'motorlab-memory-lab03-db.py');
const payload=JSON.parse(execFileSync('python3',[py,'export','--database',dbPath],{encoding:'utf8',timeout:15000,maxBuffer:500000}));
const view=buildMemoryView(payload.records,payload.links,{projectId:'MotorLab'});
if(view.conflicts.length)throw Error('ambiguous_memory_after_restart');
const hot=hotCapsule(view,{limit:20});
const book=masterBookChapters(view);
const snapshot={records:payload.records,links:payload.links};
const release=recallVerifiedMemory(snapshot,{query:'release',projectId:'MotorLab'});
const github=recallVerifiedMemory(snapshot,{query:'GitHub',projectId:'MotorLab'});
if(release.results[0]?.key!=='core.release'||github.results[0]?.key!=='authority.github')throw Error('reopened_database_recall_failed');
if(hot.length!==9||book.reduce((sum,c)=>sum+c.pages.length,0)!==9)throw Error('reopened_database_projection_mismatch');
process.stdout.write(JSON.stringify({
 state:'RESTORED_FROM_SQLITE_NEW_PROCESS',integrity:payload.integrity,
 records:payload.records.length,links:payload.links.length,provenance_links:payload.lineage.length,
 hot_capsule_entries:hot.length,master_book_pages:book.reduce((sum,c)=>sum+c.pages.length,0),
 recall:{release:release.results[0].key,github:github.results[0].key}
},null,2)+'\n');
