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
}
