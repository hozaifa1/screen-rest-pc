import {
  app, nativeTheme, BrowserWindow, Menu, ipcMain,
  screen, shell, dialog, globalShortcut, Tray,
  powerMonitor
} from 'electron'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'path'
import { resolveLocalImage } from './utils/imageResolver.js'
import { fileURLToPath } from 'url'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import log from 'electron-log/main.js'
import Store from 'electron-store'
import humanizeDuration from 'humanize-duration'

import {
  canPostpone, canSkip, formatTimeRemaining,
  minutesRemaining, insideWindowsStore, insideFlatpak, insideSnap, insideWindowsPortable
} from './utils/utils.js'
import BreaksPlanner from './breaksPlanner.js'
import AppIcon from './utils/appIcon.js'
import { UntilMorning } from './utils/untilMorning.js'
import AutostartManager from './utils/autostartManager.js'
import { registerBreakShortcuts } from './utils/breakShortcuts.js'
import defaultSettings from './utils/defaultSettings.js'
import StatusMessages from './utils/statusMessages.js'
import DisplayManager from './utils/displayManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

process.on('uncaughtException', (err, _) => {
  log.error(err)
  const dialogOpts = {
    type: 'error',
    title: 'ScreenRest',
    message: 'An error occured while running ScreenRest and it will now quit. To report the issue, click Report.',
    buttons: ['Report', 'OK']
  }
  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) {
      shell.openExternal('https://github.com/hozaifa1/screenrest-pc/issues')
    }
    app.quit()
  })
})

nativeTheme.on('updated', function theThemeHasChanged () {
  if (!gotTheLock) {
    return
  }
  updateTray()
})

let breakPlanner
let appIcon = null
let autostartManager = null
let displayManager = null
let processWin = null
let microbreakWins = null
let preferencesWin = null
let welcomeWin = null
let settings
let pausedForSuspendOrLock = false
let currentTrayIconPath = null
let currentTrayMenuTemplate = null
let trayUpdateIntervalObj = null

if (insideWindowsPortable()) {
  const portableDataPath = join(process.env.PORTABLE_EXECUTABLE_DIR, 'Data')
  if (!existsSync(portableDataPath)) {
    mkdirSync(portableDataPath, { recursive: true })
  }
  app.setPath('userData', portableDataPath)
}

log.initialize({ preload: true })

// https://stackoverflow.com/questions/65859634/notification-from-electron-shows-electron-app-electron/65863174#65863174
if (process.platform === 'win32') {
  app.setAppUserModelId('ScreenRest')
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    log.info('ScreenRest: second instance detected, showing preferences')
    createPreferencesWindow()
  })
}

app.on('ready', initialize)
app.on('window-all-closed', () => {
  // do nothing, so app wont get closed
})
app.on('before-quit', (event) => {
  if (breakPlanner.scheduler.reference === 'finishMicrobreak' && settings.get('microbreakStrictMode')) {
    log.info('ScreenRest: preventing app closure (in break with strict mode)')
    event.preventDefault()
  } else {
    globalShortcut.unregisterAll()
    // Clean up D-Bus connections
    if (autostartManager) {
      autostartManager.disconnect()
    }
    app.quit()
  }
})

