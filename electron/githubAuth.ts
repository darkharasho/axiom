// GitHub OAuth device flow — "Sign in with GitHub".
// Pure async functions: fetch + delay are injectable for unit testing with no
// real network and no real timers. The IPC layer opens the verification URI.
// Mirrors axivale/src/main/githubAuth.ts. Sign-in asks for read:user only, which
// is enough to resolve the login. A login on the allowlist of a private APP_META
// entry can then run a second flow ("Unlock private apps") asking for
// read:user repo, because private release assets need the repo scope. No other
// login is ever asked for repo (privateTools.ts#deviceFlowScope), and the token
// only goes to the private repo's API paths (tokenScope.ts).

const GITHUB_HOST = 'https://github.com'
const GITHUB_API = 'https://api.github.com'
const UA = 'AxiOM'

export const SCOPE_BASIC = 'read:user'
export const SCOPE_PRIVATE = 'read:user repo'

/** "read:user repo" or GitHub's "read:user,repo" → ['read:user', 'repo']. */
export function scopeList(scope: string): string[] {
  return scope.split(/[\s,]+/).filter(Boolean)
}

/** Parse the X-OAuth-Scopes response header (comma-separated). Missing → []. */
export function parseScopesHeader(value: string | null | undefined): string[] {
  return (value ?? '').split(',').map(x => x.trim()).filter(Boolean)
}

export const GITHUB_DEVICE_CLIENT_ID = process.env.GITHUB_DEVICE_CLIENT_ID || 'Ov23liFh1ih9LAcnLACw'

export type FetchFn = typeof fetch
export type DelayFn = (ms: number) => Promise<void>

const realDelay: DelayFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export interface DeviceAuthBegin {
  deviceCode: string
  userCode: string
  verificationUri: string
  interval: number
  expiresIn: number
}

export async function beginDeviceAuth(clientId: string, fetchFn: FetchFn = fetch, scope: string = SCOPE_BASIC): Promise<DeviceAuthBegin> {
  if (!clientId) throw new Error('Missing GitHub device client ID.')
  const body = new URLSearchParams({ client_id: clientId, scope })
  const res = await fetchFn(`${GITHUB_HOST}/login/device/code`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body,
  })
  if (!res.ok) throw new Error(`Failed to request device code (${res.status}).`)
  const data = (await res.json()) as {
    device_code?: string; user_code?: string; verification_uri?: string
    interval?: number; expires_in?: number; error_description?: string
  }
  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error(data.error_description || 'GitHub did not return a device code.')
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    interval: data.interval ?? 5,
    expiresIn: data.expires_in ?? 900,
  }
}

export async function pollForToken(
  clientId: string,
  deviceCode: string,
  { intervalSeconds, expiresInSeconds, fetchFn = fetch, delayFn = realDelay }: {
    intervalSeconds: number; expiresInSeconds: number; fetchFn?: FetchFn; delayFn?: DelayFn
  },
): Promise<string> {
  if (!clientId) throw new Error('Missing GitHub device client ID.')
  if (!deviceCode) throw new Error('Missing GitHub device code.')
  const deadline = Date.now() + Math.max(0, expiresInSeconds) * 1000
  let intervalMs = Math.max(1, intervalSeconds) * 1000
  while (Date.now() < deadline) {
    await delayFn(intervalMs)
    const body = new URLSearchParams({
      client_id: clientId, device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })
    const res = await fetchFn(`${GITHUB_HOST}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body,
    })
    if (!res.ok) throw new Error(`Failed to poll for token (${res.status}).`)
    const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
    if (data.access_token) return data.access_token
    if (data.error === 'authorization_pending') continue
    if (data.error === 'slow_down') { intervalMs += 5000; continue }
    if (data.error === 'expired_token') throw new Error('GitHub login expired before you authorized. Try again.')
    throw new Error(data.error_description || data.error || 'GitHub OAuth failed.')
  }
  throw new Error('GitHub login timed out.')
}

/** GET /user: the login, the numeric user id (used by the Axi access check) and
 *  the scopes the token was actually granted (X-OAuth-Scopes).
 *  Throws when the request fails or the response has no usable id. */
export async function fetchGithubUser(token: string, fetchFn: FetchFn = fetch): Promise<{ login: string; id: number; scopes: string[] }> {
  const res = await fetchFn(`${GITHUB_API}/user`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`Failed to fetch GitHub user (${res.status}).`)
  const data = (await res.json()) as { login?: string; id?: number }
  if (typeof data.id !== 'number' || !Number.isSafeInteger(data.id) || data.id <= 0) {
    throw new Error('GitHub did not return a user id.')
  }
  return { login: data.login || 'github', id: data.id, scopes: parseScopesHeader(res.headers?.get('X-OAuth-Scopes')) }
}

export async function fetchGithubLogin(token: string, fetchFn: FetchFn = fetch): Promise<string> {
  try {
    const res = await fetchFn(`${GITHUB_API}/user`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': UA },
    })
    if (!res.ok) return 'github'
    const data = (await res.json()) as { login?: string }
    return data.login || 'github'
  } catch {
    return 'github'
  }
}
