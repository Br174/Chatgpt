import { strict as assert } from 'node:assert';
export function activeCandidate(item, now) {
  return item.status === 'ACTIVE' && (!item.valid_from || item.valid_from <= now) && (!item.valid_to || now < item.valid_to);
}
export function retrieveMemory(items, query, { projectId, now = new Date().toISOString(), limit = 5 } = {}) {
  const words = String(query).toLowerCase().match(/[a-zà-ÿ0-9]+/g) || [];
  return items.filter(x => x.project_id === projectId && activeCandidate(x, now)).map(x => {
    const haystack = (x.canonical_path + ' ' + x.summary).toLowerCase();
    const relevance = words.length ? words.filter(w => haystack.includes(w)).length / words.length : 0;
    const importance = Math.max(0, Math.min(1, Number(x.importance ?? 0.5)));
    const usage = Math.min(1, Math.log1p(Math.max(0, x.retrieval_count ?? 0)) / Math.log1p(100));
    const age = Math.max(0, Date.parse(now) - Date.parse(x.updated_at || now));
    const recency = Math.exp(-age / (90 * 86400000));
    return { ...x, score: .30 * relevance + .30 * importance + .25 * usage + .15 * recency };
  }).sort((a,b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}
export function verifySupersession(items, relations) {
  const ids = new Set(items.map(x=>x.id));
  for (const r of relations) {
    assert(ids.has(r.from_id) && ids.has(r.to_id), 'relation_endpoint_missing');
    assert(r.evidence_ref, 'relation_evidence_missing');
  }
  return items.filter(x => !relations.some(r => r.relation_type === 'SUPERSEDES' && r.to_id === x.id && items.some(i => i.id === r.from_id && i.status === 'ACTIVE')));
}
