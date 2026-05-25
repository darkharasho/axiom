export type ArcSource =
  | { kind: 'deltaconnected' }
  | { kind: 'github'; repo: string }

export type InstallDir = 'bin64' | 'bin64/arcdps/extensions'

export interface ArcPluginMeta {
  id: string
  name: string
  source: ArcSource
  dllPattern: RegExp
  installDir: InstallDir
  assetPattern?: RegExp
  alwaysShow: boolean
}

export const ARCDPS_REGISTRY: ArcPluginMeta[] = [
  {
    id: 'arcdps',
    name: 'arcdps',
    source: { kind: 'deltaconnected' },
    dllPattern: /^d3d11\.dll$/i,
    installDir: 'bin64',
    alwaysShow: true,
  },
  {
    id: 'arcdps_axipulse',
    name: 'AxiPulse (arcdps plugin)',
    source: { kind: 'github', repo: 'darkharasho/arcdps_axipulse' },
    dllPattern: /^arcdps_axipulse\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_axipulse\.dll$/i,
    alwaysShow: true,
  },
  {
    id: 'squad_roles',
    name: 'Squad Roles',
    source: { kind: 'github', repo: 'xvwyh/SquadRoles' },
    dllPattern: /^arcdps_squad_roles\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_squad_roles\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'squad_ready',
    name: 'Squad Ready',
    source: { kind: 'github', repo: 'cheahjs/arcdps-squad-ready-plugin' },
    dllPattern: /^arcdps_squad_ready\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_squad_ready\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'player_list',
    name: 'Player List',
    source: { kind: 'github', repo: 'Calcoph/gw2-player-list' },
    dllPattern: /^arcdps_player_list\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_player_list\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'mechanics_log',
    name: 'Mechanics Log',
    source: { kind: 'github', repo: 'knoxfighter/GW2-ArcDPS-Mechanics-Log' },
    dllPattern: /^arcdps_mechanics?.*\.dll$/i,
    installDir: 'bin64',
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'killproof_me',
    name: 'Killproof.me',
    source: { kind: 'github', repo: 'knoxfighter/arcdps-killproof.me-plugin' },
    dllPattern: /^arcdps_killproof_me\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_killproof_me\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'food_reminder',
    name: 'Food Reminder',
    source: { kind: 'github', repo: 'Zerthox/arcdps-food-reminder' },
    dllPattern: /^arcdps_food[_-]reminder\.dll$/i,
    installDir: 'bin64',
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'arc_clears',
    name: 'arcdps Clears',
    source: { kind: 'github', repo: 'gw2scratch/arcdps-clears' },
    dllPattern: /^arcdps_clears\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_clears\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'chat_log',
    name: 'Chat Log',
    source: { kind: 'github', repo: 'cheahjs/arcdps-chat-log' },
    dllPattern: /^arcdps_chat_log\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_chat_log\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'gw2_buddy',
    name: 'GW2 Buddy',
    source: { kind: 'github', repo: 'Zerthox/gw2-buddy' },
    dllPattern: /^arcdps_buddy\.dll$/i,
    installDir: 'bin64',
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'boon_table',
    name: 'Boon Table',
    source: { kind: 'github', repo: 'knoxfighter/GW2-ArcDPS-Boon-Table' },
    dllPattern: /^arcdps_boon_table\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_boon_table\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'bhud',
    name: 'Blish HUD bridge',
    source: { kind: 'github', repo: 'blish-hud/arcdps-bhud' },
    dllPattern: /^arcdps_bhud\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_bhud\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'unofficial_extras',
    name: 'Unofficial Extras',
    source: { kind: 'github', repo: 'Krappa322/arcdps_unofficial_extras_releases' },
    dllPattern: /^extras\.dll$/i,
    installDir: 'bin64/arcdps/extensions',
    assetPattern: /^extras\.dll$/i,
    alwaysShow: false,
  },
]

export function getPluginMeta(id: string): ArcPluginMeta | undefined {
  return ARCDPS_REGISTRY.find(p => p.id === id)
}
