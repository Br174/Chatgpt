#!/usr/bin/env bash
set -euo pipefail
PKG=it.motorlab.app.lab02
APK=apps/motorlab-android/app/build/outputs/apk/debug/app-debug.apk
test -s "$APK"
adb wait-for-device
adb install -r "$APK"
adb logcat -c
echo '--- Android 11 launch check: MainActivity ---'
adb shell am start -W -n "$PKG/it.motorlab.app.MainActivity"
sleep 4
if ! adb shell pidof "$PKG" >/dev/null; then
  echo "::error::MotorLab process died on Android emulator launch"
  adb logcat -d -s AndroidRuntime:E ActivityTaskManager:E | tail -180
  exit 1
fi
echo '--- Navigate to Team Chat using Android UI hierarchy ---'
adb shell uiautomator dump /sdcard/motorlab-window.xml >/dev/null
XML="$(adb shell cat /sdcard/motorlab-window.xml | tr -d '\r')"
COORDS="$(printf '%s' "$XML" | python3 -c 'import sys,re,xml.etree.ElementTree as E; root=E.fromstring(sys.stdin.read()); nodes=[n for n in root.iter() if n.attrib.get("text")=="Team" and n.attrib.get("class")=="android.widget.Button"]; assert len(nodes)==1, "Team tab not found uniquely"; a=[int(v) for v in re.findall(r"\d+",nodes[0].attrib["bounds"])]; assert len(a)==4; print((a[0]+a[2])//2,(a[1]+a[3])//2)')"
if [[ ! "$COORDS" =~ ^[0-9]+\ [0-9]+$ ]]; then
  echo "::error::Team button bounds could not be located"
  exit 1
fi
read -r TAP_X TAP_Y <<< "$COORDS"
echo "Tapping Team button at x=$TAP_X y=$TAP_Y"
adb shell input tap "$TAP_X" "$TAP_Y"
sleep 3
ACTIVITIES="$(adb shell dumpsys activity activities)"
if ! grep -Fq 'it.motorlab.app.TeamChatActivity' <<< "$ACTIVITIES"; then
  echo "::error::Team Chat Activity did not open from its real UI button"
  echo "$ACTIVITIES" | grep -E 'mResumed|topResumed|Hist |ActivityRecord|Task' | tail -40 || true
  adb logcat -d -s AndroidRuntime:E | tail -90
  exit 1
fi
if ! adb shell pidof "$PKG" >/dev/null; then
  echo "::error::MotorLab process died while opening Team Chat"
  adb logcat -d -s AndroidRuntime:E ActivityTaskManager:E | tail -180
  exit 1
fi
echo '--- Look for immediate uncaught runtime exceptions ---'
if adb logcat -d -s AndroidRuntime:E | grep -E 'FATAL EXCEPTION|Process: it.motorlab.app.lab02'; then
  echo "::error::Found fatal exception in AndroidRuntime"
  adb logcat -d -s AndroidRuntime:E | tail -160
  exit 1
fi
echo 'PASS: Android 11 installed MainActivity and TeamChatActivity, process alive, no uncaught exceptions'
