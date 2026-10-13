#!/usr/bin/env python3
from pathlib import Path
p=Path(__file__).resolve().parents[1]
source=(p/"app/src/main/java/it/motorlab/app/MainActivity.java").read_text()
manifest=(p/"app/src/main/AndroidManifest.xml").read_text()
gemini=(p/"app/src/main/java/it/motorlab/app/GeminiClient.java").read_text()
key=(p/"app/src/main/java/it/motorlab/app/SecureGeminiKey.java").read_text()
openai=(p/"app/src/main/java/it/motorlab/app/ChatGptPlan.java").read_text()
assert "applicationId 'it.motorlab.app'" in (p/"app/build.gradle").read_text()
assert "applicationId 'it.motorlab.app.lab" not in (p/"app/build.gradle").read_text()
assert "versionCode 5" in (p/"app/build.gradle").read_text()
# Main release signing must never fall back to the disposable LAB/test certificate.
gradle=(p/"app/build.gradle").read_text()
assert "signingConfig signingConfigs.mainApp" in gradle
assert "signingConfig signingConfigs.lab" not in gradle
assert "MOTORLAB_MAIN_KEYSTORE" in gradle
assert "MOTORLAB_MAIN_STORE_PASSWORD" in gradle
assert "MOTORLAB_MAIN_KEY_PASSWORD" in gradle
assert 'android:allowBackup="false"' in manifest
assert "GeminiClient.reply" in source
assert "KeyGenParameterSpec" in key and "AES/GCM/NoPadding" in key
assert "x-goog-api-key" in gemini and "429" in gemini
assert "boolean usableNow() { return false; }" in openai
assert "chatgpt.tokens.use.direct" in (p/"README.md").read_text()
assert "reserveDailyTrialCall()" in source
assert "read-only" in (p/"README.md").read_text() or "sola lettura" in source
print("LAB01 static contract: PASS (does not establish successful Android runtime or OAuth)")

teamstore=(p/"app/src/main/java/it/motorlab/app/TeamChatStore.java").read_text()
teamlogic=(p/"app/src/main/java/it/motorlab/app/TeamCoordinator.java").read_text()
teamui=(p/"app/src/main/java/it/motorlab/app/TeamChatActivity.java").read_text()
assert "SQLiteOpenHelper" in teamstore and "parent_id" in teamstore and "run" in teamstore
assert "UNVERIFIED" in teamstore and "exportJson" in teamstore
assert 'GEMINI_UNVERIFIED' in teamlogic and teamlogic.count("GeminiClient.reply") == 2
assert teamlogic.count("reserveDailyTrialCall()") == 2
assert "TeamChatActivity" in manifest and 'android:exported="false"' in manifest
assert "ACTION_CREATE_DOCUMENT" in teamui and "TeamCoordinator.run" in teamui
assert "applicationId 'it.motorlab.app'" in (p/"app/build.gradle").read_text()
assert "versionCode 5" in (p/"app/build.gradle").read_text()
print("LAB02 Team Chat contract: PASS - runtime and live AI not proven")

archive=(p/"app/src/main/java/it/motorlab/app/TeamArchiveActivity.java").read_text()
folder=(p/"app/src/main/java/it/motorlab/app/TeamBackupFolder.java").read_text()
assert "TeamArchiveActivity" in teamui and "Archivio Team Chat" in teamui
assert "TeamArchiveActivity" in manifest and 'android:exported="false"' in manifest
assert "ACTION_OPEN_DOCUMENT_TREE" in archive and "ACTION_OPEN_DOCUMENT" in archive
assert "renderList()" in archive and "importBackup" in archive
assert "exportRoomJson" in teamstore and "synchronized ImportReport importBackup" in teamstore
assert "imported_message_keys" in teamstore and "db.beginTransaction()" in teamstore
assert "Chat Team MotorLab" in folder and "takePersistableUriPermission" in folder
assert "DocumentsContract.createDocument" in folder and "Executors.newSingleThreadExecutor()" in folder
assert "TeamBackupFolder.schedule" in teamui
print("LAB04 static archive contract: PASS (not equivalent to a phone test)")

