import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileTurnEnd, recoverOperation, reconcileProgressUpdate} from './nonstop-state.mjs';
const base = {id:'op-1',status:'OPEN',verifiedProgress:40,nextSafeStep:'test'};
test('turn end does not complete operation',()=>{const x=reconcileTurnEnd(base,{});assert.equal(x.status,'OPEN');assert.equal(x.nextSafeStep,'test')});
test('microtask 100 percent cannot complete without acceptance',()=>assert.equal(reconcileTurnEnd({...base,verifiedProgress:100},{},{acceptanceVerified:false}).status,'OPEN'));
test('verified whole project completes',()=>assert.equal(reconcileTurnEnd({...base,verifiedProgress:100},{},{acceptanceVerified:true,allRequiredChecksPassed:true}).status,'COMPLETED'));
test('user stop respected',()=>assert.equal(reconcileTurnEnd(base,{userStop:true}).status,'PAUSED_BY_USER'));
test('no fake durable handoff',()=>assert.equal(reconcileTurnEnd(base,{},{durableExecutorAccepted:true}).status,'OPEN'));
test('verified durable handoff',()=>assert.equal(reconcileTurnEnd(base,{},{durableExecutorAccepted:true,executorJobId:'job-1',executorPersisted:true}).status,'RUNNING_EXTERNAL'));
test('monotonic progress',()=>assert.equal(recoverOperation(base,{verifiedProgress:55}).verifiedProgress,55));
test('stale checkpoint cannot lower floor',()=>assert.equal(recoverOperation(base,{verifiedProgress:10}).verifiedProgress,40));
test('identity mismatch rejected',()=>assert.throws(()=>recoverOperation(base,{id:'other'})));
test('blocked external preserved',()=>assert.equal(reconcileTurnEnd({...base,status:'BLOCKED_EXTERNAL'},{}).status,'BLOCKED_EXTERNAL'));

test('user pause survives re-entry',()=>assert.equal(recoverOperation({...base,status:'PAUSED_BY_USER'},{}).status,'PAUSED_BY_USER'));
test('running external job is not duplicated on re-entry',()=>assert.equal(recoverOperation({...base,status:'RUNNING_EXTERNAL'},{}).status,'RUNNING_EXTERNAL'));
test('external blocker remains blocked on re-entry',()=>assert.equal(recoverOperation({...base,status:'BLOCKED_EXTERNAL'},{}).status,'BLOCKED_EXTERNAL'));

test('progress explanation never ends active turn',()=>{const x=reconcileProgressUpdate(base,{verifiedProgress:50,explanation:'phase complete'});assert.equal(x.status,'OPEN');assert.equal(x.turnState,'ACTIVE');assert.equal(x.nextSafeStep,'test');assert.equal(x.verifiedProgress,50)});
test('100 percent intermediate status is not project acceptance',()=>{const x=reconcileProgressUpdate(base,{verifiedProgress:100});assert.equal(x.status,'OPEN');assert.notEqual(x.turnState,'TURN_ENDED')});
test('status cannot resume user-paused operation',()=>assert.equal(reconcileProgressUpdate({...base,status:'PAUSED_BY_USER'},{}).status,'PAUSED_BY_USER'));
test('stale progress report does not lower verified floor',()=>assert.equal(reconcileProgressUpdate(base,{verifiedProgress:5}).verifiedProgress,40));
