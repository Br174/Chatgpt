package it.motorlab.app;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

final class TeamChatStore extends SQLiteOpenHelper {
    static final class Message {
        long id, when, parent;
        String room, run, author, recipient, kind, body, source;
        Message(Cursor c) {
            id=c.getLong(0); room=c.getString(1); run=c.getString(2);
            author=c.getString(3); recipient=c.getString(4); kind=c.getString(5);
            body=c.getString(6); source=c.getString(7); when=c.getLong(8); parent=c.getLong(9);
        }
    }
    TeamChatStore(Context ctx) {super(ctx,"motorlab_team_v1.db",null,1);}
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE messages(id INTEGER PRIMARY KEY AUTOINCREMENT,"+
            "room TEXT NOT NULL,run TEXT NOT NULL,author TEXT NOT NULL,"+
            "recipient TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,"+
            "source TEXT NOT NULL,created_at INTEGER NOT NULL,parent_id INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE INDEX room_messages ON messages(room,id)");
        db.execSQL("CREATE INDEX run_messages ON messages(run,id)");
        db.execSQL("CREATE TABLE imported_message_keys(source_hash TEXT PRIMARY KEY,new_id INTEGER NOT NULL UNIQUE)");
        db.execSQL("CREATE TABLE lessons(id INTEGER PRIMARY KEY AUTOINCREMENT,"+
            "room TEXT NOT NULL,message_id INTEGER NOT NULL UNIQUE,"+
            "status TEXT NOT NULL,created_at INTEGER NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase d,int from,int to) {
        throw new IllegalStateException("No destructive upgrade: migration required.");
    }
    synchronized long append(String room,String run,String author,String recipient,String kind,
                            String body,String source,long parent) {
        if(body==null||body.trim().isEmpty()||body.length()>10000)
            throw new IllegalArgumentException("Message must contain 1..10000 characters");
        ContentValues v=new ContentValues();
        v.put("room",room);v.put("run",run);v.put("author",author);
        v.put("recipient",recipient);v.put("kind",kind);v.put("body",body.trim());
        v.put("source",source);v.put("created_at",System.currentTimeMillis());v.put("parent_id",parent);
        return getWritableDatabase().insertOrThrow("messages",null,v);
    }
    synchronized List<Message> recent(String room) {
        ArrayList<Message> list=new ArrayList<>();
        try(Cursor c=getReadableDatabase().rawQuery(
            "SELECT id,room,run,author,recipient,kind,body,source,created_at,parent_id "+
            "FROM messages WHERE room=? ORDER BY id DESC LIMIT 80",new String[]{room})){
            while(c.moveToNext())list.add(new Message(c));
        }
        Collections.reverse(list);
        return list;
    }
    synchronized Message latest(String room,String author) {
        try(Cursor c=getReadableDatabase().rawQuery(
            "SELECT id,room,run,author,recipient,kind,body,source,created_at,parent_id "+
            "FROM messages WHERE room=? AND author=? ORDER BY id DESC LIMIT 1",
            new String[]{room,author})) {
            return c.moveToFirst()?new Message(c):null;
        }
    }
    synchronized boolean pin(String room,long id) {
        try(Cursor c=getReadableDatabase().rawQuery(
            "SELECT id FROM messages WHERE room=? AND id=? AND author IN ('Analista','Tester')",
            new String[]{room,String.valueOf(id)})){
            if(!c.moveToFirst())return false;
        }
        ContentValues v=new ContentValues();v.put("room",room);v.put("message_id",id);
        v.put("status","UNVERIFIED");v.put("created_at",System.currentTimeMillis());
        return getWritableDatabase().insertWithOnConflict(
            "lessons",null,v,SQLiteDatabase.CONFLICT_IGNORE)>0;
    }
    synchronized String exportJson() throws Exception {
        JSONObject out=new JSONObject().put("schema","motorlab-team-chat-lab02-v1")
            .put("state","LOCAL_UNVERIFIED");JSONArray messages=new JSONArray(), lessons=new JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery(
            "SELECT id,room,run,author,recipient,kind,body,source,created_at,parent_id "+
            "FROM messages ORDER BY id",null)){
            while(c.moveToNext()){
                Message m=new Message(c);
                messages.put(new JSONObject().put("id",m.id).put("room",m.room)
                    .put("run",m.run).put("author",m.author).put("recipient",m.recipient)
                    .put("kind",m.kind).put("body",m.body).put("source",m.source)
                    .put("createdAt",m.when).put("parentId",m.parent));
            }
        }
        try(Cursor c=getReadableDatabase().rawQuery(
            "SELECT room,message_id,status,created_at FROM lessons ORDER BY id",null)){
            while(c.moveToNext())lessons.put(new JSONObject()
                .put("room",c.getString(0)).put("messageId",c.getLong(1))
                .put("status",c.getString(2)).put("createdAt",c.getLong(3)));
        }
        return out.put("messages",messages).put("lessons",lessons).toString(2);
    }

    synchronized List<Message> search(String room,String query,int limit) {
        int safeLimit=Math.max(1,Math.min(200,limit));
        String where=" WHERE 1=1";
        ArrayList<String> args=new ArrayList<>();
        if(!"Tutte".equals(room)){where+=" AND room=?";args.add(room);}
        if(query!=null&&!query.trim().isEmpty()){
            where+=" AND (body LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\')";
            String pattern="%"+query.trim().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
            args.add(pattern);args.add(pattern);
        }
        ArrayList<Message> out=new ArrayList<>();
        try(Cursor c=getReadableDatabase().rawQuery(
            "SELECT id,room,run,author,recipient,kind,body,source,created_at,parent_id"+
            " FROM messages"+where+" ORDER BY id DESC LIMIT "+safeLimit,
            args.toArray(new String[0]))) {
            while(c.moveToNext())out.add(new Message(c));
        }
        return out;
    }

    synchronized String exportRoomJson(String targetRoom) throws Exception {
        JSONObject output=new JSONObject()
            .put("schema","motorlab-team-chat-lab02-v1")
            .put("state","LOCAL_UNVERIFIED")
            .put("roomBackup",targetRoom);
        JSONArray content=new JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery(
            "SELECT id,room,run,author,recipient,kind,body,source,created_at,parent_id"+
            " FROM messages WHERE room=? ORDER BY id",new String[]{targetRoom})) {
            while(c.moveToNext()) {
                Message m=new Message(c);
                content.put(new JSONObject().put("id",m.id).put("room",m.room)
                    .put("run",m.run).put("author",m.author).put("recipient",m.recipient)
                    .put("kind",m.kind).put("body",m.body).put("source",m.source)
                    .put("createdAt",m.when).put("parentId",m.parent));
            }
        }
        JSONArray pins=new JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery(
            "SELECT room,message_id,status,created_at FROM lessons WHERE room=? ORDER BY id",
            new String[]{targetRoom})){
            while(c.moveToNext())pins.put(new JSONObject()
                .put("room",c.getString(0)).put("messageId",c.getLong(1))
                .put("status","UNVERIFIED").put("createdAt",c.getLong(3)));
        }
        return output.put("messages",content).put("lessons",pins).toString(2);
    }

    static final class ImportReport {
        final int inserted,skipped;
        ImportReport(int inserted,int skipped){this.inserted=inserted;this.skipped=skipped;}
    }
    private static String checked(String value,int max) {
        if(value==null||value.isEmpty()||value.length()>max)
            throw new IllegalArgumentException("Invalid backup field");
        return value;
    }
    private static boolean knownRoom(String room) {
        return room.equals("MotorLab")||room.equals("MusicLab")
            ||room.equals("StudyBook AI")||room.equals("MotorAI");
    }
    private static String fingerprint(String value) throws Exception {
        byte[] digest=java.security.MessageDigest.getInstance("SHA-256")
            .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder h=new StringBuilder();
        for(byte b:digest)h.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        return h.toString();
    }
    private static long existing(SQLiteDatabase db,String key) {
        try(Cursor c=db.rawQuery("SELECT new_id FROM imported_message_keys WHERE source_hash=?",
            new String[]{key})) {return c.moveToFirst()?c.getLong(0):0;}
    }
    /**
     * Import LAB02 JSON atomically. Imported AI results remain unverified.
     * Persistent hash mapping prevents duplicates when importing the same backup again.
     */
    synchronized ImportReport importBackup(String raw) throws Exception {
        if(raw==null||raw.isEmpty()||raw.length()>2_000_000)
            throw new IllegalArgumentException("Backup JSON vuoto o superiore a 2MB");
        JSONObject j=new JSONObject(raw);
        if(!"motorlab-team-chat-lab02-v1".equals(j.optString("schema")))
            throw new IllegalArgumentException("Formato backup non riconosciuto");
        JSONArray arr=j.getJSONArray("messages");
        if(arr.length()>5000)throw new IllegalArgumentException("Backup troppo grande");
        JSONArray lessons=j.optJSONArray("lessons");
        if(lessons!=null&&lessons.length()>5000)
            throw new IllegalArgumentException("Troppe note nel backup");
        SQLiteDatabase db=getWritableDatabase();
        java.util.HashMap<Long,Long> remap=new java.util.HashMap<>();
        int inserted=0,skipped=0;
        db.beginTransaction();
        try {
            for(int i=0;i<arr.length();i++){
                JSONObject m=arr.getJSONObject(i);
                long priorId=m.getLong("id"),date=m.getLong("createdAt"),oldParent=m.optLong("parentId",0);
                if(priorId<=0||date<=0||remap.containsKey(priorId))
                    throw new IllegalArgumentException("ID o data incoerenti");
                String room=checked(m.getString("room"),60);
                if(!knownRoom(room))throw new IllegalArgumentException("Stanza sconosciuta");
                String who=checked(m.getString("author"),100);
                String recipient=checked(m.getString("recipient"),100);
                String body=checked(m.getString("body"),10000);
                String run=checked(m.getString("run"),160);
                String kind=checked(m.getString("kind"),50);
                String originalSource=checked(m.getString("source"),80);
                String hash=fingerprint(priorId+"\n"+date+"\n"+room+"\n"+who+"\n"+
                    recipient+"\n"+kind+"\n"+run+"\n"+originalSource+"\n"+body);
                long newId=existing(db,hash);
                if(newId>0){skipped++;remap.put(priorId,newId);continue;}
                // LAB02 exports in ID order. Parent references may point to older messages.
                if(oldParent>0&&!remap.containsKey(oldParent))
                    throw new IllegalArgumentException("Riferimento messaggio mancante");
                android.content.ContentValues values=new android.content.ContentValues();
                values.put("room",room);values.put("run","imported:"+run);
                values.put("author",who);values.put("recipient",recipient);
                values.put("kind",kind);values.put("body",body);
                values.put("source","IMPORTED_UNVERIFIED");
                values.put("created_at",date);
                values.put("parent_id",oldParent>0?remap.get(oldParent):0);
                newId=db.insertOrThrow("messages",null,values);
                android.content.ContentValues keyValues=new android.content.ContentValues();
                keyValues.put("source_hash",hash);keyValues.put("new_id",newId);
                db.insertOrThrow("imported_message_keys",null,keyValues);
                remap.put(priorId,newId);inserted++;
            }
            if(lessons!=null)for(int i=0;i<lessons.length();i++){
                JSONObject l=lessons.getJSONObject(i);
                String room=checked(l.getString("room"),60);
                Long newId=remap.get(l.getLong("messageId"));
                if(!knownRoom(room)||newId==null)
                    throw new IllegalArgumentException("Lezione senza messaggio");
                android.content.ContentValues v=new android.content.ContentValues();
                v.put("room",room);v.put("message_id",newId);
                v.put("status","UNVERIFIED");
                v.put("created_at",l.optLong("createdAt",System.currentTimeMillis()));
                db.insertWithOnConflict("lessons",null,v,SQLiteDatabase.CONFLICT_IGNORE);
            }
            db.setTransactionSuccessful();
        } finally {db.endTransaction();}
        return new ImportReport(inserted,skipped);
    }
}
