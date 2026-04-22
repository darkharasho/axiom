import { app } from 'electron'

export function setAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    name: 'AxiOM',
  })
}

export function getAutoStart(): boolean {
  return app.getLoginItemSettings().openAtLogin
}
