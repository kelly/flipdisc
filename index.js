import Display from './src/display.js'
import SegmentDisplay from './src/segmentDisplay.js'
import * as Utils from './src/utils.js'
import * as Panels from './src/panels/index.js'

const createDisplay = (layout, devicePath, options = {}) => {
  return (options.panel?.style ===  Panels.PanelStyles.segment) ? 
    new SegmentDisplay(layout, devicePath, options) : 
    new Display(layout, devicePath, options)
}

export { Display, SegmentDisplay, createDisplay, Utils, Panels }
