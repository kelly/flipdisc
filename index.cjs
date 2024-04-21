'use strict';

var EventEmitter = require('events');
var serialport = require('serialport');
var connectionString = require('connection-string');
var net = require('net');
var udp = require('node:dgram');

function concatTypedArrays(a, b) { // a, b TypedArray of same type
  var c = new (a.constructor)(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

function areArraysEqual(arr1, arr2) {
  // Check if the arrays have the same dimensions
  if (arr1.length !== arr2.length || arr1[0].length !== arr2[0].length) {
    return false;
  }

  const rows = arr1.length;
  const cols = arr1[0].length;

  // Flatten both arrays into typed arrays
  const flatArr1 = new Uint8Array(rows * cols);
  const flatArr2 = new Uint8Array(rows * cols);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      flatArr1[i * cols + j] = arr1[i][j];
      flatArr2[i * cols + j] = arr2[i][j];
    }
  }

  // Compare typed arrays
  for (let i = 0; i < flatArr1.length; i++) {
    if (flatArr1[i] !== flatArr2[i]) {
      return false;
    }
  }

  return true;
}

function packBits(content, axis, bitorder) {
  const numRows = content.length;
  const numCols = content[0].length;

  return Array.from({ length: axis === 0 ? numCols : numRows }, (_, i) => {
      let packedByte = 0;
      const range = axis === 0 ? numRows : numCols;
      for (let j = 0; j < range; j++) {
          const [row, col] = axis === 0 ? [j, i] : [i, j];
          if (content[row][col] !== 0) {
              packedByte |= 1 << (range - 1 - j);
          }
      }
      return bitorder === 'little' ? this.reverseBits(packedByte) : packedByte;
  });
}

function reverseBits(byte) {
  let result = 0;
  for (let i = 0; i < 8; i++) {
      result |= ((byte >> i) & 1) << (7 - i);
  }
  return result;
}

