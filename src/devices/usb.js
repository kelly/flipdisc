import Device from './device.js';
import { SerialPort } from 'serialport';
import { MockBinding } from '@serialport/binding-mock'

const BAUD_RATE_DEFAULT = 57600;

export default class USBDevice extends Device {
  static devices = [];
  static exitHandlersSet = false;

  constructor(path, addresses, baudRate, isMock) {
    super(path, addresses);
    this.baudRate = baudRate || BAUD_RATE_DEFAULT;
    this.autoOpen = true;
    this.isOpen = false;
    this.isMock = isMock;

    if (this.isMock) {
      MockBinding.createPort(path, { echo: false, record: true });
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

      this.port = new SerialPort(
        {
          path,
          baudRate,
          autoOpen,
          ...(this.isMock && { binding: MockBinding }),
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

    return SerialPort.list().then((ports) => {
      return !!ports.find((port) => port.path === path);
    });
  }
}