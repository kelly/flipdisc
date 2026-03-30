import Device from './device.js';
import { ConnectionString } from 'connection-string';
import net from 'net';
import udp from 'node:dgram';

export default class NetworkDevice extends Device {
  constructor(path, addresses) {
    super(path, addresses);
    this.connection = this.parseConnectionString(path);
  }

  parseConnectionString(connectionString) {
    const parsed = new ConnectionString(connectionString);
    if (!parsed.protocol || !parsed.host || !parsed.port) 
      throw new Error('invalid connection string');
    if (parsed.protocol !== 'tcp' && parsed.protocol !== 'udp') 
      throw new Error('invalid protocol');
    
    return parsed;
  }

  open(callback) {
    const { port, hostname, protocol } = this.connection;
    this.protocol = protocol;

    if (protocol === 'udp') {
      this.socket = udp.createSocket('udp4');
      this.remotePort = port;
      this.remoteHost = hostname;
      console.log(`opened connection: ${protocol} port: ${port} hostname: ${hostname}`);
      this.isOpen = true;
      this.emit('open');
      callback();
    } else {
      this.socket = new net.Socket();
      this.socket.connect(port, hostname, () => {
        console.log(`opened connection: ${protocol} port: ${port} hostname: ${hostname}`);
        this.isOpen = true;
        this.emit('open');
        callback();
      });
      this.socket.on('error', (err) => {
        console.error(`Network error: ${err.message}`);
      });
    }
  }

  write(data, callback) {
    super.write(data, callback);
    if (this.protocol === 'udp') {
      this.socket.send(data, this.remotePort, this.remoteHost, callback);
    } else {
      this.socket.write(data, callback);
    }
  }

  close() {
    this.removeAllListeners();
    if (this.socket) {
      this.socket.removeAllListeners();
      if (this.protocol === 'udp') {
        this.socket.close();
      } else {
        this.socket.destroy();
      }
    }
    this.isOpen = false;
  }

}