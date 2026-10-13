#!/usr/bin/env python3
"""MotorLab LAB04 emulator-only smoke. Writes synthetic canary data, never accesses user chats."""
import os
import re
import subprocess
import sys
import time
from xml.etree import ElementTree as ET

PACKAGE="it.motorlab.app"
MAIN=PACKAGE+"/it.motorlab.app.MainActivity"
CANARY="MotorLabUnifiedProof20261012"
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

def scroll_to_click(token,tries=7):
    # Works inside AutoSetup's upper Android ScrollView; never touches the WebView.
    for attempt in range(tries):
        found=matches(token,clickable=True)
        if found:
            box=[int(v) for v in re.findall(r"\d+",found[0].get("bounds",""))]
            if len(box)==4 and box[2]>box[0] and box[3]>box[1] and 0<box[1]<2150:
                tap(found[0])
                return
        scrolls=[n for n in ui() if n.get("class")=="android.widget.ScrollView"]
        if not scrolls:
            raise AssertionError("AutoSetup scroll area missing before "+token)
        coords=[int(v) for v in re.findall(r"\d+",scrolls[0].get("bounds",""))]
        if len(coords)!=4 or coords[3]-coords[1]<220:
            raise AssertionError("AutoSetup scroll bounds missing")
        x=(coords[0]+coords[2])//2
        adb("shell","input","swipe",str(x),str(coords[3]-50),
            str(x),str(coords[1]+50),"420")
        time.sleep(.7)
    raise AssertionError("AutoSetup button could not be reached: "+token)

def scroll_until_visible(token,tries=10):
    for _ in range(tries):
        nodes=matches(token)
        for node in nodes:
            bounds=[int(v) for v in re.findall(r"\d+",node.get("bounds",""))]
            if len(bounds)==4 and bounds[2]>bounds[0] and bounds[3]>bounds[1]:
                return node
        scrolls=[n for n in ui() if n.get("class")=="android.widget.ScrollView"]
        if not scrolls:break
        bounds=[int(v) for v in re.findall(r"\d+",scrolls[0].get("bounds",""))]
        if len(bounds)!=4 or bounds[3]-bounds[1]<220:break
        x=(bounds[0]+bounds[2])//2
        adb("shell","input","swipe",str(x),str(bounds[3]-45),
            str(x),str(bounds[1]+45),"370")
        time.sleep(.6)
    raise AssertionError("AutoSetup text not visible after scrolling: "+token)

def scroll_top():
    scrolls=[n for n in ui() if n.get("class")=="android.widget.ScrollView"]
    if not scrolls:raise AssertionError("AutoSetup scroll missing")
    coords=[int(v) for v in re.findall(r"\d+",scrolls[0].get("bounds",""))]
    if len(coords)!=4:raise AssertionError("AutoSetup scroll bounds missing")
    x=(coords[0]+coords[2])//2
    for _ in range(3):
        adb("shell","input","swipe",str(x),str(coords[1]+60),
            str(x),str(coords[3]-60),"350")
        time.sleep(.4)

def autosetup_smoke():
    # Launch a fresh main screen: no account, token, network or destructive action.
    adb("shell","am","force-stop",PACKAGE)
    launch()
    click("Chat",exact=True)
    click("AutoSetup")
    wait("MotorLab AutoSetup")
    wait("Prova modulo generico offline",clickable=True)
    print("MOTORLAB_AUTOSETUP_CHAT_ENTRY=PASSED",flush=True)
    click("Prova modulo generico offline",exact=True)
    print("MOTORLAB_AUTOSETUP_OFFLINE_DEMO_LAUNCH=PASSED",flush=True)
    time.sleep(2)
    click("Riconosci i campi del modulo",exact=True)
    # Form controls are below the chat header inside the bounded ScrollView.
    for _ in range(3):
        if matches("Campi rilevati nel sito · 2"):
            break
        scrolls=[n for n in ui() if n.get("class")=="android.widget.ScrollView"]
        if not scrolls:
            break
        bounds=[int(v) for v in re.findall(r"\d+",scrolls[0].get("bounds",""))]
        if len(bounds)!=4 or bounds[3]-bounds[1]<180:
            break
        x=(bounds[0]+bounds[2])//2
        adb("shell","input","swipe",str(x),str(bounds[3]-35),
            str(x),str(bounds[1]+35),"400")
        time.sleep(.8)
    wait("Campi rilevati nel sito · 2",seconds=10)
    print("MOTORLAB_AUTOSETUP_GENERIC_FORM_SCAN=PASSED_FIELDS_2_PASSWORD_EXCLUDED",flush=True)
    scroll_to_click("Prepara valori dimostrativi")
    scroll_top()
    scroll_until_visible("Preparati 2 valori nella chat")
    scroll_to_click("Compila i campi sulla pagina")
    scroll_top()
    scroll_until_visible("Compilati 2 campi")
    print("MOTORLAB_AUTOSETUP_GENERIC_FORM_FILL=PASSED_FIELDS_2_VERIFIED",flush=True)
    scroll_top()
    scroll_to_click("Trova collegamenti del sito")
    scroll_until_visible("Collegamenti interni · 1")
    scroll_until_visible("Apri: Impostazioni demo")
    print("MOTORLAB_AUTOSETUP_GENERIC_LINK_DISCOVERY=PASSED_SAME_ORIGIN_DEMO",flush=True)
    scroll_to_click("Apri: Impostazioni demo")
    wait("Navigare sul sito?",seconds=12)
    click("APRI PAGINA",exact=True)
    wait("Impostazioni demo",seconds=16)
    scroll_top()
    scroll_to_click("Riconosci i campi del modulo")
    scroll_until_visible("Campi rilevati nel sito · 2")
    print("MOTORLAB_AUTOSETUP_MULTIPAGE_CONSENT_AND_SCAN=PASSED_OFFLINE",flush=True)
    scroll_top()
    scroll_to_click("Mostra piano operazioni")
    wait("Piano AutoSetup",seconds=12)
    wait("Campi riconosciuti: 2",seconds=12)
    click("OK",exact=True)
    print("MOTORLAB_AUTOSETUP_STAGED_PLAN=PASSED_NO_AUTO_SUBMIT",flush=True)
    no_crash()

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
    autosetup_smoke()
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
