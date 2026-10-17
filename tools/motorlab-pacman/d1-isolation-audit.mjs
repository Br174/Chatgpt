// Pure configuration comparison: does not contact Cloudflare or read secrets.
export function compareD1Isolation(production, candidate) {
  const prod=production?.d1_databases ?? [];
  const stage=candidate?.d1_databases ?? [];
  const ids=new Set(prod.map(x=>x.database_id).filter(Boolean));
  const collisions=stage.filter(x=>x.database_id && ids.has(x.database_id))
    .map(x=>({binding:x.binding,reason:"SHARED_DATABASE_ID"}));
  const missing=stage.length===0 || stage.some(x=>!x.database_id || !x.database_name);
  return Object.freeze({
    safe: !missing && collisions.length===0,
    reason:missing?"STAGING_DATABASE_NOT_CONFIGURED":collisions.length?"PRODUCTION_D1_COLLISION":null,
    collisions,mutationAllowed:false
  });
}
