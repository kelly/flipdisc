import EventEmitter from 'events';

export default class Device extends EventEmitter {
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
    })

    if (this.queue.length > this.maxQueueLength) 
      this.queue.shift()
  }

  open(callback) {}
  write(data, callback) {
    if (!this.isOpen) {
      this._addToQueue(data, callback);
      return;
    };
  }

  close() {}


}