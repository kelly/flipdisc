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

    if (!this._queueListenerSet) {
      this._queueListenerSet = true;
      this.once('open', () => {
        const pending = this.queue.slice();
        this.queue = [];
        this._queueListenerSet = false;
        pending.forEach(item => this.write(item));
      });
    }

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