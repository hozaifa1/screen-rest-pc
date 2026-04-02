export function getNextMessage (settings) {
  const quranEnabled = settings.get('quranAyatEnabled')
  const remindersEnabled = settings.get('islamicRemindersEnabled')
  const lastMessageType = settings.get('lastMessageType') ?? 0 // 0 = Reminder, 1 = Ayah

  const ayahs = settings.get('quranAyats') || []
  const reminders = settings.get('islamicReminders') || []

  // Sequential logic: alternate between Ayah and Reminder
  // If last was Reminder (0), show Ayah (1) next if available
  // If last was Ayah (1), show Reminder (0) next if available
  const shouldShowAyah = (lastMessageType === 0)

  if (shouldShowAyah && quranEnabled && ayahs.length > 0) {
    // Show Ayah
    const ayahIndex = settings.get('ayahIndex') || 0
    const currentAyah = ayahs[ayahIndex]
    const nextIndex = (ayahIndex + 1) % ayahs.length
    settings.set('ayahIndex', nextIndex)
    settings.set('lastMessageType', 1)

    return {
      type: 'ayah',
      content: currentAyah
    }
  } else if (!shouldShowAyah && remindersEnabled && reminders.length > 0) {
    // Show Reminder
    const reminderIndex = settings.get('reminderIndex') || 0
    const currentReminder = reminders[reminderIndex]
    const nextIndex = (reminderIndex + 1) % reminders.length
    settings.set('reminderIndex', nextIndex)
    settings.set('lastMessageType', 0)

    return {
      type: 'reminder',
      content: currentReminder
    }
  } else if (quranEnabled && ayahs.length > 0) {
    // Fallback to Ayah if Reminder not available
    const ayahIndex = settings.get('ayahIndex') || 0
    const currentAyah = ayahs[ayahIndex]
    const nextIndex = (ayahIndex + 1) % ayahs.length
    settings.set('ayahIndex', nextIndex)
    settings.set('lastMessageType', 1)

    return {
      type: 'ayah',
      content: currentAyah
    }
  } else if (remindersEnabled && reminders.length > 0) {
    // Fallback to Reminder if Ayah not available
    const reminderIndex = settings.get('reminderIndex') || 0
    const currentReminder = reminders[reminderIndex]
    const nextIndex = (reminderIndex + 1) % reminders.length
    settings.set('reminderIndex', nextIndex)
    settings.set('lastMessageType', 0)

    return {
      type: 'reminder',
      content: currentReminder
    }
  } else {
    return {
      type: 'reminder',
      content: 'Take a moment to rest your eyes and reflect.'
    }
  }
}

export function getNextThemeColor (settings) {
  const themeColors = settings.get('themeColors') || ['#26A69A', '#2196F3', '#3F51B5', '#9C27B0', '#E91E63', '#F44336', '#FF9800', '#FFC107', '#4CAF50', '#00BCD4']
  const themeIndex = settings.get('themeIndex') || 0

  const nextIndex = (themeIndex + 1) % themeColors.length
  settings.set('themeIndex', nextIndex)

  return themeColors[themeIndex]
}
