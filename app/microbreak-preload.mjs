import {
  exposeElectronApi,
  exposeBreaks,
  exposeI18next,
  exposeRuntime,
  exposeSettings,
  exposeScreenRest,
  exposeUtils
} from './utils/context-bridge-exposers.js'

exposeElectronApi()
exposeBreaks('mini')
exposeI18next()
exposeRuntime()
exposeSettings()
exposeScreenRest()
exposeUtils()
