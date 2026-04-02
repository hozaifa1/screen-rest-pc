import HtmlTranslate from './utils/htmlTranslate.js'
import './platform.js'

window.onload = async (event) => {
  const [idea, started, duration, strictMode, ,
    , backgroundColor] = await window.breaks.sendBreakData()

  new HtmlTranslate(document).translate()

  document.ondragover = event =>
    event.preventDefault()

  document.ondrop = event =>
    event.preventDefault()

  document.querySelector('#close').onclick = async event =>
    await window.breaks.finishBreak()

  const customMessage = await window.settings.get('customBreakMessage')
  const customMessageElement = document.querySelector('.custom-break-message')
  if (customMessage && customMessage.trim() !== '') {
    customMessageElement.innerHTML = window.breaks.sanitizeIdea(customMessage)
    customMessageElement.style.display = 'block'
  } else {
    customMessageElement.style.display = 'none'
  }

  const messageContent = idea[0]
  const microbreakIdeaElement = document.querySelector('.microbreak-idea')
  const breakTextElement = document.querySelector('.break-text')
  const breakReferenceElement = document.querySelector('.break-reference')

  breakTextElement.style.display = 'none'
  breakReferenceElement.style.display = 'none'
  microbreakIdeaElement.style.display = 'none'

  if (messageContent && messageContent.includes('|||')) {
    const parts = messageContent.split('|||')
    if (parts.length >= 3) {
      breakTextElement.innerHTML = window.breaks.sanitizeIdea(parts[1].trim())
      breakTextElement.style.display = 'block'
      if (parts[2].trim()) {
        breakReferenceElement.innerHTML = window.breaks.sanitizeIdea(`— ${parts[2].trim()}`)
        breakReferenceElement.style.display = 'block'
      }
    } else if (parts.length === 2) {
      breakTextElement.innerHTML = window.breaks.sanitizeIdea(parts[0].trim())
      breakTextElement.style.display = 'block'
      if (parts[1].trim()) {
        breakReferenceElement.innerHTML = window.breaks.sanitizeIdea(`— ${parts[1].trim()}`)
        breakReferenceElement.style.display = 'block'
      }
    }
  } else if (messageContent) {
    breakTextElement.innerHTML = window.breaks.sanitizeIdea(messageContent)
    breakTextElement.style.display = 'block'
  }

  document.querySelectorAll('.custom-break-message a, .microbreak-idea a, .break-text a').forEach(a => {
    a.onclick = (event) => {
      event.preventDefault()
      window.electronApi.openExternal(a.href)
    }
  })

  document.querySelectorAll('.microbreak-idea img, .break-text img').forEach(async img => {
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
