export default class Panel {
  constructor( address, width, height) {
    this.address = address;
    this.width = width;
    this.height = height;
  }

  get _contentDefault()  {
    return Uint8Array.from({ length: this.height }, () => new Uint8Array(this.width).fill(0))
  }

  setContent(content) {
    this.content = content
  }

  getSerialFormat(options) {
    console.warn('getSerialFormat not implemented')
  }
}