import Display from './src/display.js'
import * as Utils from './src/utils.js'

const defaults = {
  rotation: 0,
  isMirrored: false,
  isInverted: false,
  panel: {
    width: 28,
    height: 7,
    type: 'AlfaZeta'
  }
}

const createDisplay = (layout, devicePath, options = defaults) => {
  options = { ...defaults, ...options }
  return new Display(layout, devicePath, options)
}

export { Display, createDisplay, Utils }
