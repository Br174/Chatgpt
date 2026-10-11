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
WIDTH="${SIZE%x*}"
HEIGHT="${SIZE#*x}"
BOTTOM="$(( HEIGHT - (DENSITY * 36 / 160) ))"
if ! [[ "$WIDTH" =~ ^[0-9]+$ && "$HEIGHT" =~ ^[0-9]+$ && "$DENSITY" =~ ^[0-9]+$ ]]; then
  echo "::error::Could not parse Android emulator dimensions for UI test"
  exit 1
fi
adb shell input tap "$((WIDTH / 2))" "$BOTTOM"
sleep 3
if ! adb shell dumpsys activity activities | grep -q 'it.motorlab.app.TeamChatActivity'; then
  echo "::error::Team Chat screen did not open after tapping its navigation button"
  adb shell dumpsys activity activities | tail -65
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