async function initialize (isAppStart = true) {
  if (!gotTheLock) {
    return
  }
  // TODO maybe we should not reinitialize but handle everything when we save new values for preferences
  log.info(`ScreenRest: ${isAppStart ? '' : 're'}initializing...`)

  EventEmitter.setMaxListeners(200) // for watching Store changes
  if (!settings) {
    settings = new Store({
      defaults: defaultSettings,
      beforeEachMigration: (store, context) => {
        log.info(`ScreenRest: migrating preferences from ScreenRest v${context.fromVersion} to v${context.toVersion}`)
      },
      migrations: {
        '1.13.0': store => {
          if (store.has('pauseBreaksShortcut')) {
            store.set('pauseBreaksToggleShortcut', store.get('pauseBreaksShortcut'))
            log.info(`ScreenRest: settings pauseBreaksToggleShortcut to "${store.get('pauseBreaksShortcut')}"`)
            store.delete('pauseBreaksShortcut')
            log.info('ScreenRest: removing pauseBreaksShortcut')
          } else {
            log.info('ScreenRest: not migrating pauseBreaksShortcut')
          }
          if (store.has('pauseBreaksShortcut')) {
            store.delete('resumeBreaksShortcut')
            log.info('ScreenRest: removing resumeBreaksShortcut')
          }
        },
        '1.17.0': store => {
          if (store.has('showBreakActionsInStrictMode')) {
            store.set('showTrayMenuInStrictMode', store.get('showBreakActionsInStrictMode'))
            log.info(`ScreenRest: settings showTrayMenuInStrictMode to "${store.get('showBreakActionsInStrictMode')}"`)
            store.delete('showBreakActionsInStrictMode')
            log.info('ScreenRest: removing showBreakActionsInStrictMode')
          } else {
            log.info('ScreenRest: not migrating showBreakActionsInStrictMode')
          }
        },
        '1.18.2': store => {
          if (insideFlatpak() || insideWindowsStore() || insideSnap()) {
            if (!store.get('disableAppUpdateFeatures')) {
              store.set('disableAppUpdateFeatures', true)
              log.info('ScreenRest: setting disableAppUpdateFeatures to true because we are in Flatpak/Windows Store/Snap build')
            }
          }
        },
        '1.19.0': store => {
          if (store.has('audio')) {
            const legacyAudio = store.get('audio')
            store.set('longBreakAudio', legacyAudio)
            log.info(`ScreenRest: migrating audio to longBreakAudio with value "${legacyAudio}"`)
            store.delete('audio')
            log.info('ScreenRest: removing audio')
          } else {
            log.info('ScreenRest: not migrating audio to longBreakAudio')
          }
          if (store.has('microbreakStartSoundPlaying')) {
            const val = store.get('microbreakStartSoundPlaying') ? store.get('miniBreakAudio') : 'silence'
            store.set('miniBreakStartSound', val)
            log.info(`ScreenRest: migrating microbreakStartSoundPlaying to miniBreakStartSound with value "${val}"`)
            store.delete('microbreakStartSoundPlaying')
            log.info('ScreenRest: removing microbreakStartSoundPlaying')
          } else {
            log.info('ScreenRest: not migrating microbreakStartSoundPlaying')
          }
          if (store.has('breakStartSoundPlaying')) {
            const val = store.get('breakStartSoundPlaying') ? store.get('longBreakAudio') : 'silence'
            store.set('longBreakStartSound', val)
            log.info(`ScreenRest: migrating breakStartSoundPlaying to longBreakStartSound with value "${val}"`)
            store.delete('breakStartSoundPlaying')
            log.info('ScreenRest: removing breakStartSoundPlaying')
          } else {
            log.info('ScreenRest: not migrating breakStartSoundPlaying')
          }
        },
        '1.20.0': store => {
          if (store.has('timeToBreakInTray')) {
            if (store.get('timeToBreakInTray')) {
              store.set('trayIconStyle', 'time')
              log.info('ScreenRest: migrating timeToBreakInTray to trayIconStyle="time"')
            } else {
              store.set('trayIconStyle', 'default')
              log.info('ScreenRest: migrating tray settings to trayIconStyle="default"')
            }
            store.delete('timeToBreakInTray')
          }
        }
      },
      watch: true
    })
    log.info('ScreenRest: loading preferences')
    Store.initRenderer()
    Object.entries(settings.store).forEach(([key, _]) => {
      settings.onDidChange(key, (newValue, oldValue) => {
        log.info(`ScreenRest: setting '${key}' to '${JSON.stringify(newValue)}' (was '${JSON.stringify(oldValue)}')`)
      })
    })
  }
  if (!breakPlanner) {
    breakPlanner = new BreaksPlanner(settings)
    breakPlanner.nextBreak()
    breakPlanner.on('startMicrobreakNotification', () => { startMicrobreakNotification() })
    breakPlanner.on('startMicrobreak', () => { startMicrobreak() })
    breakPlanner.on('finishMicrobreak', (shouldPlaySound, shouldPlanNext) => {
      if (settings.get('miniBreakManualFinish')) {
        enterMiniBreakManualContinuation(shouldPlaySound)
        return
      }
      finishMicrobreak(shouldPlaySound, shouldPlanNext)
    })
    breakPlanner.on('resumeBreaks', () => { resumeBreaks() })
    breakPlanner.on('updateToolTip', function () {
      updateTray()
    })
  } else {
    breakPlanner.clear()
    breakPlanner.appExclusionsManager.reinitialize(settings)
    breakPlanner.doNotDisturb(settings.get('monitorDnd'))
    breakPlanner.naturalBreaks(settings.get('naturalBreaks'))
    breakPlanner.nextBreak()
  }

  autostartManager = new AutostartManager({
    app,
    settings
  })

  if (!settings.get('_migratedOpenAtLogin')) {
    // one time migration with 1.20 or after
    settings.set('openAtLogin', await autostartManager.autoLaunchStatus())
    settings.set('_migratedOpenAtLogin', true)
    log.info('ScreenRest: Migrated to openAtLogin')
  }

  const currentAutostartValue = await autostartManager.autoLaunchStatus()
  const openAtLogin = settings.get('openAtLogin')
  if (openAtLogin !== currentAutostartValue) {
    autostartManager.setAutostartEnabled(openAtLogin)
  }
  log.info(`ScreenRest: attempting to set autostart to ${openAtLogin}`)

  const imagesDir = join(app.getPath('userData'), 'images')
  if (!existsSync(imagesDir)) {
    try {
      mkdirSync(imagesDir, { recursive: true })
    } catch (error) {
      log.error('ScreenRest: error creating images directory', error)
    }
  }
  // Initialize portal early for Flatpak so it's ready when user opens preferences
  if (insideFlatpak()) {
    autostartManager.flatpakPortalManager.initialize().catch(err => {
      log.error('ScreenRest: Failed to initialize portal manager during startup:', err)
    })
  }

  displayManager = new DisplayManager(settings)

  startI18next()
  startProcessWin()
  createWelcomeWindow()
  nativeTheme.themeSource = settings.get('themeSource')

  startPowerMonitoring()
  if (preferencesWin) {
    preferencesWin.webContents.send('renderSettings', settings.store)
  }
  if (welcomeWin) {
    welcomeWin.webContents.send('renderSettings', settings.store)
  }
  globalShortcut.unregisterAll()

  registerBreakShortcuts({
    settings,
    log,
    globalShortcut,
    breakPlanner,
    functions: { pauseBreaks, resumeBreaks, skipToBreak, skipToMicrobreak, resetBreaks }
  })

  updateTray()
}

