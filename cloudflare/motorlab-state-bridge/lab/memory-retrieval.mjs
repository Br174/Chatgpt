// Cloudflare-compatible pure retrieval projection. Source authority remains external.
const words = s => String(s || '').toLocaleLowerCase('it').match(/[\p{L}\p{N}]+/gu) || [];
export function eligible(item, now) {
 return item.status === 'ACTIVE' && (!item.valid_from || item.valid_from <= now) && (!item.valid_to || now < item.valid_to) && Boolean(item.evidence_ref) && Boolean(item.source_authority);
}
export function selectCanonical(items, relations = [], now = new Date().toISOString()) {
 const byId = new Map(items.map(x=>[x.id,x]));
 const superseded = new Set();
 for(const r of relations) {
   if(r.relation_type !== 'SUPERSEDES' || !r.evidence_ref) continue;
   const newer=byId.get(r.from_id), older=byId.get(r.to_id);
   if(newer && older && newer.project_id===older.project_id && eligible(newer,now)) superseded.add(older.id);
 }
 return items.filter(x=>eligible(x,now) && !superseded.has(x.id));
}
export function retrieveMemory({items, relations=[], categories=[], itemCategories=[], query='', projectId, now=new Date().toISOString(), limit=5}) {
 if(!projectId) throw new Error('project_id_required');
 const queryTokens=[...new Set(words(query))];
 const byCategory=new Map(categories.map(x=>[x.id,x]));
 const catByItem=new Map();
 for(const row of itemCategories) {
   const cat=byCategory.get(row.category_id);
   if(!cat) continue;
   const terms=[cat.label,...(Array.isArray(cat.aliases)?cat.aliases:[])].join(' ');
   catByItem.set(row.item_id,(catByItem.get(row.item_id)||'')+' '+terms);
 }
 const neighbor=new Map();
 const eligibleItems=selectCanonical(items,relations,now).filter(x=>x.project_id===projectId);
 const ids=new Set(eligibleItems.map(x=>x.id));
 for(const r of relations) if(r.evidence_ref && ids.has(r.from_id) && ids.has(r.to_id) && r.relation_type!=='SUPERSEDES') {
   neighbor.set(r.from_id,(neighbor.get(r.from_id)||0)+1);
 }
 return eligibleItems.map(x=>{
   const tokens=new Set(words([x.summary,x.canonical_path,catByItem.get(x.id)||''].join(' ')));
   const relevance=queryTokens.length?queryTokens.filter(w=>tokens.has(w)).length/queryTokens.length:0;
   const importance=Math.max(0,Math.min(1,Number(x.importance??0.5)));
   const frequency=Math.min(1,Math.log1p(Math.max(0,x.retrieval_count||0))/Math.log(101));
   const age=Math.max(0,Date.parse(now)-Date.parse(x.updated_at||now));
   const recency=Number.isFinite(age)?Math.exp(-age/(90*86400000)):0;
   const graph=Math.min(1,(neighbor.get(x.id)||0)/5);
   const score=.35*relevance+.3*importance+.15*recency+.1*frequency+.1*graph;
   return {...x,score,match:relevance,verified_source:x.evidence_ref};
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,Math.max(0,limit));
}
