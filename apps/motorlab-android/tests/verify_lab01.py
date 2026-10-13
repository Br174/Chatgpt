#!/usr/bin/env python3
from pathlib import Path
import json
import hashlib
import struct
p=Path(__file__).resolve().parents[1]
source=(p/"app/src/main/java/it/motorlab/app/MainActivity.java").read_text()
manifest=(p/"app/src/main/AndroidManifest.xml").read_text()
gemini=(p/"app/src/main/java/it/motorlab/app/GeminiClient.java").read_text()
key=(p/"app/src/main/java/it/motorlab/app/SecureGeminiKey.java").read_text()
openai=(p/"app/src/main/java/it/motorlab/app/ChatGptPlan.java").read_text()
assert "applicationId 'it.motorlab.app'" in (p/"app/build.gradle").read_text()
assert "applicationId 'it.motorlab.app.lab" not in (p/"app/build.gradle").read_text()
assert "versionCode 6" in (p/"app/build.gradle").read_text()
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
assert "versionCode 6" in (p/"app/build.gradle").read_text()
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
assert "versionCode 6" in (p/"app/build.gradle").read_text()
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
assert "currentTaskPlan().applied(applied);" in autosetup
assert "MOTORLAB_AUTOSETUP_STAGED_PLAN=PASSED_NO_AUTO_SUBMIT" in (p/"tests/emulator_smoke.py").read_text()
assert "Analizza pagina e pianifica" in autosetup and "guidedAnalysisPending" in autosetup
assert "MOTORLAB_AUTOSETUP_GUIDED_READONLY_ANALYSIS=PASSED" in (p/"tests/emulator_smoke.py").read_text()
assert "private void executeSuggestedStep()" in autosetup and "private void finishGuidedNavigation()" in autosetup
assert "Esegui passo suggerito" in autosetup and "Apri e analizza" in autosetup
assert "destinationOrigin.equals(activeOrigin)" in autosetup
assert "MOTORLAB_AUTOSETUP_APPROVED_STEP_AND_READONLY_RESCAN=PASSED_OFFLINE" in (p/"tests/emulator_smoke.py").read_text()
assert "private void openDemoSettingsPage()" in autosetup
goalrouter=(p/"app/src/main/java/it/motorlab/app/AutoSetupGoalRouter.java").read_text()
assert "class AutoSetupGoalRouter" in goalrouter
assert "static int score(String goal,String linkLabel)" in goalrouter
assert "Percorso suggerito:" in autosetup
assert "MOTORLAB_AUTOSETUP_LOCAL_GOAL_ROUTE_HINT=PASSED_NO_AUTO_NAVIGATION" in (p/"tests/emulator_smoke.py").read_text()
assert "private void discoverLinks()" in autosetup
assert 'new AlertDialog.Builder(this).setTitle("Navigare sul sito?")' in autosetup
assert "Navigazione esterna bloccata nella demo offline." in autosetup
emulator=(p/"tests/emulator_smoke.py").read_text()
assert "MOTORLAB_AUTOSETUP_MULTIPAGE_CONSENT_AND_SCAN=PASSED_OFFLINE" in emulator
print("AutoSetup universal HTTPS + optional consented AI suggestion source contract: PASS (live provider call not proven)")

