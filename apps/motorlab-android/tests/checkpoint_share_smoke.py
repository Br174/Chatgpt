#!/usr/bin/env python3
"""Emulator E2E: receiving text/plain from Android Sharesheet is review-only.

All shared data is synthetic. No network, account login, API key, or site writes.
"""
import json
import shlex
import sys
from pathlib import Path
from emulator_smoke import adb, wait, click, no_crash, PACKAGE, launch, scroll_top, scroll_until_visible

ROOT=Path(__file__).resolve().parents[1]
RECEIVER=PACKAGE+"/.AutoSetupShareReceiverActivity"


def send(json_text):
    # Avoid Android ActivityManager -W waiting forever for deliberately rejected
    # shares that close the receiver before a resumed activity is reported.
    cmd=("am start -a android.intent.action.SEND -t text/plain -n "+
         RECEIVER+" --es android.intent.extra.TEXT "+shlex.quote(json_text))
    result=adb("shell",cmd,timeout=40)
    assert "Error:" not in result and "Exception" not in result, result[-250:]


def main():
    launch()
    fixture=json.loads((ROOT/"tests/fixtures/autosetup_checkpoint_chatgpt.json").read_text())
    checkpoint=json.dumps(fixture,separators=(",",":"),ensure_ascii=True)
    send(checkpoint)
    wait("Checkpoint AutoSetup dalla chat",seconds=22)
    wait("Origine dichiarata: https://example.com",seconds=15)
    wait("NON autenticato",seconds=12)
    print("MOTORLAB_CHAT_TO_APK_DIRECT_SHARE_PREVIEW=PASSED",flush=True)
    click("ANNULLA",exact=True)
    wait("Prova modulo generico offline",clickable=True)
    print("MOTORLAB_CHAT_TO_APK_DIRECT_SHARE_CANCEL=PASSED",flush=True)

    # Confirm preparation copies ONLY the declared origin; it is not navigation.
    adb("shell","input","keyevent","KEYCODE_BACK")
    launch()
    send(checkpoint)
    wait("Checkpoint AutoSetup dalla chat",seconds=22)
    click("PREPARA SITO",exact=True)
    scroll_top()
    scroll_until_visible("Checkpoint dalla chat letto come dato non verificato")
    scroll_until_visible("Nessuna sessione, autorizzazione o credenziale importata")
    print("MOTORLAB_CHAT_TO_APK_DIRECT_SHARE_PREPARED_NO_NAV=PASSED",flush=True)
    no_crash()
    adb("shell","input","keyevent","KEYCODE_BACK")
    launch()

    # An untrusted/malformed share must not open the review UI.
    send('{"protocol":"motorlab.autosetup.checkpoint","permissions":{"can_execute":true}}')
    wait("⚙ MotorLab",seconds=20,exact=True)
    print("MOTORLAB_CHAT_TO_APK_DIRECT_SHARE_INVALID_REJECTED=PASSED",flush=True)
    no_crash()


if __name__=="__main__":
    try:main()
    except Exception as e:
        print("MOTORLAB_CHAT_TO_APK_SHARE_E2E=FAILED "+str(e),flush=True)
        sys.exit(1)
