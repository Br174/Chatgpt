import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(name)=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('one existing routing owner, Re-entry is only the caller',async()=>{
 const [route,reentry,guard,plan]=await Promise.all([
 read('UAB_PROJECT_ROUTING.txt'),read('MOTORLAB_REENTRY_GATE_V1.txt'),
 read('MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt'),read('MOTORLAB_PIANO_UNICO_2026_10_12.md')]);
 assert.match(route,/Sole owner of chat\/project target routing: THIS UAB_PROJECT_ROUTING contract/);
 assert.match(reentry,/apply the canonical UAB_PROJECT_ROUTING\.txt CHAT CONTEXT GUARD/);
 assert.match(route,/not a scheduler, process, independent classifier service, database/);
 assert.match(route,/MOTORLAB_CORE_SELF_CHANGE/);
 assert.match(route,/CURRENT_PROJECT_CHANGE/);
 assert.match(route,/OTHER_PROJECT_CHANGE/);
 assert.match(route,/EXPLANATION_ONLY/);
 assert.match(guard,/ONE RESPONSIBILITY = ONE ACTIVE COORDINATOR/);
 assert.match(plan,/FASE 1 — FONDAMENTA/);
 assert.match(plan,/FASE 7 — INDIPENDENZA/);
});

test('negative warning routing examples: use of MotorLab inside the right project never triggers context alert',async()=>{
 const s=await read('UAB_PROJECT_ROUTING.txt');
 for(const example of [
 'MusicLab chat + "MotorLab accelerate MusicLab covers" => CURRENT_PROJECT_CHANGE => NO_WARNING',
 'GeoVision chat + "Use MotorLab to configure GeoVision" => CURRENT_PROJECT_CHANGE => NO_WARNING',
 'MotorLab administration chat + "Change CORE MotorLab" => MOTORLAB_CORE_SELF_CHANGE => NO_WARNING',
 'Any chat + "Explain how MotorLab works" => EXPLANATION_ONLY => NO_WARNING',
 'Explicit approved transfer of a pending operation to this chat => RESUME_IN_NEW_CHAT_WITH_CHECKPOINT, NO_REPEAT'
 ])assert.ok(s.includes(example), 'missing negative example: '+example);
 assert.match(s,/never warn solely because MotorLab is mentioned or used to change the current project/i);
});

test('positive warning routing examples and protected no-migration principle remain',async()=>{
 const s=await read('UAB_PROJECT_ROUTING.txt');
 assert.match(s,/MusicLab chat \+ "Change CORE MotorLab central release\/guard" => MOTORLAB_CORE_SELF_CHANGE => RECOMMEND_MOTORLAB_CHAT/);
 assert.match(s,/MusicLab chat \+ "Change GeoVision native app" => OTHER_PROJECT_CHANGE => RECOMMEND_GEOVISION_CHAT/);
 assert.match(s,/must not be required to migrate manually to another conversation/);
 assert.match(s,/explicitly chosen cross-chat transfer by operation_id\/checkpoint/);
 assert.match(s,/does not add a scheduler/);
 assert.match(s,/If CURRENT_CHAT_PROJECT is reliable/);
 assert.match(s,/without accessible chat\/project identity/);
});
