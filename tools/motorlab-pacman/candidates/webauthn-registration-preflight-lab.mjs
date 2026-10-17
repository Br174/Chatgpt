// LAB-only WebAuthn registration preflight, NOT a complete attestation verifier.
// A registration must ALSO parse attestationObject (CBOR), validate authData
// RP ID hash, UV, credential ID and COSE key, and enforce trust policy.
const deny=()=>{throw Error("WEBAUTHN_REGISTRATION_PREFLIGHT_DENIED");};
function decodeB64Url(s){
 if(typeof s!=="string"||s.length===0||s.length%4===1||
 !/^[A-Za-z0-9_-]+$/.test(s))deny();
 let bytes;try{const raw=s.replace(/-/g,"+").replace(/_/g,"/");bytes=Uint8Array.from(atob(raw+"=".repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0));}catch{deny();}
 // Canonical encoding prevents alternate representations.
 const canonical= btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
 if(canonical!==s)deny();
 return bytes;
}
export function verifyRegistrationClientDataLab({clientDataJSON,challenge,origin}={}){
 if(typeof challenge!=="string"||!challenge||typeof origin!=="string"||
 !origin.startsWith("https://")||origin.includes("#")||origin.includes("?"))deny();
 let raw,client;
 try{
  raw=decodeB64Url(clientDataJSON);
  client=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw));
 }catch{deny();}
 if(!client||Array.isArray(client)||client.type!=="webauthn.create"||
 client.challenge!==challenge||client.origin!==origin||
 client.crossOrigin===true||client.topOrigin!==undefined)deny();
 return Object.freeze({type:client.type,origin:client.origin,challenge:client.challenge,clientDataJSONBytes:raw});
}
// Never accept this preflight result alone as verified registration.
