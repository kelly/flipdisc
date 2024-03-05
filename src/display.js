import { SerialPort } from 'serialport'
import Panel from './panel.js'
import Utilities from './utilities.js'

const BAUD_RATE_DEFAULT = 57600

export default class Display {
  constructor(layout, devicePath, options = {}) {
    this.panels = [];
    this.port = {}

    if (!devicePath) {
      throw new Error("Device Path must not be empty");
    }

    if (!layout.length || !layout[0].length) {
      throw new Error("Panel layout must not be empty");
    }
    
    this._initSerialPort(devicePath, options.serial)
    this._initPanels(layout, options.panel);
  }

  _initSerialPort(devicePath, options) {
    this.port = new SerialPort({ 
      path: devicePath, 
      baudRate: options?.baudRate || BAUD_RATE_DEFAULT,
      autoOpen: true,
      function (err) {
        if (err) {
          throw new Error('Serial Error: ', err.message)
        }
      }
    })
  }

  _initPanels(layout, options) {
    layout.forEach(row => {
      let rows = [];

      row.forEach(address => {
         rows.push(new Panel(address, options?.width, options?.height));
      });

      this.panels = this.panels === null ? [rows] : this.panels.concat([rows]);
    });
  }


  _formatData(frameData, flush) {
    let serialData = new Uint8Array()
    
    for (let r = 0; r < this.panels.length; r++) {
      const row = this.panels[r];

      for (let c = 0; c < row.length; c++) {
        const panel = row[c];
        const panelWidth = this._basePanel.width
        const panelHeight = this._basePanel.height
      
        const panelData = frameData.slice(r * panelHeight, (r + 1) * panelHeight)
          .map(row => row.slice(c * panelWidth, (c + 1) * panelWidth));

        panel.setContent(panelData);
        serialData = Utilities.concatTypedArrays(serialData, panel.getSerialFormat(flush))
      }
    }
    return serialData;
  }

  get _basePanel() {
    return this.panels[0][0]
  }

  get width() {
    return this._basePanel.width * this.panels[0].length;
  }

  get height() {
    return this._basePanel.height * this.panels.length;
  }

  getContent() {
    return this.panel.map(row => row.map(panel => panel.content));
  
  }

  send(frameData, flush) {
    const serialData = this._formatData(frameData, flush = true)
    this.port.write(serialData, function(err) {
      if (err) {
        return console.log('Error on write: ', err.message)      }
    })
  }

  
  stream() {

  }
}