# Cross-surface (ChatGPT tools ↔ Android APK) portable checkpoint contract.
contract=json.loads((p/"AUTOSETUP_SHARED_CHECKPOINT_V1.schema.json").read_text())
fixture=json.loads((p/"tests/fixtures/autosetup_checkpoint_demo.json").read_text())
assert contract["properties"]["protocol"]["const"]=="motorlab.autosetup.checkpoint"
assert contract["properties"]["version"]["const"]==1
assert contract["properties"]["permissions"]["properties"]["requires_new_consent"]["const"] is True
assert contract["properties"]["permissions"]["properties"]["can_execute"]["const"] is False
assert set(fixture)==set(contract["required"])
assert fixture["protocol"]=="motorlab.autosetup.checkpoint" and fixture["version"]==1
assert fixture["source"] in contract["properties"]["source"]["enum"]
assert fixture["origin"]=="https://autosetup-demo.example"
assert fixture["permissions"]=={"can_execute":False,"requires_new_consent":True}
assert fixture["privacy"]=={"contains_goal":False,"contains_field_values":False,"contains_credentials":False}
assert fixture["verification"]=={"scope":"local_ui_observation","remote_outcome":"not_verified"}
assert set(fixture["observations"])==set(contract["properties"]["observations"]["required"])
assert all(isinstance(v,bool) if k=="page_loaded" else (v is None or isinstance(v,int) and 0<=v<=30)
    for k,v in fixture["observations"].items())
tp=(p/"app/src/main/java/it/motorlab/app/AutoSetupTaskPlan.java").read_text()
assert "String checkpointJson() throws JSONException" in tp
method=tp.split("String checkpointJson()",1)[1].split("String summary()",1)[0]
assert "objective" not in method and "f.editor" not in method and "password" not in method
assert 'put("requires_new_consent",true)' in method and 'put("can_execute",false)' in method
assert "Condividi checkpoint" in autosetup and "Intent.ACTION_SEND" in autosetup
assert "Condividere checkpoint AutoSetup?" in autosetup and "NON contiene obiettivo" in autosetup
assert "MOTORLAB_AUTOSETUP_REDACTED_CHECKPOINT_SHARE_CONSENT=PASSED" in emulator
print("AutoSetup shared redacted contract and explicit Android share: PASS")

# Original user-supplied two-gear icon is resampled only for Android avatar density.
icon=p/"app/src/main/res/drawable-nodpi/autosetup_avatar.png"
raw=icon.read_bytes()
assert raw[:8]==b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II",raw[16:24])==(96,96)
assert hashlib.sha256(raw).hexdigest()=="a087c868ff129847326a3a4fcb5e4823b3e50c46cf18e888e4f75edc4f361227"
assert 'setImageResource(R.drawable.autosetup_avatar)' in autosetup
assert 'setContentDescription("AutoSetup attivo")' in autosetup
assert "avatar.setBackground(null);" in autosetup
assert "avatar.setPadding(0,0,0,0);" in autosetup
assert "GradientDrawable" not in autosetup
assert "avatar.setBackground(circle)" not in autosetup
assert 'private void activateAutoSetup()' in autosetup
assert 'activateAutoSetup();' in autosetup
assert 'MOTORLAB_AUTOSETUP_ORIGINAL_AVATAR=PASSED_ACTIVE_ONLY' in emulator
print("AutoSetup user-original inline avatar resource and active state: PASS")

assert 'setTitle("Confermare la compilazione?")' in autosetup
assert 'setPositiveButton("Conferma compilazione"' in autosetup
assert "private void applyApprovedFormChanges()" in autosetup
assert "return 'PAGE_CHANGED';" in autosetup
assert "SALVANO AUTOMATICAMENTE" in autosetup
assert "MOTORLAB_AUTOSETUP_FORM_REVIEW_CONSENT_CANCEL=PASSED" in emulator
print("AutoSetup explicit pre-write approval and complete DOM preflight: PASS")

# AS6: distinct DOM observation and server persistence, redacted local receipts.
receipt=(p/"app/src/main/java/it/motorlab/app/AutoSetupOperationEvidence.java").read_text()
assert 'class AutoSetupOperationEvidence' in receipt
assert 'MAX_EVENTS=20' in receipt and 'SharedPreferences' in receipt
assert '"remote_save","not_verified"' in receipt
assert '"contains_field_values",false' in receipt
assert '"contains_credentials",false' in receipt
assert '"requested_fields",requested' in receipt
assert "String latestSummary(Context context)" in receipt
assert "private void verifyAppliedDomValues(" in autosetup
assert "private void publishDomReceipt(" in autosetup
assert "browser.postDelayed(()->verifyAppliedDomValues(" in autosetup
assert "AutoSetupOperationEvidence.latestSummary(this)" in autosetup
assert "MOTORLAB_AUTOSETUP_DOM_SECOND_READBACK=PASSED_FIELDS_2" in emulator
print("AS6 redacted bounded receipt and second read-only DOM verification: PASS")

