#!/usr/bin/env python3
from pathlib import Path
p=Path(__file__).resolve().parents[1]
source=(p/"app/src/main/java/it/motorlab/app/MainActivity.java").read_text()
manifest=(p/"app/src/main/AndroidManifest.xml").read_text()
gemini=(p/"app/src/main/java/it/motorlab/app/GeminiClient.java").read_text()
key=(p/"app/src/main/java/it/motorlab/app/SecureGeminiKey.java").read_text()
openai=(p/"app/src/main/java/it/motorlab/app/ChatGptPlan.java").read_text()
assert "it.motorlab.app" in (p/"app/build.gradle").read_text()
assert 'android:allowBackup="false"' in manifest
assert "GeminiClient.reply" in source
assert "KeyGenParameterSpec" in key and "AES/GCM/NoPadding" in key
assert "x-goog-api-key" in gemini and "429" in gemini
assert "boolean usableNow() { return false; }" in openai
assert "chatgpt.tokens.use.direct" in (p/"README.md").read_text()
assert "reserveDailyTrialCall()" in source
assert "read-only" in (p/"README.md").read_text() or "sola lettura" in source
print("LAB01 static contract: PASS (does not establish successful Android runtime or OAuth)")
