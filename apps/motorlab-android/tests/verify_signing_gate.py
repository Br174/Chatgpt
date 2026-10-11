#!/usr/bin/env python3
"""Static test of stable signing gate. Does not prove a signed APK exists."""
from pathlib import Path
base=Path(__file__).resolve().parents[1]
app=(base/"app/build.gradle").read_text()
wf=(base.parent.parent/".github/workflows/motorlab-app-lab03-signing.yml").read_text()
guide=(base/"SIGNING_SETUP.md").read_text()
for text in ["it.motorlab.app.stable","it.motorlab.app.lab02","motorlabStableBuild",
             "motorlabSignRelease","MOTORLAB_APP_KEYSTORE_FILE",
             "MOTORLAB_APP_STORE_PASSWORD","MOTORLAB_APP_KEY_PASSWORD",
             "MOTORLAB_APP_KEY_ALIAS","versionCode 3"]:
    assert text in app,text
for text in ["workflow_dispatch","apksigner","aapt","sha256sum",
             "gh release create","MOTORLAB_APP_SIGNING_KEYSTORE_B64",
             "MOTORLAB_APP_EXPECTED_CERT_SHA256","motorlabStableBuild=true",
             "motorlabSignRelease=true","chmod 600","umask 077"]:
    assert text in wf,text
assert "if: github.event_name == 'workflow_dispatch'" in wf
assert "CONFLICT" in guide
print("PASS: Stable signing release is gated on protected material (not provisioned).")
