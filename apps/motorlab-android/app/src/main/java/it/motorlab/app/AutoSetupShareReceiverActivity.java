package it.motorlab.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import java.nio.charset.StandardCharsets;

/**
 * Android Sharesheet ingress for redacted AutoSetup checkpoint JSON.
 * An external share can NEVER execute a task, navigate, import credentials,
 * save sessions, or grant approval. Only opens the internal review dialog.
 */
public final class AutoSetupShareReceiverActivity extends Activity {
    static final String EXTRA_REVIEW_CHECKPOINT="it.motorlab.app.REVIEW_AUTOS_CHECKPOINT";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            Intent incoming=getIntent();
            if(incoming==null||!Intent.ACTION_SEND.equals(incoming.getAction()))
                throw new IllegalArgumentException("Unsupported share");
            String type=incoming.getType();
            if(!"text/plain".equals(type)&&!"application/json".equals(type))
                throw new IllegalArgumentException("Unsupported MIME type");
            CharSequence shared=incoming.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if(shared==null)
                throw new IllegalArgumentException("No checkpoint");
            String json=shared.toString();
            if(json.getBytes(StandardCharsets.UTF_8).length>AutoSetupCheckpointBridge.MAX_BYTES)
                throw new IllegalArgumentException("Shared checkpoint too large");
            // Reject malicious shares before opening any app screen.
            AutoSetupCheckpointBridge.inspect(json);
            Intent review=new Intent(this,AutoSetupActivity.class);
            review.setAction("it.motorlab.app.ACTION_REVIEW_ONLY");
            review.putExtra(EXTRA_REVIEW_CHECKPOINT,json);
            startActivity(review);
        } catch(Exception e) {
            // Never log, forward or display untrusted clipboard/share text.
            android.widget.Toast.makeText(this,
                "Checkpoint non valido: nessuna azione effettuata.",
                android.widget.Toast.LENGTH_LONG).show();
        } finally {
            finish();
        }
    }
}
