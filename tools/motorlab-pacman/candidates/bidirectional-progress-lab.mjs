// LAB-only weighted bidirectional progress: verified completion can increase
// or decrease; parent progress is recomputed, never incremented blindly.
const invalid=()=>{throw Error("PACMAN_PROGRESS_INVALID");};
function bounded(n){if(typeof n!=="number"||!Number.isFinite(n)||n<0||n>100)invalid();return n;}
function weight(n){if(typeof n!=="number"||!Number.isFinite(n)||n<=0)invalid();return n;}
export function calculateBidirectionalProgressLab(node){
 if(!node||typeof node!=="object")invalid();
 if(Array.isArray(node.children)){
  if(!node.children.length)invalid();
  let numerator=0,denominator=0;
  for(const child of node.children){
   const w=weight(child.weight);
   numerator+=w*calculateBidirectionalProgressLab(child);
   denominator+=w;
  }
  return bounded(numerator/denominator);
 }
 if(node.children!==undefined)invalid();
 return bounded(node.verified===true?node.completion:0);
}
export function compareBidirectionalProgressLab(previous,current){
 const before=calculateBidirectionalProgressLab(previous);
 const after=calculateBidirectionalProgressLab(current);
 return Object.freeze({before,after,delta:after-before,direction:after>before?"advance":after<before?"regression":"unchanged"});
}
// The caller must supply independently checked evidence for verified:true;
// this pure calculator does not authenticate the evidence.
