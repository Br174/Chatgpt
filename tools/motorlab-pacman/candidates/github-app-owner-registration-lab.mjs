// MotorLab Pac-Man LAB: generate a one-click GitHub App REGISTRATION form.
// No app is created by importing or calling this pure function.
// ONLY the GitHub account owner can review/submit GitHub's registration.
// This is not an OAuth authorization redirect: installed/consented = false.
const SETTINGS="https://github.com/settings/apps/new";
const CALLBACK="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback";
const REPO="https://github.com/Br174/Chatgpt";
const NAME="Br174 MotorLab PacMan LAB";
const PERMISSIONS=Object.freeze({deployments:"write",actions:"read",contents:"read"});
export function preparePacmanOwnerGitHubAppRegistrationLab(){
 const url=new URL(SETTINGS);
 const fields={
  name:NAME,
  description:"Private MotorLab Pac-Man LAB: owner-reviewed staging workflow approvals only",
  url:REPO,
  "callback_urls[]":CALLBACK,
  request_oauth_on_install:"false",
  public:"false",
  webhook_active:"false",
  ...PERMISSIONS
 };
 for(const [name,value] of Object.entries(fields))url.searchParams.set(name,value);
 return Object.freeze({
  registrationUrl:url.toString(),officialOrigin:url.origin,
  proposedAppName:NAME,callbackUrl:CALLBACK,
  permissions:PERMISSIONS,installOnlyForOwner:true,
  OAuthOnInstall:false,webhooksEnabled:false,
  requiresOwnerGithubSignIn:true,appCreated:false,
  appInstalled:false,oauthVerified:false,workerDeployed:false,
  safeToAttemptLiveOAuth:false
 });
}
