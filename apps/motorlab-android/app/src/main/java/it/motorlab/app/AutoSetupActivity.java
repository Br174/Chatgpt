package it.motorlab.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.util.ArrayList;

/**
 * Provider-neutral first AutoSetup LAB:
 *   URL -> controlled embedded site -> safe metadata-only form discovery ->
 *   explicit in-chat field entry -> one user-commanded form fill.
 * Does NOT submit forms, bypass site protections, or claim OAuth/browser-agent autonomy.
 */
public final class AutoSetupActivity extends Activity {
    private LinearLayout conversation,fields;
    private TextView state;
    private EditText url,goal;
    private WebView browser;
    private SecureServiceToken vault;
    private final ArrayList<FormField> controls=new ArrayList<>();
    private String activeOrigin="";
    private boolean pageReady=false;
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}

    static final class FormField {
        final int index;
        final String signature;
        final EditText editor;
        FormField(int i,String s,EditText e){index=i;signature=s;editor=e;}
    }

    private TextView text(String value,int size,boolean bold) {
        TextView v=new TextView(this);
        v.setText(value);v.setTextSize(size);
        v.setTextColor(Color.rgb(28,38,53));
        if(bold)v.setTypeface(null,1);
        v.setPadding(dp(4),dp(5),dp(4),dp(5));
        return v;
    }
    private Button button(LinearLayout target,String label,Runnable action) {
        Button b=new Button(this);b.setText(label);b.setAllCaps(false);
        b.setOnClickListener(v->action.run());
        target.addView(b,new LinearLayout.LayoutParams(-1,dp(48)));
        return b;
    }
    private EditText editor(LinearLayout parent,String hint) {
        EditText e=new EditText(this);e.setHint(hint);e.setSingleLine(true);
        parent.addView(e,new LinearLayout.LayoutParams(-1,-2));return e;
    }
    private void say(String msg) {
        conversation.addView(text(msg,13,false));
    }
    private void status(String msg) {state.setText(msg);}
    private void alert(String msg){new AlertDialog.Builder(this).setMessage(msg).setPositiveButton("OK",null).show();}

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        vault=new SecureServiceToken(this);
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(12),dp(8),dp(12),dp(8));
        root.setBackgroundColor(0xfff8fafc);
        root.addView(text("MotorLab AutoSetup · Siti web",20,true));
        root.addView(text("Assistente generico: non limitato a GitHub o Cloudflare.",12,false));

        ScrollView scroll=new ScrollView(this);
        LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(top);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,3));
        conversation=new LinearLayout(this);conversation.setOrientation(LinearLayout.VERTICAL);
        top.addView(conversation);
        say("MotorLab: indicami un sito HTTPS e cosa desideri configurare. "+
            "Posso riconoscere i campi visibili e compilarli con il tuo consenso. "+
            "L'autonomia AI, l'OAuth e l'invio finale sono ancora da integrare.");

        url=editor(top,"Sito HTTPS, per esempio https://example.com");
        goal=editor(top,"Cosa vuoi fare su questo sito?");
        button(top,"Apri sito dentro MotorLab",this::openSite);
        button(top,"Prova modulo generico offline",this::openDemo);
        button(top,"Riconosci i campi del modulo",this::inspectForm);
        button(top,"Inserisci token protetto per questo sito",this::saveToken);
        button(top,"Elimina token di questo sito",this::removeToken);
        button(top,"Apri login ufficiale nel browser",this::externalLogin);
        status=text("Pronto · nessuna azione esterna eseguita.",12,false);top.addView(status);
        fields=new LinearLayout(this);fields.setOrientation(LinearLayout.VERTICAL);top.addView(fields);

        browser=new WebView(this);
        WebSettings settings=browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r) {
                if(!r.isForMainFrame())return false;
                try{SecureServiceToken.checkedOrigin(r.getUrl().toString());return false;}
                catch(Exception ignored){runOnUiThread(()->status("Navigazione non HTTPS bloccata."));return true;}
            }
            @Override public void onPageStarted(WebView w,String page,android.graphics.Bitmap favicon){
                pageReady=false;controls.clear();fields.removeAllViews();
            }
            @Override public void onPageFinished(WebView w,String page) {
                try{
                    activeOrigin=SecureServiceToken.checkedOrigin(page);
                    pageReady=true;
                    status("Pagina pronta: "+activeOrigin+". Premere Riconosci i campi.");
                }catch(Exception e){
                    pageReady=false;status("Pagina non supportata per l'autocompilazione.");
                }
            }
            @Override public void onReceivedError(WebView w,WebResourceRequest request,android.webkit.WebResourceError error) {
                if(request.isForMainFrame())status("Caricamento del sito non riuscito.");
            }
        });
        browser.setBackgroundColor(Color.WHITE);
        root.addView(browser,new LinearLayout.LayoutParams(-1,0,2));
        button(root,"← Torna alla Team Chat",this::finish);
        setContentView(root);
    }

    private void openDemo() {
        activeOrigin="https://autosetup-demo.example";
        url.setText(activeOrigin);
        goal.setText("Dimostrazione locale senza servizi esterni");
        pageReady=false;controls.clear();fields.removeAllViews();
        say("MotorLab: prova offline. Nessuna connessione a servizi esterni o login.");
        String html="<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"+
            "<body><h2>Modulo dimostrativo MotorLab</h2><form>"+
            "<label for='nome'>Nome della prova</label><input id='nome' name='nome' type='text'>"+
            "<label for='tema'>Tema</label><textarea id='tema' name='tema'></textarea>"+
            "<label for='riservato'>Password da escludere</label><input id='riservato' type='password'>"+
            "</form></body></html>";
        browser.loadDataWithBaseURL(activeOrigin+"/",html,"text/html","UTF-8",null);
        status("Caricamento modulo dimostrativo offline…");
    }

    private void openSite() {
        String address=url.getText().toString().trim();
        try{
            activeOrigin=SecureServiceToken.checkedOrigin(address);
            controls.clear();fields.removeAllViews();pageReady=false;
            say("Richiesta: "+limit(goal.getText().toString(),180)+
                " · Sito: "+activeOrigin+" · Apertura autorizzata.");
            browser.loadUrl(address);
            status("Apertura del sito…");
        }catch(Exception e){alert("Inserire un URL HTTPS pubblico valido.");}
    }

    private String currentOrigin() {
        if(!pageReady||browser.getUrl()==null)
            throw new IllegalStateException("Prima apri un sito HTTPS.");
        String live=SecureServiceToken.checkedOrigin(browser.getUrl());
        if(!live.equals(activeOrigin))throw new IllegalStateException("Il sito è cambiato: riaprilo.");
        return live;
    }

    private static String limit(String s,int max){
        return s==null?"":s.substring(0,Math.min(max,s.length()));
    }

    private void inspectForm() {
        try{currentOrigin();}
        catch(Exception e){alert("Apri prima un sito compatibile.");return;}
        // No input values, passwords, tokens, cookies, or page content are collected.
        String js="(function(){var all=Array.from(document.querySelectorAll('input,textarea,select'));"+
          "return JSON.stringify(all.map(function(el,i){"+
          "var typ=(el.getAttribute('type')||'text').toLowerCase();"+
          "var tag=el.tagName.toLowerCase();"+
          "var label=(el.labels&&el.labels.length?el.labels[0].innerText:'')||"+
          "el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.name||el.id||('Campo '+(i+1));"+
          "var sig=[el.tagName,typ,el.name||'',el.id||''].join('|');"+
          "var sensitive=/password|passwort|token|secret|api.?key|auth|credential|otp|2fa|codice.*accesso/i.test("+
          "label+' '+(el.name||'')+' '+(el.id||''));"+
          "if(['password','hidden','file','checkbox','radio','submit','button','reset'].indexOf(typ)>=0||sensitive)return null;"+
          "if(['input','textarea','select'].indexOf(tag)<0||el.disabled)return null;"+
          "return {i:i,s:sig,label:String(label).slice(0,90)};"+
          "}).filter(Boolean).slice(0,30));})()";
        String origin=activeOrigin;
        status("Rilevazione campi in corso…");
        browser.evaluateJavascript(js,value->{
            try{
                if(!origin.equals(currentOrigin()))return;
                Object decoded=new JSONTokener(value).nextValue();
                JSONArray found=new JSONArray((String)decoded);
                controls.clear();fields.removeAllViews();
                fields.addView(text("Campi rilevati nel sito · "+found.length(),14,true));
                for(int i=0;i<found.length();i++){
                    JSONObject f=found.getJSONObject(i);
                    String title=f.optString("label","Campo");
                    EditText input=editor(fields,title);
                    controls.add(new FormField(f.getInt("i"),f.getString("s"),input));
                }
                if(controls.isEmpty()){
                    status("Nessun campo ordinario riconosciuto. Il sito potrebbe usare moduli speciali.");
                }else{
                    say("MotorLab: ho trovato "+controls.size()+
                        " campi ordinari. Inserisci i valori qui nella chat; "+
                        "non saranno inviati alla pagina finché non premi Compila.");
                    button(fields,"Compila i campi sulla pagina (senza inviare il modulo)",this::fillForm);
                    status("Compilazione disponibile · nessun modulo è stato inviato.");
                }
            }catch(Exception e){status("Il sito non consente questa analisi oppure il modulo è cambiato.");}
        });
    }

    private void fillForm() {
        try{currentOrigin();}
        catch(Exception e){alert("Pagina non più disponibile.");return;}
        JSONArray updates=new JSONArray();
        try{
            for(FormField f:controls){
                String val=f.editor.getText().toString();
                if(!val.isEmpty())updates.put(new JSONObject().put("i",f.index)
                    .put("s",f.signature).put("v",val));
            }
            if(updates.length()==0){alert("Compila almeno un campo nella chat.");return;}
            String origin=activeOrigin;
            final String js="(function(){var values="+updates.toString()+";"+
                "var all=Array.from(document.querySelectorAll('input,textarea,select'));"+
                "var filled=0;for(var j=0;j<values.length;j++){var v=values[j];var el=all[v.i];"+
                "if(!el||[el.tagName,(el.getAttribute('type')||'text').toLowerCase(),el.name||'',el.id||''].join('|')!==v.s)continue;"+
                "var typ=(el.getAttribute('type')||'text').toLowerCase();"+
                "if(['password','hidden','file','checkbox','radio','submit','button','reset'].indexOf(typ)>=0||el.disabled)continue;"+
                "if(el.tagName==='SELECT'){el.value=v.v;}else{"+
                "var p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;"+
                "var d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set)d.set.call(el,v.v);else el.value=v.v;}"+
                "el.dispatchEvent(new Event('input',{bubbles:true}));"+
                "el.dispatchEvent(new Event('change',{bubbles:true}));filled++;}"+
                "return String(filled);})()";
            browser.evaluateJavascript(js,result->{
                try{
                    if(!origin.equals(currentOrigin()))return;
                    String count=String.valueOf(new JSONTokener(result).nextValue());
                    status("Compilati "+count+" campi; nessun modulo inviato. Controlla la pagina.");
                    say("MotorLab: compilazione effettuata su "+origin+
                        ". Per inviare definitivamente il modulo è necessaria una conferma separata.");
                }catch(Exception e){status("Non posso confermare la compilazione della pagina.");}
            });
        }catch(Exception e){alert("Impossibile preparare i campi.");}
    }

    private void saveToken() {
        String origin;
        try{origin=currentOrigin();}
        catch(Exception e){alert("Apri prima il sito HTTPS a cui appartiene la credenziale.");return;}
        EditText secret=new EditText(this);
        secret.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        secret.setHint("Token, API key o segreto");
        new AlertDialog.Builder(this).setTitle("Salva credenziale protetta")
            .setMessage("Il token resta cifrato per "+origin+
                " e non viene aggiunto ai messaggi o inserito automaticamente in pagine web.")
            .setView(secret).setNegativeButton("Annulla",null)
            .setPositiveButton("Salva",(d,w)->{
                try{
                    vault.save(origin,secret.getText().toString());
                    secret.setText("");
                    status("Credenziale cifrata salvata per "+origin+" (NON verificata presso il servizio).");
                }catch(Exception e){alert("Credenziale non salvata.");}
            }).show();
    }

    private void removeToken() {
        String origin;
        try{origin=currentOrigin();}
        catch(Exception e){alert("Apri prima il sito.");return;}
        final String urlOrigin=origin;
        new AlertDialog.Builder(this).setTitle("Rimuovere la credenziale?")
            .setMessage(urlOrigin+" · Le altre credenziali non cambiano.")
            .setNegativeButton("Annulla",null)
            .setPositiveButton("Rimuovi",(d,w)->{
                vault.clear(urlOrigin);status("Credenziale locale rimossa per "+urlOrigin);
            }).show();
    }

    private void externalLogin(){
        try{
            String origin=currentOrigin();
            startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(origin)));
            status("Login ufficiale aperto fuori dall'app; nessuna autorizzazione simulata.");
        }catch(Exception e){alert("Apri prima un sito HTTPS.");}
    }

    @Override protected void onDestroy(){
        if(browser!=null){browser.stopLoading();browser.destroy();}
        super.onDestroy();
    }
}
