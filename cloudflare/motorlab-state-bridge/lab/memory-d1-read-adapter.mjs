import { retrieveMemory } from './memory-retrieval.mjs';

// Read-only LAB adapter. It does not alter the authoritative continuity endpoint.
// Missing LAB tables are treated as unavailable, not as an empty authoritative memory.
export async function readMemoryLab(db, { projectId, query, now, limit = 5 }) {
  if (!db || typeof db.prepare !== 'function') return { state:'UNAVAILABLE', reason:'D1_BINDING_MISSING' };
  if (!projectId || typeof projectId !== 'string') return { state:'INVALID_REQUEST', reason:'PROJECT_ID_REQUIRED' };
  try {
    const rows = await Promise.all([
      db.prepare('SELECT * FROM memory_items_lab WHERE project_id = ? LIMIT 500').bind(projectId).all(),
      db.prepare('SELECT r.* FROM memory_relations_lab r JOIN memory_items_lab i ON i.id=r.from_id WHERE i.project_id=? LIMIT 2000').bind(projectId).all(),
      db.prepare('SELECT * FROM memory_categories_lab LIMIT 500').all(),
      db.prepare('SELECT ic.* FROM memory_item_categories_lab ic JOIN memory_items_lab i ON i.id=ic.item_id WHERE i.project_id=? LIMIT 2000').bind(projectId).all(),
      db.prepare('SELECT u.* FROM memory_usage_lab u JOIN memory_items_lab i ON i.id=u.item_id WHERE i.project_id=? LIMIT 500').bind(projectId).all()
    ]);
    const [items,relations,categories,itemCategories,usage] = rows.map(r=>r.results||[]);
    const counts=new Map(usage.map(x=>[x.item_id,x.retrieval_count]));
    const mapped=items.map(x=>({...x,retrieval_count:counts.get(x.id)||0}));
    const enrichedCategories=categories.map(x=>{
      let aliases=[];try { const parsed=JSON.parse(x.aliases_json||'[]'); if(Array.isArray(parsed)) aliases=parsed.filter(v=>typeof v==='string'); } catch {}
      return {...x,aliases};
    });
    return {state:'READY',authority:'DERIVED_READ_ONLY',items:retrieveMemory({items:mapped,relations,categories:enrichedCategories,itemCategories,query,projectId,now,limit})};
  } catch (error) {
    return {state:'UNAVAILABLE',reason:'LAB_SCHEMA_OR_READ_FAILED'};
  }
}
