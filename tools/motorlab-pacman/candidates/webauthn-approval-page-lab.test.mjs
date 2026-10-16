import test from "node:test";
import assert from "node:assert/strict";
import {renderWebAuthnApprovalPage} from "../webauthn/approval-page.mjs";

test("mobile approval page performs passkey approve-and-execute flow",()=>{
 const html=renderWebAuthnApprovalPage();
 assert.match(html,/Pac-Man · Autorizzazione passkey/);
 assert.match(html,/navigator\.credentials\.get/);
 assert.match(html,/\/webauthn\/approval\/start/);
 assert.match(html,/\/webauthn\/approval\/execute/);
 assert.match(html,/location\.hash\.slice\(1\)/);
 assert.match(html,/operation\.intent\.operationId/);
 assert.match(html,/operation\.intent\.branch/);
 assert.match(html,/operation\.intent\.path/);
 assert.match(html,/PACMAN_OPERATION_VERIFIED/);
});

test("mobile approval page does not send operation in navigation URL",()=>{
 const html=renderWebAuthnApprovalPage();
 assert.doesNotMatch(html,/location\.search|URLSearchParams\(location/);
 assert.match(html,/location\.hash/);
});
