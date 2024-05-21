import Display from './src/display.js'
import * as Utils from './src/utils.js'


const createDisplay = (layout, devicePath, options) => {
  options = { ...defaults, ...options }
  return new Display(layout, devicePath, options)
}

export { Display, createDisplay, Utils }
