import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'io.darkharasho.axiom',
  productName: 'AxiOM',
  directories: { output: 'dist_out' },
  files: ['dist/**', 'dist-electron/**', 'public/**'],
  linux: {
    target: 'AppImage',
    icon: 'public/AxiOM-White.png',
  },
  win: {
    target: 'nsis',
    icon: 'public/AxiOM-White.png',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'public/AxiOM-White.png',
    uninstallerIcon: 'public/AxiOM-White.png',
  },
}

export default config
