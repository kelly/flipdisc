'use strict';

require('node:crypto');
var EventEmitter = require('events');
var serialport = require('serialport');
var bindingMock = require('@serialport/binding-mock');
var connectionString = require('connection-string');
var net = require('net');
var udp = require('node:dgram');

function hashFrameData(...arrays) {
  const flatData = flatten(arrays);
  const buffer = Buffer.from(flatData);
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  return hash;
}

function flatten(arr) {
  return arr.reduce((acc, val) => {
    return acc.concat(Array.isArray(val) ? flatten(val) : val);
  }, []);
}

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

function getLuminanceRGB(r = 0, g = 0, b = 0) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5 ? 0 : 1;
}

function createImageData(data, width, height) {
  // convert an array from  [[1, 1, 1, 1], [0, 1, 0, 1]] to RGBA format
  const imageData = new Uint8ClampedArray(width * height * 4); // Output RGBA array
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const value = data[y][x] * 255;
      imageData[i] = value;       // Red
      imageData[i + 1] = value; // Green
      imageData[i + 2] = value; // Blue
      imageData[i + 3] = 255; // Alpha
    }
  }     
  return imageData;
}

function resizeImageData(imageData, width, height, newWidth, newHeight) {
  if (width === newWidth && height === newHeight) {
    return imageData
  }
  
  const resizedData = new Uint8ClampedArray(newWidth * newHeight * 4); // Output RGBA array
  const xRatio = width / newWidth;
  const yRatio = height / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const nearestX = Math.floor(x * xRatio);
      const nearestY = Math.floor(y * yRatio);
      const index = (y * newWidth + x) * 4;
      const nearestIndex = (nearestY * width + nearestX) * 4;

      // Copy RGBA values
      resizedData[index] = imageData[nearestIndex];       // Red
      resizedData[index + 1] = imageData[nearestIndex + 1]; // Green
      resizedData[index + 2] = imageData[nearestIndex + 2]; // Blue
      resizedData[index + 3] = imageData[nearestIndex + 3]; // Alpha
    }
  }

  return Array.from(resizedData); 
}

