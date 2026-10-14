#!/usr/bin/env node
// MotorLab NON-STOP: deterministic contract assertions; not end-to-end runtime tests.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const tests = [
 ['T01', 'MOTORLAB_RESUME_RECOVERY_V1.txt', /If the approved project outcome is NOT fully verified and execution control remains, immediately execute the next authorized safe ready action in the SAME turn/i],
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
// Whole-project regression assertions: prevent microtask-level terminal interpretation.
tests.push(
 ['P01', 'MOTORLAB_RESUME_RECOVERY_V1.txt', /ENTIRE user-approved project outcome/i],
 ['P02', 'MOTORLAB_RESUME_RECOVERY_V1.txt', /HANDOFF_COMPLETE means an actual durable approved executor/i],
 ['P03', 'MOTORLAB_EXECUTION_CONTINUITY_V1.txt', /one completed micro-task.*does NOT complete the project/i],
 ['P04', 'MOTORLAB_PROGRESS_REPORTING_V1.txt', /WHOLE-PROJECT COMPLETION PRECEDENCE/i],
 ['P05', 'checkpoints/MOTORLAB_NONSTOP_PROJECT_SCOPE_RULE_20261014.md', /Subtask success -> final response.*FAIL/i]
);
// Cross-module fanout: the same approved project remains the completion unit.
tests.push(
 ['F01','MOTORLAB_CORE_ENTRYPOINT_V1.txt',/WHOLE-PROJECT NON-STOP RULE/i],
 ['F02','MOTORLAB_REENTRY_GATE_V1.txt',/PROJECT-LEVEL RE-ENTRY/i],
 ['F03','MOTORLAB_VELOCITY_LAYER_V1.txt',/PROJECT-COMPLETION SCHEDULING/i],
 ['F04','MOTORLAB_EXECUTION_FABRIC_V1.txt',/WHOLE-PROJECT NON-STOP/i],
 ['F05','MOTORLAB_WATCHDOG_V1.txt',/PROJECT-LEVEL WATCHDOG/i],
 ['F06','MOTORLAB_LIVE_CONTROL_V1.txt',/PROJECT-LEVEL LIVE CONTROL/i],
 ['F07','MOTORLAB_FOREGROUND_STALL_GUARD_V1.txt',/WHOLE-PROJECT FOREGROUND PRECEDENCE/i],
 ['F08','MOTORLAB_BACKGROUND_EXECUTION_V1.txt',/PROJECT-LEVEL COMPLETION/i],
 ['F09','UAB_ENGINE_CONTRACT.txt',/completion of a single task.*not project completion/i],
 ['F10','UAB_GLOBAL_APK_POLICY.txt',/PROJECT-LEVEL TERMINATION/i],
 ['F11','MOTORLAB_RELEASE_MANIFEST_V1.txt',/NON-STOP PROJECT-SCOPE CANONICAL RULE/i]
);
tests.push(
 ['O01','MOTORLAB_PROJECT_CONTINUITY_V1.txt',/TURN\/OPERATION SEPARATION/i],
 ['O02','MOTORLAB_POLLICINO_CONTINUITY_V1.txt',/SESSION\/PROJECT DISTINCTION/i],
 ['O03','MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt',/NON-STOP PRECEDENCE/i]
);
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
