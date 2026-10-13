#!/usr/bin/env python3
"""Real pure-Java state-machine test. No simulated provider connectivity."""
from pathlib import Path
import subprocess
import tempfile
p=Path(__file__).resolve().parents[1]
source=p/"app/src/main/java/it/motorlab/app/AutoSetupHybridFlow.java"
activity=(p/"app/src/main/java/it/motorlab/app/AutoSetupActivity.java").read_text()
assert "Avvia AutoSetup ibrido" in activity
assert "new AutoSetupHybridFlow()" in activity
assert "apriUltimaRisorsa" in activity
assert "Apri login ufficiale nel browser" in activity # preserve the existing explicit option
assert "setAllowFileAccess(false)" in activity
assert "onPageStarted" in activity
code=r"""
package it.motorlab.app;
public class HybridFlowCheck {
  static void yes(boolean value) { if (!value) throw new AssertionError("condition failed"); }
  static void denied(Runnable action) {
    try { action.run(); throw new AssertionError("unsafe transition accepted"); }
    catch (IllegalStateException | IllegalArgumentException expected) { }
  }
  public static void main(String[] args) {
    String origin="https://github.com", page="https://github.com/Br174/Chatgpt/settings";
    AutoSetupHybridFlow flow=new AutoSetupHybridFlow();
    denied(() -> flow.officialFallbackUrl(origin,page));
    flow.start(origin,page);
    yes(flow.stage()==AutoSetupHybridFlow.Stage.AUTO);
    denied(() -> flow.cannotUseChat("bypass"));
    flow.requestHumanChoice("intervento utente");
    yes(flow.stage()==AutoSetupHybridFlow.Stage.CHAT);
    denied(() -> flow.officialFallbackUrl(origin,page));
    flow.cannotUseChat("no secure bridge");
    yes(flow.requestRepair());
    flow.repairFailed("first bounded attempt failed");
    yes(!flow.lastResortAllowed(origin,page));
    yes(flow.requestRepair());
    flow.repairFailed("second bounded attempt failed");
    yes(flow.stage()==AutoSetupHybridFlow.Stage.LAST_RESORT);
    yes(flow.lastResortAllowed(origin,page));
    yes(flow.officialFallbackUrl(origin,page).equals(page));
    denied(() -> flow.officialFallbackUrl("https://evil.example",page));
    denied(() -> flow.officialFallbackUrl(origin,
         "https://github.com/Br174/Chatgpt/settings?token=secret")); // Stale page blocked
    flow.reset();
    yes(flow.stage()==AutoSetupHybridFlow.Stage.IDLE);
    denied(() -> flow.start("http://github.com","http://github.com/x"));
    denied(() -> flow.start("https://github.com","https://other.example/x"));
    flow.start(origin,"https://github.com/path?secret=value");
    flow.requestHumanChoice("secret");
    flow.cannotUseChat("no secure channel");
    yes(flow.requestRepair());
    flow.repairFailed("again");
    yes(flow.requestRepair());
    flow.repairFailed("again");
    yes(flow.officialFallbackUrl(origin,"https://github.com/path?secret=value").equals(origin));
    flow.reset();
    flow.start(origin,page);
    flow.requestHumanChoice("form");
    flow.cannotUseChat("bridge");
    yes(flow.requestRepair());
    flow.repairSucceeded();
    yes(flow.stage()==AutoSetupHybridFlow.Stage.AUTO);
    denied(() -> flow.officialFallbackUrl(origin,page));
    System.out.println("MOTORLAB_HYBRID_STATE_MACHINE=PASS");
  }
}
"""
with tempfile.TemporaryDirectory() as tmp:
    folder=Path(tmp)
    (folder/"HybridFlowCheck.java").write_text(code)
    subprocess.run(["javac","-d",tmp,str(source),str(folder/"HybridFlowCheck.java")],check=True)
    subprocess.run(["java","-cp",tmp,"it.motorlab.app.HybridFlowCheck"],check=True)
print("MOTORLAB_HYBRID_STATIC_CONTRACTS=PASS")
