import { setSameWidths } from './utils/sameWidths.js'
import HtmlTranslate from './utils/htmlTranslate.js'

import './platform.js'

let eventsAttached = false

window.onload = async (e) => {
  const bounds = await window.screenrest.getWindowBounds()
  const settings = await window.settings.currentSettings()
  if (settings.hideStrictModePreferences) {
    document.querySelectorAll('[data-strict-mode]').forEach(element => {
      element.classList.add('hidden')
    })
  }

  new HtmlTranslate(document).translate()
  setWindowHeight()
  setTimeout(() => { eventsAttached = true }, 500)

  if (settings.customPreferencesMessage) {
    const customMessageDiv = document.createElement('div')
    customMessageDiv.className = 'custom-message'
    customMessageDiv.textContent = settings.customPreferencesMessage
    document.querySelector('.navigation').parentNode.insertBefore(customMessageDiv, document.querySelector('.navigation').nextSibling)
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    const imagesWithDarkVersion = document.querySelectorAll('[data-has-dark-version]')
    imagesWithDarkVersion.forEach(image => {
      // replace last occurance https://github.com/electron-userland/electron-builder/issues/5152
      const newSource = image.src.replace(/.([^.]*)$/, '-dark.' + '$1')
      image.src = newSource
    })
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    const imagesWithDarkVersion = document.querySelectorAll('[data-has-dark-version]')
    if (event.matches) {
      imagesWithDarkVersion.forEach(image => {
        const newSource = image.src.replace(/.([^.]*)$/, '-dark.' + '$1')
        image.src = newSource
      })
    } else {
      imagesWithDarkVersion.forEach(image => {
        const newSource = image.src.replace('-dark.', '.')
        image.src = newSource
      })
    }
  })

  document.ondragover = event =>
    event.preventDefault()

  document.ondrop = event =>
    event.preventDefault()

  window.screenrest.onTranslate(async () => {
    new HtmlTranslate(document).translate()
    setWindowHeight()
  })

  document.querySelectorAll('.navigation a').forEach(element => {
    element.onclick = event => {
      event.preventDefault()
      event.target.closest('.navigation').childNodes.forEach(link => {
        if (link.classList) {
          link.classList.remove('active')
        }
      })
      event.target.closest('a').classList.add('active')

      const toBeDisplayed = document.querySelector(`.${event.target.closest('[data-section]').getAttribute('data-section')}`)
      document.querySelectorAll('body > div:not(.custom-message)').forEach(section => {
        if (section !== toBeDisplayed) {
          section.classList.add('hidden')
        } else {
          section.classList.remove('hidden')
        }
      })

      setSameWidths()
      setWindowHeight()
    }
  })

  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    const isNegative = checkbox.classList.contains('negative')
    checkbox.checked = isNegative ? !settings[checkbox.value] : settings[checkbox.value]
    if (!eventsAttached) {
      checkbox.onchange = (event) =>
        window.settings.saveSettings(checkbox.value,
          isNegative ? !checkbox.checked : checkbox.checked)
    }
  })

  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    let value
    switch (radio.value) {
      case 'true':
        value = true
        break
      case 'false':
        value = false
        break
      default:
        value = radio.value
    }
    radio.checked = settings[radio.name] === value
    if (!eventsAttached) {
      radio.onchange = (event) => {
        window.settings.saveSettings(radio.name, value)
      }
    }
  })

  // Color picker logic
  const colorPicker = document.querySelector('#colorPicker')
  if (colorPicker) {
    colorPicker.value = settings.mainColor || '#478484'
    if (!eventsAttached) {
      colorPicker.oninput = () => {
        window.settings.saveSettings('mainColor', colorPicker.value)
      }
    }
  }

  document.querySelector('#language').value = settings.language
  if (!eventsAttached) {
    document.querySelector('#language').onchange = (event) => {
      window.settings.saveSettings('language', event.target.value)
    }
  }

  document.querySelector('#trayIconStyle').value = settings.trayIconStyle
  if (!eventsAttached) {
    document.querySelector('#trayIconStyle').onchange = (event) => {
      window.settings.saveSettings('trayIconStyle', event.target.value)
    }
  }

  // Custom message list popup logic
  const currentMessageList = settings.customMessageList || []

  function renderMessageList () {
    const container = document.querySelector('#messageListContainer')
    container.innerHTML = ''
    currentMessageList.forEach((msg, index) => {
      const item = document.createElement('div')
      item.className = 'message-item'
      const span = document.createElement('span')
      span.textContent = msg
      const btn = document.createElement('button')
      btn.textContent = 'Remove'
      btn.onclick = () => {
        currentMessageList.splice(index, 1)
        window.settings.saveSettings('customMessageList', currentMessageList)
        renderMessageList()
      }
      item.appendChild(span)
      item.appendChild(btn)
      container.appendChild(item)
    })
  }

  if (!eventsAttached) {
    document.querySelector('#openCustomMessageList').onclick = () => {
      document.querySelector('#customMessageModal').classList.remove('hidden')
      renderMessageList()
    }
    document.querySelector('#closeMessageModal').onclick = () => {
      document.querySelector('#customMessageModal').classList.add('hidden')
    }
    document.querySelector('#addMessageBtn').onclick = () => {
      const input = document.querySelector('#newMessageInput')
      const val = input.value.trim()
      if (val) {
        currentMessageList.push(val)
        window.settings.saveSettings('customMessageList', currentMessageList)
        input.value = ''
        renderMessageList()
      }
    }
    document.querySelector('#newMessageInput').onkeydown = (e) => {
      if (e.key === 'Enter') document.querySelector('#addMessageBtn').click()
    }
  }

  const breakDurationInput = document.querySelector('#breakDurationInput')
  const breakIntervalInput = document.querySelector('#breakIntervalInput')
  if (breakDurationInput) {
    breakDurationInput.value = Math.round(settings.microbreakDuration / 1000)
    if (!eventsAttached) {
      breakDurationInput.onchange = (event) => {
        const val = Math.max(5, Math.min(3600, parseInt(event.target.value) || 20))
        event.target.value = val
        window.settings.saveSettings('microbreakDuration', val * 1000)
      }
    }
  }
  if (breakIntervalInput) {
    breakIntervalInput.value = Math.round(settings.microbreakInterval / 60000)
    if (!eventsAttached) {
      breakIntervalInput.onchange = (event) => {
        const val = Math.max(1, Math.min(480, parseInt(event.target.value) || 10))
        event.target.value = val
        window.settings.saveSettings('microbreakInterval', val * 60000)
      }
    }
  }

  document.querySelectorAll('.sounds img').forEach(preview => {
    if (!eventsAttached) {
      preview.onclick = (event) =>
        window.screenrest.playSound(preview.closest('div').querySelector('input').value)
    }
  })

  setWindowHeight()

  document.querySelector('#restoreDefaultsBtn').onclick = (event) => {
    window.screenrest.restoreDefaults()
  }

  document.querySelector('.version').innerHTML = await window.screenrest.getVersion()

  function setWindowHeight () {
    const classes = document.querySelector('body').classList
    const scrollHeight = document.querySelector('body').scrollHeight
    const availHeight = window.screen.availHeight
    let height = null
    if (classes.contains('win32')) {
      if (scrollHeight + 40 > availHeight) {
        height = availHeight
      } else {
        height = scrollHeight + 40
      }
    } else {
      if (scrollHeight + 32 > availHeight) {
        height = availHeight
      } else {
        height = scrollHeight + 32
      }
    }
    if (height) {
      window.screenrest.setWindowSize(bounds.width, height)
    }
  }
}
