// LAB-only WebAuthn approval challenge policy; no deployment, DB or credential registration.
const deny=()=>{throw Error("WEBAUTHN_CHALLENGE_DENIED");};
const hex=/^[a-f0-9]{64}$/;
export function validateApprovalChallengeLab({challenge,expected,now=Date.now()}={}){
 if(!challenge||!expected||!Number.isSafeInteger(now))deny();
 if(typeof expected.origin!=="string"||!expected.origin.startsWith("https://")||
    typeof expected.rpId!=="string"||!expected.rpId||
    typeof expected.operationId!=="string"||!expected.operationId||
    typeof expected.contentSha256!=="string"||!hex.test(expected.contentSha256))deny();
 if(typeof challenge.challenge!=="string"||!/^[A-Za-z0-9_-]{43,128}$/.test(challenge.challenge)||
    challenge.origin!==expected.origin||challenge.rpId!==expected.rpId||
    challenge.operationId!==expected.operationId||
    challenge.capability!=="github.lab-file-cycle"||
    challenge.branch!=="motorlab/pacman-execution-v2-lab-20261014"||
    challenge.path!=="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"||
    challenge.contentSha256!==expected.contentSha256||
    !Number.isSafeInteger(challenge.createdAt)||!Number.isSafeInteger(challenge.expiresAt)||
    challenge.createdAt>now||challenge.expiresAt<=now||
    challenge.expiresAt-challenge.createdAt>120000||
    challenge.consumed!==false)deny();
 return Object.freeze({operationId:challenge.operationId,contentSha256:challenge.contentSha256,expiresAt:challenge.expiresAt});
}
// This policy is NOT WebAuthn verification. The server must generate a CSPRNG
// challenge and atomically consume it, then verify signed authenticator data,
// clientDataJSON, origin, RP ID hash, flags, credential and counter.