function formatRGBAPixels(imageData, width, height) {
  const pixelArray = new Array(height);

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

function isImageData(data) {
  if (!data) return false;
  return !Array.isArray(data[0])
}

function isEmptyArray(arr) {
  // if 1d or 2d array only has elements that are 0
  return arr.every(row => row.every(el => el === 0))
}

var utils = /*#__PURE__*/Object.freeze({
  __proto__: null,
  areArraysEqual: areArraysEqual,
  concatTypedArrays: concatTypedArrays,
  createImageData: createImageData,
  formatRGBAPixels: formatRGBAPixels,
  hashFrameData: hashFrameData,
  isEmptyArray: isEmptyArray,
  isImageData: isImageData,
  mergeFrames: mergeFrames,
  packBits: packBits,
  resizeImageData: resizeImageData,
  reverseBits: reverseBits,
  sleep: sleep
});

const PanelStyles = {
  dot: 'dot',
  segment: 'segment'
};

class Panel {
  constructor(address, width, height) {
    this.address = address;
    this.width = width;
    this.height = height;
    this._content = this.defaultContent();
  }

  defaultContent() {
    return Array.from({ length: this.height }, () => new Uint8Array(this.width).fill(0));
  }

  setContent(content) {
    this._content = content;
  }

  get content() {
    return this._content;
  }

  set content(content) {
    this._content = content;
  }

  static get style() {
    return PanelStyles.dot;
  }

  getSerialFormat(options) {
    console.warn('getSerialFormat not implemented');
  }
}

const START_BYTES$1 = [0x80];
const FLUSH_BYTE  = [0x83];
const BUFFER_BYTE = [0x84];
const END_BYTES$1   = [0x8F];
const PANEL_WIDTH_DEFAULT$2 = 28;
const PANEL_HEIGHT_DEFAULT$2 = 7;

class AlfaZetaPanel extends Panel {
  constructor( address, width = PANEL_WIDTH_DEFAULT$2, height = PANEL_HEIGHT_DEFAULT$2) {  
    super(address, width, height); 
  }

  getSerialFormat(flush) {
    const flushOrBuffer = flush ? FLUSH_BYTE : BUFFER_BYTE;
    const serialCommand = [
      ...START_BYTES$1,
      ...flushOrBuffer,
      this.address,
      ...this.content,
      ...END_BYTES$1
    ];
    return Uint8Array.from(serialCommand);
  }

  get content() {
    return packBits(this._content, 0, 'big')
  }
}

const START_BYTES= [0x02];
const END_BYTES = [0x03];
const PANEL_WIDTH_DEFAULT$1 = 56;
const PANEL_HEIGHT_DEFAULT$1 = 7;

class HanoverPanel extends Panel {

  constructor( address, width = PANEL_WIDTH_DEFAULT$1, height = PANEL_HEIGHT_DEFAULT$1) {
    super(address, width, height, PanelStyles.dot); 
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

const PANEL_DIGIT_VERTICAL_SIZE = { width: 2, height: 2 };
const PANEL_DIGIT_HORIZONTAL_SIZE = { width: 1, height: 3 };
const PANEL_WIDTH_DEFAULT = 7;
const PANEL_HEIGHT_DEFAULT = 4;
const PANEL_SEGMENT_COUNT = 7;

///    6
/// -------
/// |     |
/// | 1   | 5
/// |     |
/// -------
/// |  0  | 
/// | 2   | 4
/// |     |
/// -------
///    3

const PANEL_SEGMENTS = {
  VERTICAL: [1, 5, 2, 4], // Top Left, Top Right, Bottom Left, Bottom Right
  HORIZONTAL: [6, 0, 3],   // Top, Middle, Bottom
};

class AlfaZetaSegmentPanel extends AlfaZetaPanel {
  constructor(address, width = PANEL_WIDTH_DEFAULT, height = PANEL_HEIGHT_DEFAULT) {
    super(address, width, height);
    this._content = Array.from({ length: this.width * this.height }, () => Array(PANEL_SEGMENT_COUNT).fill(0));
  }

  // Virtual sizes are needed because each segment is essentially a 2x3 display
  get virtualWidth() {
    return this.width * PANEL_DIGIT_VERTICAL_SIZE.width;
  }

  get virtualHeight() {
    return this.height * PANEL_DIGIT_HORIZONTAL_SIZE.height;
  }

  setVerticalContent(content) {
    this._setSegmentContent(
      content,
      PANEL_DIGIT_VERTICAL_SIZE,
      PANEL_SEGMENTS.VERTICAL
    );
  }

  setHorizontalContent(content) {
    this._setSegmentContent(
      content,
      PANEL_DIGIT_HORIZONTAL_SIZE,
      PANEL_SEGMENTS.HORIZONTAL
    );
  }

  _setSegmentContent(content, digitSize, segmentIndices) {
    const slicedContent = this._sliceContent(content, digitSize);
    slicedContent.forEach((slice, i) => {
      segmentIndices.forEach((segmentIndex, j) => {
        this._content[i][segmentIndex] = slice[j];  
      });
    });

  }

  _sliceContent(content, { width, height }) {
    const rows = Math.floor(content.length / height);
    const cols = Math.floor(content[0].length / width);
    const sliced = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const slice = content
          .slice(r * height, (r + 1) * height)
          .flatMap(row => row.slice(c * width, (c + 1) * width));
        sliced.push(slice);
      }
    }
    return sliced;
  }

  get content() {
    return this.segments.map(segment => {
      segment = segment.slice().reverse();
      return parseInt(segment.join(''), 2)
    })
  }

  get segments() {
    // an alias for content
    return this._content;
  }

  get horizontalContentSize() {
    return {
      width: PANEL_DIGIT_HORIZONTAL_SIZE.width * this.width,
      height: PANEL_DIGIT_HORIZONTAL_SIZE.height * this.height,
    }
  }

  get verticalContentSize() {
    return {
      width: PANEL_DIGIT_VERTICAL_SIZE.width * this.width,
      height: PANEL_DIGIT_VERTICAL_SIZE.height * this.height,
    }
  }

  static get style() {
    return PanelStyles.segment;
  }
}

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  AlfaZetaPanel: AlfaZetaPanel,
  AlfaZetaSegmentPanel: AlfaZetaSegmentPanel,
  HanoverPanel: HanoverPanel,
  Panel: Panel,
  PanelStyles: PanelStyles
});

