import Scheduler from './utils/scheduler.js'
import EventEmitter from 'events'
import NaturalBreaksManager from './utils/naturalBreaksManager.js'
import DndManager from './utils/dndManager.js'
import AppExclusionsManager from './utils/appExclusionsManager.js'
import log from 'electron-log/main.js'

class BreaksPlanner extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.breakNumber = 0
    this.postponesNumber = 0
    this.scheduler = null
    this.isPaused = false
    this.naturalBreaksManager = new NaturalBreaksManager(settings)
    this.dndManager = new DndManager(settings)
    this.appExclusionsManager = new AppExclusionsManager(settings)

    this.on('microbreakStarted', (shouldPlaySound) => {
      const interval = this.settings.get('microbreakDuration')
      this.scheduler = new Scheduler(() => this.emit('finishMicrobreak', shouldPlaySound, true), interval, 'finishMicrobreak')
      this.scheduler.plan()
    })

    this.naturalBreaksManager.on('clearBreakScheduler', () => {
      if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && this.scheduler.reference !== null) {
        this.clear()
        log.info('ScreenRest: pausing breaks because of idle time')
      }
    })

    this.naturalBreaksManager.on('naturalBreakFinished', () => {
      if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && !this.dndManager.isOnDnd) {
        this.reset()
        log.info('ScreenRest: resuming breaks after idle time')
        this.emit('updateToolTip')
      }
    })

    this.dndManager.on('dndStarted', () => {
      if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && this.scheduler.reference !== null) {
        this.clear()
        log.info('ScreenRest: pausing breaks for Do Not Distrub')
        this.emit('updateToolTip')
      } else {
        this.dndManager.isOnDnd = false
      }
    })

    this.dndManager.on('dndFinished', () => {
      if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak') {
        this.reset()
        log.info('ScreenRest: resuming breaks for Do Not Distrub')
        this.emit('updateToolTip')
      }
    })

    this.appExclusionsManager.on('appExclusionStarted', (rule, exclusion) => {
      if (rule === 'pause') {
        if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && this.scheduler.reference !== null) {
          this.clear()
          log.info(`ScreenRest: pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
          this.emit('updateToolTip')
        } else if (!this.isPaused && this.scheduler.reference === 'finishBreak') {
          this.emit('finishBreak', false, false)
          this.clear()
          log.info(`ScreenRest: closing current and pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
          this.emit('updateToolTip')
        } else if (!this.isPaused && this.scheduler.reference === 'finishMicrobreak') {
          this.emit('finishMicrobreak', false, false)
          this.clear()
          log.info(`ScreenRest: closing current and pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
          this.emit('updateToolTip')
        } else {
          this.appExclusionsManager.inOnException = false
        }
      } else if (rule === 'resume') {
        if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak') {
          this.reset()
          log.info(`ScreenRest: resuming breaks as 'resume' exclusion found running: '${exclusion}'`)
          this.emit('updateToolTip')
        }
      }
    })

    this.appExclusionsManager.on('appExclusionFinished', (rule) => {
      if (rule === 'pause') {
        if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak') {
          this.reset()
          log.info("ScreenRest: resuming breaks as no 'pause' exclusion found running")
          this.emit('updateToolTip')
        }
      } else if (rule === 'resume') {
        if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && this.scheduler.reference !== null) {
          this.clear()
          log.info("ScreenRest: pausing breaks as no 'resume' exclusion found running")
          this.emit('updateToolTip')
        } else {
          this.appExclusionsManager.inOnException = true
        }
      }
    })
  }

  nextBreak () {
    this.postponesNumber = 0
    if (this.scheduler) this.scheduler.cancel()
    const shouldMicrobreak = this.settings.get('microbreak')
    if (!shouldMicrobreak) return
    const interval = this.settings.get('microbreakInterval')
    const microbreakNotification = this.settings.get('microbreakNotification')
    const microbreakNotificationInterval = this.settings.get('microbreakNotificationInterval')
    if (microbreakNotification) {
      this.scheduler = new Scheduler(() => this.emit('startMicrobreakNotification'), interval - microbreakNotificationInterval, 'startMicrobreakNotification')
    } else {
      this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), interval, 'startMicrobreak')
    }
    this.scheduler.plan()
  }

  nextBreakAfterNotification () {
    this.scheduler.cancel()
    const scheduledBreakType = this._scheduledBreakType
    const breakNotificationInterval = this.settings.get(`${scheduledBreakType}NotificationInterval`)
    const eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}`
    this.scheduler = new Scheduler(() => this.emit(eventName), breakNotificationInterval, eventName)
    this.scheduler.plan()
  }

  postponeCurrentBreak () {
    this.scheduler.cancel()
    this.postponesNumber += 1
    let postponeTime, eventName
    const scheduledBreakType = this._scheduledBreakType
    const notification = this.settings.get(`${scheduledBreakType}Notification`)
    if (notification && this.settings.get(`${scheduledBreakType}PostponeTime`) > this.settings.get(`${scheduledBreakType}NotificationInterval`)) {
      postponeTime = this.settings.get(`${scheduledBreakType}PostponeTime`) - this.settings.get(`${scheduledBreakType}NotificationInterval`)
      eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}Notification`
    } else {
      postponeTime = this.settings.get(`${scheduledBreakType}PostponeTime`)
      eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}`
    }
    this.scheduler = new Scheduler(() => this.emit(eventName), postponeTime, eventName)
    this.scheduler.plan()
    this.emit('updateToolTip')
  }

  skipToMicrobreak (delay = 100) {
    this.scheduler.cancel()
    this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), delay, 'startMicrobreak')
    this.scheduler.plan()
    this.emit('updateToolTip')
  }

  skipToBreak (delay = 100) {
    this.skipToMicrobreak(delay)
  }

  clear () {
    this.scheduler.cancel()
    this.breakNumber = 0
    this.postponesNumber = 0
  }

  pause (milliseconds) {
    this.clear()
    this.isPaused = true
    if (milliseconds !== 1) {
      this.scheduler = new Scheduler(() => this.emit('resumeBreaks'), milliseconds, 'resumeBreaks')
      this.scheduler.plan()
    }
  }

  resume () {
    this.scheduler.cancel()
    this.isPaused = false
    this.appExclusionsManager.reset()
    this.nextBreak()
  }

  correctScheduler () {
    if (this.scheduler) this.scheduler.correct()
  }

  reset () {
    this.clear()
    this.resume()
  }

  get _scheduledBreakType () {
    return 'microbreak'
  }

  naturalBreaks (shouldUse) {
    if (shouldUse) {
      this.naturalBreaksManager.start()
    } else {
      this.naturalBreaksManager.stop()
    }
  }

  doNotDisturb (shouldUse) {
    if (shouldUse) {
      this.dndManager.start()
    } else {
      this.dndManager.stop()
      if (!this.isPaused && this.scheduler.reference === null) {
        this.reset()
      }
    }
  }

  get timeToNextBreak () {
    if (!this.scheduler) return null
    if (this.scheduler.reference === 'startMicrobreak') {
      return this.scheduler.timeLeft
    }
    if (this.scheduler.reference === 'startMicrobreakNotification') {
      return this.scheduler.timeLeft + (this.settings.get('microbreakNotification')
        ? this.settings.get('microbreakNotificationInterval')
        : 0)
    }
    return null
  }

  get _progressInterval () {
    if (!this.scheduler) return null
    const { reference, delay } = this.scheduler

    if (reference === 'startMicrobreak') {
      return delay
    }

    if (reference === 'startMicrobreakNotification') {
      return delay + this.settings.get('microbreakNotificationInterval')
    }

    return null
  }

  get progressPercentage () {
    const total = this._progressInterval
    const remaining = this.timeToNextBreak
    if (total === null || total <= 0 || remaining === null) return 0

    const progress = 1 - (remaining / total)
    return Math.max(0, Math.min(100, Math.round(progress * 100)))
  }
}

export default BreaksPlanner
