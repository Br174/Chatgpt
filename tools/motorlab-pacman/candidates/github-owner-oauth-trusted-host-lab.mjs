// Connects existing Pac-Man OAuth+PKCE browser route and review provider
// to ONE trusted server-side host. LAB SOURCE ONLY: no new Worker, DB, secrets.
// Live runtime MUST inject independently verified encrypted vault, authenticated
// passkey owner session and per-account GitHub App credentials. Never a Map live.
import {createGithubAppUserOAuthTransportLab} from "./github-app-user-oauth-transport-lab.mjs";
const fail=k=>{throw Error("PACMAN_GITHUB_OWNER_TRUSTED_HOST_HOLD_"+k)};
const methods=["ownerSession","savePendingOnce","consumePendingOnce",
 "installOwnerCredential","getOwnerAccessToken"];
const secretFields=["clientId","clientSecret","fetchImpl","secureVault"];
export function createPacmanGitHubOwnerOAuthHostLab({clientId,clientSecret,fetchImpl,secureVault}={}){
 if(!secureVault||secureVault.durable!==true||
  secureVault.atomic!==true||secureVault.serverPrivate!==true||
  secureVault.encryptedAtRest!==true||
  methods.some(name=>typeof secureVault[name]!=="function"))
  fail("PRIVATE_DURABLE_ENCRYPTED_VAULT_NOT_CONNECTED");
 const provider=createGithubAppUserOAuthTransportLab({clientId,clientSecret,fetchImpl});
 // Vault ensures atomic PKCE callback state, one-time access token insertion,
 // HttpOnly+Secure+SameSite owner session proven by the actual WebAuthn issuer.
 // We DO NOT fabricate these properties in this candidate.
 return Object.freeze({
  ownerSession:()=>secureVault.ownerSession(),
  savePendingOnce:pending=>secureVault.savePendingOnce(pending),
  consumePendingOnce:stateHash=>secureVault.consumePendingOnce(stateHash),
  exchangeGithubCode:params=>provider.exchangeGithubCode(params),
  verifyGithubUser:token=>provider.verifyGithubUser(token),
  verifyOwnerRepositoryPermission:token=>provider.verifyOwnerRepositoryPermission(token),
  installOwnerCredential:receipt=>secureVault.installOwnerCredential(receipt),
  getOwnerAccessToken:()=>secureVault.getOwnerAccessToken(),
  fetchImpl, // owned by the private HTTPS runtime; not exported into public JSON
  connectedOnThisHost:false, // composition source is not proof of registered OAuth client/active vault
  liveDeploymentVerified:false
 });
}
export function ownerOAuthDeploymentReadinessLab({clientId,callbackOrigin,
 secureVaultAvailable=false,githubAppRegistered=false,
 workerStagingDeployed=false,ownerLoginVerified=false}={}){
 const checks=Object.freeze({
  exactCallback:callbackOrigin==="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev",
  registeredGitHubApp:githubAppRegistered===true,
  clientIdConfigured:typeof clientId==="string"&&/^Iv1[._][A-Za-z0-9]{10,120}$/.test(clientId),
  privateEncryptedVault:secureVaultAvailable===true,
  existingWorkerStagingDeployed:workerStagingDeployed===true,
  actualOwnerOAuthConsent:ownerLoginVerified===true
 });
 return Object.freeze({checks,readyForLiveReview:Object.values(checks).every(x=>x===true),
  requiresSeparateDeployApproval:true,requiresUserGithubConsent:true,
  productionModified:false,remoteWritePerformed:false});
}
