// LAB-only bootstrap proof consumption adapter. Requires caller-provided
// atomic durable claim implementation. No D1 writes or deployment here.
const deny=()=>{throw new Error("BOOTSTRAP_CLAIM_DENIED");};
export async function consumeVerifiedBootstrapLab({verifiedProof,expectedOwner,claimOnce,now=Date.now()}={}){
 if(!verifiedProof||typeof expectedOwner!=="string"||!expectedOwner||
    verifiedProof.ownerId!==expectedOwner||
    typeof verifiedProof.nonce!=="string"||verifiedProof.nonce.length<32||
    !Number.isSafeInteger(verifiedProof.expiresAt)||verifiedProof.expiresAt<=now||
    typeof claimOnce!=="function")deny();
 let claimed=false;
 try{claimed=await claimOnce({purpose:"pacman.webauthn.enroll.v1",ownerId:expectedOwner,nonce:verifiedProof.nonce,expiresAt:verifiedProof.expiresAt});}
 catch{deny();}
 if(claimed!==true)deny();
 return Object.freeze({ownerId:expectedOwner,nonce:verifiedProof.nonce,claimed:true});
}
// claimOnce must perform a unique-key insert transaction atomically.
// Never pass an unverified client payload as verifiedProof.
