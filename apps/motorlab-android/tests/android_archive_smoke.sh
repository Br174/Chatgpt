#!/usr/bin/env bash
set -euo pipefail
APK=apps/motorlab-android/app/build/outputs/apk/debug/app-debug.apk
PKG=it.motorlab.app.lab04
adb wait-for-device
adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PKG/it.motorlab.app.MainActivity" | tee /tmp/lab04-start.txt
grep -Fq "Status: ok" /tmp/lab04-start.txt
adb shell pidof "$PKG" >/dev/null || exit 1

tap_button() {
  local TITLE="$1"
  adb shell uiautomator dump /sdcard/ml04-screen.xml >/dev/null
  adb shell cat /sdcard/ml04-screen.xml | tr -d '\r' > /tmp/ml04-screen.xml
  python3 - "$TITLE" < /tmp/ml04-screen.xml > /tmp/ml04-coordinates <<'PY'
import re,sys,xml.etree.ElementTree as ET
title=sys.argv[1]
root=ET.fromstring(sys.stdin.read())
found=[n for n in root.iter() if n.attrib.get('class')=='android.widget.Button'
  and (n.attrib.get('text') or '').startswith(title)]
if len(found)!=1:raise SystemExit('Expected one button '+title+', got '+str(len(found)))
bounds=[int(n) for n in re.findall(r'\d+',found[0].attrib['bounds'])]
if len(bounds)!=4:raise SystemExit('Bad bounds')
print((bounds[0]+bounds[2])//2,(bounds[1]+bounds[3])//2)
PY
  read -r X Y < /tmp/ml04-coordinates
  adb shell input tap "$X" "$Y"
  sleep 3
}
tap_button "Team"
adb shell dumpsys activity activities | grep -Fq 'it.motorlab.app.TeamChatActivity' || {
  echo "::error::Team Chat not opened";exit 1;
}
tap_button "📁 Archivio Team Chat"
adb shell dumpsys activity activities | grep -Fq 'it.motorlab.app.TeamArchiveActivity' || {
  echo "::error::Archive not opened";exit 1;
}
adb shell uiautomator dump /sdcard/ml04-archive.xml >/dev/null
adb shell cat /sdcard/ml04-archive.xml | grep -q "Importa vecchio backup LAB02" || {
  echo "::error::Archive import button missing";exit 1;
}
if adb logcat -d -s AndroidRuntime:E | grep -Eq 'FATAL EXCEPTION|Process: it.motorlab.app.lab04';then
  echo "::error::Crash detected";adb logcat -d -s AndroidRuntime:E|tail -120;exit 1
fi
echo "PASS: Android 11 installed LAB04 Home/Team/Archive, import control visible, no fatal exceptions."
