import * as Utils from './utils.js'
import * as Panels from './panels/index.js'
import * as Devices from './devices/index.js'

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

export default class Display {

  constructor(layout, devices, options) {
    options = { ...defaults, ...options }
    this.panels = [];
    this.devices = []
    this.rotation = options.rotation,
    this.isMirrored = options.isMirrored
    this.lastSendTime = null;
    this.minSendInterval = 5;
    this.lastFrameData = [];
    this.isConnected = false

    if (!devices) 
      throw new Error("Device Path must not be empty");
    

    if (!layout.length || !layout[0].length) 
      throw new Error("Panel layout must not be empty");
    
    // Example devices:
    // [ {path: '/dev/cu.usbserial-AB0OJSKG', baudRate: 57600, panels: [1, 2, 3, 4]}, 
    //   {path: '/dev/cu.usbserial-AB0OJSKF', baudRate: 57600, panels: [5, 6, 7, 8]}]
    // or
    // '/dev/cu.usbserial-AB0OJSKG' a string path
    this._initPanels(layout, options.panel);
    this._initDevices(devices)
  }

  _initDevices(devices) {
    devices = (devices.constructor !== Array) ? [devices] : devices
    devices.forEach(args => {
      this._initDevice(args)
    })
  }

  _initDevice(args) {
    if (args.constructor === String) {
      args = {
        path: args,
        addresses: this.allPanelAddresses
      }
    }

    const Device = Devices.deviceForInput(args.path)
    const device = new Device(args.path, args.addresses, args.baudRate)
    device.open(() => this._setConnected())

    this.devices.push(device)
  }

  _setConnected() { 
    this.isConnected = true
    process.once('exit', () => {
      this._closeDevices()
      process.removeAllListeners('exit')
    })
  }

  _closeDevices() {
    this.devices.forEach(device => {
      device.removeAllListeners()
      device.close()
    })
  }

  _initPanels(layout, options) {
    const { width, height, type } = options;
    const Panel = Panels.panelForType(type)

    layout.forEach(row => {
      let rows = [];

      row.forEach(address => {
        rows.push(new Panel(address, width, height));
      });

      this.panels = this.panels === null ? [rows] : this.panels.concat([rows]);
    });
  }

  setInverted(frameData) {
    this.isInverted = !this.isInverted;
    // invert stale data
  }

  _invert(frameData) {
    return frameData.map(row => row.map(pixel => 1 - pixel));
  }

  _mirror(frameData) {
    const mirrored = [];

    for (let i = 0; i < frameData.length; i++) {
      mirrored.push(frameData[i].slice().reverse());
    }

    return mirrored;
  }

  _rotate(frameData, degrees) {
    const rows = frameData.length;
    const cols = frameData[0].length;

    const rotate = (row, col, angle) => {
      switch (angle) {
        case 90:
          return [col, rows - 1 - row];
        case 180:
          return [rows - 1 - row, cols - 1 - col];
        case 270:
          return [cols - 1 - col, row];
        default:
          return [row, col]; // No rotation
      }
    };

    const rotated = [];
    for (let i = 0; i < rows; i++) {
      rotated.push([]);
      for (let j = 0; j < cols; j++) {
        const [newRow, newCol] = rotate(i, j, degrees % 360);
        rotated[i].push(frameData[newRow][newCol]);
      }
    }
    return rotated;
  }

  _formatOrientation(frameData) {
    if (this.rotation != 0) 
      frameData = this._rotate(frameData, this.rotation)
    
    if (this.isMirrored) 
      frameData = this._mirror(frameData)

    if (this.isInverted) 
      frameData = this._invert(frameData)

    return frameData
  }

  _formatSerialData(frameData, addresses, flush) {
    let serialData = new Uint8Array()
    frameData = this._formatOrientation(frameData)
    const panelWidth = this._basePanel.width
    const panelHeight = this._basePanel.height
    const rows = this.rows
    const cols = this.cols

    for (let r = 0; r < rows; r++) {
      const row = this.panels[r];
      for (let c = 0; c < cols; c++) {
        const panel = row[c];
        const panelData = frameData.slice(r * panelHeight, (r + 1) * panelHeight)
          .map(row => row.slice(c * panelWidth, (c + 1) * panelWidth));

        if (addresses.indexOf(row[c].address) !== -1) {
          // add to serial data if address is in the list
          panel.setContent(panelData);
          serialData = Utils.concatTypedArrays(serialData, panel.getSerialFormat(flush))
        }
      }
    }
    return serialData;
  }

  get _basePanel() {
    return this.panels[0][0]
  }

  get width() {
    return this.panelWidth * this.cols;
  }

  get height() {
    return this.panelHeight * this.rows;
  }

  get aspect() {
    return this.width / this.height;
  }

  get panelContent() {
    return this.panels.map(row => row.map(panel => panel.content))
  }

  get content() {
    const content = [];
    this.panels.forEach(row => {
      const rowData = row.map(panel => panel.content);
      for (let i = 0; i < this.panelHeight; i++) {
        content.push(rowData.map(panel => panel[i]).flat());
      }
    });
    return this._formatOrientation(content);
  }

  get allPanelAddresses() {
    return this.panels.flat().map(panel => panel.address)
  }

  get panelWidth() {
    return this._basePanel.width;
  }

  get panelHeight() {
    return this._basePanel.height;
  }

  get rows() {
    return this.panels.length;
  }

  get cols() {
    return this.panels[0].length;
  }

  get info() {
    const { width, height, rotation, isMirrored, isInverted, 
      content, panelWidth, panelHeight, isConnected, lastSendTime } = this;
    return {
      width,
      height,
      rotation,
      isMirrored,
      isInverted,
      panelHeight,
      panelWidth,
      lastSendTime,
      isConnected,
      content,
    }
  }

  sendImageData(imageData) {
    const pixels = Utils.formatRGBAPixels(imageData)
    this.send(pixels)
  }

  _sendToDevice(device, frameData, flush) {
    const serialData = this._formatSerialData(frameData, device.addresses, flush = true)
    device.write(serialData, function(err) {
      if (err) 
        return console.log('Error on write: ', err.message)      
    })
  }
 
  send(frameData, flush) {
    if (this.devices.length === 0) 
      throw new Error('no serial ports available')
    
    if (frameData?.length !== this.height || frameData[0]?.length !== this.width) 
      throw new Error('frame data does not match display dimensions')
    
    if (Utils.areArraysEqual(frameData, this.lastFrameData)) 
      return;

    if (Utils.isImageData(frameData)) 
      frameData = Utils.formatRGBAPixels(frameData)

    if (this.lastSendTime && ((Date.now() - this.lastSendTime) < this.minSendInterval)) 
      console.warn('rendering too quickly. you might be calling render incorrectly')


    this.lastSendTime = Date.now();
    this.lastFrameData = frameData;
    
    this.devices.forEach(device => {
      this._sendToDevice(device, frameData, flush)
    })
  }
}