function startI18next () {
  i18next
    .use(Backend)
    .init({
      lng: settings.get('language'),
      fallbackLng: 'en',
      debug: !app.isPackaged,
      backend: {
        loadPath: join(__dirname, '/locales/{{lng}}.json'),
        jsonIndent: 2
      }
    }, function (err, t) {
      if (err) {
        log.error(err.stack)
      }
    })
}

i18next.on('languageChanged', () => {
  if (welcomeWin) {
    welcomeWin.webContents.send('translate')
  }
  if (preferencesWin) {
    preferencesWin.webContents.send('translate')
  }
  updateTray()
})

function onSuspendOrLock () {
  log.info('System: suspend or lock')
  if (settings.get('pauseForSuspendOrLock')) {
    if (breakPlanner.isPaused || breakPlanner.dndManager.isOnDnd ||
      breakPlanner.naturalBreaksManager.isSchedulerCleared ||
      breakPlanner.appExclusionsManager.isSchedulerCleared) {
      log.info('ScreenRest: not pausing for suspendOrLock because paused already')
    } else {
      pausedForSuspendOrLock = true
      pauseBreaks(1)
      updateTray()
    }
  } else {
    log.info('ScreenRest: not pausing for suspendOrLock because setting is disabled')
  }
}

function onResumeOrUnlock () {
  log.info('System: resume or unlock')
  if (pausedForSuspendOrLock) {
    pausedForSuspendOrLock = false
    resumeBreaks(false)
  } else {
    // corrrect the planner for the time spent in suspend
    breakPlanner.correctScheduler()
  }
  updateTray()
}

function startPowerMonitoring () {
  powerMonitor.on('suspend', onSuspendOrLock)
  powerMonitor.on('lock-screen', onSuspendOrLock)
  powerMonitor.on('resume', onResumeOrUnlock)
  powerMonitor.on('unlock-screen', onResumeOrUnlock)
}

function closeWindows (windowArray) {
  for (const window of windowArray) {
    if (!window || window.isDestroyed()) {
      continue
    }

    window.hide()
    if (windowArray[0] === window) {
      ipcMain.removeHandler('send-mini-break-data')
    }

    // Use destroy() for immediate, guaranteed cleanup on all platforms
    window.destroy()
  }
  return null
}

function trayIconPath () {
  const params = {
    paused:
      breakPlanner.isPaused ||
      breakPlanner.dndManager.isOnDnd ||
      breakPlanner.naturalBreaksManager.isSchedulerCleared ||
      breakPlanner.appExclusionsManager.isSchedulerCleared,
    monochrome: settings.get('useMonochromeTrayIcon'),
    inverted: settings.get('useMonochromeInvertedTrayIcon'),
    darkMode: nativeTheme.shouldUseDarkColors,
    platform: process.platform,
    trayIconStyle: settings.get('trayIconStyle'),
    timeToBreak: minutesRemaining(breakPlanner.timeToNextBreak),
    percentage: breakPlanner.progressPercentage,
    reference: breakPlanner.scheduler.reference
  }
  const trayIconFileName = new AppIcon(params).trayIconFileName
  const pathToTrayIcon = join(__dirname, '/images/app-icons/', trayIconFileName)
  return pathToTrayIcon
}

