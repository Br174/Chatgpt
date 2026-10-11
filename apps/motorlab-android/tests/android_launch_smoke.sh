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
echo '--- Navigate to Team Chat via the central tab ---'
SIZE="$(adb shell wm size | tr -d '\r' | tail -1 | awk '{print $3}')"
DENSITY="$(adb shell wm density | tr -d '\r' | tail -1 | awk '{print $3}')"
WIDTH="\${SIZE%x*}"
HEIGHT="\${SIZE#*x}"
BOTTOM="$(( HEIGHT - (DENSITY * 36 / 160) ))"
adb shell input tap "$((WIDTH / 2))" "$BOTTOM"
sleep 3
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
echo 'PASS: installed and MainActivity remained alive; tab tap executed; verify TeamChat activity separately in real device acceptance'
