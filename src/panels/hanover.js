import PanelStyles from './styles.js';
import Panel from './panel.js'

const START_BYTES= [0x02]
const END_BYTES = [0x03]
const PANEL_WIDTH_DEFAULT = 56
const PANEL_HEIGHT_DEFAULT = 7

export default class HanoverPanel extends Panel {

  constructor( address, width = PANEL_WIDTH_DEFAULT, height = PANEL_HEIGHT_DEFAULT) {
    super(address, width, height, PanelStyles.dot) 
  }

  // this is ridiculous, but apparently it's part of the format: https://engineer.john-whittington.co.uk/2017/11/adventures-flippy-flip-dot-display/
  _byteToASCII(byte) {
    const hexString = byte.toString(16).padStart(2, '0');
    const bytes = hexString.split('').map(n => {
      return n.charCodeAt(0);
    });

    return bytes;
  }

  _calculateChecksum(command) {
    const addBytes = 3; // for start and end bytes
    let sum = command.reduce((acc, byte) => acc + byte, 0);
    sum = sum & 0xFF;
    return (sum ^ 255) + addBytes;  
  }

  getSerialFormat(flush) {
    const data = this.content
    const res = new Uint8Array([(data.length & 0xFF)]);
    const header = [this.address, ...res]
    const command = [
      ...header,
      ...data,
    ].map(this._byteToASCII).flat();
    const checksum = this._byteToASCII(this._calculateChecksum(command))

    const serialCommand = [
      ...START_BYTES,
      ...command,
      ...END_BYTES,
      ...checksum
    ];

    return Uint8Array.from(serialCommand);
  }
}