assert 'android:label="MotorLab"' in manifest
assert 'android:label="MotorLab Archivio"' not in manifest
assert "TeamChatActivity" in source and "TeamArchiveActivity" in teamui
print("Unified app identity/Team Chat/Archive: PASS (signing and device acceptance not yet verified)")


# Generic AutoSetup LAB: provider-neutral, user-scoped HTTPS origin & zero implicit writes.
autosetup=(p/"app/src/main/java/it/motorlab/app/AutoSetupActivity.java").read_text()
vault=(p/"app/src/main/java/it/motorlab/app/SecureServiceToken.java").read_text()
assert 'class AutoSetupActivity' in autosetup
assert "SecureServiceToken.checkedOrigin" in autosetup
assert "Riconosci i campi" in autosetup and "Compila i campi" in autosetup
assert "Prova modulo generico offline" in autosetup
assert "Password da escludere" in autosetup
assert "querySelectorAll('input,textarea,select')" in autosetup
assert "password','hidden','file" in autosetup
assert "setAllowFileAccess(false)" in autosetup
assert "setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)" in autosetup
assert "new Intent(Intent.ACTION_VIEW" in autosetup
assert "new SecureServiceToken(this)" in autosetup
assert "checkedOrigin(String siteUrl)" in vault and "IDN.toASCII" in vault
assert "new URI(siteUrl.trim())" in vault and '"https".equalsIgnoreCase' in vault
assert 'originUrl' in vault and "KeyStore.getInstance(\"AndroidKeyStore\")" in vault
assert "AES/GCM/NoPadding" in vault
assert '"github".equals(service)' not in vault and '"cloudflare".equals(service)' not in vault
assert "AutoSetupActivity" in manifest and 'android:exported="false"' in manifest
assert "AutoSetupActivity.class" in teamui and "AutoSetupActivity.class" in source
assert "versionCode 5" in (p/"app/build.gradle").read_text()
assert "private void suggestValues()" in autosetup
assert "Suggerisci valori con Gemini (facoltativo)" in autosetup
assert "Nessun campo sarà compilato sul sito" in autosetup
assert "new SecureGeminiKey(this).load()" in autosetup
assert "appSettings.reserveDailyTrialCall()" in autosetup
assert "f.editor.getText().length()==0" in autosetup
plan=(p/"app/src/main/java/it/motorlab/app/AutoSetupTaskPlan.java").read_text()
assert 'class AutoSetupTaskPlan' in plan
assert "Invio definitivo non automatico" in plan
assert "credenziali non sono incluse" in plan
assert "Mostra piano operazioni" in autosetup and "currentTaskPlan()" in autosetup
assert "taskPlan=null" in autosetup and ".scanned(found.length())" in autosetup
assert ".links(shown)" in autosetup and ".prepared(updates.length())" in autosetup
assert ".applied(Integer.parseInt(count))" in autosetup
assert "MOTORLAB_AUTOSETUP_STAGED_PLAN=PASSED_NO_AUTO_SUBMIT" in (p/"tests/emulator_smoke.py").read_text()
assert "Analizza pagina e pianifica" in autosetup and "guidedAnalysisPending" in autosetup
assert "MOTORLAB_AUTOSETUP_GUIDED_READONLY_ANALYSIS=PASSED" in (p/"tests/emulator_smoke.py").read_text()
assert "private void openDemoSettingsPage()" in autosetup
assert "private void discoverLinks()" in autosetup
assert 'new AlertDialog.Builder(this).setTitle("Navigare sul sito?")' in autosetup
assert "Navigazione esterna bloccata nella demo offline." in autosetup
emulator=(p/"tests/emulator_smoke.py").read_text()
assert "MOTORLAB_AUTOSETUP_MULTIPAGE_CONSENT_AND_SCAN=PASSED_OFFLINE" in emulator
print("AutoSetup universal HTTPS + optional consented AI suggestion source contract: PASS (live provider call not proven)")
