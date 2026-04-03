# ScreenRest — Desktop

> **Take breaks. Protect your eyes. Stay healthy.**

ScreenRest is a desktop application that reminds you to take regular breaks while working on your computer. It runs quietly in your system tray and displays a fullscreen break overlay at configurable intervals, helping you reduce eye strain, prevent repetitive stress injuries, and maintain focus throughout the day.

This project was built on top of the excellent [stretchly](https://github.com/hovancik/stretchly) app by [hovancik](https://github.com/hovancik), which serves as the foundation for ScreenRest's break reminder functionality.

## What It Does

- **Automatic break reminders** — ScreenRest shows a fullscreen break screen at regular intervals (default: every 10 minutes for 20 seconds). You set the schedule that works for you.
- **Quran Ayat display** — During breaks, the app displays Quranic verses (Arabic + English translation) from an editable built-in list.
- **Islamic Reminders** — A separate list of 15 Islamic reminders about mindfulness, intention renewal, and remembering Allah during work.
- **Sequential message display** — Break screens alternate between Quran Ayat and Islamic Reminders sequentially (Ayah → Reminder → Ayah → Reminder). No duplicates in a row.
- **Dynamic theme rotation** — Break screen colors automatically rotate through 10 preset colors on each break. Your manually selected preference is preserved.
- **Fully editable lists** — Add, remove, or modify Quran Ayat and Islamic Reminders through the preferences window.
- **Idle detection** — ScreenRest monitors your idle time. If you step away for 5+ minutes, breaks pause automatically and resume when you return.
- **Do Not Disturb awareness** — Breaks are paused when your system's DND mode is active.
- **Strict mode** — Optionally prevent yourself from skipping breaks for maximum discipline.
- **Notification before breaks** — Get a heads-up before each break starts so you can wrap up what you're doing.
- **Fullscreen on all monitors** — Break screens cover all connected displays.
- **Auto-start on login** — ScreenRest starts automatically when you log in.
- **Dark mode support** — Follows your system theme.
- **Multi-language support** — Available in 40+ languages.
- **Customizable theme** — Pick a break screen color that suits you, or let it rotate automatically.
- **Sound themes** — Choose from multiple break sounds or mute them entirely.
- **Keyboard shortcuts** — Configure shortcuts to skip breaks, pause/resume, reset breaks, or pause for specific durations (30min, 1hr, 2hr, 5hr, until morning).
- **App exclusions** — Automatically pause breaks when specific applications are running.
- **Pause on suspend/lock** — Breaks pause when your system is locked or suspended.

## Installation

### Windows

Download the latest installer or portable version from the [Releases](https://github.com/hozaifa1/screen-rest-pc/releases) page.

### macOS

Download the `.dmg` file from the [Releases](https://github.com/hozaifa1/screen-rest-pc/releases) page. ScreenRest supports both Intel and Apple Silicon Macs.

### Linux

Download the AppImage, `.deb`, `.rpm`, or other package from the [Releases](https://github.com/hozaifa1/screen-rest-pc/releases) page. Available formats: AppImage, deb, rpm, pacman, tar.xz, apk, and freebsd.

### Running from Source

```bash
git clone https://github.com/hozaifa1/screen-rest-pc.git
cd screenrest-pc
npm install
npm start
```

### Building an Installer

```bash
npm install --no-save
npx electron-builder build
```

Platform-specific builds:
- Windows: `npx electron-builder build --win`
- macOS: `npx electron-builder build --mac`
- Linux: `npx electron-builder build --linux`

Output files are placed in the `dist/` folder.

---

## Technical Details

### Tech Stack

- **[Electron](https://www.electronjs.org/)** — Cross-platform desktop framework
- **[electron-store](https://github.com/sindresorhus/electron-store)** — Persistent JSON settings
- **[i18next](https://www.i18next.com/)** — Internationalization
- **[electron-log](https://github.com/megahertz/electron-log)** — Logging
- **[humanize-duration](https://github.com/EvanHahn/HumanizeDuration.js)** — Human-readable time formatting
- **[Standard](https://standardjs.com/)** — JavaScript linting
- **[Vitest](https://vitest.dev/)** — Unit testing
- **[luxon](https://moment.github.io/luxon/)** — Date/time handling
- **[meeussunmoon](https://github.com/janrg/meeussunmoon)** — Sunrise/sunset calculations

### Project Structure

```
screenrest-pc/
├── app/
│   ├── main.js                  # Main Electron process
│   ├── breaksPlanner.js         # Break scheduling engine
│   ├── microbreak.html          # Break overlay window
│   ├── microbreak-renderer.js   # Break window renderer
│   ├── break.html               # Alternative break window
│   ├── break-renderer.js        # Alternative break renderer
│   ├── welcome.html             # First-run welcome window
│   ├── preferences.html         # Preferences window
│   ├── preferences-renderer.js  # Preferences renderer
│   ├── css/                     # Stylesheets
│   ├── images/                  # App icons, break icons, preference icons
│   ├── locales/                 # i18n translation files (40+ languages)
│   ├── audio/                   # Break sound files
│   └── utils/
│       ├── defaultSettings.js   # Default configuration values
│       ├── defaultQuranAyats.js # Default Quran verses list
│       ├── messageSelector.js   # Sequential message selection logic
│       ├── scheduler.js         # Timer scheduling utility
│       ├── naturalBreaksManager.js  # Idle time detection
│       ├── dndManager.js        # Do Not Disturb detection
│       ├── appExclusionsManager.js  # App-based pause/resume rules
│       ├── autostartManager.js  # Auto-start on login
│       ├── displayManager.js    # Multi-monitor management
│       ├── commands.js          # CLI command parser
│       ├── untilMorning.js      # "Pause until morning" calculation
│       └── utils.js             # Shared utility functions
├── test/                        # Vitest unit tests
├── build/                       # Build assets (icons, etc.)
├── buildcommand.md              # Build instructions
├── package.json
└── LICENSE
```

### How It Works

1. **BreaksPlanner** schedules the next break using a `Scheduler` timer.
2. When the timer fires, the main process creates fullscreen `BrowserWindow` instances on all monitors.
3. The break window loads `microbreak.html` which displays a progress bar, sequential message (Ayah or Reminder), and a skip button (unless strict mode is on).
4. **MessageSelector** (`messageSelector.js`) alternates between Quran Ayat and Islamic Reminders sequentially, tracking indices in settings.
5. **Dynamic theming** — `getNextThemeColor()` rotates through 10 predefined colors on each break.
6. After the configured break duration, the windows close automatically and the next break is scheduled.
7. **NaturalBreaksManager** monitors system idle time and pauses/resumes the schedule.
8. **DndManager** listens for Do Not Disturb changes and pauses/resumes accordingly.
9. **AppExclusionsManager** pauses breaks when specific apps are running.
10. **UntilMorning** calculates time until sunrise for the "pause until morning" feature.

### Configuration

All settings are stored in a JSON file managed by `electron-store`. Key settings:

| Setting | Default | Description |
|---|---|---|
| `microbreakDuration` | `20000` (20s) | Break duration in milliseconds |
| `microbreakInterval` | `600000` (10min) | Interval between breaks in milliseconds |
| `microbreakStrictMode` | `false` | Prevent skipping breaks |
| `microbreakNotification` | `true` | Show notification before break |
| `naturalBreaks` | `true` | Pause breaks when idle |
| `monitorDnd` | `true` | Pause breaks during DND |
| `quranAyatEnabled` | `true` | Show Quran Ayat during breaks |
| `islamicRemindersEnabled` | `true` | Show Islamic reminders during breaks |
| `mainColor` | `#26A69A` | Break screen color |
| `themeColors` | Array of 10 colors | Colors for dynamic rotation |
| `themeIndex` | `0` | Current position in theme rotation |
| `ayahIndex` | `0` | Current position in Ayat list |
| `reminderIndex` | `0` | Current position in reminders list |
| `lastMessageType` | `0` | Last shown message type (0=Reminder, 1=ayah) |
| `language` | `en` | UI language |
| `endBreakShortcut` | `CmdOrCtrl+X` | Shortcut to end break early |
| `pauseBreaksToggleShortcut` | `''` | Toggle pause/resume |
| `pauseBreaksFor30MinutesShortcut` | `''` | Pause for 30 minutes |
| `pauseBreaksFor1HourShortcut` | `''` | Pause for 1 hour |
| `pauseBreaksFor2HoursShortcut` | `''` | Pause for 2 hours |
| `pauseBreaksFor5HoursShortcut` | `''` | Pause for 5 hours |
| `pauseBreaksUntilMorningShortcut` | `''` | Pause until morning |
| `skipToNextScheduledBreakShortcut` | `''` | Skip to next break |
| `resetBreaksShortcut` | `''` | Reset break schedule |

### CLI Commands

ScreenRest supports command-line arguments for automation:

```bash
screenrest help              # Show help message
screenrest version           # Show version
screenrest reset             # Reset breaks
screenrest pause -d 1h       # Pause for 1 hour
screenrest resume            # Resume from pause
screenrest toggle            # Toggle pause/unpause
screenrest mini -T "Stretch up!"  # Skip to mini break with custom title
screenrest long -T "Title" -t "Go stretch!"  # Skip to long break
screenrest preferences       # Open preferences window
```

Duration formats: `30` (minutes), `1h`, `1h30m`, `indefinitely`, `until-morning`

### Testing

```bash
npx vitest run          # Run all tests
npx vitest run --coverage  # Run with coverage
npx vitest --watch      # Watch mode for TDD
```

### Linting

```bash
npm run lint
```

## License

See [LICENSE](LICENSE) file.