function windowIconPath () {
  const unusedParams = null
  const params = {
    paused: false,
    monochrome: settings.get('useMonochromeTrayIcon'),
    inverted: settings.get('useMonochromeInvertedTrayIcon'),
    darkMode: nativeTheme.shouldUseDarkColors,
    platform: unusedParams,
    timeToBreakInTrayString: unusedParams,
    reference: unusedParams
  }
  const windowIconFileName = new AppIcon(params).windowIconFileName
  return join(__dirname, '/images/app-icons', windowIconFileName)
}

function startProcessWin () {
  if (processWin) {
    return
  }
  const modalPath = 'file://' + join(__dirname, '/process.html')

  processWin = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    backgroundThrottling: false,
    webPreferences: {
      preload: join(__dirname, './process-preload.mjs'),
      sandbox: false
    }
  })
  processWin.webContents.loadURL(modalPath)
}

function createWelcomeWindow (isAppStart = true) {
  if (settings.get('isFirstRun') && isAppStart) {
    const modalPath = 'file://' + join(__dirname, '/welcome.html')
    welcomeWin = new BrowserWindow({
      x: displayManager.getDisplayX(-1, 1000),
      y: displayManager.getDisplayY(-1, 750),
      width: 1000,
      height: 750,
      show: false,
      autoHideMenuBar: true,
      icon: windowIconPath(),
      backgroundColor: 'EDEDED',
      webPreferences: {
        preload: join(__dirname, './welcome-preload.mjs'),
        sandbox: false
      }
    })
    welcomeWin.webContents.loadURL(modalPath)
    welcomeWin.once('ready-to-show', () => {
      welcomeWin.center()
      welcomeWin.show()
    })
    welcomeWin.once('closed', () => {
      welcomeWin = null
    })
  }
}

function startMicrobreakNotification () {
  showNotification(i18next.t('main.microbreakIn', { seconds: settings.get('microbreakNotificationInterval') / 1000 }))
  log.info('ScreenRest: showing Mini break notification')
  breakPlanner.nextBreakAfterNotification()
  updateTray()
}

function getBlurredBackgroundWindowOptions () {
  if (!settings.get('blurredBackground')) {
    return {}
  }

  switch (process.platform) {
    case 'darwin':
      return {
        vibrancy: 'hud',
        visualEffectState: 'active'
      }
    default:
      return {}
  }
}

