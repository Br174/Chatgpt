package it.motorlab.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class GeminiClient {
    static String reply(String model, String key, String prompt) throws Exception {
        if (key.isEmpty() || prompt.trim().isEmpty()) throw new IllegalArgumentException("Chiave o domanda mancante");
        if (!model.matches("[a-zA-Z0-9._-]{3,100}")) throw new IllegalArgumentException("Nome modello non valido");
        URL url = new URL("https://generativelanguage.googleapis.com/v1beta/models/"
            + model + ":generateContent");
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(12000);
        c.setReadTimeout(45000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        c.setRequestProperty("x-goog-api-key", key);
        try {
            JSONObject req = new JSONObject()
                .put("contents", new JSONArray().put(new JSONObject().put("parts",
                     new JSONArray().put(new JSONObject().put("text", prompt)))));
            req.put("generationConfig", new JSONObject().put("maxOutputTokens", 1024));
            try (OutputStream out = c.getOutputStream()) {
                out.write(req.toString().getBytes(StandardCharsets.UTF_8));
            }
            int status = c.getResponseCode();
            if (status == 429) throw new IllegalStateException("Quota o limite Google raggiunto (429). Nessun retry automatico.");
            if (status < 200 || status > 299)
                throw new IllegalStateException("Gemini non disponibile: HTTP " + status + ". Controlla modello, chiave e piano.");
            String content = read(c.getInputStream());
            JSONObject json = new JSONObject(content);
            JSONArray candidates = json.optJSONArray("candidates");
            if (candidates == null || candidates.length() == 0) return "Nessuna risposta testuale disponibile.";
            JSONArray parts = candidates.getJSONObject(0).getJSONObject("content").getJSONArray("parts");
            StringBuilder ans = new StringBuilder();
            for (int i=0; i<parts.length(); i++) {
                String t = parts.getJSONObject(i).optString("text", "");
                if (!t.isEmpty()) ans.append(t);
            }
            return ans.length()==0 ? "Risposta vuota." : ans.toString();
        } finally { c.disconnect(); }
    }
    private static String read(InputStream in) throws Exception {
        try (InputStream s=in; ByteArrayOutputStream b=new ByteArrayOutputStream()) {
            byte[] buf=new byte[4096]; int n;
            while ((n=s.read(buf)) != -1) {
                if (b.size()+n > 500_000) throw new IllegalStateException("Risposta troppo grande");
                b.write(buf,0,n);
            }
            return b.toString("UTF-8");
        }
    }
}
