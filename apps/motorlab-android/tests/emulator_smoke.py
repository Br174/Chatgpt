#!/usr/bin/env python3
"""MotorLab LAB04 emulator-only smoke. Writes synthetic canary data, never accesses user chats."""
import os
import re
import subprocess
import sys
import time
from xml.etree import ElementTree as ET

PACKAGE="it.motorlab.app.lab04"
MAIN=PACKAGE+"/it.motorlab.app.MainActivity"
CANARY="MotorLabSmoke20261012"
def adb(*argv,timeout=35,check=True):
    cmd=["adb",*argv]
    p=subprocess.run(cmd,text=True,capture_output=True,timeout=timeout)
    if check and p.returncode:
        raise AssertionError("ADB command failed: "+repr(cmd)+" rc="+str(p.returncode)+" stderr="+p.stderr[-500:])
    return p.stdout

def ui():
    for attempt in range(8):
        try:
            s=adb("shell","uiautomator","dump","/sdcard/window-motorlab.xml",timeout=40,check=False)
            raw=adb("shell","cat","/sdcard/window-motorlab.xml",timeout=20)
            root=ET.fromstring(raw[raw.index("<?xml"):])
            return list(root.iter("node"))
        except Exception:
            time.sleep(1.0)
    raise AssertionError("Cannot retrieve uiautomator hierarchy")

def matches(token,exact=False,clickable=False):
    found=[]
    for node in ui():
        label=(node.get("text","") or node.get("content-desc","")).strip()
        if (label==token if exact else token in label):
            if clickable and (node.get("clickable")!="true" or node.get("class")!="android.widget.Button"):
                continue
            found.append(node)
    return found

def wait(token,seconds=17,exact=False,clickable=False):
    until=time.monotonic()+seconds
    while time.monotonic()<until:
        m=matches(token,exact=exact,clickable=clickable)
        if m:return m[0]
        time.sleep(1)
    raise AssertionError("Screen missing "+("clickable " if clickable else "")+"text: "+token)

def tap(node):
    bounds=node.get("bounds","")
    pts=[int(i) for i in re.findall(r"\d+",bounds)]
    if len(pts)!=4:raise AssertionError("missing bounds: "+repr(bounds))
    if pts[0]>=pts[2] or pts[1]>=pts[3]:
        raise AssertionError("UI accessibility bounds are empty for "+repr(node.get("text",""))+": "+bounds)
    x=(pts[0]+pts[2])//2
    y=(pts[1]+pts[3])//2
    if x<0 or y<0 or y>2500:raise AssertionError("Invalid UI bounds")
    print("LAB04_UI_TAP="+repr(node.get("text",""))+" class="+node.get("class","")+" bounds="+bounds+" xy="+str(x)+","+str(y),flush=True)
    adb("shell","input","tap",str(x),str(y))
    time.sleep(1.3)

def click(token,exact=False):
    # Prevent false taps on labels/taglines containing the same word as a button.
    node=wait(token,exact=exact,clickable=True)
    tap(node)

def edit(fieldHint,content):
    nodes=ui()
    targets=[x for x in nodes if x.get("class")=="android.widget.EditText" and fieldHint in (x.get("text","")+" "+x.get("content-desc",""))]
    if not targets:targets=[x for x in nodes if x.get("class")=="android.widget.EditText"]
    if not targets:raise AssertionError("Editor not found")
    tap(targets[0])
    adb("shell","input","text",content)
    adb("shell","input","keyevent","4")
    time.sleep(.5)

def launch():
    adb("shell","am","start","-W","-n",MAIN,timeout=35)
    wait("⚙ MotorLab",exact=True)
    print("LAB04_APP_LAUNCH=PASSED",flush=True)

def open_team():
    click("Team",exact=True)
    wait("Team Chat · Sala Operativa",exact=True)
    print("LAB04_TEAM_CHAT_OPEN=PASSED",flush=True)

def open_archive():
    click("Archivio Team Chat")
    wait("📁 Archivio Team Chat",exact=True)
    wait("Messaggi trovati:")
    print("LAB04_ARCHIVE_OPEN=PASSED",flush=True)

