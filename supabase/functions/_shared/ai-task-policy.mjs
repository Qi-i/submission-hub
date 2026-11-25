// Independent task policies use route IDs, never copy credentials. Missing or
// null policy inherits the existing shared route. An explicit empty array
// deliberately disables that task; it must not silently fall back.
export const AI_TASKS=['mail_translation','mail_analysis','ledger_text','ledger_vision']
export function taskPolicy(pref,task){
 if(!AI_TASKS.includes(task))throw Error('Unknown AI task')
 const raw=pref.ai_task_routes?.[task]
 const primary=pref.ai_endpoint_id?'endpoint:'+pref.ai_endpoint_id:'glm:'+String(pref.ai_model||'glm-4.7-flash')
 const valid=ids=>[...new Set((Array.isArray(ids)?ids:[]).filter(id=>typeof id==='string'&&(/^(glm:glm-4\.[57]-flash|endpoint:[0-9a-f-]{36})$/i.test(id))))].slice(0,6)
 if(raw&&typeof raw==='object'&&Array.isArray(raw.routes)){
  return {routes:valid(raw.routes),fallback:raw.routes.length>1,allowPaid:task!=='mail_translation'&&raw.allowPaid===true,inherit:false}
 }
 const fallback=pref.ai_failover_enabled===true
 const routes=fallback?valid(pref.ai_route_order):valid([primary])
 return {routes,fallback,allowPaid:task!=='mail_translation'&&pref.ai_allow_paid===true&&!fallback,inherit:true}
}
export function endpointEligible(endpoint,task,policy,{consent=false}={}){
 if(!endpoint?.key_ready||endpoint.last_test_status!=='ok')return false
 if(task==='ledger_vision'&&endpoint.vision_test_status!=='ok')return false
 if(endpoint.declared_free===true)return true
 if(task==='mail_translation'||!policy.allowPaid||endpoint.allow_paid!==true)return false
 // Never automatically fall back onto a paid route. Explicit task policies
 // may use paid models only for manual ledger requests with per-run consent,
 // or the single selected analysis route with existing double consent.
 return task==='mail_analysis'?!policy.fallback:consent===true&&!policy.fallback
}
