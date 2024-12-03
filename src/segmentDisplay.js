import Display from './display.js';
import * as Utils from './utils.js';

export default class SegmentDisplay extends Display {
  constructor(layout, devices, options = {}) {
    super(layout, devices, options);
  }

  _sendToDevice(device, frameData, flush) {
    const { verticalFrameData, horizontalFrameData } = this._prepareFrameData(frameData);
    this._sendFrameDataToDevice(device, verticalFrameData, horizontalFrameData, flush);
  }

  _prepareFrameData(frameData) {
    if (!Utils.isImageData(frameData)) {
      frameData = Utils.createImageData(frameData, this.width, this.height);
    }

    return {
      verticalFrameData: this._resizeFrameData(
        frameData,
        this._segmentDisplayVerticalSize
      ),
      horizontalFrameData: this._resizeFrameData(
        frameData,
        this._segmentDisplayHorizontalSize
      ),
    };
  }

  _resizeFrameData(frameData, targetSize) {
    return Utils.resizeImageData(
      frameData,
      this.width,
      this.height,
      targetSize.width,
      targetSize.height
    );
  }

  _sendFrameDataToDevice(device, verticalFrameData, horizontalFrameData, flush) {
    const serialData = this._formatSerialSegmentData(
      verticalFrameData,
      horizontalFrameData,
      device.addresses,
      flush
    );

    device.write(serialData, (err) => {
      if (err) console.warn('Error on write:', err.message);
    });
  }

  _formatSerialSegmentData(verticalFrameData, horizontalFrameData, addresses, flush) {
    let serialData = new Uint8Array();

    verticalFrameData = this._formatFrameData(
      verticalFrameData,
      this._segmentDisplayVerticalSize.width,
      this._segmentDisplayVerticalSize.height
    );
    horizontalFrameData = this._formatFrameData(
      horizontalFrameData,
      this._segmentDisplayHorizontalSize.width,
      this._segmentDisplayHorizontalSize.height
    );

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

  get _segmentDisplayVerticalSize() {
    const { width, height } = this._basePanel.verticalContentSize;
    return {
      width: width * this.cols,
      height: height * this.rows,
    };
  }

  get _segmentDisplayHorizontalSize() {
    const { width, height } = this._basePanel.horizontalContentSize;
    return {
      width: width * this.cols,
      height: height * this.rows,
    };
  }

  sendSegmentData(verticalFrameData, horizontalFrameData, flush = true) {
    if (this.devices.length === 0) {
      throw new Error('No serial ports available');
    }

    verticalFrameData = this._validateFrameData(verticalFrameData);
    horizontalFrameData = this._validateFrameData(horizontalFrameData);

    const now = Date.now();
    if (this.lastSendTime && now - this.lastSendTime < this.minSendInterval) {
      console.warn('Rendering too quickly. You might be calling render incorrectly');
    }

    this.lastSendTime = now;

    this.devices.forEach((device) => {
      this._sendFrameDataToDevice(device, verticalFrameData, horizontalFrameData, flush);
    });
  }
}
