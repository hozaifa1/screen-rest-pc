// Test script for messageSelector sequential logic
import { getNextMessage, getNextThemeColor } from '../app/utils/messageSelector.js'

// Mock settings store
class MockSettings {
  constructor (data) {
    this.data = { ...data }
  }

  get (key) { return this.data[key] }

  set (key, value) { this.data[key] = value }
}

// Test 1: Sequential alternation between ayahs and reminders
console.log('--- Test 1: Sequential Alternation ---')
const settings1 = new MockSettings({
  quranAyatEnabled: true,
  islamicRemindersEnabled: true,
  quranAyats: ['|||Ayah One|||Surah 1:1', '|||Ayah Two|||Surah 2:2', '|||Ayah Three|||Surah 3:3'],
  islamicReminders: ['Reminder A', 'Reminder B'],
  ayahIndex: 0,
  reminderIndex: 0,
  lastMessageType: 0 // Start with reminder -> next should be ayah
})

const results1 = []
for (let i = 0; i < 10; i++) {
  const msg = getNextMessage(settings1)
  results1.push(`${msg.type}: ${msg.content}`)
}
results1.forEach((r, i) => console.log(`  ${i + 1}. ${r}`))

// Verify alternation pattern
const types1 = results1.map(r => r.split(':')[0])
let alternationOk = true
for (let i = 1; i < types1.length; i++) {
  if (types1[i] === types1[i - 1]) {
    alternationOk = false
    break
  }
}
console.log(`  Alternation correct: ${alternationOk}`)

// Test 2: Only ayahs enabled
console.log('\n--- Test 2: Only Ayahs Enabled ---')
const settings2 = new MockSettings({
  quranAyatEnabled: true,
  islamicRemindersEnabled: false,
  quranAyats: ['|||A1|||S1', '|||A2|||S2'],
  islamicReminders: [],
  ayahIndex: 0,
  reminderIndex: 0,
  lastMessageType: 0
})
for (let i = 0; i < 4; i++) {
  const msg = getNextMessage(settings2)
  console.log(`  ${i + 1}. ${msg.type}: ${msg.content}`)
}

// Test 3: Only reminders enabled
console.log('\n--- Test 3: Only Reminders Enabled ---')
const settings3 = new MockSettings({
  quranAyatEnabled: false,
  islamicRemindersEnabled: true,
  quranAyats: [],
  islamicReminders: ['R1', 'R2', 'R3'],
  ayahIndex: 0,
  reminderIndex: 0,
  lastMessageType: 0
})
for (let i = 0; i < 6; i++) {
  const msg = getNextMessage(settings3)
  console.log(`  ${i + 1}. ${msg.type}: ${msg.content}`)
}

// Test 4: Theme color rotation
console.log('\n--- Test 4: Theme Color Rotation ---')
const settings4 = new MockSettings({
  themeColors: ['#FF0000', '#00FF00', '#0000FF'],
  themeIndex: 0
})
for (let i = 0; i < 6; i++) {
  const color = getNextThemeColor(settings4)
  console.log(`  ${i + 1}. ${color}`)
}

// Test 5: Wrapping around lists
console.log('\n--- Test 5: Index Wrapping ---')
const settings5 = new MockSettings({
  quranAyatEnabled: true,
  islamicRemindersEnabled: true,
  quranAyats: ['A1', 'A2'],
  islamicReminders: ['R1'],
  ayahIndex: 1,
  reminderIndex: 0,
  lastMessageType: 0
})
for (let i = 0; i < 6; i++) {
  const msg = getNextMessage(settings5)
  console.log(`  ${i + 1}. ${msg.type}: ${msg.content} (ayahIdx=${settings5.get('ayahIndex')}, remIdx=${settings5.get('reminderIndex')})`)
}

console.log('\nAll tests complete!')
