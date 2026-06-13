// GitHub OAuth device flow — "Sign in with GitHub".
// Pure async functions: fetch + delay are injectable for unit testing with no
// real network and no real timers. The IPC layer opens the verification URI.
// Mirrors axivale/src/main/githubAuth.ts. Scope is read:user only — AxiOM only
// needs to resolve the login (the axivale repo is public, so no repo scope).

const GITHUB_HOST = 'https://github.com'
const GITHUB_API = 'https://api.github.com'
const UA = 'AxiOM'
const SCOPE = 'read:user'

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

export async function beginDeviceAuth(clientId: string, fetchFn: FetchFn = fetch): Promise<DeviceAuthBegin> {
  if (!clientId) throw new Error('Missing GitHub device client ID.')
  const body = new URLSearchParams({ client_id: clientId, scope: SCOPE })
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
