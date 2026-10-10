package it.motorlab.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

final class AppSettings {
    private final SharedPreferences prefs;
    AppSettings(Context context) {
        prefs = context.getSharedPreferences("motorlab_lab01_settings", Context.MODE_PRIVATE);
    }
    String provider() { return prefs.getString("provider", "gemini"); }
    void provider(String value) { prefs.edit().putString("provider", value).apply(); }
    String model() { return prefs.getString("gemini_model", "gemini-3.5-flash-lite"); }
    void model(String value) { prefs.edit().putString("gemini_model", value).apply(); }
    boolean freeTierConfirmed() { return prefs.getBoolean("google_free_verified", false); }
    void freeTierConfirmed(boolean value) { prefs.edit().putBoolean("google_free_verified", value).apply(); }
    int usesToday() {
        String day = new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date());
        return day.equals(prefs.getString("day", "")) ? prefs.getInt("count", 0) : 0;
    }
    boolean reserveDailyTrialCall() {
        if (usesToday() >= 5) return false;
        String day = new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date());
        prefs.edit().putString("day", day).putInt("count", usesToday() + 1).commit();
        return true;
    }
}
