package it.motorlab.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.net.IDN;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Locale;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Generic secure credential vault: never assumes a named service.
 * Entries are scoped to exact HTTPS origin; never include secrets in chat, logs
 * or exported Team Chat JSON. Passwords should use provider-owned sign-in.
 */
final class SecureServiceToken {
    private static final String PREFS="motorlab_autosetup_secure_v1";
    private static final String PREFIX="motorlab_autosetup_v1_";
    private final SharedPreferences prefs;

    SecureServiceToken(Context ctx) {
        prefs=ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }

    static String checkedOrigin(String siteUrl) {
        try {
            URI url=new URI(siteUrl.trim());
            if(!"https".equalsIgnoreCase(url.getScheme())
                    ||url.getRawUserInfo()!=null
                    ||url.getHost()==null
                    ||(url.getPort()!=-1&&url.getPort()!=443))
                throw new IllegalArgumentException("È richiesto un sito HTTPS pubblico");
            String host=IDN.toASCII(url.getHost(),IDN.USE_STD3_ASCII_RULES)
                .toLowerCase(Locale.ROOT);
            if(host.length()>253||!host.contains(".")
                    ||host.startsWith(".")||host.endsWith(".")
                    ||host.equals("localhost")||host.endsWith(".localhost")
                    ||host.endsWith(".local")||host.endsWith(".internal")
                    ||host.matches("[0-9.]+")||host.contains(":"))
                throw new IllegalArgumentException("Host non consentito");
            return "https://"+host;
        } catch(Exception e) {
            throw new IllegalArgumentException("Inserire l'indirizzo HTTPS di un sito pubblico");
        }
    }

    private static String entry(String url) {
        try {
            String origin=checkedOrigin(url);
            MessageDigest md=MessageDigest.getInstance("SHA-256");
            byte[] d=md.digest(origin.getBytes(StandardCharsets.UTF_8));
            StringBuilder b=new StringBuilder();
            for(int i=0;i<16;i++)b.append(String.format(Locale.ROOT,"%02x",d[i]&0xff));
            return b.toString();
        }catch(Exception e){throw new IllegalArgumentException("Sito non valido");}
    }

    private static String alias(String url){return PREFIX+entry(url);}
    private SecretKey key(String url) throws Exception {
        String alias=alias(url);
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey result=(SecretKey)store.getKey(alias,null);
        if(result!=null)return result;
        KeyGenerator kg=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(alias,
            KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return kg.generateKey();
    }

    synchronized void save(String originUrl,String token) throws Exception {
        String id=entry(originUrl);
        if(token==null||token.trim().isEmpty()||token.length()>1000)
            throw new IllegalArgumentException("Credenziale non valida");
        Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE,key(originUrl));
        byte[] encrypted=c.doFinal(token.getBytes(StandardCharsets.UTF_8));
        if(!prefs.edit()
            .putString(id+"_iv",Base64.encodeToString(c.getIV(),Base64.NO_WRAP))
            .putString(id+"_encrypted",Base64.encodeToString(encrypted,Base64.NO_WRAP))
            .commit())throw new IllegalStateException("Salvataggio locale non riuscito");
    }

    synchronized String load(String originUrl) throws Exception {
        String id=entry(originUrl);
        String iv=prefs.getString(id+"_iv","");
        String enc=prefs.getString(id+"_encrypted","");
        if(iv.isEmpty()||enc.isEmpty())return "";
        Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE,key(originUrl),
            new GCMParameterSpec(128,Base64.decode(iv,Base64.NO_WRAP)));
        return new String(c.doFinal(Base64.decode(enc,Base64.NO_WRAP)),StandardCharsets.UTF_8);
    }

    synchronized boolean has(String originUrl) {
        String id=entry(originUrl);
        return prefs.contains(id+"_iv")&&prefs.contains(id+"_encrypted");
    }

    synchronized void clear(String originUrl) {
        String id=entry(originUrl);
        prefs.edit().remove(id+"_iv").remove(id+"_encrypted").commit();
        try {
            KeyStore store=KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            store.deleteEntry(alias(originUrl));
        } catch(Exception ignored) {
            // An inaccessible key does not compromise other saved origins.
        }
    }
}