# AS6B runtime verification: private receipts, no synthetic form values, survive process restart.
assert "MOTORLAB_AUTOSETUP_RECEIPT_PRIVATE_REDACTED=PASSED" in emulator
assert "MOTORLAB_AUTOSETUP_RECEIPT_REOPEN_PERSISTENCE=PASSED" in emulator
assert "shared_prefs/autosetup_operation_evidence_v1.xml" in emulator
print("AS6B local receipt privacy and persistence gate: PASS")

# AS7 read-only GitHub provider readback, separate from website-form persistence.
readback=(p/"tests/verify_github_provider_readback.py").read_text()
workflow=(p.parent.parent/".github/workflows/motorlab-app-unified-gate.yml").read_text()
assert "def compare(branch, pull, ref_name, expected_sha, repo):" in readback
assert "ERROR_PROVIDER_INCONSISTENT" in readback
assert "STALE_RUN" in readback
assert "VERIFIED_GITHUB_BRANCH_AND_PR" in readback
assert "GITHUB_COMMIT_ONLY_NOT_WEBSITE_FORM" in readback
assert "autosetup_provider_readback:" in workflow
assert "pull-requests: read" in workflow
assert "GH_TOKEN: "+"$"+"{{ secrets.GITHUB_TOKEN }}" in workflow
print("AS7 provider-readback gate static contracts: PASS")

# Progress is milestone-based for the *local form workflow*, never wall-clock or server save.
taskplan=(p/"app/src/main/java/it/motorlab/app/AutoSetupTaskPlan.java").read_text()
assert "int progressPercent()" in taskplan
assert "void domVerified(int requested,int observed)" in taskplan
assert "if(domConfirmed)return 100;" in taskplan
assert "if(appliedFields>0)return 80;" in taskplan
assert "if(scannedFields>=0)return 40;" in taskplan
assert "non è salvataggio sul server" in taskplan
assert "Avanzamento locale: " in autosetup
assert "[\"+localProgressPercent()+\"% percorso locale]" in autosetup
assert 'taskPlan.domVerified(requested,observed)' in autosetup
assert "MOTORLAB_AUTOSETUP_STAGE_PROGRESS=PASSED_LOCAL_100_NOT_REMOTE" in emulator
print("AutoSetup percentage progress is stage-derived, local-only and tested: PASS")

# AS8B regression: verified milestone percents and no progress leakage across pages.
assert 'pageReady=false;inspectedUrl="";taskPlan=null;controls.clear();fields.removeAllViews();' in autosetup
assert "MOTORLAB_AUTOSETUP_PROGRESS_20_PAGE_READY=PASSED" in emulator
assert "MOTORLAB_AUTOSETUP_PROGRESS_40_SCAN=PASSED" in emulator
assert "MOTORLAB_AUTOSETUP_PROGRESS_60_PREPARED=PASSED" in emulator
assert "MOTORLAB_AUTOSETUP_PROGRESS_CANCEL_RETAINS_60=PASSED" in emulator
assert "MOTORLAB_AUTOSETUP_PROGRESS_NEW_PAGE_RESET=PASSED" in emulator
print("AutoSetup AS8B percentage milestones and page reset regressions: PASS")

# LAB06 approved clean-install replacement: private signing stays out of source.
assert "motorlabVersionCode" in gradle and "motorlabSignedUpdateTest" in gradle
assert "signingConfig signingConfigs.mainApp" in gradle
assert "applicationId 'it.motorlab.app'" in gradle
assert "versionCode 6" in gradle
print("LAB06 immutable package and guarded signing-family source contract: PASS")