function startMicrobreak () {
  // don't start another break if break running
  if (microbreakWins) {
    log.warn('ScreenRest: Mini break already running, not starting Mini break')
    return
  }

  const breakDuration = settings.get('microbreakDuration')
  const strictMode = settings.get('microbreakStrictMode')
  const postponesLimit = settings.get('microbreakPostponesLimit')
  const postponableDurationPercent = settings.get('microbreakPostponableDurationPercent')
  const postponable = settings.get('microbreakPostpone') &&
    breakPlanner.postponesNumber < postponesLimit && postponesLimit > 0
  const showBreaksAsRegularWindows = settings.get('showBreaksAsRegularWindows')

  const modalPath = 'file://' + join(__dirname, '/microbreak.html')
  microbreakWins = []

  const idea = ['']

  if (!settings.get('silentNotifications')) {
    const sound = settings.get('miniBreakStartSound')
    if (sound !== 'silence') {
      processWin.webContents.send('play-sound', sound, settings.get('volume'))
    }
  }

  ipcMain.handle('send-mini-break-data', (event) => {
    const startTime = Date.now()
    const shortcut = settings.get('endBreakShortcut')
    if (shortcut) {
      globalShortcut.register(shortcut, () => {
        const passedPercent = (Date.now() - startTime) / breakDuration * 100
        if (passedPercent >= 100) {
          finishMicrobreak(false)
          return
        }
        if (canPostpone(postponable, passedPercent, postponableDurationPercent)) {
          postponeMicrobreak()
        } else if (canSkip(strictMode, postponable, passedPercent, postponableDurationPercent)) {
          finishMicrobreak(false)
        }
      })
    }
    return [idea, startTime, breakDuration, strictMode,
      postponable, postponableDurationPercent,
      calculateBackgroundColor(settings.get('miniBreakColor'))]
  })

  for (let localDisplayId = 0; localDisplayId < displayManager.getDisplayCount(); localDisplayId++) {
    const windowOptions = {
      width: Math.floor(displayManager.getDisplayWidth(localDisplayId) * settings.get('breakWindowWidth')),
      height: Math.floor(displayManager.getDisplayHeight(localDisplayId) * settings.get('breakWindowHeight')),
      autoHideMenuBar: true,
      icon: windowIconPath(),
      resizable: false,
      frame: showBreaksAsRegularWindows,
      show: false,
      backgroundThrottling: false,
      transparent: !showBreaksAsRegularWindows,
      ...getBlurredBackgroundWindowOptions(),
      backgroundColor: calculateBackgroundColor(settings.get('miniBreakColor')),
      skipTaskbar: !showBreaksAsRegularWindows,
      focusable: showBreaksAsRegularWindows,
      alwaysOnTop: !showBreaksAsRegularWindows,
      hasShadow: false,
      title: 'ScreenRest',
      titleBarStyle: process.platform === 'darwin' ? (showBreaksAsRegularWindows ? 'default' : 'hidden') : undefined,
      titleBarOverlay: process.platform === 'darwin' ? !showBreaksAsRegularWindows : undefined,
      webPreferences: {
        preload: join(__dirname, './microbreak-preload.mjs'),
        sandbox: false
      }
    }

    if (settings.get('fullscreen') && process.platform !== 'darwin') {
      windowOptions.width = displayManager.getDisplayWidth(localDisplayId)
      windowOptions.height = displayManager.getDisplayHeight(localDisplayId)
      windowOptions.x = displayManager.getDisplayX(localDisplayId, 0, true)
      windowOptions.y = displayManager.getDisplayY(localDisplayId, 0, true)
    } else if (!(settings.get('fullscreen') && process.platform === 'win32')) {
      windowOptions.x = displayManager.getDisplayX(localDisplayId, windowOptions.width, false)
      windowOptions.y = displayManager.getDisplayY(localDisplayId, windowOptions.height, false)
    }

    let microbreakWinLocal = new BrowserWindow(windowOptions)
    // seems to help with multiple-displays problems
    microbreakWinLocal.setSize(windowOptions.width, windowOptions.height)

    microbreakWinLocal.once('ready-to-show', () => {
      log.info('ScreenRest: ready-to-show fired')
    })

    ipcMain.once('mini-break-loaded', () => {
      log.info('ScreenRest: Mini break window loaded')
      if (showBreaksAsRegularWindows) {
        microbreakWinLocal.show()
      } else {
        microbreakWinLocal.showInactive()
      }

      log.info(`ScreenRest: showing window ${localDisplayId + 1} of ${displayManager.getDisplayCount()}`)
      if (process.platform === 'darwin') {
        if (showBreaksAsRegularWindows) {
          microbreakWinLocal.setFullScreen(settings.get('fullscreen'))
        } else {
          microbreakWinLocal.setMinimizable(false)
          microbreakWinLocal.setClosable(false)
          microbreakWinLocal.setKiosk(settings.get('fullscreen'))
        }
      }
      if (localDisplayId === 0) {
        breakPlanner.emit('microbreakStarted', true)
        log.info('ScreenRest: starting Mini break')
      }
      if (!settings.get('fullscreen') && process.platform !== 'darwin') {
        setTimeout(() => {
          microbreakWinLocal.center()
        }, 0)
      }
      updateTray()
    })

    microbreakWinLocal.loadURL(modalPath)
    microbreakWinLocal.setVisibleOnAllWorkspaces(true)
    microbreakWinLocal.setAlwaysOnTop(!showBreaksAsRegularWindows, 'pop-up-menu')
    if (microbreakWinLocal) {
      microbreakWinLocal.on('close', (e) => {
        if (breakPlanner.scheduler.timeLeft > 0 && settings.get('microbreakStrictMode')) {
          log.info('ScreenRest: preventing closing break window as in strict mode')
          e.preventDefault()
        }
      })
      microbreakWinLocal.once('closed', () => {
        microbreakWinLocal = null
      })
    }
    microbreakWins.push(microbreakWinLocal)

    if (!settings.get('allScreens')) {
      if (displayManager.getDisplayCount() > 1) {
        log.info('ScreenRest: not showing on more Monitors as it is disabled.')
      }
      break
    }
  }
  if (process.platform === 'darwin') {
    if (app.dock.isVisible) {
      app.dock.hide()
    }
  }
}

