import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(p)=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('r35 closure counts all six main repos and four exact pending active LAB refs',async()=>{
 const [m,l,registry,policy]=await Promise.all([
 read('MOTORLAB_RELEASE_MANIFEST_V1.txt'),read('MOTORLAB_RELEASE_FANOUT_STATE_V1.txt'),
 read('MOTORLAB_PROJECT_INTEGRATION_REGISTRY_V1.txt'),read('MOTORLAB_RELEASE_FANOUT_V1.txt')
 ]);
 for(const v of ['CURRENT_RELEASE=2026.10.12-r35','FANOUT_STATE=COMPLETE','FANOUT_MAIN_VERIFIED=6/6','FANOUT_PENDING_SAFE_BOUNDARY=4'])assert.ok(m.includes(v),v);
 assert.match(l,/R35_GLOBAL_STATE=COMPLETE/);
 assert.match(l,/R35_CLOSURE_NOT_FULL_ADOPTION=TRUE/);
 assert.match(l,/R35_PENDING_SAFE_BOUNDARY_COUNT=4/);
 for(const repo of ['MusicLab','GeoVision-Test','StudyBook-AI','Visionflix','streamflix-BV','MotorAI'])
  assert.ok(l.includes('R35_MAIN_VERIFIED Br174/'+repo+' ref=main sha='),repo);
 const pending=l.match(/R35_PENDING_SAFE_BOUNDARY Br174\//g)||[];
 assert.equal(pending.length,4);
 for(const [repo,ref] of [['MusicLab','uab-build/musiclab-lab64-aggiornamento-family-01'],
 ['MusicLab','uab-build/musiclab-turbo-lab10-artwork-autovideo-family-02'],
 ['StudyBook-AI','lab/studybook-core-android-01-update-23'],
 ['MotorAI','lab/seed021r3r14-contrastive-two-stage']])
  assert.ok(l.includes('R35_PENDING_SAFE_BOUNDARY Br174/'+repo+' ref='+ref));
 assert.match(l,/R35_EXCLUDED_DORMANT=Br174\/Cover-Lab-AI/);
 assert.match(registry,/STATUS=DORMANT_RESERVED/);
 assert.match(policy,/PENDING_SAFE_BOUNDARY with exact repository\/ref\/reason/);
});
