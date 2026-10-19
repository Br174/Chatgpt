import test from "node:test";
import assert from "node:assert/strict";
import {isGitHubAppClientIdLab} from "./github-app-client-id-lab.mjs";
test("registered owner GitHub App current client ID is recognized by the same strict validator",()=>{
 assert.equal(isGitHubAppClientIdLab("Iv23liKpIEhpEJCOIEfm"),true);
 assert.equal(isGitHubAppClientIdLab("Iv1.0123456789abcdef"),true);
 assert.equal(isGitHubAppClientIdLab("Iv1_0123456789abcdef"),true);
});
test("unknown short names, GitHub tokens, secrets and OAuth callbacks are not valid client IDs",()=>{
 for(const value of ["Iv23","Iv1.", "ghu_"+"a".repeat(40),
  "https://github.com/settings/apps","Iv23example.github.com",
  "Iv23a?x=1",123,null,"Iv23a b c defghij","Iv23\nabcdefghijk"]){
  assert.equal(isGitHubAppClientIdLab(value),false,String(value));
 }
});
