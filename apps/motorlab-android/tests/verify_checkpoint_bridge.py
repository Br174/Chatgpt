#!/usr/bin/env python3
"""Offline checkpoint-envelope compatibility test. No secrets or network.
This checks schema/fixtures and source guardrails; Android parser is built
separately by Gradle and the selection UI is smoked on the emulator.
"""
import copy
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
schema=json.loads((root/"AUTOSETUP_SHARED_CHECKPOINT_V1.schema.json").read_text())
apk=json.loads((root/"tests/fixtures/autosetup_checkpoint_demo.json").read_text())
chat=json.loads((root/"tests/fixtures/autosetup_checkpoint_chatgpt.json").read_text())

def valid(value,rule):
    if "const" in rule and value!=rule["const"]:return False
    if "enum" in rule and value not in rule["enum"]:return False
    typ=rule.get("type")
    if typ is not None:
        types=typ if isinstance(typ,list) else [typ]
        correct={
            "object":lambda v:type(v) is dict,
            "string":lambda v:type(v) is str,
            "integer":lambda v:type(v) is int,
            "boolean":lambda v:type(v) is bool,
            "null":lambda v:v is None
        }
        if not any(correct[k](value) for k in types):return False
    if isinstance(value,(int,str)) and not isinstance(value,bool):
        if "maxLength" in rule and len(value)>rule["maxLength"]:return False
        if "pattern" in rule and not re.fullmatch(rule["pattern"],value):return False
        if "minimum" in rule and value<rule["minimum"]:return False
        if "maximum" in rule and value>rule["maximum"]:return False
    if isinstance(value,dict):
        required=set(rule.get("required",()))
        if not required<=set(value):return False
        props=rule.get("properties",{})
        if rule.get("additionalProperties") is False and set(value)-set(props):return False
        if not all(valid(v,props[k]) for k,v in value.items() if k in props):return False
    return True

assert valid(apk,schema) and valid(chat,schema)
assert apk["source"]=="motorlab_android" and chat["source"]=="chatgpt_tools"
assert all(not x["permissions"]["can_execute"] and x["permissions"]["requires_new_consent"]
           for x in (apk,chat))
assert all(not any(x["privacy"].values()) for x in (apk,chat))
assert all(x["verification"]["remote_outcome"]=="not_verified" for x in (apk,chat))

def rejects(modify):
    candidate=copy.deepcopy(chat)
    modify(candidate)
    assert not valid(candidate,schema), "Invalid checkpoint wrongly accepted"

rejects(lambda x:x["permissions"].__setitem__("can_execute",True))
rejects(lambda x:x["permissions"].__setitem__("requires_new_consent",False))
rejects(lambda x:x["privacy"].__setitem__("contains_credentials",True))
rejects(lambda x:x.__setitem__("token","do-not-read-secrets"))
rejects(lambda x:x.__setitem__("source","unknown_executor"))
rejects(lambda x:x.__setitem__("origin","https://example.com/private"))
rejects(lambda x:x["observations"].__setitem__("ordinary_fields",100))
rejects(lambda x:x["observations"].__setitem__("page_loaded","true"))
rejects(lambda x:x.__setitem__("version",2))
rejects(lambda x:x["verification"].__setitem__("remote_outcome","success"))

bridge=(root/"app/src/main/java/it/motorlab/app/AutoSetupCheckpointBridge.java").read_text()
activity=(root/"app/src/main/java/it/motorlab/app/AutoSetupActivity.java").read_text()
assert "MAX_BYTES=16384" in bridge
assert 'keys(data,"protocol","version","source","origin","stage","observations"' in bridge
assert 'bool(perms,"can_execute",false)' in bridge
assert 'bool(perms,"requires_new_consent",true)' in bridge
assert 'bool(privacy,"contains_credentials",false)' in bridge
assert "SecureServiceToken.checkedOrigin(origin)" in bridge
assert 'choice(verification,"remote_outcome","not_verified","verified_separately")' in bridge
assert "Intent.ACTION_OPEN_DOCUMENT" in activity
receiver=(root/"app/src/main/java/it/motorlab/app/AutoSetupShareReceiverActivity.java").read_text()
manifest=(root/"app/src/main/AndroidManifest.xml").read_text()
assert 'android:name=".AutoSetupActivity" android:exported="false"' in manifest
assert 'android:name=".AutoSetupShareReceiverActivity"' in manifest
assert 'android:exported="true"' in manifest
assert 'android.intent.action.SEND' in manifest
assert "AutoSetupCheckpointBridge.inspect(json)" in receiver
assert "Intent.ACTION_SEND.equals(incoming.getAction())" in receiver
assert "MAX_BYTES" in receiver
assert "EXTRA_REVIEW_CHECKPOINT" in receiver
assert "startActivity(review)" in receiver
assert "reviewImportedCheckpoint(imported)" in activity
assert 'launch.removeExtra(AutoSetupShareReceiverActivity.EXTRA_REVIEW_CHECKPOINT)' in activity
assert 'browser.loadUrl("about:blank")' in activity
assert 'button(top,"Importa checkpoint dalla chat",this::pickCheckpoint)' in activity
assert "AutoSetupCheckpointBridge.inspect(json)" in activity
assert "ByteArrayOutputStream" in activity and "input.read(buffer)" in activity
assert "PICK_CHECKPOINT_JSON=4403" in activity
assert 'browser.loadUrl("about:blank")' in activity
assert 'goal.setText("")' in activity and "url.setText(preview.origin)" in activity
assert "importedCheckpoint" not in activity
assert "startActivityForResult(chooser,PICK_CHECKPOINT_JSON)" in activity
print("MOTORLAB_AUTOSETUP_CHECKPOINT_V1_APK_AND_CHAT_CONTRACT=PASSED")
print("MOTORLAB_AUTOSETUP_CHECKPOINT_INVALID_ENVELOPES=REJECTED_10_CASES")
print("MOTORLAB_AUTOSETUP_CHECKPOINT_IMPORT_SOURCE_GUARDS=PASSED_STATIC_NOT_ANDROID_RUNTIME")
