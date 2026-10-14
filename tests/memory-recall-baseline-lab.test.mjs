import test from 'node:test';
import assert from 'node:assert/strict';
import {retrieveMemory} from '../cloudflare/motorlab-state-bridge/lab/memory-retrieval.mjs';
const now='2026-10-14T12:00:00.000Z';
const items=Array.from({length:30},(_,i)=>({
 id:'item-'+String(i).padStart(2,'0'),project_id:'MotorLab',kind:'FACT',
 canonical_path:'archive/general/'+i,summary:'archivio generico '+i,
 evidence_ref:'git:fixture-'+i,source_authority:'GitHub',importance:0.2,
 status:'ACTIVE',updated_at:'2026-01-01T00:00:00.000Z'
}));
items[17]={...items[17],canonical_path:'projects/motorlab/memory',summary:'memoria persistente gerarchica relazioni recupero',importance:0.8,updated_at:now};
items[18]={...items[18],canonical_path:'projects/motorlab/recovery',summary:'ripresa operazione checkpoint',importance:0.8,updated_at:now};
items[19]={...items[19],canonical_path:'projects/motorlab/rules',summary:'regola precedente sostituita',importance:0.9,updated_at:now};
items[20]={...items[20],canonical_path:'projects/motorlab/rules',summary:'regola attuale approvata',importance:0.9,updated_at:now};
const relations=[{from_id:'item-20',to_id:'item-19',relation_type:'SUPERSEDES',evidence_ref:'git:approval'}];
function search(query) {return retrieveMemory({items,relations,query,projectId:'MotorLab',now,limit:5})}
const fixtures=[
 {query:'memoria persistente gerarchica',expected:'item-17'},
 {query:'ripresa operazione checkpoint',expected:'item-18'},
 {query:'regola attuale approvata',expected:'item-20'},
 {query:'relazioni recupero',expected:'item-17'},
 {query:'checkpoint',expected:'item-18'}
];
test('baseline corpus has 30 candidates, not trivially all within top 5',()=>assert.equal(items.length,30));
test('recall at 5 for exact terms',()=>{
 const hits=fixtures.filter(f=>search(f.query).some(x=>x.id===f.expected)).length;
 assert.equal(hits,fixtures.length);
});
test('superseded approved rule is never returned',()=>assert(!search('regola precedente sostituita').some(x=>x.id==='item-19')));
test('cross-project isolation in baseline',()=>{
 const result=retrieveMemory({items:[...items,{...items[17],id:'foreign',project_id:'MusicLab',importance:1}],relations,query:'memoria persistente',projectId:'MotorLab',now,limit:30});
 assert(!result.some(x=>x.id==='foreign'));
});
test('precision at 5 remains a measurement, not a guaranteed quality claim',()=>{
 const top=search('memoria persistente gerarchica');
 const precision=top.filter(x=>x.id==='item-17').length/top.length;
 assert(precision>=0 && precision<=1);
});
