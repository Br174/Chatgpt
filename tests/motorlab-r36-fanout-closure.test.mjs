import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(p)=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('r36 closes central transaction only with six verified main satellite refs and four explicit pending LABs',async()=>{
 const [m,l,reg]=await Promise.all([read('MOTORLAB_RELEASE_MANIFEST_V1.txt'),read('MOTORLAB_RELEASE_FANOUT_STATE_V1.txt'),read('MOTORLAB_PROJECT_INTEGRATION_REGISTRY_V1.txt')]);
 // Verify immutable r36 closure history without asserting it is still the current release.
 assert.match(m,/R36 FINAL RELEASE FANOUT ACCOUNTING/);
 assert.match(m,/All six ACTIVE main repos adopted r36/);
 // Current r38 top-level pending count is separate from immutable r36 history.
 assert.match(l,/R36_GLOBAL_STATE=COMPLETE/);
 assert.match(l,/R36_FANOUT_CLOSURE_NOT_TOTAL_LAB_ADOPTION=TRUE/);
 assert.match(l,/R36_PENDING_SAFE_BOUNDARY_COUNT=4/);
 for(const n of ['MusicLab','GeoVision-Test','StudyBook-AI','Visionflix','streamflix-BV','MotorAI'])assert.ok(l.includes('R36_MAIN_VERIFIED Br174/'+n+' ref=main sha='),n);
 assert.equal((l.match(/R36_PENDING_SAFE_BOUNDARY Br174\//g)||[]).length,4);
 for(const ref of ['uab-build/musiclab-lab64-aggiornamento-family-01','uab-build/musiclab-turbo-lab10-artwork-autovideo-family-02','lab/studybook-core-android-01-update-23','lab/seed021r3r14-contrastive-two-stage'])assert.ok(l.includes('ref='+ref));
 assert.match(l,/R36_EXCLUDED_DORMANT=Br174\/Cover-Lab-AI/);
 assert.match(reg,/GLOBAL_AUTO_UI_WARNING_UNVERIFIED=TRUE/);
});