function mergeFrames(frameDatas, mergeStrategy = 'invert') {
  const numRows = frameDatas[0].length;
  const numCols = frameDatas[0][0].length;
  return Array.from({ length: numRows }, (_, i) => {
      return Array.from({ length: numCols }, (_, j) => {
          return frameDatas.reduce((acc, frameData) => {
              if (mergeStrategy === 'invert') {
                  return acc ^ frameData[i][j];
              } else {
                  return acc | frameData[i][j];
              }
          }, 0);
      });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function getLuminanceRGB(r, g, b) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5 ? 0 : 1;
}

function formatRGBAPixels(imageData) {
  const pixelArray = new Array(this.height);
  const width = this.width;
  const height = this.height;

  for (let y = 0; y < height; y++) {
    const row = new Array(width);
    const yWidth = y * width * 4;

    for (let x = 0; x < width; x++) {
      const i = yWidth + x * 4;
      row[x] = getLuminanceRGB(imageData[i], imageData[i + 1], imageData[i + 2]);
    }

    pixelArray[y] = row;
  }

  return pixelArray;
}

var utils = /*#__PURE__*/Object.freeze({
  __proto__: null,
  areArraysEqual: areArraysEqual,
  concatTypedArrays: concatTypedArrays,
  formatRGBAPixels: formatRGBAPixels,
  mergeFrames: mergeFrames,
  packBits: packBits,
  reverseBits: reverseBits,
  sleep: sleep
});

class Panel {
  constructor( address, width, height) {
    this.address = address;
    this.width = width;
    this.height = height;
  }

  get _contentDefault()  {
    return Uint8Array.from({ length: this.height }, () => new Uint8Array(this.width).fill(0))
  }

  setContent(content) {
    this.content = content;
  }

  getSerialFormat(options) {
    console.warn('getSerialFormat not implemented');
  }
}

const START_BYTES$1 = [0x80];
const FLUSH_BYTE  = [0x83];
const BUFFER_BYTE = [0x84];
const END_BYTES$1   = [0x8F];
const PANEL_WIDTH_DEFAULT$1 = 28;
const PANEL_HEIGHT_DEFAULT$1 = 7;

class AlfaZetaPanel extends Panel {
  constructor( address, width, height ) {
    super(address, width || PANEL_WIDTH_DEFAULT$1, height || PANEL_HEIGHT_DEFAULT$1); 
  }

  getSerialFormat(flush) {
    const flushOrBuffer = flush ? FLUSH_BYTE : BUFFER_BYTE;
    const serializedContent = packBits(this.content, 0, 'big');
    const serialCommand = [
      ...START_BYTES$1,
      ...flushOrBuffer,
      this.address,
      ...serializedContent,
      ...END_BYTES$1
    ];
    return Uint8Array.from(serialCommand);
  }
}

const START_BYTES= [0x02];
const END_BYTES = [0x03];
const PANEL_WIDTH_DEFAULT = 56;
const PANEL_HEIGHT_DEFAULT = 7;

class HanoverPanel extends Panel {

  constructor( address, width, height ) {
    super(address, width || PANEL_WIDTH_DEFAULT, height || PANEL_HEIGHT_DEFAULT); 
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
    const data = this.content;
    const res = new Uint8Array([(data.length & 0xFF)]);
    const header = [this.address, ...res];
    const command = [
      ...header,
      ...data,
    ].map(this._byteToASCII).flat();
    const checksum = this._byteToASCII(this._calculateChecksum(command));

    const serialCommand = [
      ...START_BYTES,
      ...command,
      ...END_BYTES,
      ...checksum
    ];

    return Uint8Array.from(serialCommand);
  }
}

function panelForType(type) {
  switch (type.toLowerCase()) {
    case 'alfazeta':
      return AlfaZetaPanel
    case 'hanover':
      return HanoverPanel
    default:
      throw new Error('Invalid panel type')
  }
}

class Device extends EventEmitter {
  constructor(path, addresses) {
    super();

    this.path = path;
    this.addresses = addresses;
    this.isOpen = false;
  }

  open(callback) {}
  send(data, callback) {}
  close() {}


}

const BAUD_RATE_DEFAULT = 57600;

class USBDevice extends Device {

  constructor(path, addresses, baudRate) {
    super(path, addresses);
    this.baudRate = baudRate || BAUD_RATE_DEFAULT;
  }

  open(callback) {
    this.port = new serialport.SerialPort({ 
      path: this.path, 
      baudRate: this.baudRate,
      autoOpen: true,
    }, (err) => {
      if (err) {
        throw new Error(err)
      } else {
        console.log(`Opened USB Device: ${this.path} baud rate: ${this.baudRate}`);
        this.isOpen = true;
        this.emit('open');
        callback();
      }
    }
  );}
  
  write(data, callback) {
    if (!this.isOpen) {
      console.warn('Device is not open');
    }
    this.port.write(data, callback);
  }

  close() {
    this.removeAllListeners();
    this.port.removeAllListeners();
    this.port.close();
    this.isOpen = false;
  }
}

class NetworkDevice extends Device {
  constructor(path, addresses) {
    super(path, addresses);
    this.connection = this.parseConnectionString(path);
  }

  parseConnectionString(connectionString$1) {
    const parsed = new connectionString.ConnectionString(connectionString$1);
    if (!parsed.protocol || !parsed.host || !parsed.port) 
      throw new Error('invalid connection string');
    if (parsed.protocol !== 'tcp' && parsed.protocol !== 'udp') 
      throw new Error('invalid protocol');
    
    return parsed;
  }

  open(callback) {
    const { port, hostname, protocol } = this.connection;

    this.socket = protocol == 'udp' ? udp.createSocket('udp4') : new net.Socket();
    this.socket.connect(port, hostname, () => {
      console.log(`Opened Connection: ${protocol} port: ${port} hostname: ${hostname}`);

      this.isOpen = true;
      this.emit('open');
      callback();
    });
  }

  write(data, callback) {
    if (!this.isOpen) {
      console.warn('Device is not open');
      return;
    }
    (this.socket instanceof net.Socket) ? this.socket.write(data, callback) : this.socket.send(data, callback);
  }

  close() {
    this.removeAllListeners();
    this.socket.removeAllListeners();
    (this.socket instanceof net.Socket) ? this.socket.destroy() : this.socket.close();
    this.isOpen = false;
  }

}

function deviceForInput(input) {
  if (input.match(/tty|cu/)) {
    return USBDevice;
  } else {
    return NetworkDevice;
  }
}

class Display {
  constructor(layout, devices, options) {
    this.panels = [];
    this.devices = [];
    this.rotation = options.rotation,
    this.isMirrored = options.isMirrored;
    this.lastSendTime = null;
    this.minSendInterval = 5;
    this.lastFrameData = [];
    this.isConnected = false;

    if (!devices) {
      throw new Error("Device Path must not be empty");
    }

    if (!layout.length || !layout[0].length) {
      throw new Error("Panel layout must not be empty");
    }
    // Example devices:
    // [ {path: '/dev/cu.usbserial-AB0OJSKG', baudRate: 57600, panels: [1, 2, 3, 4]}, 
    //   {path: '/dev/cu.usbserial-AB0OJSKF', baudRate: 57600, panels: [5, 6, 7, 8]}]
    // or
    // '/dev/cu.usbserial-AB0OJSKG' a string path
    this._initPanels(layout, options.panel);
    this._initDevices(devices);
  }


  _initDevices(devices) {
    devices = (devices.constructor !== Array) ? [devices] : devices;
    devices.forEach(args => {
      this._initDevice(args);
    });
  }

  _initDevice(args) {
    if (args.constructor === String) {
      args = {
        path: args,
        addresses: this.allPanelAddresses
      };
    }

    const Device = deviceForInput(args.path);
    const device = new Device(args.path, args.addresses, args.baudRate);
    device.open(() => this._setConnected());

    this.devices.push(device);
  }

  _setConnected() { 
    this.isConnected = true;
    process.on('exit', () => {
      this._closeDevices();
      process.removeAllListeners('exit');
    });
  }

  _closeDevices() {
    this.devices.forEach(device => {
      device.removeAllListeners();
      device.close();
    });
  }

  _initPanels(layout, options) {
    const { width, height, type } = options;
    const Panel = panelForType(type);

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
    if (this.rotation != 0) {
      frameData = this._rotate(frameData, this.rotation);
    }

    if (this.isMirrored) {
      frameData = this._mirror(frameData);
    }

    if (this.isInverted) {
      frameData = this._invert(frameData);
    }

    return frameData
  }

  _formatSerialData(frameData, addresses, flush) {
    let serialData = new Uint8Array();
    frameData = this._formatOrientation(frameData);
    const panelWidth = this._basePanel.width;
    const panelHeight = this._basePanel.height;
    const rows = this.panels.length;

    for (let r = 0; r < rows; r++) {
      const row = this.panels[r];
      const cols = row.length;
      for (let c = 0; c < cols; c++) {
        const panel = row[c];
        const panelData = frameData.slice(r * panelHeight, (r + 1) * panelHeight)
          .map(row => row.slice(c * panelWidth, (c + 1) * panelWidth));

        if (addresses.indexOf(row[c].address) !== -1) {
          // add to serial data if address is in the list
          panel.setContent(panelData);
          serialData = concatTypedArrays(serialData, panel.getSerialFormat(flush));
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

  get content() {
    return this.panels.map(row => row.map(panel => panel.content));
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
    const pixels = formatRGBAPixels(imageData);
    this.send(pixels);
  }

  _sendToDevice(device, frameData, flush) {
    if (!device.isOpen) {
      return device.on('open', () => {
        console.log('not open');
        sleep(1000); // time to wake-up
        this._sendToDevice(device, frameData, flush);
      })
    }
    const serialData = this._formatSerialData(frameData, device.addresses, flush = true);
    device.write(serialData, function(err) {
      if (err) {
        return console.log('Error on write: ', err.message)      
      }
    });
  }
 
  send(frameData, flush) {
    if (this.devices.length === 0) 
      throw new Error('No serial ports available')
    
    if (frameData?.length !== this.height || frameData[0]?.length !== this.width) 
      throw new Error('Frame data does not match display dimensions')

    if (this.lastSendTime && ((Date.now() - this.lastSendTime) < this.minSendInterval)) 
      console.warn('Rendering too quickly. You might be calling render incorrectly');

    if (areArraysEqual(frameData, this.lastFrameData)) 
      return;

    this.lastSendTime = Date.now();
    this.lastFrameData = frameData;
    
    this.devices.forEach(device => {
      this._sendToDevice(device, frameData, flush);
    });
  }
}

const defaults = {
  rotation: 0,
  isMirrored: false,
  isInverted: false,
  panel: {
    width: 28,
    height: 14,
    type: 'AlfaZeta'
  }
};

const createDisplay = (layout, devicePath, options = defaults) => {
  options = { ...defaults, ...options };
  return new Display(layout, devicePath, options)
};

exports.Display = Display;
exports.Utils = utils;
exports.createDisplay = createDisplay;
