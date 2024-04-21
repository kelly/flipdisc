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
    super.write(data, callback);
    this.port.write(data, callback);
  }

  close() {
    this.removeAllListeners();
    this.port.removeAllListeners();
    this.port.close();
    this.isOpen = false;
  }
}
