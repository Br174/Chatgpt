// GitHub changed user-to-server GitHub App client-ID format over time.
// Accept the historic Iv1.<id> / Iv1_<id> form AND the owner-confirmed 2026
// Iv23<id> form. This is syntax validation, NOT proof an app is installed.
const LEGACY=/^Iv1[._][A-Za-z0-9]{10,120}$/;
const CURRENT=/^Iv[2-9][0-9][A-Za-z0-9]{10,120}$/;
export const isGitHubAppClientIdLab=value=>
 typeof value==="string"&&(LEGACY.test(value)||CURRENT.test(value));
