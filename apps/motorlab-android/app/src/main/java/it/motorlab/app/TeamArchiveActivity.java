package it.motorlab.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class TeamArchiveActivity extends Activity {
    private static final int FOLDER_PICK=4401, IMPORT_JSON=4402;
    private static final String[] FILTERS={"Tutte","MotorLab","MusicLab","StudyBook AI","MotorAI"};
    private String room="Tutte",term="";
    private TeamChatStore db;
    private LinearLayout list;
    private Button saveButton;
    private TextView state;
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    @Override public void onCreate(Bundle b){
        super.onCreate(b);db=new TeamChatStore(this);
        if(b!=null){room=b.getString("filter","Tutte");term=b.getString("term","");}
        draw();
    }
    @Override protected void onSaveInstanceState(Bundle b){
        b.putString("filter",room);b.putString("term",term);super.onSaveInstanceState(b);
    }
    private TextView text(String t,int size){
        TextView x=new TextView(this);x.setText(t);x.setTextSize(size);
        x.setTextColor(0xff263346);x.setPadding(dp(3),dp(5),dp(3),dp(5));return x;
    }
    private Button button(LinearLayout p,String title,Runnable action){
        Button b=new Button(this);b.setText(title);b.setAllCaps(false);
        b.setOnClickListener(v->action.run());p.addView(b,new LinearLayout.LayoutParams(-1,dp(46)));return b;
    }
    private void alert(String message){new AlertDialog.Builder(this).setMessage(message)
        .setPositiveButton("OK",null).show();}
    private void draw(){
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12),dp(8),dp(12),dp(8));root.setBackgroundColor(0xfff8fafc);
        root.addView(text("📁 Archivio Team Chat",22));
        root.addView(text("Messaggi locali sempre accessibili. Cerca, apri o trasferisci i backup.",13));
        state=text(TeamBackupFolder.configured(this)?"Backup cartella: configurato":"Backup cartella: da scegliere (facoltativo)",12);
        root.addView(state);
        LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.HORIZONTAL);
        root.addView(top);
        for(String option:new String[]{"Tutte","MotorLab","MusicLab"}){
            Button b=new Button(this);b.setText(option.equals(room)?"● "+option:option);b.setAllCaps(false);
            b.setTextSize(11);b.setOnClickListener(v->{room=option;draw();});
            top.addView(b,new LinearLayout.LayoutParams(0,dp(45),1));
        }
        LinearLayout secondary=new LinearLayout(this);secondary.setOrientation(LinearLayout.HORIZONTAL);
        root.addView(secondary);
        for(String option:new String[]{"StudyBook AI","MotorAI"}){
            Button b=new Button(this);b.setText(option.equals(room)?"● "+option:option);b.setAllCaps(false);
            b.setTextSize(11);b.setOnClickListener(v->{room=option;draw();});
            secondary.addView(b,new LinearLayout.LayoutParams(0,dp(42),1));
        }
        EditText search=new EditText(this);search.setSingleLine(true);
        search.setHint("🔎 Cerca nei messaggi e nei nomi degli autori");search.setText(term);
        root.addView(search);
        ScrollView scroll=new ScrollView(this);list=new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);scroll.addView(list);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        search.addTextChangedListener(new TextWatcher(){
            @Override public void beforeTextChanged(CharSequence s,int st,int c,int a){}
            @Override public void onTextChanged(CharSequence s,int start,int before,int count){
                term=s.toString();renderList();
            }
            @Override public void afterTextChanged(Editable e){}
        });
        renderList();
        button(root,"📁 Scegli dove creare «Chat Team MotorLab»",()->{
            Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            startActivityForResult(picker,FOLDER_PICK);
        });
        saveButton=button(root,"💾 Salva/aggiorna backup nella cartella",()->saveFolder());
        saveButton.setEnabled(TeamBackupFolder.configured(this));
        button(root,"📥 Importa vecchio backup LAB02 (JSON)",()->{
            Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","application/octet-stream","text/plain"});
            startActivityForResult(i,IMPORT_JSON);
        });
        button(root,"← Torna alla Team Chat",()->finish());
        setContentView(root);
    }
    private void renderList(){
        if(list==null)return;
        list.removeAllViews();
        java.util.List<TeamChatStore.Message> found=db.search(room,term,150);
        list.addView(text("Messaggi trovati: "+found.size()+(found.size()==150?" (primi 150)":"")+" · "+room,13));
        if(found.isEmpty())list.addView(text("Nessun messaggio qui. Puoi importare un backup LAB02 oppure scrivere in Team Chat.",14));
        SimpleDateFormat fmt=new SimpleDateFormat("dd/MM/yyyy HH:mm",Locale.ITALY);
        for(TeamChatStore.Message m:found){
            String line=m.room+" · "+m.author+" · "+fmt.format(new Date(m.when))+"\n"+m.body;
            Button b=new Button(this);
            b.setText(line.length()>230?line.substring(0,230)+"…":line);
            b.setTextSize(12);b.setAllCaps(false);b.setGravity(android.view.Gravity.START);
            b.setOnClickListener(v->alert(m.room+" · "+m.author+" → "+m.recipient+
                "\n"+fmt.format(new Date(m.when))+"\n\n"+m.body+
                "\n\nProvenienza: "+m.source+" (non equivale a verifica)"));
            list.addView(b,new LinearLayout.LayoutParams(-1,-2));
        }
    }
    private void saveFolder(){
        saveButton.setEnabled(false);state.setText("Salvataggio in corso…");
        new Thread(()->{
            String message;
            try{int count=TeamBackupFolder.saveNow(getApplicationContext());
                message="Backup aggiornato: "+count+" archivi JSON nella cartella «Chat Team MotorLab».";
            }catch(Exception e){message="Backup non aggiornato: "+e.getClass().getSimpleName()+
                ". I messaggi restano comunque nella memoria locale.";}
            final String result=message;
            runOnUiThread(()->{state.setText(result);saveButton.setEnabled(true);alert(result);});
        },"motorlab-backup-manual").start();
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(result!=RESULT_OK||data==null)return;
        if(request==FOLDER_PICK){
            try{
                TeamBackupFolder.set(this,data);
                draw();saveFolder();
            }catch(Exception e){alert("Permesso per la cartella non disponibile: "+e.getClass().getSimpleName());}
        }else if(request==IMPORT_JSON){
            Uri uri=data.getData();if(uri==null)return;
            new AlertDialog.Builder(this).setTitle("Importare le conversazioni?")
                .setMessage("I messaggi del file JSON saranno aggiunti all'archivio LAB04 senza eliminare nulla. "+
                    "I risultati AI importati restano NON verificati. Continuare?")
                .setNegativeButton("Annulla",null)
                .setPositiveButton("Importa",(dialog,which)->importFile(uri)).show();
        }
    }
    private void importFile(Uri uri){
        state.setText("Importazione in corso…");
        new Thread(()->{
            String feedback;
            try(InputStream stream=getContentResolver().openInputStream(uri)){
                if(stream==null)throw new IllegalStateException("File non leggibile");
                ByteArrayOutputStream buffer=new ByteArrayOutputStream();
                byte[] block=new byte[4096];int n;
                while((n=stream.read(block))!=-1){
                    if(buffer.size()+n>2_000_000)throw new IllegalArgumentException("Backup superiore a 2MB");
                    buffer.write(block,0,n);
                }
                TeamChatStore.ImportReport report=db.importBackup(
                    buffer.toString(StandardCharsets.UTF_8.name()));
                feedback="Importazione riuscita. Nuovi messaggi: "+report.inserted+
                    "; già presenti: "+report.skipped+".";
                TeamBackupFolder.schedule(getApplicationContext());
            }catch(Exception e){feedback="Importazione non riuscita: "+e.getClass().getSimpleName()+
                ". Nessun messaggio precedente è stato cancellato.";}
            final String done=feedback;
            runOnUiThread(()->{state.setText(done);renderList();alert(done);});
        },"motorlab-backup-import").start();
    }
    @Override protected void onDestroy(){if(db!=null)db.close();super.onDestroy();}
}
