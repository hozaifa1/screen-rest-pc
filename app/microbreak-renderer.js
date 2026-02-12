import HtmlTranslate from './utils/htmlTranslate.js'
import './platform.js'

window.onload = async (event) => {
  const [, started, duration, strictMode, ,
    , backgroundColor] = await window.breaks.sendBreakData()

  new HtmlTranslate(document).translate()

  document.ondragover = event =>
    event.preventDefault()

  document.ondrop = event =>
    event.preventDefault()

  document.querySelector('#close').onclick = async event =>
    await window.breaks.finishBreak()

  const customMessagesEnabled = await window.settings.get('customMessagesEnabled')
  const quranAyatEnabled = await window.settings.get('quranAyatEnabled')
  const customMessageList = await window.settings.get('customMessageList') || []
  const storedQuranAyats = await window.settings.get('quranAyats') || []
  const customMessageElement = document.querySelector('.custom-break-message')

  let displayMessage = ''

  const pool = []
  if (customMessagesEnabled && customMessageList.length > 0) {
    pool.push(...customMessageList.map(m => m))
  }
  if (quranAyatEnabled && storedQuranAyats.length > 0) {
    pool.push(...storedQuranAyats.map(a => a))
  }

  if (pool.length > 0) {
    displayMessage = pool[Math.floor(Math.random() * pool.length)]
  }

  if (displayMessage) {
    customMessageElement.innerHTML = window.breaks.sanitizeIdea(displayMessage)
    customMessageElement.style.display = 'block'
  } else {
    customMessageElement.style.display = 'none'
  }

  document.querySelector('.microbreak-idea').style.display = 'none'

  document.querySelectorAll('.custom-break-message a, .microbreak-idea a').forEach(a => {
    a.onclick = (event) => {
      event.preventDefault()
      window.electronApi.openExternal(a.href)
    }
  })

  document.querySelectorAll('.microbreak-idea img').forEach(async img => {
    const src = img.getAttribute('src') || ''
    const resolved = await window.electronApi.resolveLocalImage(src)
    if (resolved) {
      img.src = resolved
    } else {
      img.remove()
    }
  })

  const progress = document.querySelector('#progress')
  const progressTime = document.querySelector('#progress-time')
  const closeElement = document.querySelector('#close')
  const manualFinishElement = document.querySelector('#finish')
  const mainColor = await window.settings.get('mainColor')
  document.body.classList.add(mainColor.substring(1))
  document.body.style.backgroundColor = backgroundColor

  document.querySelectorAll('.tiptext').forEach(async tt => {
    const keyboardShortcut = await window.settings.get('endBreakShortcut')
    tt.innerHTML = window.utils.formatKeyboardShortcut(keyboardShortcut)
  })

  let manualAwaiting = false

  const locale = await window.settings.get('language')

  manualFinishElement.onclick = async () => {
    await window.breaks.finishBreak()
  }

  setInterval(async () => {
    if (await window.settings.get('currentTimeInBreaks')) {
      document.querySelector('.breaks > :last-child').innerHTML = (new Date()).toLocaleTimeString()
    }
    const now = Date.now()
    const passed = now - started
    if (!manualAwaiting) {
      if (passed < duration) {
        const passedPercent = passed / duration * 100
        if (window.utils.canSkip(strictMode, false, passedPercent, 0)) {
          closeElement.classList.remove('hidden')
        } else {
          closeElement.classList.add('hidden')
        }
        progress.value = (100 - passedPercent) * progress.max / 100
        progressTime.innerHTML = await window.utils.formatTimeRemaining(duration - passed, locale)
      }
    } else {
      progressTime.innerHTML = await window.utils.formatElapsedDuration(passed, locale)
    }
  }, 100)

  window.breaks.onEnterManualAwait(async (which) => {
    if (which !== 'microbreak' || manualAwaiting) return
    manualAwaiting = true
    progress.value = 0
    progressTime.classList.remove('hidden')
    closeElement.classList.add('hidden')
    manualFinishElement.classList.remove('hidden')
    progressTime.innerHTML = await window.utils.formatElapsedDuration(Date.now() - started, locale)
  })

  await window.breaks.signalLoaded()
}
