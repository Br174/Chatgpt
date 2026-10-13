#!/usr/bin/env python3
"""LAB06 AutoSetup hybrid real emulator UI smoke. Offline demo, no user accounts."""
import sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from emulator_smoke import adb,launch,click,wait,scroll_to_click,scroll_until_visible,scroll_top,ui,no_crash
adb("shell","am","force-stop","it.motorlab.app")
launch()
click("Chat",exact=True)
click("AutoSetup")
wait("MotorLab AutoSetup")
scroll_to_click("Prova modulo generico offline")
time.sleep(2)
scroll_top()
scroll_to_click("Avvia AutoSetup ibrido")
scroll_top()
scroll_until_visible("AUTO: passo 1/2",tries=12)
print("HYBRID_ANDROID11_AUTONOMOUS_SAME_ORIGIN_READ_ONLY=PASS",flush=True)
scroll_top()
scroll_until_visible("CHAT:",tries=12)
print("HYBRID_ANDROID11_CHAT_HANDOFF=PASS",flush=True)
scroll_top()
scroll_to_click("Non riesco da qui")
scroll_top()
scroll_until_visible("RECOVERY: verifica tecnica 1/2",tries=12)
print("HYBRID_ANDROID11_RECOVERY_ATTEMPT=PASS",flush=True)
no_crash()
print("HYBRID_ANDROID11_NO_CRASH=PASS",flush=True)
