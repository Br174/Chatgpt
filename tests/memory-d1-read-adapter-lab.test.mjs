import test from 'node:test';
import assert from 'node:assert/strict';
import {readMemoryLab} from '../cloudflare/motorlab-state-bridge/lab/memory-d1-read-adapter.mjs';
const now='2026-10-14T12:00:00.000Z';
const item={id:'a',project_id:'MotorLab',status:'ACTIVE',summary:'continuita memoria',canonical_path:'rules/memory',evidence_ref:'git:1',source_authority:'GitHub',updated_at:now};
function fakeDb(tables,fail=false) {
 const calls=[];
 return {calls,prepare(sql) {
   const key=sql.includes('FROM memory_items_lab')?'items':sql.includes('FROM memory_relations_lab')?'relations':sql.includes('FROM memory_categories_lab')?'categories':sql.includes('FROM memory_item_categories_lab')?'itemCategories':'usage';
   const query={bind(...args){calls.push({key,args});return query},async all(){if(fail)throw new Error('no such table');return {results:tables[key]||[]}}};
   return query;
 }};
}
test('missing DB is unavailable not empty',async()=>assert.equal((await readMemoryLab(null,{projectId:'MotorLab'})).state,'UNAVAILABLE'));
test('project id required',async()=>assert.equal((await readMemoryLab(fakeDb({}),{})).state,'INVALID_REQUEST'));
test('schema missing is unavailable not empty',async()=>assert.equal((await readMemoryLab(fakeDb({},true),{projectId:'MotorLab'})).state,'UNAVAILABLE'));
test('reads valid memory from five tables',async()=>{
 const db=fakeDb({items:[item],relations:[],categories:[],itemCategories:[],usage:[{item_id:'a',retrieval_count:4}]});
 const result=await readMemoryLab(db,{projectId:'MotorLab',query:'memoria',now});
 assert.equal(result.state,'READY');assert.equal(result.items.length,1);assert.equal(result.items[0].retrieval_count,4);
 assert.equal(db.calls.length,4);assert(db.calls.every(x=>x.args[0]==='MotorLab'));
});
test('empty ready means successful query',async()=>{const x=await readMemoryLab(fakeDb({}),{projectId:'MotorLab',now});assert.equal(x.state,'READY');assert.deepEqual(x.items,[])});
test('category aliases parse safely',async()=>{
 const x=await readMemoryLab(fakeDb({items:[{...item,summary:'x',canonical_path:'x'}],categories:[{id:'c',label:'memory',aliases_json:'["ricordo"]'}],itemCategories:[{item_id:'a',category_id:'c'}]}),{projectId:'MotorLab',query:'ricordo',now});
 assert.equal(x.items[0].match,1);
});
test('malformed alias json cannot crash',async()=>{
 const x=await readMemoryLab(fakeDb({items:[item],categories:[{id:'c',label:'memory',aliases_json:'{'}],itemCategories:[{item_id:'a',category_id:'c'}]}),{projectId:'MotorLab',query:'memoria',now});
 assert.equal(x.state,'READY');
});
