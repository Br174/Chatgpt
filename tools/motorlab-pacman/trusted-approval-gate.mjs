import {validateChatApproval} from "./chat-approval.mjs";
import {verifyApprovalAttestation} from "./approval-attestation.mjs";
import {claimSingleUseApproval} from "./approval-single-use.mjs";
// Call only after an authenticated trusted-host issuer has been established.
// Claim is atomic and occurs before any GitHub side effect.
export async function verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db,now}={}){
 validateChatApproval(intent,approval);
 await verifyApprovalAttestation({intent,attestation,secret,now});
 return claimSingleUseApproval(db,attestation,{now});
}
