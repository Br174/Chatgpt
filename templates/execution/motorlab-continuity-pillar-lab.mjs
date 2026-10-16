// MotorLab Continuity Pillar — LAB-only policy evaluator.
// This is a subordinate decision helper for existing Execution Continuity;
// Change Compatibility Guard remains the sole conflict authority.
const stops=new Set(["NEEDS_NEW_AUTHORIZATION","NEEDS_USER_ACTION","NEEDS_USER_DECISION","EXTERNAL_BLOCKER","HOST_UNAVAILABLE"]);
const forbidden=new Set(["STEP_COMPLETE","PHASE_COMPLETE","BATCH_COMPLETE","CHECKPOINT_SAVED","PROGRESS_REPORTED","TEST_COMPLETE","COMMIT_COMPLETE","RECOVERABLE_FAILURE","RETRY_REQUIRED","DURABLE_HANDOFF"]);
export function evaluateContinuityStopLab({approved=false,projectComplete=false,reason=null,scopeChange=false,protectedBoundary=false,manualActionRequired=false,decisionRequired=false,externalBlocked=false,hostUnavailable=false}={}){
 if(scopeChange||protectedBoundary||!approved)return Object.freeze({decision:"STOP",reason:"NEEDS_NEW_AUTHORIZATION",requiresUser:true});
 if(manualActionRequired)return Object.freeze({decision:"STOP",reason:"NEEDS_USER_ACTION",requiresUser:true});
 if(decisionRequired)return Object.freeze({decision:"STOP",reason:"NEEDS_USER_DECISION",requiresUser:true});
 if(externalBlocked)return Object.freeze({decision:"WAIT",reason:"EXTERNAL_BLOCKER",requiresUser:false});
 if(hostUnavailable)return Object.freeze({decision:"WAIT",reason:"HOST_UNAVAILABLE",requiresUser:false});
 if(projectComplete)return Object.freeze({decision:"COMPLETE",reason:"PROJECT_VERIFIED_COMPLETE",requiresUser:false});
 if(reason!==null&&typeof reason!=="string")throw Error("INVALID_STOP_REASON");
 if(stops.has(reason))throw Error("UNSUPPORTED_UNVERIFIED_STOP_REASON");
 if(reason!==null&&!forbidden.has(reason))throw Error("UNKNOWN_STOP_REASON");
 return Object.freeze({decision:"CONTINUE",reason:reason||"WORK_REMAINS",requiresUser:false});
}
export const RETIRED_ARBITRARY_STOP_REASONS=Object.freeze([...forbidden]);