function breakComplete (shouldPlaySound, windows) {
  if (settings.get('endBreakShortcut') && globalShortcut.isRegistered(settings.get('endBreakShortcut'))) {
    globalShortcut.unregister(settings.get('endBreakShortcut'))
  }
  if (shouldPlaySound && !settings.get('silentNotifications')) {
    processWin.webContents.send('play-sound', settings.get('miniBreakAudio'), settings.get('volume'))
  }
  if (process.platform === 'darwin') {
    Menu.sendActionToFirstResponder('hide:')
  }
  return closeWindows(windows)
}

function enterMiniBreakManualContinuation (shouldPlaySound) {
  if (!settings.get('miniBreakManualFinish')) return
  if (shouldPlaySound && !settings.get('silentNotifications')) {
    processWin.webContents.send('play-sound', settings.get('miniBreakAudio'), settings.get('volume'))
  }
  if (microbreakWins) {
    microbreakWins.forEach(w => {
      if (w && !w.isDestroyed()) {
        w.webContents.send('enter-manual-await', 'microbreak')
      }
    })
  }
  log.info('ScreenRest: entering manual finish phase (break)')
}

function finishMicrobreak (shouldPlaySound = true, shouldPlanNext = true) {
  microbreakWins = breakComplete(shouldPlaySound, microbreakWins)
  log.info(`ScreenRest: finishing break (shouldPlanNext: ${shouldPlanNext})`)
  if (shouldPlanNext) {
    breakPlanner.nextBreak()
  } else {
    breakPlanner.clear()
  }
  updateTray()
}

function postponeMicrobreak () {
  microbreakWins = breakComplete(false, microbreakWins)
  breakPlanner.postponeCurrentBreak()
  log.info('ScreenRest: postponing break')
  updateTray()
}

function skipToMicrobreak (delay) {
  if (microbreakWins) {
    microbreakWins = breakComplete(false, microbreakWins)
  }
  if (delay) {
    breakPlanner.skipToMicrobreak(delay)
    log.info(`ScreenRest: skipping to break in ${delay}ms`)
  } else {
    breakPlanner.skipToMicrobreak()
    log.info('ScreenRest: skipping to break')
  }
  updateTray()
}

function skipToBreak (delay) {
  skipToMicrobreak(delay)
}

function resetBreaks () {
  if (microbreakWins) {
    microbreakWins = breakComplete(false, microbreakWins)
  }
  breakPlanner.reset()
  log.info('ScreenRest: resetting breaks')
  updateTray()
}

function calculateBackgroundColor (color) {
  let opacityMultiplier = 1
  if (settings.get('transparentMode')) {
    opacityMultiplier = settings.get('opacity')
  }
  return color + Math.round(opacityMultiplier * 255).toString(16).padStart(2, '0')
}

function pauseBreaks (milliseconds) {
  if (microbreakWins) {
    finishMicrobreak(false)
  }
  breakPlanner.pause(milliseconds)
  log.info(`ScreenRest: pausing breaks for ${milliseconds}ms`)
  updateTray()
}

function resumeBreaks (notify = true) {
  if (breakPlanner.dndManager.isOnDnd) {
    log.info('ScreenRest: not resuming breaks because in Do Not Disturb')
  } else {
    breakPlanner.resume()
    log.info('ScreenRest: resuming breaks')
    if (notify) {
      showNotification(i18next.t('main.resumingBreaks'))
    }
  }
  updateTray()
}

function createPreferencesWindow () {
  if (preferencesWin) {
    preferencesWin.show()
    return
  }
  const modalPath = 'file://' + join(__dirname, '/preferences.html')
  const maxHeight = screen
    .getDisplayNearestPoint(screen.getCursorScreenPoint())
    .workAreaSize.height * 0.9
  preferencesWin = new BrowserWindow({
    autoHideMenuBar: true,
    show: false,
    backgroundThrottling: false,
    icon: windowIconPath(),
    width: 600,
    height: 530,
    maxHeight: Math.round(maxHeight),
    x: displayManager.getDisplayX(-1, 600),
    y: displayManager.getDisplayY(-1, 530),
    backgroundColor: '#EDEDED',
    webPreferences: {
      preload: join(__dirname, './preferences-preload.mjs'),
      sandbox: false
    }
  })
  preferencesWin.webContents.loadURL(modalPath)
  preferencesWin.once('ready-to-show', () => {
    preferencesWin.center()
    preferencesWin.show()
  })
  preferencesWin.once('closed', () => {
    preferencesWin = null
  })
}

