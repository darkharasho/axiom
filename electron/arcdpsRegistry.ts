export type ArcSource =
  | { kind: 'deltaconnected' }
  | { kind: 'github'; repo: string }

// '' = GW2 install root (next to Gw2-64.exe). Other values are subfolders of the root.
export type InstallDir =
  | ''
  | 'bin64'
  | 'bin64/arcdps/extensions'
  | 'addons'

export interface PluginLocation {
  dir: InstallDir
  dllPattern: RegExp
  installFilename: string  // filename to write when installing into this location
}

export interface ArcPluginMeta {
  id: string
  name: string
  description: string
  source: ArcSource
  locations: PluginLocation[]  // detection scans all; install uses first unless one is already detected
  assetPattern?: RegExp
  alwaysShow: boolean
}

// Helper for the common case: a plugin .dll loaded by arcdps (root/ or bin64/)
// or by GW2 Nexus (addons/).
function arcOrNexus(filename: string, pattern?: RegExp): PluginLocation[] {
  const dllPattern = pattern ?? new RegExp(`^${filename.replace(/\./g, '\\.')}$`, 'i')
  return [
    { dir: '',       dllPattern, installFilename: filename },
    { dir: 'bin64',  dllPattern, installFilename: filename },
    { dir: 'addons', dllPattern, installFilename: filename },
  ]
}

