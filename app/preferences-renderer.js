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
    colorPicker.value = settings.mainColor || '#26A69A'
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

  // Ayat list management
  const currentAyahList = settings.quranAyats || []

  function getAyahDisplayText (ayah) {
    if (ayah.includes('|||')) {
      const parts = ayah.split('|||')
      if (parts.length >= 3) return parts[1].trim() + ' — ' + parts[2].trim()
      if (parts.length === 2) return parts[0].trim() + ' — ' + parts[1].trim()
    }
    return ayah
  }

  function renderAyahList () {
    const container = document.querySelector('#ayahListContainer')
    container.innerHTML = ''
    if (currentAyahList.length === 0) {
      container.innerHTML = '<div class="empty-list-message">No ayat added yet.</div>'
      return
    }
    currentAyahList.forEach((ayah, index) => {
      const item = document.createElement('div')
      item.className = 'message-item'
      const indexLabel = document.createElement('span')
      indexLabel.className = 'item-index'
      indexLabel.textContent = `${index + 1}`
      const span = document.createElement('span')
      span.textContent = getAyahDisplayText(ayah)
      const actions = document.createElement('div')
      actions.className = 'item-actions'
      const editBtn = document.createElement('button')
      editBtn.className = 'item-btn edit-btn'
      editBtn.textContent = 'Edit'
      editBtn.onclick = () => {
        document.querySelector('#editAyahModal').classList.remove('hidden')
        document.querySelector('#editAyahInput').value = getAyahDisplayText(ayah)
        document.querySelector('#editAyahRefInput').value = ''
        if (ayah.includes('|||')) {
          const parts = ayah.split('|||')
          if (parts.length >= 3) {
            document.querySelector('#editAyahInput').value = parts[1].trim()
            document.querySelector('#editAyahRefInput').value = parts[2].trim()
          } else if (parts.length === 2) {
            document.querySelector('#editAyahInput').value = parts[0].trim()
            document.querySelector('#editAyahRefInput').value = parts[1].trim()
          }
        } else {
          document.querySelector('#editAyahInput').value = ayah
        }
        document.querySelector('#saveEditAyahBtn').onclick = () => {
          const newText = document.querySelector('#editAyahInput').value.trim()
          const newRef = document.querySelector('#editAyahRefInput').value.trim()
          if (newText) {
            currentAyahList[index] = newRef ? `|||${newText}|||${newRef}` : newText
            window.settings.saveSettings('quranAyats', currentAyahList)
            renderAyahList()
          }
          document.querySelector('#editAyahModal').classList.add('hidden')
        }
      }
      const removeBtn = document.createElement('button')
      removeBtn.className = 'item-btn remove-btn'
      removeBtn.textContent = 'Remove'
      removeBtn.onclick = () => {
        currentAyahList.splice(index, 1)
        window.settings.saveSettings('quranAyats', currentAyahList)
        window.settings.saveSettings('ayahIndex', 0)
        renderAyahList()
      }
      actions.appendChild(editBtn)
      actions.appendChild(removeBtn)
      item.appendChild(indexLabel)
      item.appendChild(span)
      item.appendChild(actions)
      container.appendChild(item)
    })
  }

  // Reminders list management
  const currentReminderList = settings.islamicReminders || []

  function renderReminderList () {
    const container = document.querySelector('#reminderListContainer')
    container.innerHTML = ''
    if (currentReminderList.length === 0) {
      container.innerHTML = '<div class="empty-list-message">No reminders added yet.</div>'
      return
    }
    currentReminderList.forEach((reminder, index) => {
      const item = document.createElement('div')
      item.className = 'message-item'
      const indexLabel = document.createElement('span')
      indexLabel.className = 'item-index'
      indexLabel.textContent = `${index + 1}`
      const span = document.createElement('span')
      span.textContent = reminder
      const actions = document.createElement('div')
      actions.className = 'item-actions'
      const editBtn = document.createElement('button')
      editBtn.className = 'item-btn edit-btn'
      editBtn.textContent = 'Edit'
      editBtn.onclick = () => {
        document.querySelector('#editReminderModal').classList.remove('hidden')
        document.querySelector('#editReminderInput').value = reminder
        document.querySelector('#saveEditReminderBtn').onclick = () => {
          const newText = document.querySelector('#editReminderInput').value.trim()
          if (newText) {
            currentReminderList[index] = newText
            window.settings.saveSettings('islamicReminders', currentReminderList)
            renderReminderList()
          }
          document.querySelector('#editReminderModal').classList.add('hidden')
        }
      }
      const removeBtn = document.createElement('button')
      removeBtn.className = 'item-btn remove-btn'
      removeBtn.textContent = 'Remove'
      removeBtn.onclick = () => {
        currentReminderList.splice(index, 1)
        window.settings.saveSettings('islamicReminders', currentReminderList)
        window.settings.saveSettings('reminderIndex', 0)
        renderReminderList()
      }
      actions.appendChild(editBtn)
      actions.appendChild(removeBtn)
      item.appendChild(indexLabel)
      item.appendChild(span)
      item.appendChild(actions)
      container.appendChild(item)
    })
  }

  if (!eventsAttached) {
    document.querySelector('#openAyahList').onclick = () => {
      document.querySelector('#ayahModal').classList.remove('hidden')
      renderAyahList()
    }
    document.querySelector('#closeAyahModal').onclick = () => {
      document.querySelector('#ayahModal').classList.add('hidden')
    }
    document.querySelector('#addAyahBtn').onclick = () => {
      const input = document.querySelector('#newAyahInput')
      const refInput = document.querySelector('#newAyahRefInput')
      const val = input.value.trim()
      const ref = refInput ? refInput.value.trim() : ''
      if (val) {
        const entry = ref ? `|||${val}|||${ref}` : val
        currentAyahList.push(entry)
        window.settings.saveSettings('quranAyats', currentAyahList)
        input.value = ''
        if (refInput) refInput.value = ''
        renderAyahList()
      }
    }
    document.querySelector('#newAyahInput').onkeydown = (e) => {
      if (e.key === 'Enter') document.querySelector('#addAyahBtn').click()
    }

    document.querySelector('#openReminderList').onclick = () => {
      document.querySelector('#reminderModal').classList.remove('hidden')
      renderReminderList()
    }
    document.querySelector('#closeReminderModal').onclick = () => {
      document.querySelector('#reminderModal').classList.add('hidden')
    }
    document.querySelector('#addReminderBtn').onclick = () => {
      const input = document.querySelector('#newReminderInput')
      const val = input.value.trim()
      if (val) {
        currentReminderList.push(val)
        window.settings.saveSettings('islamicReminders', currentReminderList)
        input.value = ''
        renderReminderList()
      }
    }
    document.querySelector('#newReminderInput').onkeydown = (e) => {
      if (e.key === 'Enter') document.querySelector('#addReminderBtn').click()
    }

    document.querySelector('#resetAyahsBtn').onclick = () => {
      window.screenrest.resetAyahs()
    }
    document.querySelector('#resetRemindersBtn').onclick = () => {
      window.screenrest.resetReminders()
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
