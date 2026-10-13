#!/usr/bin/env python3
"""LAB06 Android 11 same-signer update-in-place, isolated emulated test ONLY.

Uses two temporary debug-enabled APKs with the SAME temporary test signing
identity and strictly increasing versionCode (6 -> 7). This is not an
authorization to upgrade an installed LAB01, and is not a production key.
"""
import os
import re
import subprocess
import sys

from emulator_smoke import (
    PACKAGE, CANARY, adb, launch, open_team, open_archive, edit,
    click, wait, verify_db_canary, no_crash,
)


def tool(name, *args):
    root = os.environ.get("ANDROID_HOME", "")
    path = os.path.join(root, "build-tools", "35.0.0", name)
    return subprocess.check_output([path, *args], text=True, timeout=35)


def apk_details(path):
    assert os.path.isfile(path) and os.path.getsize(path) > 0, path
    tool("apksigner", "verify", path)
    cert = tool("apksigner", "verify", "--print-certs", path)
    found = re.search(r"^Signer #1 certificate SHA-256 digest: ([0-9a-fA-F]{64})$", cert, re.M)
    assert found, "Cannot establish single APK certificate"
    badging = tool("aapt", "dump", "badging", path)
    pkg = re.search(r"^package: name='([^']+)' versionCode='(\\d+)'", badging, re.M)
    assert pkg, "Cannot establish package and versionCode"
    assert pkg.group(1) == PACKAGE, "Wrong Android family"
    return int(pkg.group(2)), found.group(1).lower()


def main(base, update):
    base_code, base_cert = apk_details(base)
    next_code, next_cert = apk_details(update)
    assert (base_code, next_code) == (6, 7), "Update must increase versionCode 6->7"
    assert base_cert == next_cert, "In-place update would be rejected by Android"
    print("MOTORLAB_LAB06_SIGNING_IDENTITY_SAME_CERT=PASSED_TEMPORARY_TEST_ONLY", flush=True)

    result = adb("install", "-r", base, timeout=120)
    assert "Success" in result, "First install failed"
    launch()
    open_team()
    edit("Scrivi un messaggio", CANARY)
    click("Invia messaggio")
    wait("Messaggio salvato")
    verify_db_canary()
    print("MOTORLAB_LAB06_CANARY_CREATED_BEFORE_UPGRADE=PASSED", flush=True)

    adb("shell", "am", "force-stop", PACKAGE)
    result = adb("install", "-r", update, timeout=120)
    assert "Success" in result, "Signed LAB07 same-family update rejected"
    verify_db_canary()
    launch()
    open_team()
    open_archive()
    wait(CANARY)
    no_crash()
    print("MOTORLAB_LAB06_TO_LAB07_SIGNED_UPDATE=PASSED_TEMPORARY_TEST_ONLY", flush=True)
    print("MOTORLAB_LAB06_TO_LAB07_SQLITE_AND_ARCHIVE_PRESERVED=PASSED", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: update_family_smoke.py base-v6.apk update-v7.apk")
    main(sys.argv[1], sys.argv[2])
