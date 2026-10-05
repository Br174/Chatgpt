const encoder = new TextEncoder();
const decoder = new TextDecoder();
const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_OIDC_JWKS = 'https://token.actions.githubusercontent.com/.well-known/jwks';

function b64urlBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_jwt_segment');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function b64urlJson(value) {
  return JSON.parse(decoder.decode(b64urlBytes(value)));
}

function audienceMatches(actual, expected) {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

export function validateGitHubOidcClaims(claims, policy, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!claims || typeof claims !== 'object') throw new Error('invalid_oidc_claims');
  if (claims.iss !== GITHUB_OIDC_ISSUER) throw new Error('invalid_oidc_issuer');
  if (!audienceMatches(claims.aud, policy.audience)) throw new Error('invalid_oidc_audience');
  if (claims.repository !== policy.repository) throw new Error('invalid_oidc_repository');
  if (policy.repositoryId && String(claims.repository_id) !== String(policy.repositoryId)) throw new Error('invalid_oidc_repository_id');
  if (claims.repository_visibility !== 'private') throw new Error('invalid_oidc_repository_visibility');
  if (claims.ref !== policy.ref) throw new Error('invalid_oidc_ref');
  if (claims.workflow_ref !== policy.workflowRef) throw new Error('invalid_oidc_workflow_ref');
  if (!['push','workflow_dispatch'].includes(claims.event_name)) throw new Error('invalid_oidc_event');
  if (claims.runner_environment !== 'github-hosted') throw new Error('invalid_oidc_runner');
  if (!Number.isInteger(claims.exp) || claims.exp <= nowSeconds - 30) throw new Error('expired_oidc_token');
  if (!Number.isInteger(claims.nbf) || claims.nbf > nowSeconds + 30) throw new Error('premature_oidc_token');
  if (!Number.isInteger(claims.iat) || claims.iat > nowSeconds + 30 || claims.iat < nowSeconds - 900) throw new Error('invalid_oidc_iat');
  if (typeof claims.jti !== 'string' || claims.jti.length < 8 || claims.jti.length > 256) throw new Error('invalid_oidc_jti');
  return claims;
}

export async function verifyGitHubActionsOidc(jwt, policy, fetcher = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof jwt !== 'string' || jwt.length < 100 || jwt.length > 20000) throw new Error('invalid_oidc_token');
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('invalid_oidc_token');
  const header = b64urlJson(parts[0]);
  const claims = b64urlJson(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new Error('invalid_oidc_header');

  const response = await fetcher(GITHUB_OIDC_JWKS, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('oidc_jwks_unavailable');
  const jwks = await response.json();
  const jwk = Array.isArray(jwks?.keys) ? jwks.keys.find((key) => key.kid === header.kid && key.kty === 'RSA') : null;
  if (!jwk) throw new Error('oidc_key_not_found');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlBytes(parts[2]),
    encoder.encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error('invalid_oidc_signature');
  return validateGitHubOidcClaims(claims, policy, nowSeconds);
}
