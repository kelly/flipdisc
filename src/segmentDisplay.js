import Display from './display.js';
import * as Utils from './utils.js';

export default class SegmentDisplay extends Display {
  constructor(layout, devices, options = {}) {
    super(layout, devices, options);
  }

  _prepareFrameData(frameData) {
    if (!Utils.isImageData(frameData)) {
      frameData = Utils.createImageData(frameData, this.width, this.height);
    }

    return {
      verticalFrameData: this._resizeFrameData(
        frameData,
        this.verticalContentSize
      ),
      horizontalFrameData: this._resizeFrameData(
        frameData,
        this.horizontalContentSize
      ),
    };
  }

  _resizeFrameData(frameData, targetSize) {
    const { width, height } = targetSize
    return Utils.resizeImageData(
      frameData,
      this.width,
      this.height,
      width,
      height
    );
  }

  _formatSerialSegmentData(verticalFrameData, horizontalFrameData, addresses, flush) {
    let serialData = new Uint8Array();

    verticalFrameData = this._formatFrameData(verticalFrameData, this.verticalContentSize);
    horizontalFrameData = this._formatFrameData(horizontalFrameData, this.horizontalContentSize);

    this._loopPanels((panel, r, c) => {
      const verticalPanelData = this._parsePanelData(
        verticalFrameData,
        r,
        c,
        panel.verticalContentSize
      );
      const horizontalPanelData = this._parsePanelData(
        horizontalFrameData,
        r,
        c,
        panel.horizontalContentSize
      );

      if (addresses.includes(panel.address)) {
        panel.setVerticalContent(verticalPanelData);
        panel.setHorizontalContent(horizontalPanelData);
        serialData = Utils.concatTypedArrays(
          serialData,
          panel.getSerialFormat(flush)
        );
      }
    });

    return serialData;
  }

  get verticalContentSize() {
    const { width, height } = this._basePanel.verticalContentSize;
    return {
      width: width * this.cols,
      height: height * this.rows,
    };
  }

  get horizontalContentSize() {
    const { width, height } = this._basePanel.horizontalContentSize;
    return {
      width: width * this.cols,
      height: height * this.rows,
    };
  }
  
  send(frameData, flush = true) {
    const { verticalFrameData, horizontalFrameData } = this._prepareFrameData(frameData);
    this.sendSegmentData(verticalFrameData, horizontalFrameData, flush);
  }

  sendSegmentData(verticalFrameData, horizontalFrameData, flush = true) {
    if (!this.isConnected) {
      this._addQueueItem({verticalFrameData, horizontalFrameData, flush})
      return;
    }

    if (!this._isFrameChanged(verticalFrameData, horizontalFrameData)) return;

    verticalFrameData = this._validateFrameData(verticalFrameData, this.verticalContentSize);
    horizontalFrameData = this._validateFrameData(horizontalFrameData, this.horizontalContentSize);

    this.devices.forEach((device) => {
      const serialData = this._formatSerialSegmentData(
        verticalFrameData,
        horizontalFrameData,
        device.addresses,
        flush
      );

      this._write(device, serialData);
    });
  }

  _processQueue() {
    while (this.sendQueue.length > 0) {
      const { verticalFrameData, horizontalFrameData, flush} = this.sendQueue.shift();
      this.sendSegmentData(verticalFrameData, horizontalFrameData, flush)
    }
  }
}