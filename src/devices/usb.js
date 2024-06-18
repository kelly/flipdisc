import Device from './device.js';
import { SerialPort } from 'serialport'

const BAUD_RATE_DEFAULT = 57600

export default class USBDevice extends Device {

  constructor(path, addresses, baudRate) {
    super(path, addresses);
    this.baudRate = baudRate || BAUD_RATE_DEFAULT
    this.autoOpen = true;
  }

  open(callback) {
    const { path, baudRate, autoOpen } = this

    if (!this._isSerialAvailable(path)) {
      console.warn(`USB device not available: ${path}`)
      return;
    }

    this.port = new SerialPort({ 
      path,
      baudRate,
      autoOpen
    }, (err) => {
      if (err) {
        throw new Error(err)
      } else {
        console.log(`opened USB device: ${this.path} baud rate: ${this.baudRate}`)
        this.isOpen = true;
        this.emit('open')
        callback()
      }
    }
  )}
  
  write(data, callback) {
    if (!this.port) return;

    super.write(data, callback);
    this.port.write(data, callback);
  }

  close() {
    if (!this.port) return;

    this.removeAllListeners();
    this.port.removeAllListeners();
    this.port.close();
    this.isOpen = false;
  }

  _isSerialAvailable(path) {
    SerialPort.list().then(ports => {
      return !!ports.find(port => port.path === path);
    }
  )}
}
