import { SerialPort } from 'serialport'
import Panel from './panel.js'
import { concatTypedArrays, sleep } from './utilities.js'

const BAUD_RATE_DEFAULT = 57600

export default class Display {
  constructor(layout, devices, options) {
    this.panels = [];
    this.devices = []
    this.rotation = options.rotation,
    this.isMirrored = options.isMirrored

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
    this._initDevices(devices)
  }


  _initDevices(devices) {
    devices = (devices.constructor !== Array) ? [devices] : devices
    devices.forEach(device => {
      this._initSerialPort(device)
    })
  }

  _initSerialPort(device) {
    if (device.constructor === String) { 
      device = {
        path: device,
        addresses: this.panels.flat().map(panel => panel.address) // map all addresses if not specified 
      }
    }

    device.port = new SerialPort({ 
      path: device.path, 
      baudRate: device.baudRate || BAUD_RATE_DEFAULT,
      autoOpen: true,
      function (err) {
        if (err) {
          throw new Error('Serial Error: ', err.message)
        }
      }
    })

    this.devices.push(device)
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
      frameData = this._rotate(frameData, this.rotation)
    }

    if (this.isMirrored) {
      frameData = this._mirror(frameData)
    }

    if (this.isInverted) {
      frameData = this._invert(frameData)
    }

    return frameData
  }

  _getLuminanceRGB(r, g, b) {
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5 ? 0 : 1;
  }

  _formatRGBAPixels(imageData) {
    const pixelArray = new Array(this.height)
    const width = this.width
    const height = this.height

    for (let y = 0; y < height; y++) {
      const row = new Array(width);
      const yWidth = y * width * 4;

      for (let x = 0; x < width; x++) {
        const i = yWidth + x * 4;
        row[x] = this._getLuminanceRGB(imageData[i], imageData[i + 1], imageData[i + 2]);
      }

      pixelArray[y] = row;
    }

    return pixelArray;
  }

  _formatSerialData(frameData, addresses, flush) {
    let serialData = new Uint8Array()
    frameData = this._formatOrientation(frameData)

    for (let r = 0; r < this.panels.length; r++) {
      const row = this.panels[r];

      for (let c = 0; c < row.length; c++) {
        const panel = row[c];
        const panelWidth = this._basePanel.width
        const panelHeight = this._basePanel.height

        const panelData = frameData.slice(r * panelHeight, (r + 1) * panelHeight)
          .map(row => row.slice(c * panelWidth, (c + 1) * panelWidth));

        if (addresses.indexOf(row[c].address) !== -1) {
          // add to serial data if address is in the list
          panel.setContent(panelData);
          serialData = concatTypedArrays(serialData, panel.getSerialFormat(flush))
        }
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
    return this.panels.map(row => row.map(panel => panel.content));
  }

  sendImageData(imageData) {
    const pixels = this._formatRGBAPixels(imageData)
    this.send(pixels)
  }

  _sendToDevice(device, frameData, flush) {
    if (!device.port.isOpen) {
      return device.port.on('open', () => {
        sleep(1000)
        this._sendToDevice(device, frameData, flush)
      })
    }
    const serialData = this._formatSerialData(frameData, device.addresses, flush = true)
    device.port.write(serialData, function(err) {
      if (err) {
        return console.log('Error on write: ', err.message)      
      }
    })
  }
 
  send(frameData, flush) {
    if (this.devices.length === 0) {
      throw new Error('No serial ports available')
    }
    this.devices.forEach(device => {
      this._sendToDevice(device, frameData, flush)
    })
  }
}