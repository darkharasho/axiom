// Single source of truth for which GitHub accounts may see `private` registry
// entries. Code-defined on purpose — there is intentionally no UI to edit it.
export const PRIVATE_TOOL_ALLOWLIST = ['darkharasho']

export function isPrivateUnlocked(login: string | null): boolean {
  return login != null && PRIVATE_TOOL_ALLOWLIST.includes(login)
}
