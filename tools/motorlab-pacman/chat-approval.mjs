// Approval intent for chat-controlled Pacman LAB actions.
// This is an authorization scope validator, not an OAuth or provider credential.
export const LAB_BRANCH="motorlab/pacman-execution-v2-lab-20261014";
export const LAB_PROBE="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
export function validateChatApproval(intent, approval) {
 if(!intent || intent.capability!=="github.lab-file-cycle" ||
    intent.branch!==LAB_BRANCH || intent.path!==LAB_PROBE ||
    typeof intent.operationId!=="string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/.test(intent.operationId))
   throw Error("INTENT_SCOPE_DENIED");
 if(!approval || approval.decision!=="authorize" ||
    approval.operationId!==intent.operationId ||
    approval.capability!==intent.capability ||
    approval.branch!==intent.branch || approval.path!==intent.path)
   throw Error("CHAT_APPROVAL_MISMATCH");
 return Object.freeze({operationId:intent.operationId,branch:LAB_BRANCH,path:LAB_PROBE,approval:true});
}
