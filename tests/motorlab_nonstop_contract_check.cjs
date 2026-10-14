#!/usr/bin/env node
// MotorLab NON-STOP: deterministic contract assertions; not end-to-end runtime tests.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const tests = [
 ['T01', 'MOTORLAB_RESUME_RECOVERY_V1.txt', /If NOT complete and execution control remains, continue the same turn/i],
 ['T02', 'MOTORLAB_PROGRESS_REPORTING_V1.txt', /Never end a turn merely to show a percentage/i],
 ['T03', 'MOTORLAB_WATCHDOG_V1.txt', /Checkpoint creation is not a pause/i],
 ['T04', 'MOTORLAB_RESUME_RECOVERY_V1.txt', /latest verified checkpoint/i],
 ['T05', 'MOTORLAB_WATCHDOG_V1.txt', /healthy external waiting/i],
 ['T06', 'MOTORLAB_WATCHDOG_V1.txt', /third identical attempt is prohibited/i],
 ['T07', 'UAB_ENGINE_CONTRACT.txt', /approval/i],
 ['T08', 'MOTORLAB_WATCHDOG_V1.txt', /single.writer/i],
 ['T09', 'UAB_ENGINE_CONTRACT.txt', /cannot force a suspended ordinary ChatGPT/i],
 ['T10', 'MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt', /retire EVERY old contradictory path/i],
 ['T11', 'MOTORLAB_RELEASE_MANIFEST_V1.txt', /pin their complete MotorLab snapshot/i],
 ['T12', 'MOTORLAB_RESUME_RECOVERY_V1.txt', /VALID TURN TERMINATION STATES/i]
];
let failed=0;
for (const [id, file, pattern] of tests) {
  try {
    const ok=pattern.test(read(file));
    process.stdout.write((ok?'PASS':'FAIL')+' '+id+' '+file+'\n');
    if(!ok) failed++;
  } catch(e) {
    failed++;
    process.stderr.write('ERROR '+id+' '+e.message+'\n');
  }
}
process.stdout.write('Contract assertions: '+(tests.length-failed)+'/'+tests.length+' passed. Runtime E2E: NOT RUN.\n');
process.exitCode=failed?1:0;
