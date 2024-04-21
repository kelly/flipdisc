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

    this.socket = protocol == 'udp' ? udp.createSocket('udp4') : new net.Socket();
    this.socket.connect(port, hostname, () => {
      console.log(`opened connection: ${protocol} port: ${port} hostname: ${hostname}`)

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