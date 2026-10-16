// LAB-only strict CBOR attestationObject parser for WebAuthn "none".
// Parses the outer object only; authenticatorData and COSE need separate checks.
const fail=()=>{throw Error("INVALID_ATTESTATION_OBJECT");};
export function parseNoneAttestationObjectLab(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input instanceof ArrayBuffer?input:fail());
 if(b.length<4||b.length>16384)fail();
 let p=0;
 const read=()=>{if(p>=b.length)fail();return b[p++];};
 const length=(ai)=>{
  if(ai<24)return ai;
  if(ai===24){const n=read();if(n<24)fail();return n;}
  if(ai===25){const n=(read()<<8)|read();if(n<=255)fail();return n;}
  fail();
 };
 const head=major=>{const v=read();if((v>>5)!==major)fail();return length(v&31);};
 const str=()=>{const n=head(3);if(n>64||p+n>b.length)fail();const bytes=b.subarray(p,p+n);p+=n;
  const value=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  if(new TextEncoder().encode(value).length!==n)fail();return value;};
 const bytes=()=>{const n=head(2);if(n>8192||p+n>b.length)fail();const value=b.slice(p,p+n);p+=n;return value;};
 const entries=head(5);if(entries!==3)fail();
 const seen=new Set();let fmt,authData,statement;
 for(let i=0;i<entries;i++){
  const key=str();if(seen.has(key))fail();seen.add(key);
  if(key==="fmt")fmt=str();
  else if(key==="authData")authData=bytes();
  else if(key==="attStmt"){if(head(5)!==0)fail();statement=true;}
  else fail();
 }
 if(fmt!=="none"||!statement||!(authData instanceof Uint8Array)||p!==b.length)fail();
 return Object.freeze({fmt,authData});
}
// Does NOT independently validate owner identity, RP ID, clientDataJSON,
// credential public key, or authenticatorData. Do not deploy as full verifier.
