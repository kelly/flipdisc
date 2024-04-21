import * as Utils from '../utils.js'
import Panel from './panel.js'

const START_BYTES = [0x80]
const FLUSH_BYTE  = [0x83]
const BUFFER_BYTE = [0x84]
const END_BYTES   = [0x8F]
const PANEL_WIDTH_DEFAULT = 28
const PANEL_HEIGHT_DEFAULT = 7

export default class AlfaZetaPanel extends Panel {
  constructor( address, width, height ) {
    super(address, width || PANEL_WIDTH_DEFAULT, height || PANEL_HEIGHT_DEFAULT) 
  }

  getSerialFormat(flush) {
    const flushOrBuffer = flush ? FLUSH_BYTE : BUFFER_BYTE
    const serializedContent = Utils.packBits(this.content, 0, 'big')
    const serialCommand = [
      ...START_BYTES,
      ...flushOrBuffer,
      this.address,
      ...serializedContent,
      ...END_BYTES
    ];
    return Uint8Array.from(serialCommand);
  }
}