function updateTray () {
  if (process.platform === 'darwin') {
    if (app.dock.isVisible) {
      app.dock.hide()
    }
  }

  if (!appIcon && !settings.get('showTrayIcon')) {
    return
  }

  if (settings.get('showTrayIcon')) {
    if (!appIcon) {
      appIcon = new Tray(trayIconPath())
      appIcon.on('double-click', () => {
        createPreferencesWindow()
      })
      appIcon.on('click', () => {
        appIcon.popUpContextMenu(Menu.buildFromTemplate(currentTrayMenuTemplate))
      })
    }
    if (!trayUpdateIntervalObj) {
      trayUpdateIntervalObj = setInterval(updateTray, 10000)
    }

    updateToolTip()

    const newTrayIconPath = trayIconPath()
    if (newTrayIconPath !== currentTrayIconPath) {
      appIcon.setImage(newTrayIconPath)
      currentTrayIconPath = newTrayIconPath
    }

    const newTrayMenuTemplate = getTrayMenuTemplate()
    if (JSON.stringify(newTrayMenuTemplate) !== JSON.stringify(currentTrayMenuTemplate)) {
      const trayMenu = Menu.buildFromTemplate(newTrayMenuTemplate)
      appIcon.setContextMenu(trayMenu)
      currentTrayMenuTemplate = newTrayMenuTemplate
    }
  }
}

function getTrayMenuTemplate () {
  const trayMenu = []

  const statusMessage = new StatusMessages({
    breakPlanner,
    settings,
    i18next,
    humanizeDuration
  }).trayMessage

  if (statusMessage !== '') {
    const messages = statusMessage.split('\n')
    for (const index in messages) {
      trayMenu.push({
        label: messages[index],
        enabled: false
      })
    }

    trayMenu.push({
      type: 'separator'
    })
  }

  if (breakPlanner.scheduler.reference === 'finishMicrobreak' && settings.get('microbreakStrictMode') &&
        !settings.get('showTrayMenuInStrictMode')) {
    // empty menu, we are in strict mode
    return trayMenu
  }

  if (!(breakPlanner.isPaused || breakPlanner.dndManager.isOnDnd || breakPlanner.appExclusionsManager.isSchedulerCleared)) {
    if (settings.get('microbreak')) {
      trayMenu.push({
        label: i18next.t('main.skipToTheNext'),
        click: () => skipToMicrobreak()
      })
    }
  }

  if (breakPlanner.isPaused) {
    trayMenu.push({
      label: i18next.t('main.resume'),
      click: function () {
        resumeBreaks(false)
        updateTray()
      }
    })
  } else if (!(breakPlanner.dndManager.isOnDnd || breakPlanner.appExclusionsManager.isSchedulerCleared)) {
    trayMenu.push({
      label: i18next.t('main.pause'),
      submenu: [
        {
          label: i18next.t('utils.minutes', { count: 30 }),
          accelerator: settings.get('pauseBreaksFor30MinutesShortcut') || null,
          click: function () {
            pauseBreaks(1800 * 1000)
          }
        }, {
          label: i18next.t('main.forHour'),
          accelerator: settings.get('pauseBreaksFor1HourShortcut') || null,
          click: function () {
            pauseBreaks(3600 * 1000)
          }
        }, {
          label: i18next.t('main.for2Hours'),
          accelerator: settings.get('pauseBreaksFor2HoursShortcut') || null,
          click: function () {
            pauseBreaks(3600 * 2 * 1000)
          }
        }, {
          label: i18next.t('main.for5Hours'),
          accelerator: settings.get('pauseBreaksFor5HoursShortcut') || null,
          click: function () {
            pauseBreaks(3600 * 5 * 1000)
          }
        }, {
          label: i18next.t('main.untilMorning'),
          accelerator: settings.get('pauseBreaksUntilMorningShortcut') || null,
          click: function () {
            const untilMorning = new UntilMorning(settings).msToSunrise()
            pauseBreaks(untilMorning)
          }
        }, {
          type: 'separator'
        }, {
          label: i18next.t('main.indefinitely'),
          click: function () {
            pauseBreaks(1)
          }
        }
      ]
    }, {
      label: i18next.t('main.resetBreaks'),
      click: resetBreaks
    })
  }

  trayMenu.push({
    type: 'separator'
  }, {
    label: i18next.t('main.preferences'),
    click: function () {
      createPreferencesWindow()
    }
  })

  trayMenu.push({
    type: 'separator'
  }, {
    label: i18next.t('main.quitScreenRest'),
    role: 'quit',
    click: function () {
      app.quit()
    }
  })

  return trayMenu
}

