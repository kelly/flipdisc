import PanelStyles from './styles.js';

export default class Panel {
  constructor( address, width, height, style = PanelStyles.dot) {
    this.address = address;
    this.width = width;
    this.height = height;
    this.style = style;
  }

  get _contentDefault()  {
    return Uint8Array.from({ length: this.height }, () => new Uint8Array(this.width).fill(0))
  }

  setContent(content) {
    this.content = content
  }

  isSegment() {
    return this.style === PanelStyles.segment
  }

  isDot() {
    return this.style === PanelStyles.dot
  }

  getSerialFormat(options) {
    console.warn('getSerialFormat not implemented')
  }
}