class Device extends EventEmitter {
  constructor(path, addresses) {
    super();

    this.queue = [];
    this.maxQueueLength = 10;
    this.path = path;
    this.addresses = addresses;
    this.isOpen = false;
  }

  _addToQueue(data, callback) {
    this.queue.push(data);
    this.once('open', () => {
      this.queue.forEach(data => this.write(data));
      this.queue = [];
      
      callback();
    });

    if (this.queue.length > this.maxQueueLength) 
      this.queue.shift();
  }

  open(callback) {}
  write(data, callback) {
    if (!this.isOpen) {
      this._addToQueue(data, callback);
      return;
    }  }

  close() {}


}

const BAUD_RATE_DEFAULT = 57600;

class USBDevice extends Device {
  static devices = [];
  static exitHandlersSet = false;

  constructor(path, addresses, baudRate, isMock) {
    super(path, addresses);
    this.baudRate = baudRate || BAUD_RATE_DEFAULT;
    this.autoOpen = true;
    this.isOpen = false;
    this.isMock = isMock;

    if (this.isMock) {
      bindingMock.MockBinding.createPort(path, { echo: false, record: true });
    }
    
    USBDevice.devices.push(this);
    USBDevice.setupExitHandlers();
  }

  static setupExitHandlers() {
    if (USBDevice.exitHandlersSet) return; 
    USBDevice.exitHandlersSet = true;

    const exitHandler = () => {
      console.log('Received exit signal, closing USB devices.');
      USBDevice.devices.forEach((device) => device.close());
      process.exit();
    };

    process.on('SIGINT', exitHandler);
    process.on('SIGTERM', exitHandler);
  }

  open(callback) {
    const { path, baudRate, autoOpen } = this;

    this._isSerialAvailable(path).then((available) => {
      if (!available) {
        console.warn(`USB device not available: ${path}`);
        return;
      }

      this.port = new serialport.SerialPort(
        {
          path,
          baudRate,
          autoOpen,
          ...(this.isMock && { binding: bindingMock.MockBinding }),
        },
        (err) => {
          if (err) {
            throw new Error(err);
          } else {
            console.log(
              `Opened USB device: ${this.path} baud rate: ${this.baudRate}`
            );
            this.isOpen = true;
            this.emit('open');
            if (callback) callback();
          }
        }
      );
    });
  }

  write(data, callback) {
    if (!this.port) return;

    super.write(data, callback);
    this.port.write(data, callback);
  }

  close() {
    if (!this.port || !this.isOpen) return;

    this.removeAllListeners();
    this.port.removeAllListeners();

    this.port.close((err) => {
      if (err) {
        console.error('Error closing port:', err);
      } else {
        console.log('Serial port closed.');
      }
      this.isOpen = false;

      // Remove this device from the devices array
      const index = USBDevice.devices.indexOf(this);
      if (index > -1) {
        USBDevice.devices.splice(index, 1);
      }
    });
  }

