// Pac-Man B4 billing permissions diagnostic. API-only, never calls Workers.
const statuses=Object.freeze({
  400:"HTTP_400_REQUEST_REJECTED",
  401:"HTTP_401_TOKEN_INVALID_OR_UNAUTHORIZED",
  403:"HTTP_403_BILLING_READ_OR_ACCOUNT_SCOPE_DENIED",
  404:"HTTP_404_ACCOUNT_OR_ENDPOINT_NOT_FOUND",
  429:"HTTP_429_RATE_LIMITED"
});
export function classifyBillingReply(status,body){
  if(!Number.isInteger(status))return {code:"INVALID_HTTP_STATUS",http:0};
  if(status!==200)return {code:statuses[status]||(status>=500?"HTTP_5XX_CLOUDFLARE_UNAVAILABLE":"HTTP_OTHER_NOT_VERIFIED"),http:status};
  if(!body||body.success!==true||!Array.isArray(body.result))
    return {code:"HTTP_200_INVALID_BILLING_SCHEMA",http:200};
  // Do not infer Workers plan from a zone's Free rate plan.
  const workers=body.result.filter(s=>{
    if(!s||typeof s!=="object")return false;
    const name=[typeof s.product==="string"?s.product:s.product?.name,
      s.rate_plan?.public_name,s.rate_plan?.scope,s.rate_plan?.id]
      .filter(x=>typeof x==="string").join(" ");
    return /workers/i.test(name);
  });
  if(workers.length!==1)return {code:"WORKERS_SUBSCRIPTION_NOT_UNIQUELY_IDENTIFIED",http:200};
  const sub=workers[0];
  const plan=sub.rate_plan;
  // This identifies a candidate only, not an account quota or billing guarantee.
  if(plan?.id==="free"&&sub.price===0&&
     ["Provisioned","Paid"].includes(sub.state))
    return {code:"WORKERS_FREE_SUBSCRIPTION_CANDIDATE_QUOTAS_UNVERIFIED",http:200};
  if(sub.price>0||["pro","business","enterprise"].includes(plan?.id))
    return {code:"NONZERO_OR_PAID_WORKERS_SUBSCRIPTION_DETECTED_HOLD",http:200};
  return {code:"WORKERS_PLAN_OR_COST_UNVERIFIED",http:200};
}
export async function diagnoseBillingReadOnly({token,accountId,fetchImpl=fetch}={}){
  if(typeof token!=="string"||token.length<16||
     typeof accountId!=="string"||!/^[0-9a-f]{32}$/i.test(accountId))
    return {code:"MISSING_OR_INVALID_PROTECTED_CREDENTIALS",http:0};
  const url="https://api.cloudflare.com/client/v4/accounts/"+accountId+"/subscriptions";
  let res;
  try{
    res=await fetchImpl(url,{method:"GET",
      headers:{Authorization:"Bearer "+token,Accept:"application/json"},
      redirect:"manual",signal:AbortSignal.timeout(12000)});
  }catch{return {code:"CLOUDFLARE_API_TRANSPORT_FAILED",http:0};}
  if(!Number.isInteger(res?.status))return {code:"INVALID_HTTP_STATUS",http:0};
  if(res.status!==200)return classifyBillingReply(res.status,null);
  let payload;
  try{
    const body=await res.text();
    if(body.length>65536)return {code:"BILLING_RESPONSE_EXCEEDS_SAFE_LIMIT",http:200};
    payload=JSON.parse(body);
  }catch{return {code:"BILLING_RESPONSE_NOT_VALID_JSON",http:200};}
  return classifyBillingReply(200,payload);
}
