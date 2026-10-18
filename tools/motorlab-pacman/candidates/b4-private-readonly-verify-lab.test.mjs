import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPrivateSchemaAudit,getPrivateSchemaAuditOnce} from './b4-private-readonly-verify-lab.mjs';
const url='https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev/__motorlab_lab/diagnostics/execution-schema-audit';
const key='test-only-not-real-key-12345678901234567890';
const body={component:'pacmanExecutionReadOnlySchemaAudit',schema:'EXACT',controlledLedgerSchema:'EXACT'};
test('positive exact schema and component',()=>assert.deepEqual(verifyPrivateSchemaAudit({status:200,body}),{ok:true,reason:'PRIVATE_EXECUTION_SCHEMA_EXACT'}));
for(const [status,reason] of [[401,'UNAUTHORIZED'],[403,'FORBIDDEN'],[429,'RATE_LIMIT'],[503,'WORKER_UNAVAILABLE'],[302,'HTTP_OR_REDIRECT_DENIED'],[500,'HTTP_OR_REDIRECT_DENIED']])
test('negative HTTP '+status,()=>assert.equal(verifyPrivateSchemaAudit({status,body}).reason,reason));
for(const [bad,reason] of [[null,'INVALID_RESPONSE'],[[],'INVALID_RESPONSE'],[{...body,component:'OTHER'},'WRONG_COMPONENT'],[{...body,schema:'WRONG'},'SCHEMA_MISMATCH'],[{...body,controlledLedgerSchema:'WRONG'},'SCHEMA_MISMATCH']])
test('negative schema or type '+reason,()=>assert.equal(verifyPrivateSchemaAudit({status:200,body:bad}).reason,reason));
test('exact allowlisted url only, no network on wrong URL',async()=>{let c=0;let x=await getPrivateSchemaAuditOnce({url:url+'?a=1',key,fetchImpl:()=>{c++}});assert.equal(x.reason,'ENDPOINT_NOT_ALLOWLISTED');assert.equal(c,0)});
test('reject missing protected key before fetch',async()=>{let c=0;const x=await getPrivateSchemaAuditOnce({url,key:'',fetchImpl:()=>{c++}});assert.equal(x.reason,'KEY_UNAVAILABLE');assert.equal(c,0)});
test('single GET and no redirects, no raw result',async()=>{let c=0;const x=await getPrivateSchemaAuditOnce({url,key,fetchImpl:async(u,o)=>{c++;assert.equal(u,url);assert.equal(o.method,'GET');assert.equal(o.redirect,'manual');assert.equal(o.headers.Authorization,'Bearer '+key);return {status:200,text:async()=>JSON.stringify({...body,token:'must-not-appear'})}}});assert.equal(c,1);assert.deepEqual(x,{ok:true,reason:'PRIVATE_EXECUTION_SCHEMA_EXACT'});assert.equal(JSON.stringify(x).includes('must-not-appear'),false)});
test('no retry on transport failure',async()=>{let c=0;const x=await getPrivateSchemaAuditOnce({url,key,fetchImpl:()=>{c++;throw Error('private transport secret')}});assert.equal(c,1);assert.equal(x.reason,'NETWORK_OR_TIMEOUT')});
test('oversized body fails closed',async()=>{let x=await getPrivateSchemaAuditOnce({url,key,fetchImpl:async()=>({status:200,text:async()=>''.padEnd(5000,'X')})});assert.equal(x.reason,'BODY_TOO_LARGE')});
test('invalid JSON fails closed',async()=>{let x=await getPrivateSchemaAuditOnce({url,key,fetchImpl:async()=>({status:200,text:async()=>'<html>'})});assert.equal(x.reason,'INVALID_JSON')});
