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

/**
 * Independent encrypted vault for explicitly entered AutoSetup service credentials.
 * Never persist these fields as Team Chat messages, JSON backups, diagnostics or GitHub files.
 */
final class SecureServiceToken {
    private static final String PREFS="motorlab_autosetup_secure_v1";
    private static final String PREFIX="motorlab_autosetup_";
    private final SharedPreferences prefs;

    SecureServiceToken(Context context) {
        prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }

    private static String checked(String service) {
        if(!"github".equals(service)&&!"cloudflare".equals(service))
            throw new IllegalArgumentException("Servizio non autorizzato");
        return service;
    }

    private static String alias(String service){return PREFIX+checked(service)+"_aes_gcm_v1";}

    private SecretKey key(String service) throws Exception {
        String name=alias(service);
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey result=(SecretKey)store.getKey(name,null);
        if(result!=null)return result;
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(name,
            KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return generator.generateKey();
    }

    synchronized void save(String service,String token) throws Exception {
        checked(service);
        if(token==null||token.trim().isEmpty()||token.length()>1000)
            throw new IllegalArgumentException("Credenziale non valida");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,key(service));
        byte[] enc=cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        boolean ok=prefs.edit()
            .putString(service+"_iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP))
            .putString(service+"_cipher",Base64.encodeToString(enc,Base64.NO_WRAP))
            .commit();
        if(!ok)throw new IllegalStateException("Salvataggio locale non riuscito");
    }

    synchronized String load(String service) throws Exception {
        checked(service);
        String iv=prefs.getString(service+"_iv","");
        String enc=prefs.getString(service+"_cipher","");
        if(iv.isEmpty()||enc.isEmpty())return "";
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,key(service),
            new GCMParameterSpec(128,Base64.decode(iv,Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(enc,Base64.NO_WRAP)),StandardCharsets.UTF_8);
    }

    synchronized boolean has(String service) {
        checked(service);
        return prefs.contains(service+"_cipher")&&prefs.contains(service+"_iv");
    }

    synchronized void clear(String service) {
        checked(service);
        prefs.edit().remove(service+"_iv").remove(service+"_cipher").commit();
        try {
            KeyStore store=KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            store.deleteEntry(alias(service));
        } catch(Exception ignored) {
            // Deletion of an inaccessible key does not affect other providers.
        }
    }
}