  _isSerialAvailable(path) {
    if (this.isMock) return Promise.resolve(true);

    return serialport.SerialPort.list().then((ports) => {
      return !!ports.find((port) => port.path === path);
    });
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
      console.log(`opened connection: ${protocol} port: ${port} hostname: ${hostname}`);

      this.isOpen = true;
      this.emit('open');
      callback();
    });
  }

  write(data, callback) {
    super.write(data, callback);
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

const defaults = {
  rotation: 0,
  isMirrored: false,
  isInverted: false,
  isMockTesting: false,
  panel: {
    width: 28,
    height: 7,
    type: AlfaZetaPanel
  },
};

const MIN_SEND_INTERVAL_MS = 5;
const MAX_QUEUE_LENGTH = 10;

class Display  {
  constructor(layout, devices, options = {}) {
    options = { ...defaults, ...options };
    this.panels = [];
    this.devices = [];
    this.rotation = options.rotation;
    this.isMirrored = options.isMirrored;
    this.isInverted = options.isInverted;
    this.isMockTesting = options.isMockTesting;
    this.lastSendTime = null;
    this.minSendInterval = MIN_SEND_INTERVAL_MS;
    this.lastFrameHash = null;
    this.isConnected = false;
    this.sendQueue = [];
    this.maxSendQueueLength = MAX_QUEUE_LENGTH;

    if (!devices) {
      throw new Error('Device path must not be empty');
    }

    if (!layout.length || !layout[0].length) {
      throw new Error('Panel layout must not be empty');
    }

    this._initPanels(layout, options.panel);

    const deviceList = Array.isArray(devices) ? devices : [devices];

    this._initDevices(deviceList)
      .then(() => this._setConnected())
      .catch((err) => {
        console.error('Failed to connect devices:', err);
      });
  }

  _initDevices(devices) {
    const promises = devices.map((args) => this._initDevice(args));
    return Promise.all(promises);
  }

  _initDevice(args) {
    return new Promise((resolve, reject) => {
      if (typeof args === 'string') {
        args = {
          path: args,
          addresses: this.allPanelAddresses,
        };
      }

      const Device = deviceForInput(args.path);
      const device = new Device(args.path, args.addresses, args.baudRate, this.isMockTesting);

      device.open((err) => {
        if (err) return reject(err);
        this.devices.push(device);
        resolve();
      });
    });
  }

  _setConnected() {
    this.isConnected = true;
    process.once('exit', () => {
      this._closeDevices();
    });

    this._processQueue();
  }

  _closeDevices() {
    this.devices.forEach((device) => {
      device.removeAllListeners();
      device.close();
    });
  }

  _initPanels(layout, options) {
    const { width, height, type } = options;
    const Panel$1 = options.prototype instanceof Panel ? options : type || AlfaZetaPanel;
    this.panels = layout.map((row) =>
      row.map((address) => new Panel$1(address, width, height))
    );
  }

  setInverted(isInverted) {
    this.isInverted = isInverted;
  }

  _invert(frameData) {
    return frameData.map((row) => row.map((pixel) => 1 - pixel));
  }

  _mirror(frameData) {
    return frameData.map((row) => row.slice().reverse());
  }

  _rotate(frameData, degrees) {
    degrees = degrees % 360;
    if (degrees === 0) {
      return frameData;
    }
    const times = (degrees / 90) % 4;
    let rotated = frameData;
    for (let i = 0; i < times; i++) {
      rotated = this._rotate90(rotated);
    }
    return rotated;
  }

  _rotate90(frameData) {
    const rows = frameData.length;
    const cols = frameData[0].length;
    const rotated = [];
    for (let col = 0; col < cols; col++) {
      const newRow = [];
      for (let row = rows - 1; row >= 0; row--) {
        newRow.push(frameData[row][col]);
      }
      rotated.push(newRow);
    }
    return rotated;
  }

  _formatOrientation(frameData) {
    if (this.rotation !== 0) {
      frameData = this._rotate(frameData, this.rotation);
    }

    if (this.isMirrored) {
      frameData = this._mirror(frameData);
    }

    if (this.isInverted) {
      frameData = this._invert(frameData);
    }

    return frameData;
  }

  _loopPanels(callback) {
    this.panels.forEach((row, r) => {
      row.forEach((panel, c) => {
        callback(panel, r, c);
      });
    });
  }

  _formatSerialData(frameData, addresses, flush) {
    let serialData = new Uint8Array();
    frameData = this._formatFrameData(frameData);

    this._loopPanels((panel, r, c) => {
      const panelData = this._parsePanelData(frameData, r, c);
      if (addresses.includes(panel.address)) {
        panel.setContent(panelData);
        serialData = concatTypedArrays(
          serialData,
          panel.getSerialFormat(flush)
        );
      }
    });

    return serialData;
  }

  _parsePanelData(frameData, r, c, size = { width: this.panelWidth, height: this.panelHeight }) {
    const { width, height } = size;
    return frameData
      .slice(r * height, (r + 1) * height)
      .map((row) => row.slice(c * width, (c + 1) * width));
  }

  _formatFrameData(frameData, size = { width: this.width, height: this.height }) {
    if (isImageData(frameData)) {
      frameData = formatRGBAPixels(frameData, size.width, size.height);
    }
    return this._formatOrientation(frameData);
  }

  get _basePanel() {
    return this.panels[0][0];
  }

  get deviceWidth() {
    return this.panelWidth * this.cols;
  }

  get deviceHeight() {
    return this.panelHeight * this.rows;
  }

  get width() {
    return this.isRotated90 ? this.deviceHeight : this.deviceWidth;
  }

  get height() {
    return this.isRotated90 ? this.deviceWidth : this.deviceHeight;
  }

  get aspect() {
    return this.width / this.height;
  }

  get panelContent() {
    return this.panels.map((row) => row.map((panel) => panel.content));
  }

  get content() {
    const content = [];
    for (let r = 0; r < this.rows; r++) {
      for (let i = 0; i < this.panelHeight; i++) {
        const rowContent = [];
        for (let c = 0; c < this.cols; c++) {
          rowContent.push(...this.panels[r][c]._content[i]);
        }
        content.push(rowContent);
      }
    }
    return this._formatOrientation(content);
  }

  get allPanelAddresses() {
    return this.panels.flat().map((panel) => panel.address);
  }

  get panelWidth() {
    return this._basePanel.virtualWidth || this._basePanel.width;
  }

  get panelHeight() {
    return this._basePanel.virtualHeight || this._basePanel.height;
  }

  get isRotated90() {
    return this.rotation === 90 || this.rotation === 270;
  }

  get rows() {
    return this.panels.length;
  }

  get cols() {
    return this.panels[0].length;
  }

  get info() {
    const {
      width,
      height,
      rotation,
      isMirrored,
      isInverted,
      content,
      panelWidth,
      panelHeight,
      isConnected,
      lastSendTime,
    } = this;
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
    };
  }

  _write(device, data) {
    if (this.devices.length === 0) {
      throw new Error('No serial ports available');
    }

    device.write(data, (err) => {
      if (err) console.warn('Error on write:', err.message);
    });
  }

  _validateFrameData(frameData, size = { width: this.width, height: this.height }) {
    const isImageData$1 = isImageData(frameData);
    const imageLen = size.width * size.height * 4;
    const len = frameData.length;
    const rowLen = frameData[0]?.length;

    if (Array.isArray(frameData) && len > 0) { 
      if ((!isImageData$1 && (len !== size.height || rowLen !== size.width)) || 
          (isImageData$1 && (len !== imageLen))) {
        throw new Error('Frame data size does not match display size');
      } 
    }

    if (!Array.isArray(frameData)) {
      if (Buffer.isBuffer(frameData)) {
        frameData = Array.from(new Uint8Array(frameData));
      } else {
        throw new Error('Source frame data must be an Array or a Buffer');
      }
    }
    return frameData;
  }

  _isFrameChanged(...frameData) {
    const currentFrameHash = hashFrameData(frameData);
    const isNew = (currentFrameHash !== this.lastFrameHash); 

    if (isNew) {
      this.lastFrameHash = currentFrameHash;

      const now = Date.now();
      if (this.lastSendTime && now - this.lastSendTime < this.minSendInterval) {
        console.warn('Rendering too quickly. You might be calling render incorrectly');
      }
      this.lastSendTime = now;
    }

    return isNew;
  }

  send(frameData, flush = true) {
    if (!this.isConnected) {
      this._addQueueItem({frameData, flush});
      return;
    }
    frameData = this._validateFrameData(frameData);

    if (!this._isFrameChanged(frameData)) return;

    this.devices.forEach((device) => {
      const serialData = this._formatSerialData(frameData, device.addresses, flush);
      this._write(device, serialData);
    });
  }

  _addQueueItem(data) {
    this.sendQueue.push(data);
    if (this.sendQueue.length > this.maxSendQueueLength) {
      this.sendQueue.pop();
      console.warn('Send queue is full, discarding the latest frame');
    }
  }

  _processQueue() {
    while (this.sendQueue.length > 0) {
      const { frameData, flush } = this.sendQueue.shift();
      this.send(frameData, flush);
    }
  }
}

