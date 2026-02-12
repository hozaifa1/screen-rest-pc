# ScreenRest — Desktop

> **Take breaks. Protect your eyes. Stay healthy.**

ScreenRest is a desktop application that reminds you to take regular breaks while working on your computer. It runs quietly in your system tray and displays a fullscreen break overlay at configurable intervals, helping you reduce eye strain, prevent repetitive stress injuries, and maintain focus throughout the day.

This project was built on top of the excellent [stretchly](https://github.com/hovancik/stretchly) app by [hovancik](https://github.com/hovancik), which serves as the foundation for ScreenRest's break reminder functionality.

## What It Does

- **Automatic break reminders** — ScreenRest shows a fullscreen break screen at regular intervals (default: every 10 minutes for 20 seconds). You set the schedule that works for you.
- **Quran Ayat display** — During breaks, the app can fetch and display a random Quranic verse (Arabic + English translation) from the [Al Quran Cloud API](https://alquran.cloud/api). Verses longer than 150 characters are automatically skipped to keep the display clean.
- **Custom messages** — Add your own inspirational or reminder messages to display during breaks. When both Quran Ayat and custom messages are enabled, one is chosen at random for each break.
- **Idle detection** — ScreenRest monitors your idle time. If you step away for 5+ minutes, breaks pause automatically and resume when you return.
- **Do Not Disturb awareness** — Breaks are paused when your system's DND mode is active.
- **Strict mode** — Optionally prevent yourself from skipping breaks for maximum discipline.
- **Notification before breaks** — Get a heads-up before each break starts so you can wrap up what you're doing.
- **Fullscreen on all monitors** — Break screens cover all connected displays.
- **Auto-start on login** — ScreenRest starts automatically when you log in.
- **Dark mode support** — Follows your system theme.
- **Multi-language support** — Available in 40+ languages.
- **Customizable theme** — Pick a break screen color that suits you.
- **Sound themes** — Choose from multiple break sounds or mute them entirely.

## Installation

### Windows

Download the latest installer or portable version from the [Releases](https://github.com/hozaifa1/screen-rest-pc/releases) page.

### Running from Source

```bash
git clone https://github.com/hozaifa1/screen-rest-pc.git
cd screen-rest-pc
npm install
npm start
```

### Building an Installer

```bash
npm install --no-save
npx electron-builder build --win
```

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
│   └── utils/
│       ├── defaultSettings.js   # Default configuration values
│       ├── scheduler.js         # Timer scheduling utility
│       ├── naturalBreaksManager.js  # Idle time detection
│       ├── dndManager.js        # Do Not Disturb detection
│       ├── appExclusionsManager.js  # App-based pause/resume rules
│       ├── autostartManager.js  # Auto-start on login
│       ├── displayManager.js    # Multi-monitor management
│       └── utils.js             # Shared utility functions
├── test/                        # Vitest unit tests
├── buildcommand.md              # Build instructions
├── package.json
└── LICENSE
```

### How It Works

1. **BreaksPlanner** schedules the next break using a `Scheduler` timer.
2. When the timer fires, the main process creates fullscreen `BrowserWindow` instances on all monitors.
3. The break window loads `microbreak.html` which displays a progress bar, custom message or Quran Ayat, and a skip button (unless strict mode is on).
4. After the configured break duration, the windows close automatically and the next break is scheduled.
5. **NaturalBreaksManager** monitors system idle time and pauses/resumes the schedule.
6. **DndManager** listens for Do Not Disturb changes and pauses/resumes accordingly.
7. **AppExclusionsManager** can pause breaks when specific apps are running.

### Configuration

All settings are stored in a JSON file managed by `electron-store`. Key settings:

| Setting | Default | Description |
|---|---|---|
| `microbreakDuration` | `20000` (20s) | Break duration in milliseconds |
| `microbreakInterval` | `600000` (10min) | Interval between breaks in milliseconds |
| `microbreakStrictMode` | `false` | Prevent skipping breaks |
| `microbreakNotification` | `true` | Show notification before break |
| `naturalBreaks` | `true` | Pause breaks when idle |
| `monitorDnd` | `false` | Pause breaks during DND |
| `customMessagesEnabled` | `true` | Show custom messages during breaks |
| `quranAyatEnabled` | `true` | Show Quran Ayat during breaks |
| `mainColor` | `#26A69A` | Break screen color |
| `language` | `en` | UI language |

### Testing

```bash
npx vitest run
```

### Linting

```bash
npm run lint
```

## License

See [LICENSE](LICENSE) file.
