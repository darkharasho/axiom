import { app } from 'electron'

export function setAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
  })
}

export function getAutoStart(): boolean {
  return app.getLoginItemSettings().openAtLogin
}