class SegmentDisplay extends Display {
  constructor(layout, devices, options = {}) {
    super(layout, devices, options);
  }

  _prepareFrameData(frameData) {
    if (!isImageData(frameData)) {
      frameData = createImageData(frameData, this.width, this.height);
    }

    return {
      verticalFrameData: this._resizeFrameData(
        frameData,
        this.verticalContentSize
      ),
      horizontalFrameData: this._resizeFrameData(
        frameData,
        this.horizontalContentSize
      ),
    };
  }

  _resizeFrameData(frameData, targetSize) {
    const { width, height } = targetSize;
    return resizeImageData(
      frameData,
      this.width,
      this.height,
      width,
      height
    );
  }

  _formatSerialSegmentData(verticalFrameData, horizontalFrameData, addresses, flush) {
    let serialData = new Uint8Array();

    verticalFrameData = this._formatFrameData(verticalFrameData, this.verticalContentSize);
    horizontalFrameData = this._formatFrameData(horizontalFrameData, this.horizontalContentSize);

    this._loopPanels((panel, r, c) => {
      const verticalPanelData = this._parsePanelData(
        verticalFrameData,
        r,
        c,
        panel.verticalContentSize
      );
      const horizontalPanelData = this._parsePanelData(
        horizontalFrameData,
        r,
        c,
        panel.horizontalContentSize
      );

      if (addresses.includes(panel.address)) {
        panel.setVerticalContent(verticalPanelData);
        panel.setHorizontalContent(horizontalPanelData);
        serialData = concatTypedArrays(
          serialData,
          panel.getSerialFormat(flush)
        );
      }
    });

    return serialData;
  }

