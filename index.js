import Display from './src/display.js'
import * as Utils from './src/utils.js'
import * as Panels from './src/panels/index.js'


const createDisplay = (layout, devicePath, options) => {
  return new Display(layout, devicePath, options)
}

export { Display, createDisplay, Utils, Panels }
