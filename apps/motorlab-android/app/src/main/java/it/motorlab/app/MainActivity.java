package it.motorlab.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;

public final class MainActivity extends Activity {
    private static final int INK = Color.rgb(28,37,53);
    private static final int MUTE = Color.rgb(97,108,125);
    private static final int BG = Color.rgb(247,249,252);
    private static final int PRIMARY = Color.rgb(34,95,182);
    private LinearLayout root, page;
    private AppSettings cfg;
    private SecureGeminiKey vault;
    private String lastAnswer = "Le risposte arriveranno qui.";
    private boolean inFlight = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        cfg = new AppSettings(this);
        vault = new SecureGeminiKey(this);
        show("home");
    }
    private int dp(int v) { return Math.round(getResources().getDisplayMetrics().density * v); }
    private TextView text(String value, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(value); t.setTextSize(size); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        t.setPadding(0,dp(4),0,dp(4));
        return t;
    }
    private void label(String s) { page.addView(text(s,16,INK,true)); }
    private void note(String s) { page.addView(text(s,13,MUTE,false)); }
    private void gap() { View v = new View(this); page.addView(v,new LinearLayout.LayoutParams(1,dp(12))); }
    private Button button(String title, Runnable action) {
        Button b=new Button(this); b.setText(title); b.setAllCaps(false);
        b.setOnClickListener(v -> action.run());
        page.addView(b, new LinearLayout.LayoutParams(-1,dp(53)));
        return b;
    }
    private EditText field(String hint, String initial, boolean password) {
        EditText f = new EditText(this);
        f.setSingleLine(!hint.contains("Richiesta"));
        f.setText(initial); f.setHint(hint);
        f.setTextColor(INK); f.setHintTextColor(MUTE);
        if (password) f.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        page.addView(f,new LinearLayout.LayoutParams(-1,-2));
        return f;
    }
    private void open(String url) { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
    private void show(String tab) {
        root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG); root.setPadding(dp(16),dp(12),dp(16),dp(8));
        TextView title=text("⚙ MotorLab",24,INK,true); root.addView(title);
        TextView tagline=text("MotorLab  •  Team Chat e Archivio",12,MUTE,false);
        root.addView(tagline);
        ScrollView sc=new ScrollView(this); sc.setFillViewport(true);
        page=new LinearLayout(this); page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(0,dp(16),0,dp(16)); sc.addView(page);
        root.addView(sc,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout nav=new LinearLayout(this); nav.setOrientation(LinearLayout.HORIZONTAL);
        for(String t:new String[]{"Home","Chat","Team","Lavori","Impostazioni"}) {
            Button b=new Button(this); b.setText(t); b.setTextSize(10); b.setAllCaps(false);
            b.setOnClickListener(v -> { if(t.equals("Team")) { startActivity(new Intent(this,TeamChatActivity.class)); return; } show(t.equals("Home")?"home":t.equals("Chat")?"chat":t.equals("Lavori")?"works":"settings"); });
            nav.addView(b,new LinearLayout.LayoutParams(0,dp(54),1));
        }
        root.addView(nav); setContentView(root);
        switch(tab) {
            case "chat": chat(); break;
            case "works": works(); break;
            case "settings": settings(); break;
            default: home(); break;
        }
    }
    private void home() {
        label("MotorLab diventa un'app");
        note("Team Chat e Archivio sono integrati in MotorLab. I messaggi sono locali: non sono una sincronizzazione cloud né un agente programmatore autonomo.");
        gap(); label("CORE centrale");
        note("Baseline sorgente attesa: MotorLab r34. Stato live del repository privato ancora da collegare con autenticazione.");
        gap(); label("Progetti iniziali");
        note("MusicLab • StudyBook AI • MotorAI\nElenco informativo. Le versioni live e i lavori reali verranno mostrati quando il collegamento GitHub sarà verificato.");
        button("Apri il repository pubblico MotorAI",()->open("https://github.com/Br174/MotorAI"));
        gap(); label("Memoria e documentazione");
        note("Fattuale, relazionale, temporale e vettoriale: integrazione in programma. Nessun archivio fittizio.");
        button("Apri MotorLab Control Center su Notion",
             ()->open("https://app.notion.com/p/3eb101125bf18199ae89d45eaa804c3a"));
        gap(); label("Modelli AI");
        note("Gemini configurabile e ChatGPT predisposto. Provider selezionato: "+cfg.provider());
        button("Apri Team Chat - Analista e Tester",()->startActivity(new Intent(this,TeamChatActivity.class)));
        button("Vai alle impostazioni AI",()->show("settings"));
    }
    private void chat() {
        label("Chat MotorLab"); 
        note("La LAB01 consente richieste dirette al modello Gemini. Non modifica repository né esegue comandi di sistema.");
        note("Provider attivo: "+cfg.provider());
        if(cfg.provider().equals("chatgpt")) {
            gap(); label(ChatGptPlan.NAME); note(ChatGptPlan.status());
            button("Leggi la guida ufficiale ChatGPT",()->open(ChatGptPlan.DOCS));
            return;
        }
        if(!cfg.freeTierConfirmed()) {
            note("Invio bloccato: conferma prima che il progetto Google non usi fatturazione a pagamento.");
        }
        final EditText input=field("Richiesta per Gemini","",false);
        final TextView output=text(lastAnswer,15,INK,false);
        Button send=button("Invia a Gemini (max 5 prove al giorno)",()->{
            if(inFlight) return;
            if(!cfg.freeTierConfirmed()) {
                output.setText("Bloccato: apri Impostazioni e conferma il progetto gratuito.");
                return;
            }
            final String question=input.getText().toString().trim();
            if(question.isEmpty()) return;
            final String secret;
            try { secret=vault.load(); } catch(Exception e) {
                output.setText("Impossibile leggere la chiave locale protetta."); return;
            }
            if(secret.isEmpty()) { output.setText("Inserisci la chiave Google nelle Impostazioni."); return; }
            if(!cfg.reserveDailyTrialCall()) {
                output.setText("Limite locale raggiunto: 5 richieste di prova oggi."); return;
            }
            inFlight=true; output.setText("Richiesta in corso…");
            new Thread(()->{
                String result;
                try { result=GeminiClient.reply(cfg.model(),secret,question); }
                catch(Exception e) { result="Errore: "+e.getMessage(); }
                final String done=result;
                runOnUiThread(()->{ inFlight=false; lastAnswer=done; output.setText(done); });
            },"motorlab-gemini-probe").start();
        });
        send.setEnabled(cfg.freeTierConfirmed());
        gap(); label("Risposta"); page.addView(output);
        gap(); note("La chiave è locale nel KeyStore. La richiesta viene inviata direttamente a Google: non incollare segreti o codice privato.");
    }
    private void works() {
        label("Operazioni e verifiche");
        note("Non sono state avviate compilazioni o scritture GitHub da questa app.");
        final TextView state=text("Stato sonda: non eseguita.",13,MUTE,false); page.addView(state);
        button("Verifica GitHub pubblico (sola lettura)",()->{
            state.setText("Connessione in verifica…");
            new Thread(()->{
                String s;
                HttpURLConnection c=null;
                try {
                    c=(HttpURLConnection)new URL("https://api.github.com/repos/Br174/MotorAI").openConnection();
                    c.setConnectTimeout(10000);c.setReadTimeout(10000);
                    c.setRequestProperty("Accept","application/vnd.github+json");
                    int status=c.getResponseCode();
                    if(status!=200) throw new IllegalStateException("GitHub HTTP "+status);
                    byte[] content=new byte[65536];
                    int len=0,n;
                    try(java.io.InputStream in=c.getInputStream()) {
                        while(len<content.length && (n=in.read(content,len,content.length-len))>0) len+=n;
                    }
                    JSONObject j=new JSONObject(new String(content,0,len,java.nio.charset.StandardCharsets.UTF_8));
                    s="GitHub pubblico verificato: "+j.optString("full_name")
                        +" (ramo "+j.optString("default_branch")+").\n"
                        +"Non dimostra accesso al CORE privato.";
                } catch(Exception e){ s="Connessione non verificata: "+e.getMessage(); }
                finally { if(c!=null)c.disconnect(); }
                final String result=s;runOnUiThread(()->state.setText(result));
            },"motorlab-github-probe").start();
        });
        gap(); label("Prossimi moduli"); note("GitHub privato con OAuth • avvio Actions autorizzate • checkpoint • APK/ZIP • log osservabili • memorie.");
    }
    private void settings() {
        label("Configurazione dei modelli");
        note("Nessuna credenziale è inclusa nell'APK. Queste opzioni sono salvate sul telefono.");
        final CheckBox chatgpt=new CheckBox(this);
        chatgpt.setText("Seleziona ChatGPT (non ancora operativo)");
        chatgpt.setChecked(cfg.provider().equals("chatgpt")); page.addView(chatgpt);
        note(ChatGptPlan.status());
        button("Documentazione Sign in with ChatGPT",()->open(ChatGptPlan.DOCS));
        gap(); label("Google Gemini");
        final EditText model=field("ID modello Gemini",cfg.model(),false);
        final EditText key=field("Nuova chiave Google API (facoltativa)","",true);
        note("La chiave inserita viene cifrata con Android Keystore. Non è caricata su GitHub.");
        final CheckBox free=new CheckBox(this);
        free.setText("Ho verificato che il progetto Google usa il piano gratuito e non ha fatturazione attiva");
        free.setChecked(cfg.freeTierConfirmed());page.addView(free);
        note("La conferma non verifica automaticamente il conto Google. Massimo 5 chiamate al giorno per questa installazione.");
        button("Salva configurazione",()->{
            String m=model.getText().toString().trim();
            if(!m.matches("[a-zA-Z0-9._-]{3,100}")) { alert("ID modello non valido.");return; }
            try {
                String provided=key.getText().toString().trim();
                if(!provided.isEmpty()) vault.save(provided);
                cfg.model(m);cfg.provider(chatgpt.isChecked()?"chatgpt":"gemini");
                cfg.freeTierConfirmed(free.isChecked()); key.setText("");
                alert("Impostazioni salvate. ChatGPT rimane non operativo finché OAuth non sarà verificato.");
            } catch(Exception e) { alert("La chiave non è stata salvata: "+e.getClass().getSimpleName()); }
        });
        button("Elimina chiave Google dal telefono",()->{
            vault.clear();alert("Credenziale locale eliminata.");
        });
        gap(); label("Budget e privacy");
        note("Nuove spese autorizzate: €0. Nessun piano a pagamento attivato dall'app. Le chiamate Google possono avere costi se il progetto dell'utente abilita fatturazione: verifica prima di consentirle.");
        note("ChatGPT non usa l'API tradizionale a consumo in questa LAB: il flusso di accesso con piano ChatGPT sarà implementato separatamente.");
    }
    private void alert(String m) {
        new AlertDialog.Builder(this).setMessage(m).setPositiveButton("OK",(d,w)->{}).show();
    }
}
