import PanelStyles from './styles.js';

export default class Panel {
  constructor(address, width, height) {
    this.address = address;
    this.width = width;
    this.height = height;
    this._content = this.defaultContent();
  }

  defaultContent() {
    return Array.from({ length: this.height }, () => new Uint8Array(this.width).fill(0));
  }

  setContent(content) {
    this._content = content;
  }

  get content() {
    return this._content;
  }

  set content(content) {
    this._content = content;
  }

  static get style() {
    return PanelStyles.dot;
  }

  getSerialFormat(options) {
    console.warn('getSerialFormat not implemented');
  }
}