function updateToolTip () {
  let trayMessage = i18next.t('main.toolTipHeader')
  const message = new StatusMessages({
    breakPlanner,
    settings,
    i18next,
    humanizeDuration
  }).trayMessage
  if (message !== '') {
    trayMessage += '\n\n' + message
  }
  if (appIcon) {
    appIcon.setToolTip(trayMessage)
  }
}

function showNotification (text) {
  processWin.webContents.send('show-notification',
    text,
    settings.get('silentNotifications')
  )
}

ipcMain.on('postpone-mini-break', function (event) {
  postponeMicrobreak()
})

ipcMain.on('finish-mini-break', function (event, shouldPlaySound, shouldPlanNext) {
  finishMicrobreak(shouldPlaySound, shouldPlanNext)
})

ipcMain.on('save-setting', function (event, key, value) {
  if (key === 'naturalBreaks') {
    breakPlanner.naturalBreaks(value)
  }

  if (key === 'monitorDnd') {
    breakPlanner.doNotDisturb(value)
  }

  if (key === 'language') {
    i18next.changeLanguage(value)
  }

  if (key === 'themeSource') {
    nativeTheme.themeSource = value
  }

  if (key === 'longBreakAudio') {
    settings.set('miniBreakAudio', value)
  }

  if (key === 'mainColor') {
    settings.set('miniBreakColor', value)
  }

  if (key === 'showTrayIcon') {
    settings.set('showTrayIcon', value)
    if (value) {
      updateTray()
    } else {
      clearInterval(trayUpdateIntervalObj)
      trayUpdateIntervalObj = null
      appIcon.destroy()
      appIcon = null
    }
  }

  if (key === 'openAtLogin') {
    autostartManager.setAutostartEnabled(value)
  }

  settings.set(key, value)

  updateTray()
})

ipcMain.on('update-tray', function (event) {
  updateTray()
})

ipcMain.on('restore-defaults', (event) => {
  const dialogOpts = {
    type: 'question',
    title: i18next.t('main.restoreDefaults'),
    message: i18next.t('main.warning'),
    buttons: [i18next.t('main.continue'), i18next.t('main.cancel')]
  }
  dialog.showMessageBox(dialogOpts).then(async (returnValue) => {
    if (returnValue.response === 0) {
      log.info('ScreenRest: restoring default settings')
      settings.store = Object.assign(defaultSettings, { isFirstRun: false, __internal__: settings.get('__internal__') })
      initialize(false)
      event.sender.reload()
    }
  })
})

ipcMain.on('play-sound', (event, sound) => {
  processWin.webContents.send('play-sound', sound, settings.get('volume'))
})

ipcMain.handle('show-debug', (event) => {
  const reference = breakPlanner.scheduler.reference
  const timeleft = formatTimeRemaining(
    breakPlanner.scheduler.timeLeft, settings.get('language'),
    i18next, humanizeDuration
  )
  const breaknumber = breakPlanner.breakNumber
  const postponesnumber = breakPlanner.postponesNumber
  const doNotDisturb = breakPlanner.dndManager.isOnDnd
  let settingsFile = settings.path
  let logsFile = log.transports.file.getFile().path
  let imagesFolder = join(app.getPath('userData'), 'images')
  if (insideWindowsStore()) {
    settingsFile = settingsFile.replace('Roaming', 'Local\\Packages\\ScreenRest\\LocalCache\\Roaming')
    logsFile = logsFile.replace('Roaming', 'Local\\Packages\\ScreenRest\\LocalCache\\Roaming')
    imagesFolder = imagesFolder.replace('Roaming', 'Local\\Packages\\ScreenRest\\LocalCache\\Roaming')
  }
  return [
    reference,
    timeleft,
    breaknumber,
    postponesnumber,
    settingsFile,
    logsFile,
    doNotDisturb,
    imagesFolder
  ]
})

ipcMain.on('open-preferences', function (event) {
  createPreferencesWindow()
})

ipcMain.handle('current-settings', (event) => {
  return settings.store
})

ipcMain.handle('i18next-translate', (event, key, options) => {
  return i18next.t(key, options)
})

ipcMain.handle('i18next-dir', (event) => {
  return i18next.dir()
})

ipcMain.handle('settings-get', (event, key) => {
  return settings.get(key)
})

ipcMain.on('close-current-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.close()
  }
})

ipcMain.handle('get-window-bounds', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win.getBounds()
})

ipcMain.on('set-window-size', (event, width, height) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win.setSize(width, height)
})

ipcMain.handle('get-version', (event) => {
  return app.getVersion()
})

ipcMain.handle('resolve-local-image', (event, filename) => {
  const imagesPath = join(app.getPath('userData'), 'images')
  return resolveLocalImage(imagesPath, filename)
})