def verify_db_canary():
    # debug package: no root, no credential disclosure, synthetic test data only
    p=subprocess.run(["adb","exec-out","run-as",PACKAGE,"cat","databases/motorlab_team_v1.db"],
                     capture_output=True,timeout=20)
    if p.returncode:
        raise AssertionError("Cannot verify local SQLite: "+p.stderr.decode(errors="ignore")[-180:])
    if not p.stdout.startswith(b"SQLite format 3"):
        raise AssertionError("Missing valid SQLite database header")
    if CANARY.encode() not in p.stdout:
        # Android SQLite often retains current rows in the uncheckpointed WAL file.
        wal=subprocess.run(["adb","exec-out","run-as",PACKAGE,"cat","databases/motorlab_team_v1.db-wal"],
                           capture_output=True,timeout=20)
        if wal.returncode or CANARY.encode() not in wal.stdout:
            raise AssertionError("Synthetic canary absent from SQLite DB and WAL")
    print("LAB04_SQLITE_PERSISTENCE=PASSED",flush=True)

def no_crash():
    log=adb("logcat","-d","-v","brief",timeout=25,check=False)
    # Only fail app-specific crashes; incidental emulator platform log errors are irrelevant.
    blocks=log.split("FATAL EXCEPTION")
    if any(PACKAGE in b[:1700] for b in blocks[1:]):
        raise AssertionError("LAB04 FATAL EXCEPTION in logcat")
    print("LAB04_NO_FATAL_EXCEPTION=PASSED",flush=True)


def saf_backup_gate():
    """Test Android 11 DocumentsUI export with synthetic-only data."""
    import json
    folder="/sdcard/Documents/Chat Team MotorLab"
    adb("shell","mkdir","-p","/sdcard/Documents")
    click("Scegli dove creare")
    time.sleep(2)

    def picker_nodes(label):
        nodes=ui()
        print("LAB04_SAF_"+label+"="+repr([
            (n.get("text",""),n.get("content-desc",""),n.get("class",""),
             n.get("clickable",""),n.get("enabled",""),n.get("bounds",""))
            for n in nodes if n.get("text") or n.get("content-desc")
        ])[:3700],flush=True)
        return nodes

    def visible_choose_button(nodes):
        tokens=("use this folder","usa questa cartella",
                "select this folder","seleziona questa cartella")
        for n in nodes:
            label=(n.get("text","")+" "+n.get("content-desc","")).lower()
            b=[int(i) for i in re.findall(r"\d+",n.get("bounds",""))]
            if any(x in label for x in tokens) and n.get("enabled")!="false":
                if len(b)==4 and b[0]<b[2] and b[1]<b[3]:
                    return n
        return None

    nodes=picker_nodes("PICKER_INITIAL")
    # Never click an off-screen/disabled DocumentsUI confirmation ([0,0][0,0]).
    # If the picker starts at storage root, enter the Documents directory first.
    choose=visible_choose_button(nodes)
    if not choose:
        labels=[n for n in nodes if n.get("text","")=="Documents"]
        if not labels:
            raise AssertionError("Documents not visible in picker; no silent root fallback")
        folder_label=labels[-1]
        tap(folder_label)
        time.sleep(2)
        nodes=picker_nodes("AFTER_DOCUMENTS_FIRST_TAP")
        choose=visible_choose_button(nodes)
        if not choose:
            # Some DocumentsUI builds make only the row container clickable.
            raw=adb("shell","cat","/sdcard/window-motorlab.xml",timeout=20)
            root=ET.fromstring(raw[raw.index("<?xml"):])
            parent={c:p for p in root.iter("node") for c in p}
            docs=[n for n in root.iter("node") if n.get("text","")=="Documents"]
            if not docs:
                raise AssertionError("Documents row disappeared without folder selection")
            cursor=docs[-1]
            clickable=None
            while cursor is not None:
                if cursor.get("clickable")=="true":
                    clickable=cursor
                    break
                cursor=parent.get(cursor)
            if clickable is not None:
                print("LAB04_SAF_DOCUMENTS_ROW_PARENT="+repr((
                    clickable.get("class"),clickable.get("bounds"))),flush=True)
                tap(clickable)
            else:
                # Plain second tap is a safe UI fallback, not an app/runtime edit.
                tap(docs[-1])
            time.sleep(2)
            nodes=picker_nodes("AFTER_DOCUMENTS_ROW_TAP")
            choose=visible_choose_button(nodes)
    if not choose:
        raise AssertionError("DocumentsUI never enabled USE THIS FOLDER after selecting Documents")

    tap(choose)
    time.sleep(1.2)
    prompts=[n for n in picker_nodes("PERMISSION_DIALOG")
        if n.get("text","").lower() in ("allow","consenti")]
    if prompts:tap(prompts[-1])
    wait("Backup aggiornato:",seconds=35)
    files=("MotorLab.json","MusicLab.json","StudyBook-AI.json","MotorAI.json")
    for f in files:
        # Explicit shell quoting preserves the required directory name with spaces.
        data=adb("shell","sh","-c","cat '"+folder+"/"+f+"'",timeout=15)
        j=json.loads(data)
        expected=f.replace(".json","").replace("StudyBook-AI","StudyBook AI")
        if j.get("roomBackup")!=expected:
            raise AssertionError("JSON room mismatch "+f+": "+repr(j.get("roomBackup")))
        if f=="MotorLab.json":
            if not any(CANARY in m.get("body","") for m in j.get("messages",[])):
                raise AssertionError("Synthetic message not in MotorLab backup")
        elif any(CANARY in m.get("body","") for m in j.get("messages",[])):
            raise AssertionError("Cross-room synthetic message leak: "+f)
    print("LAB04_SAF_FOUR_JSON_EXPORT=PASSED",flush=True)

