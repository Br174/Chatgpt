// LAB-only strict minimal CBOR/COSE EC2 P-256 public-key decoder.
// Decodes one exact CBOR map, rejects indefinite lengths, duplicates, tags,
// trailing data, noncanonical integer/length encodings and unsupported algorithms.
const deny=()=>{throw Error("WEBAUTHN_COSE_KEY_INVALID");};
export function decodeCoseP256PublicKeyLab(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>1024)deny();
 let pos=0;
 function arg(){
  if(pos>=bytes.length)deny();
  const b=bytes[pos++],major=b>>5,ai=b&31;
  let n;
  if(ai<24)n=ai;
  else if(ai===24){if(pos>=bytes.length)deny();n=bytes[pos++];if(n<24)deny();}
  else if(ai===25){if(pos+2>bytes.length)deny();n=(bytes[pos]<<8)|bytes[pos+1];pos+=2;if(n<=255)deny();}
  else deny();
  return {major,n};
 }
 const map=arg();if(map.major!==5||map.n!==5)deny();
 const values=new Map();
 for(let i=0;i<map.n;i++){
  const key=arg();if(key.major!==0&&key.major!==1)deny();
  const k=key.major===0?key.n:-1-key.n;
  if(![1,3,-1,-2,-3].includes(k)||values.has(k))deny();
  const v=arg();
  if(k===-2||k===-3){
   if(v.major!==2||v.n!==32||pos+32>bytes.length)deny();
   values.set(k,bytes.slice(pos,pos+32));pos+=32;
  }else{
   if(v.major!==0&&v.major!==1)deny();
   values.set(k,v.major===0?v.n:-1-v.n);
  }
 }
 if(pos!==bytes.length||values.get(1)!==2||values.get(3)!==-7||
 values.get(-1)!==1||!(values.get(-2) instanceof Uint8Array)||
 !(values.get(-3) instanceof Uint8Array))deny();
 const b64=b=>{let s="";for(const n of b)s+=String.fromCharCode(n);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");};
 return Object.freeze({kty:"EC",crv:"P-256",alg:"ES256",x:b64(values.get(-2)),y:b64(values.get(-3)),ext:true,key_ops:["verify"]});
}
// Caller MUST validate this key using crypto.subtle.importKey and verify the
// registration ceremony and attestationObject before storing it as trusted.
