package it.motorlab.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class SecureGeminiKey {
    private static final String ALIAS = "motorlab_lab01_gemini_byok";
    private final SharedPreferences prefs;

    SecureGeminiKey(Context ctx) {
        prefs = ctx.getSharedPreferences("motorlab_lab01_secure", Context.MODE_PRIVATE);
    }
    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        SecretKey existing = (SecretKey) ks.getKey(ALIAS, null);
        if (existing != null) return existing;
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return kg.generateKey();
    }
    void save(String secret) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = c.doFinal(secret.getBytes(StandardCharsets.UTF_8));
        prefs.edit()
            .putString("iv", Base64.encodeToString(c.getIV(), Base64.NO_WRAP))
            .putString("encrypted", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .commit();
    }
    String load() throws Exception {
        String iv = prefs.getString("iv", ""), cipher = prefs.getString("encrypted", "");
        if (iv.isEmpty() || cipher.isEmpty()) return "";
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key(),
            new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return new String(c.doFinal(Base64.decode(cipher, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
    void clear() {
        prefs.edit().remove("iv").remove("encrypted").commit();
        try { KeyStore ks=KeyStore.getInstance("AndroidKeyStore"); ks.load(null); ks.deleteEntry(ALIAS); }
        catch (Exception ignored) { /* Already inaccessible */ }
    }
}