  get verticalContentSize() {
    const { width, height } = this._basePanel.verticalContentSize;
    return {
      width: width * this.cols,
      height: height * this.rows,
    };
  }

  get horizontalContentSize() {
    const { width, height } = this._basePanel.horizontalContentSize;
    return {
      width: width * this.cols,
      height: height * this.rows,
    };
  }
  
  send(frameData, flush = true) {
    const { verticalFrameData, horizontalFrameData } = this._prepareFrameData(frameData);
    this.sendSegmentData(verticalFrameData, horizontalFrameData, flush);
  }

  sendSegmentData(verticalFrameData, horizontalFrameData, flush = true) {
    if (!this.isConnected) {
      this._addQueueItem({verticalFrameData, horizontalFrameData, flush});
      return;
    }

    if (!this._isFrameChanged(verticalFrameData, horizontalFrameData)) return;

    verticalFrameData = this._validateFrameData(verticalFrameData, this.verticalContentSize);
    horizontalFrameData = this._validateFrameData(horizontalFrameData, this.horizontalContentSize);

    this.devices.forEach((device) => {
      const serialData = this._formatSerialSegmentData(
        verticalFrameData,
        horizontalFrameData,
        device.addresses,
        flush
      );

      this._write(device, serialData);
    });
  }

  _processQueue() {
    while (this.sendQueue.length > 0) {
      const { verticalFrameData, horizontalFrameData, flush} = this.sendQueue.shift();
      this.sendSegmentData(verticalFrameData, horizontalFrameData, flush);
    }
  }
}

const createDisplay = (layout, devicePath, options = {}) => {
  return (options.panel?.type?.style ===  PanelStyles.segment) ? 
    new SegmentDisplay(layout, devicePath, options) : 
    new Display(layout, devicePath, options)
};

exports.Display = Display;
exports.Panels = index;
exports.SegmentDisplay = SegmentDisplay;
exports.Utils = utils;
exports.createDisplay = createDisplay;
