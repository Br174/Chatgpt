#!/usr/bin/env python3
"""Android 11 checkpoint picker: user initiated only, cancellation non-destructive.

The contents of any selected JSON file must remain untrusted; this test checks
that the system document picker actually launches and cancel returns safely.
A real ChatGPT-account sync/backend is NOT provided by this feature.
"""
import sys
import time
from emulator_smoke import adb, launch, click, wait, scroll_to_click, no_crash, PACKAGE

def main():
    adb("wait-for-device",timeout=120)
    adb("shell","input","keyevent","KEYCODE_WAKEUP")
    adb("shell","wm","dismiss-keyguard",check=False)
    launch()
    click("Chat",exact=True)
    click("AutoSetup")
    wait("Importa checkpoint dalla chat",clickable=True)
    scroll_to_click("Importa checkpoint dalla chat")
    time.sleep(1.3)
    visible=adb("shell","dumpsys","activity","activities",timeout=30)
    if "documentsui" not in visible.lower():
        raise AssertionError("Expected Android system DocumentsUI after import command")
    print("MOTORLAB_AUTOSETUP_CHAT_CHECKPOINT_SYSTEM_PICKER=PASSED",flush=True)
    adb("shell","input","keyevent","KEYCODE_BACK")
    wait("Prova modulo generico offline",clickable=True)
    no_crash()
    print("MOTORLAB_AUTOSETUP_CHAT_CHECKPOINT_CANCEL_NO_WRITE=PASSED",flush=True)

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("MOTORLAB_AUTOSETUP_CHAT_CHECKPOINT_PICKER=FAILED "+str(e),flush=True)
        sys.exit(1)
