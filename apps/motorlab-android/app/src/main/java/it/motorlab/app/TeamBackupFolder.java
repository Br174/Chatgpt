package it.motorlab.app;

import android.content.Context;
import android.content.Intent;
import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** User-selected Storage Access Framework tree; never write to arbitrary public storage. */
final class TeamBackupFolder {
    static final String FOLDER="Chat Team MotorLab";
    private static final String PREF="motorlab_team_backup_v1",KEY="saf_tree";
    private static final String[] ROOMS={"MotorLab","MusicLab","StudyBook AI","MotorAI"};
    private static final String[] FILES={"MotorLab.json","MusicLab.json","StudyBook-AI.json","MotorAI.json"};
    private static final ExecutorService WRITER=Executors.newSingleThreadExecutor();
    static boolean configured(Context c){return get(c)!=null;}
    static Uri get(Context c){
        String uri=c.getSharedPreferences(PREF,Context.MODE_PRIVATE).getString(KEY,null);
        return uri==null?null:Uri.parse(uri);
    }
    static void set(Context c,Intent result){
        if(result==null||result.getData()==null)throw new IllegalArgumentException("Nessuna cartella scelta");
        Uri uri=result.getData();
        c.getContentResolver().takePersistableUriPermission(uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().putString(KEY,uri.toString()).commit();
    }
    static void clear(Context c){
        Uri uri=get(c);
        if(uri!=null)try{
            c.getContentResolver().releasePersistableUriPermission(uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        }catch(Exception ignored){}
        c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().remove(KEY).commit();
    }
    private static Uri child(Context c,Uri tree,Uri parent,String target) throws Exception {
        ContentResolver cr=c.getContentResolver();
        String parentId=DocumentsContract.getDocumentId(parent);
        Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parentId);
        try(Cursor cur=cr.query(children,new String[]{
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
            if(cur==null)throw new IllegalStateException("Cartella non consultabile");
            while(cur.moveToNext())if(target.equals(cur.getString(1)))
                return DocumentsContract.buildDocumentUriUsingTree(tree,cur.getString(0));
        }
        return null;
    }
    private static Uri ensureFolder(Context c,Uri tree) throws Exception {
        Uri root=DocumentsContract.buildDocumentUriUsingTree(
            tree,DocumentsContract.getTreeDocumentId(tree));
        Uri found=child(c,tree,root,FOLDER);
        if(found!=null)return found;
        Uri created=DocumentsContract.createDocument(c.getContentResolver(),root,
            DocumentsContract.Document.MIME_TYPE_DIR,FOLDER);
        if(created==null)throw new IllegalStateException("Creazione cartella negata");
        return created;
    }
    /** One JSON snapshot per room; current phone SQLite remains authoritative. */
    static int saveNow(Context c) throws Exception {
        Uri tree=get(c);
        if(tree==null)throw new IllegalStateException("Scegli prima dove creare la cartella");
        Uri folder=ensureFolder(c,tree);
        TeamChatStore db=new TeamChatStore(c);
        try{
            for(int i=0;i<ROOMS.length;i++){
                String text=db.exportRoomJson(ROOMS[i]);
                Uri file=child(c,tree,folder,FILES[i]);
                if(file==null)file=DocumentsContract.createDocument(
                    c.getContentResolver(),folder,"application/json",FILES[i]);
                if(file==null)throw new IllegalStateException("Impossibile scrivere "+FILES[i]);
                try(OutputStream out=c.getContentResolver().openOutputStream(file,"wt")){
                    if(out==null)throw new IllegalStateException("File non scrivibile");
                    out.write(text.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                }
            }
        }finally{db.close();}
        return ROOMS.length;
    }
    static void schedule(Context c){
        if(!configured(c))return;
        Context app=c.getApplicationContext();
        WRITER.execute(()->{
            try{saveNow(app);}catch(Exception e){
                // Explicit "Copia backup adesso" exposes folder errors to the user.
                // SQLite local history still survives failed folder sync.
                android.util.Log.w("MotorLabBackup","Folder backup not updated: "+e.getClass().getSimpleName());
            }
        });
    }
    private TeamBackupFolder(){}
}
