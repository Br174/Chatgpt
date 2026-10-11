package it.motorlab.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

public final class TeamChatActivity extends Activity {
    private static final int EXPORT_JSON=161;
    private static final String[] ROOMS={"MotorLab","MusicLab","StudyBook AI","MotorAI"};
    private TeamChatStore messages;
    private AppSettings settings;
    private SecureGeminiKey key;
    private String room="MotorLab",status="Pronto";
    private boolean running=false;
    private LinearLayout timeline;
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    @Override public void onCreate(Bundle bundle){
        super.onCreate(bundle);
        messages=new TeamChatStore(this);settings=new AppSettings(this);key=new SecureGeminiKey(this);
        if(bundle!=null)room=bundle.getString("room","MotorLab");
        redraw();
    }
    @Override protected void onSaveInstanceState(Bundle b){
        b.putString("room",room);super.onSaveInstanceState(b);
    }
    private TextView text(String value,int size,boolean strong){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);
        t.setTextColor(Color.rgb(28,38,53));t.setPadding(dp(2),dp(5),dp(2),dp(5));
        if(strong)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return t;
    }
    private Button button(LinearLayout target,String label,Runnable click){
        Button b=new Button(this);b.setText(label);b.setAllCaps(false);
        b.setOnClickListener(v->click.run());
        target.addView(b,new LinearLayout.LayoutParams(-1,dp(49)));return b;
    }
    private void alert(String msg){
        new AlertDialog.Builder(this).setMessage(msg).setPositiveButton("OK",null).show();
    }
    private void redraw(){
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12),dp(10),dp(12),dp(8));root.setBackgroundColor(0xfff8fafc);
        root.addView(text("Team Chat · Sala Operativa",21,true));
        root.addView(text("LAB02 · Locale sul telefono · Non sincronizzata con il cloud",12,false));
        for(int row=0;row<2;row++){
            LinearLayout line=new LinearLayout(this);line.setOrientation(LinearLayout.HORIZONTAL);
            root.addView(line);
            for(int col=0;col<2;col++){
                String selection=ROOMS[row*2+col];
                Button b=new Button(this);b.setText((room.equals(selection)?"● ":"")+selection);
                b.setTextSize(11);b.setAllCaps(false);
                b.setOnClickListener(v->{room=selection;status="Stanza: "+room;redraw();});
                line.addView(b,new LinearLayout.LayoutParams(0,dp(43),1));
            }
        }
        root.addView(text(status,12,false));
        ScrollView scroll=new ScrollView(this);timeline=new LinearLayout(this);
        timeline.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(timeline);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        if(messages.recent(room).isEmpty())
            timeline.addView(text("Scrivi al team e avvia una verifica Analista → Tester.",14,false));
        for(TeamChatStore.Message m:messages.recent(room)){
            LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(9),dp(6),dp(9),dp(6));
            card.setBackgroundColor("Utente".equals(m.author)?0xffe3efff:0xffeceff3);
            String moment=new SimpleDateFormat("dd/MM HH:mm",Locale.ITALY).format(new Date(m.when));
            card.addView(text(m.author+" → "+m.recipient+" · "+moment,12,true));
            card.addView(text(m.body,14,false));
            card.addView(text(m.kind+" · "+m.source+" · fonte #"+m.parent,10,false));
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,0,0,dp(7));
            timeline.addView(card,p);
        }
        EditText editor=new EditText(this);editor.setHint("Scrivi un messaggio al team…");
        editor.setMinLines(2);editor.setMaxLines(3);root.addView(editor);
        Button send=button(root,"Invia messaggio (salvataggio locale)",()->{
            String body=editor.getText().toString().trim();
            if(body.isEmpty())return;
            if(body.length()>10000){alert("Massimo 10.000 caratteri.");return;}
            messages.append(room,"manual-"+UUID.randomUUID(),"Utente","Tutti","MESSAGE",
                body,"USER_LOCAL",0);
            status="Messaggio salvato sul telefono.";redraw();
        });
        Button start=button(root,"▶ Analista → Tester con Gemini",()->begin());
        start.setEnabled(!running);
        button(root,"Salva ultima risposta come lezione NON verificata",()->{
            TeamChatStore.Message recent=messages.latest(room,"Tester");
            if(recent==null)recent=messages.latest(room,"Analista");
            if(recent==null){alert("Non ci sono risposte AI.");return;}
            boolean inserted=messages.pin(room,recent.id);
            alert(inserted?"Nota tecnica NON VERIFICATA salvata con fonte #"+recent.id:
                "Nota già presente oppure fonte non valida.");
        });
        button(root,"Esporta Team Chat e lezioni in JSON",()->{
            Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");
            i.putExtra(Intent.EXTRA_TITLE,"motorlab-team-lab02.json");
            startActivityForResult(i,EXPORT_JSON);
        });
        button(root,"← Torna alla Home MotorLab",()->finish());
        setContentView(root);
        scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN));
    }
    private void begin(){
        if(running)return;
        TeamChatStore.Message user=messages.latest(room,"Utente");
        if(user==null){alert("Invia prima un messaggio.");return;}
        if(!settings.freeTierConfirmed()||!"gemini".equals(settings.provider())){
            alert("Per usare gli agenti configura Gemini e conferma che il progetto Google è gratuito.");return;
        }
        try{if(key.load().isEmpty()){alert("Chiave Gemini mancante.");return;}}
        catch(Exception e){alert("Chiave Gemini non disponibile.");return;}
        final String currentRoom=room;
        new AlertDialog.Builder(this).setTitle("Avviare due agenti AI?")
            .setMessage("Due chiamate Gemini sequenziali useranno il tuo messaggio. "+
                "Saranno scalate dalle 5 prove giornaliere locali. "+
                "Nessun test o intervento su GitHub verrà eseguito. Continuare?")
            .setNegativeButton("Annulla",null).setPositiveButton("Avvia",(d,w)->{
                running=true;status="Richiesta avviata";redraw();
                new Thread(()->{
                    TeamCoordinator.run(messages,settings,key,currentRoom,user,newStatus->
                        runOnUiThread(()->{
                            status=newStatus;if(currentRoom.equals(room))redraw();
                        }));
                    runOnUiThread(()->{
                        running=false;if(currentRoom.equals(room))redraw();
                    });
                },"motorlab-team-lab02").start();
            }).show();
    }
    @Override protected void onActivityResult(int req,int res,Intent data){
        super.onActivityResult(req,res,data);
        if(req!=EXPORT_JSON||res!=RESULT_OK||data==null)return;
        Uri uri=data.getData();if(uri==null)return;
        try(OutputStream out=getContentResolver().openOutputStream(uri)){
            if(out==null)throw new IllegalStateException("file not open");
            out.write(messages.exportJson().getBytes(StandardCharsets.UTF_8));
            alert("JSON esportato. Il documento contiene messaggi privati: custodiscilo con cura.");
        }catch(Exception e){alert("Impossibile esportare il JSON.");}
    }
    @Override protected void onDestroy(){if(messages!=null)messages.close();super.onDestroy();}
}
