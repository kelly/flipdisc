import EventEmitter from 'events';
import * as Utils from './utils.js';
import * as Panels from './panels/index.js';
import * as Devices from './devices/index.js';

const defaults = {
  rotation: 0,
  isMirrored: false,
  isInverted: false,
  isMockTesting: false,
  panel: {
    width: 28,
    height: 7,
    type: Panels.AlfaZetaPanel
  },
};

const MIN_SEND_INTERVAL_MS = 5;
const MAX_QUEUE_LENGTH = 100;

export default class Display extends EventEmitter {
  constructor(layout, devices, options = {}) {
    super();
    options = { ...defaults, ...options };
    this.panels = [];
    this.devices = [];
    this.rotation = options.rotation;
    this.isMirrored = options.isMirrored;
    this.isInverted = options.isInverted;
    this.isMockTesting = options.isMockTesting;
    this.lastSendTime = null;
    this.minSendInterval = MIN_SEND_INTERVAL_MS;
    this.lastFrameData = null;
    this.isConnected = false;
    this._connectionError = null;
    this._frameBuffer = null;
    this.sendQueue = [];
    this.maxSendQueueLength = MAX_QUEUE_LENGTH;
    this.warnings = {}

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
        this._connectionError = err;
        if (this.listenerCount('error') > 0) {
          this.emit('error', err);
        } else {
          console.error('Failed to connect devices:', err);
        }
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

      const Device = Devices.deviceForInput(args.path);
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
    this.emit('connected');
  }

  ready() {
    if (this.isConnected) return Promise.resolve();
    if (this._connectionError) return Promise.reject(this._connectionError);
    return new Promise((resolve, reject) => {
      this.once('connected', resolve);
      this.once('error', reject);
    });
  }

  _closeDevices() {
    this.devices.forEach((device) => {
      device.removeAllListeners();
      device.close();
    });
  }

  _initPanels(layout, options) {
    const { width, height, type } = options;
    const Panel = options.prototype instanceof Panels.Panel ? options : type || Panels.AlfaZetaPanel;
    this.panels = layout.map((row) =>
      row.map((address) => new Panel(address, width, height))
    );
  }

  setInverted(isInverted) {
    this.isInverted = isInverted;
  }

  clear() {
    const frame = Array.from({ length: this.height }, () => new Array(this.width).fill(0));
    this.send(frame);
  }

  fill(value = 1) {
    const frame = Array.from({ length: this.height }, () => new Array(this.width).fill(value));
    this.send(frame);
  }

  close() {
    this.isConnected = false;
    this._closeDevices();
    this.emit('disconnected');
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
    const chunks = [];
    let totalLength = 0;

    this._loopPanels((panel, r, c) => {
      const panelData = this._parsePanelData(frameData, r, c);
      if (addresses.includes(panel.address)) {
        panel.setContent(panelData);
        const chunk = panel.getSerialFormat(flush);
        chunks.push(chunk);
        totalLength += chunk.length;
      }
    });

    const serialData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      serialData.set(chunk, offset);
      offset += chunk.length;
    }
    return serialData;
  }

  _parsePanelData(frameData, r, c, size = { width: this.panelWidth, height: this.panelHeight }) {
    const { width, height } = size;
    return frameData
      .slice(r * height, (r + 1) * height)
      .map((row) => row.slice(c * width, (c + 1) * width));
  }

  _formatFrameData(frameData, size = { width: this.width, height: this.height }) {
    if (Utils.isImageData(frameData)) {
      frameData = Utils.formatRGBAPixels(frameData, size.width, size.height);
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
    const isImageData = Utils.isImageData(frameData);
    const imageLen = size.width * size.height * 4;
    const len = frameData.length;
    const rowLen = frameData[0]?.length;

    if (Array.isArray(frameData) && len > 0) { 
      if ((!isImageData && (len !== size.height || rowLen !== size.width)) || 
          (isImageData && (len !== imageLen))) {
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
    const current = frameData.length === 1 ? frameData[0] : frameData;
    const isNew = !Utils.isFrameEqual(current, this.lastFrameData);

    if (isNew) {
      this.lastFrameData = current;

      const now = Date.now();
      if (!this.warnings.renderingSpeed && this.lastSendTime && now - this.lastSendTime < this.minSendInterval) {
        this.warnings.renderingSpeed = true;
        console.warn('Rendering too quickly. You might be calling render incorrectly');
      }
      this.lastSendTime = now;
    }

    return isNew;
  }

  _reshapeIfFlat(frameData) {
    if (Array.isArray(frameData) && frameData.length > 0 && !Array.isArray(frameData[0])
        && frameData.length === this.width * this.height) {
      const reshaped = [];
      for (let y = 0; y < this.height; y++) {
        reshaped.push(frameData.slice(y * this.width, (y + 1) * this.width));
      }
      return reshaped;
    }
    return frameData;
  }

  send(frameData, flush = true) {
    if (!this.isConnected) {
      this._addQueueItem({frameData, flush})
      return;
    }
    frameData = this._reshapeIfFlat(frameData);
    frameData = this._validateFrameData(frameData);

    if (!this._isFrameChanged(frameData)) return;

    // Keep frame buffer in sync for sendRegion
    if (Array.isArray(frameData[0])) {
      this._frameBuffer = frameData.map(row => [...row]);
    }

    const formattedData = this._formatFrameData(frameData);

    this.devices.forEach((device) => {
      const serialData = this._formatSerialData(formattedData, device.addresses, flush);
      this._write(device, serialData);
    });
  }

  sendRegion(regionData, x, y) {
    if (!this._frameBuffer) {
      this._frameBuffer = Array.from({ length: this.height }, () => new Array(this.width).fill(0));
    }

    const regionHeight = regionData.length;
    const regionWidth = regionData[0].length;

    for (let ry = 0; ry < regionHeight; ry++) {
      for (let rx = 0; rx < regionWidth; rx++) {
        const ty = y + ry;
        const tx = x + rx;
        if (ty >= 0 && ty < this.height && tx >= 0 && tx < this.width) {
          this._frameBuffer[ty][tx] = regionData[ry][rx];
        }
      }
    }

    const frame = this._frameBuffer.map(row => [...row]);
    this.send(frame);
  }

  _addQueueItem(data) {
    this.sendQueue.push(data);
    if (this.sendQueue.length > this.maxSendQueueLength) {
      this.sendQueue.shift();
      if (!this.warnings.queueFull) {
        this.warnings.queueFull = true;
        console.warn('Send queue is full, discarding the latest frame');
      }
    }
  }

  async _processQueue() {
    while (this.sendQueue.length > 0) {
      const { frameData, flush } = this.sendQueue.shift();
      this.send(frameData, flush);   
      await Utils.sleep(10);
    }
  }
}
