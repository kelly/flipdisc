import Display from './src/display.js'

const defaults = {
  rotation: 0,
  isMirrored: false,
  isInverted: false,
  panelWidth: 28,
  panelHeight: 14
}

const createDisplay = (layout, devicePath, options = defaults) => {
  options = { ...defaults, ...options }
  return new Display(layout, devicePath, options)
}

export { Display, createDisplay }