export const ARCDPS_REGISTRY: ArcPluginMeta[] = [
  {
    id: 'arcdps',
    name: 'arcdps',
    description: 'DPS meter and addon loader. Loads as ArcDPS.dll inside the GW2 Nexus addons/ folder, or as d3d11.dll in the GW2 root in a standalone setup.',
    source: { kind: 'deltaconnected' },
    // Nexus location checked first because a Nexus install also puts d3d11.dll
    // in the root (the Nexus loader), which would otherwise be misidentified
    // as arcdps. detectInstalledPlugins additionally skips the root d3d11.dll
    // candidate when <GW2>/addons/ exists.
    locations: [
      { dir: 'addons', dllPattern: /^ArcDPS\.dll$/i, installFilename: 'ArcDPS.dll' },
      { dir: '',       dllPattern: /^d3d11\.dll$/i,  installFilename: 'd3d11.dll' },
    ],
    alwaysShow: true,
  },
  {
    id: 'arcdps_axipulse',
    name: 'AxiPulse (arcdps plugin)',
    description: 'AxiPulse’s combat analysis (damage, timelines, performance history) running in-game as an arcdps panel.',
    source: { kind: 'github', repo: 'darkharasho/arcdps-axipulse' },
    locations: arcOrNexus('arcdps_axipulse.dll'),
    assetPattern: /^arcdps_axipulse\.dll$/i,
    alwaysShow: true,
  },
  {
    id: 'squad_roles',
    name: 'Squad Roles',
    description: 'Marks squad members’ roles (heal, quickness, alacrity, etc.) in the arcdps overlay.',
    source: { kind: 'github', repo: 'xvwyh/SquadRoles' },
    locations: arcOrNexus('arcdps_squad_roles.dll'),
    assetPattern: /^arcdps_squad_roles\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'squad_ready',
    name: 'Squad Ready',
    description: 'Shows who in the squad has clicked “ready” before a pull.',
    source: { kind: 'github', repo: 'cheahjs/arcdps-squad-ready-plugin' },
    locations: arcOrNexus('arcdps_squad_ready.dll'),
    assetPattern: /^arcdps_squad_ready\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'player_list',
    name: 'Player List',
    description: 'Live overlay listing nearby players with profession and account.',
    source: { kind: 'github', repo: 'Calcoph/gw2-player-list' },
    locations: arcOrNexus('arcdps_player_list.dll'),
    assetPattern: /^arcdps_player_list\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'mechanics_log',
    name: 'Mechanics Log',
    description: 'Per-encounter mechanic hits, dodges, and fail counters.',
    source: { kind: 'github', repo: 'knoxfighter/GW2-ArcDPS-Mechanics-Log' },
    locations: arcOrNexus('arcdps_mechanics.dll', /^arcdps_mechanics?.*\.dll$/i),
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'healing_stats',
    name: 'Healing Stats',
    description: 'Tracks outgoing healing per squad member (arcdps does not report heals natively).',
    source: { kind: 'github', repo: 'Krappa322/arcdps_healing_stats' },
    locations: arcOrNexus('arcdps_healing_stats.dll'),
    assetPattern: /^arcdps_healing_stats\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'killproof_me',
    name: 'Killproof.me',
    description: 'Looks up squad members on killproof.me to show LI / KP at a glance.',
    source: { kind: 'github', repo: 'knoxfighter/arcdps-killproof.me-plugin' },
    locations: arcOrNexus('arcdps_killproof_me.dll'),
    assetPattern: /^arcdps_killproof_me\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'food_reminder',
    name: 'Food Reminder',
    description: 'Reminds you to refresh food and utility buffs before they expire.',
    source: { kind: 'github', repo: 'Zerthox/arcdps-food-reminder' },
    locations: arcOrNexus('arcdps_food_reminder.dll', /^arcdps_food[_-]reminder\.dll$/i),
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'arc_clears',
    name: 'arcdps Clears',
    description: 'Tracks weekly raid and strike mission clears across your characters.',
    source: { kind: 'github', repo: 'gw2scratch/arcdps-clears' },
    locations: arcOrNexus('arcdps_clears.dll'),
    assetPattern: /^arcdps_clears\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'chat_log',
    name: 'Chat Log',
    description: 'Captures in-game chat to local log files for later review.',
    source: { kind: 'github', repo: 'cheahjs/arcdps-chat-log' },
    locations: arcOrNexus('arcdps_chat_log.dll'),
    assetPattern: /^arcdps_chat_log\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'gw2_buddy',
    name: 'GW2 Buddy',
    description: 'Boon, condition, and buff helper overlay with custom alerts.',
    source: { kind: 'github', repo: 'Zerthox/gw2-buddy' },
    locations: arcOrNexus('arcdps_buddy.dll'),
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'boon_table',
    name: 'Boon Table',
    description: 'Live boon-uptime table for the squad during fights.',
    source: { kind: 'github', repo: 'knoxfighter/GW2-ArcDPS-Boon-Table' },
    locations: arcOrNexus('arcdps_boon_table.dll'),
    assetPattern: /^arcdps_boon_table\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'bhud',
    name: 'Blish HUD bridge',
    description: 'Bridges arcdps combat data into Blish HUD modules.',
    source: { kind: 'github', repo: 'blish-hud/arcdps-bhud' },
    locations: arcOrNexus('arcdps_bhud.dll'),
    assetPattern: /^arcdps_bhud\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'unofficial_extras',
    name: 'Unofficial Extras',
    description: 'Extra arcdps callbacks (squad chat, ready check) required by several other plugins.',
    source: { kind: 'github', repo: 'Krappa322/arcdps_unofficial_extras_releases' },
    // Filenames seen in the wild for this plugin:
    //   extras.dll                       (canonical / arcdps install)
    //   Unofficial_Extras.dll            (Nexus's CamelCase rename)
    //   arcdps_unofficial_extras.dll     (prefixed variant some installers use)
    locations: [
      { dir: 'addons',                  dllPattern: /^(arcdps_unofficial_extras|Unofficial_Extras|extras)\.dll$/i, installFilename: 'Unofficial_Extras.dll' },
      { dir: 'bin64/arcdps/extensions', dllPattern: /^extras\.dll$/i,                                              installFilename: 'extras.dll' },
    ],
    assetPattern: /^extras\.dll$/i,
    alwaysShow: false,
  },
]

export function getPluginMeta(id: string): ArcPluginMeta | undefined {
  return ARCDPS_REGISTRY.find(p => p.id === id)
}
