// LAB-only evidence gate for weighted bidirectional progress.
// Only evidence records from a trusted, independently supplied validator count.
// No caller-controlled verified:true field is accepted as evidence.
import {calculateBidirectionalProgressLab} from "./bidirectional-progress-lab.mjs";
const deny=()=>{throw Error("PACMAN_PROGRESS_EVIDENCE_INVALID");};
export async function calculateEvidenceBackedProgressLab({tree,evidence,validateEvidence}={}){
 if(!tree||!Array.isArray(evidence)||typeof validateEvidence!=="function")deny();
 const index=new Map();
 for(const item of evidence){
  if(!item||typeof item.id!=="string"||!item.id||index.has(item.id))deny();
  if(!Number.isFinite(item.completion)||item.completion<0||item.completion>100)deny();
  index.set(item.id,item);
 }
 const used=new Set();
 async function visit(node){
  if(!node||typeof node!=="object")deny();
  if(Array.isArray(node.children)){
   return {...node,children:await Promise.all(node.children.map(visit))};
  }
  if(typeof node.id!=="string"||!node.id||used.has(node.id))deny();
  used.add(node.id);
  const record=index.get(node.id);
  if(!record)return {...node,verified:false,completion:0};
  // Validator must check provenance, immutable run/commit identity, scope and
  // relevance to this exact leaf. Boolean fields in record are not trusted.
  let valid=false;
  try{valid=(await validateEvidence(record,node))===true;}catch{valid=false;}
  return {...node,verified:valid,completion:valid?record.completion:0};
 }
 const verifiedTree=await visit(tree);
 if([...index.keys()].some(id=>!used.has(id)))deny();
 return Object.freeze({percent:calculateBidirectionalProgressLab(verifiedTree),tree:verifiedTree});
}
// A test run alone must not claim full feature completion: completion must be
// derived by the trusted validator from the task's predefined acceptance scope.
