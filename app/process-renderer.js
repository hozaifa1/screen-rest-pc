import VersionChecker from './utils/versionChecker.js'

window.onload = async (e) => {
  window.screenrest.onShowNotification(async (text, silent) => {
    __electronLog.info(`ScreenRest: showing notification "${text}" (silent: ${silent})`)
    const title = await window.utils.shouldShowNotificationTitle(
      await window.runtime.platform(),
      await window.runtime.getSystemVersion()
    )
      ? 'ScreenRest'
      : ''
    const notification = new Notification(title, {
      body: text,
      requireInteraction: true,
      silent: true,
      icon: '../build/icon.ico'
    })
    setTimeout(() => notification.close(), 7000)
  })

  window.screenrest.onCheckVersion(async (oldVersion, notify, silent) => {
    if (await window.global.getValue('isNewVersion') && notify) {
      notifyNewVersion(silent)
    } else {
      new VersionChecker()
        .latest()
        .then(async version => {
          if (version) {
            const cleanVersion = await window.semver.clean(version)
            __electronLog.info(`ScreenRest: checking for new version (local: ${oldVersion}, remote: ${cleanVersion})`)
            if (await window.semver.valid(cleanVersion) && await window.semver.gt(cleanVersion, oldVersion)) {
              await window.global.setValue('isNewVersion', true)
              window.screenrest.updateTray()
              if (notify) {
                notifyNewVersion(silent)
              }
            }
          } else {
            __electronLog.info('ScreenRest: could not check for new version')
          }
        })
        .catch(exception => __electronLog.error(exception))
    }
  })

  async function notifyNewVersion (silent) {
    const title = await window.utils.shouldShowNotificationTitle(await window.runtime.platform(), await window.runtime.getSystemVersion()) ? 'ScreenRest' : ''
    const notification = new Notification(title, {
      body: await window.i18next.t('process.newVersionAvailable'),
      silent,
      icon: '../build/icon.ico'
    })
    notification.onclick = () => window.electronApi.openExternal('https://github.com/hozaifa1/screenrest-pc/releases')
  }
}
