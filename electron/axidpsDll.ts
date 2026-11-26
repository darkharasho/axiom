import fs from 'fs'
import path from 'path'

// AxiDPS's game DLL takes the d3d11.dll name and chainloads arcdps from
// axidps_chain_d3d11.dll (arcdps_d3d11.dll in older builds). Every build embeds this ASCII marker (`<marker><semver>\0`).
const MARKER = Buffer.from('axidps-dll-version=')

export function isAxidpsDll(file: string): boolean {
  try {
    return fs.readFileSync(file).indexOf(MARKER) !== -1
  } catch {
    return false
  }
}

export function axidpsInstalled(gw2Path: string): boolean {
  return isAxidpsDll(path.join(gw2Path, 'd3d11.dll'))
}