def main():
    adb("wait-for-device",timeout=120)
    adb("shell","settings","put","system","screen_off_timeout","600000")
    adb("shell","input","keyevent","KEYCODE_WAKEUP")
    adb("shell","wm","dismiss-keyguard",check=False)
    adb("logcat","-c",check=False)
    launch()
    open_team()
    edit("Scrivi un messaggio",CANARY)
    click("Invia messaggio")
    wait("Messaggio salvato")
    wait(CANARY)
    print("LAB04_LOCAL_MESSAGE_WRITE=PASSED",flush=True)
    open_archive()
    edit("Cerca nei messaggi",CANARY)
    wait("Messaggi trovati: 1")
    wait(CANARY)
    print("LAB04_ARCHIVE_SEARCH=PASSED",flush=True)
    click("MusicLab",exact=True)
    wait("Messaggi trovati: 0")
    print("LAB04_ROOM_FILTER_ISOLATION=PASSED",flush=True)
    verify_db_canary()
    adb("shell","am","force-stop",PACKAGE)
    launch()
    open_team()
    open_archive()
    wait(CANARY)
    print("LAB04_REOPEN_HISTORY_PERSISTENT=PASSED",flush=True)
    no_crash()
    saf_backup_gate()
    print("LAB04_ANDROID_EMULATOR_E2E=PASSED",flush=True)

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("LAB04_ANDROID_EMULATOR_E2E=FAILED "+str(e),flush=True)
        try:
            for x in ui()[:100]:
                val=x.get("text","")
                if val:print("VISIBLE: "+val[:120])
        except Exception as diag:
            print("UI_DIAGNOSTIC_UNAVAILABLE="+str(diag)[:220],flush=True)
        try:
            a=adb("shell","dumpsys","activity","activities",timeout=25,check=False)
            for line in a.splitlines():
                if any(q in line for q in ("topResumedActivity","mResumedActivity","mFocusedApp","Hist #0","ResumedActivity","it.motorlab.app")):
                    print("ACTIVITY_DIAGNOSTIC: "+line.strip()[:370],flush=True)
        except Exception as diag:
            print("ACTIVITY_DIAGNOSTIC_UNAVAILABLE="+str(diag)[:220],flush=True)
        try:
            raw=adb("logcat","-d","-v","brief","-s","AndroidRuntime:E","ActivityTaskManager:W",timeout=25,check=False)
            for line in raw.splitlines()[-70:]:
                if line.strip():print("ANDROID_LOG_DIAGNOSTIC: "+line[:420],flush=True)
        except Exception as diag:
            print("ANDROID_LOG_DIAGNOSTIC_UNAVAILABLE="+str(diag)[:220],flush=True)
        sys.exit(1)
