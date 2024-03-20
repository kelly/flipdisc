import { packBits } from './utilities.js'

const START_BYTES_FLUSH = [0x80, 0x83]
const START_BYTES_BUFFER = [0x80, 0x84]
const END_BYTES = [0x8F]
const PANEL_WIDTH_DEFAULT = 28
const PANEL_HEIGHT_DEFAULT = 7

export default class Panel {
  constructor( address, width, height) {
    this.address = address;
    this.width = width || PANEL_WIDTH_DEFAULT;
    this.height = height || PANEL_HEIGHT_DEFAULT;
    this.content = Uint8Array.from({ length: height }, () => Uint8Array(width).fill(0))
  }

  setContent(content) {
    this.content = content
  }

  getSerialFormat(flush = true) {
    const startBytes = flush ? START_BYTES_FLUSH : START_BYTES_BUFFER;
    const serializedContent = packBits(this.content, 0, 'big')
    const serialCommand = [
        ...startBytes,
        this.address,
        ...serializedContent,
        ...END_BYTES
    ];
    return Uint8Array.from(serialCommand);
  }
}