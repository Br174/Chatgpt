package it.motorlab.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.UUID;

/**
 * Bounded local operation receipts, not a server-side proof.
 * No passwords, field names/values, cookies, page paths or session data.
 */
final class AutoSetupOperationEvidence {
    private static final String PREFS="autosetup_operation_evidence_v1";
    private static final String KEY="events";
    private static final int MAX_EVENTS=20;

    private AutoSetupOperationEvidence(){}

    /** Persist a small redacted receipt; empty ID means persistence failed. */
    static String record(Context context,String origin,int requested,int applied,
                         int domObserved,String state,boolean approved) {
        if(context==null||origin==null||!origin.startsWith("https://")||
           origin.length()>300||requested<0||requested>30||
           applied<0||applied>requested||domObserved>requested||
           domObserved< -1)return "";
        if(!"dom_confirmed".equals(state)&&!"dom_mismatch".equals(state)&&
           !"page_changed".equals(state)&&!"unavailable".equals(state)&&
           !"cancelled".equals(state)&&!"target_changed".equals(state))return "";
        try {
            String id=UUID.randomUUID().toString().substring(0,8);
            JSONObject event=new JSONObject()
                .put("protocol","motorlab.autosetup.operation-evidence")
                .put("version",1)
                .put("id",id)
                .put("timestamp_ms",System.currentTimeMillis())
                .put("source","motorlab_android")
                .put("origin",origin)
                .put("operation","fill_ordinary_fields")
                .put("approved",approved)
                .put("requested_fields",requested)
                .put("applied_fields",applied)
                .put("dom_observed_fields",domObserved<0?JSONObject.NULL:domObserved)
                .put("local_outcome",state)
                .put("remote_save","not_verified")
                .put("contains_field_values",false)
                .put("contains_credentials",false);
            SharedPreferences store=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
            JSONArray previous=new JSONArray(store.getString(KEY,"[]"));
            JSONArray remaining=new JSONArray();
            for(int i=Math.max(0,previous.length()-(MAX_EVENTS-1));i<previous.length();i++)
                remaining.put(previous.get(i));
            remaining.put(event);
            return store.edit().putString(KEY,remaining.toString()).commit()?id:"";
        }catch(Exception ignored){return "";}
    }

    /** Existing plan dialog can show this without redesign or exposing secrets. */
    static String latestSummary(Context context) {
        try{
            SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
            JSONArray history=new JSONArray(prefs.getString(KEY,"[]"));
            if(history.length()==0)return "Nessuna operazione registrata.";
            JSONObject e=history.getJSONObject(history.length()-1);
            String local=e.optString("local_outcome","unavailable");
            String label;
            switch(local){
                case "dom_confirmed":label="DOM verificato";break;
                case "dom_mismatch":label="DOM non corrispondente";break;
                case "cancelled":label="Annullata senza scrittura";break;
                case "target_changed":label="Modulo cambiato: scrittura bloccata";break;
                case "page_changed":label="Pagina cambiata: verifica impossibile";break;
                default:label="Verifica locale non disponibile";
            }
            return "Ultimo esito #"+e.optString("id","?")+
                "\nSito: "+e.optString("origin","")+
                "\nStato: "+label+
                "\nCampi richiesti: "+e.optInt("requested_fields",0)+
                " · applicati: "+e.optInt("applied_fields",0)+
                "\nSalvataggio sul server: NON verificato.";
        }catch(Exception e){return "Registro operazioni non disponibile.";}
    }
}
