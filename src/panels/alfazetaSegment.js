import AlfaZetaPanel from './alfazeta.js';
import PanelStyles from './styles.js';

const PANEL_DIGIT_VERTICAL_SIZE = { width: 2, height: 2 };
const PANEL_DIGIT_HORIZONTAL_SIZE = { width: 1, height: 3 };
const PANEL_WIDTH_DEFAULT = 7
const PANEL_HEIGHT_DEFAULT = 4
const PANEL_SEGMENT_COUNT = 7;

///    6
/// -------
/// |     |
/// | 1   | 5
/// |     |
/// -------
/// |  0  | 
/// | 2   | 4
/// |     |
/// -------
///    3

const PANEL_SEGMENTS = {
  VERTICAL: [1, 5, 2, 4], // Top Left, Top Right, Bottom Left, Bottom Right
  HORIZONTAL: [6, 0, 3],   // Top, Middle, Bottom
};

export default class AlfaZetaSegmentPanel extends AlfaZetaPanel {
  constructor(address, width = PANEL_WIDTH_DEFAULT, height = PANEL_HEIGHT_DEFAULT) {
    super(address, width, height);
    this._content = Array.from({ length: this.width * this.height }, () => Array(PANEL_SEGMENT_COUNT).fill(0));
  }

  // Virtual sizes are needed because each segment is essentially a 2x3 display
  get virtualWidth() {
    return this.width * PANEL_DIGIT_VERTICAL_SIZE.width;
  }

  get virtualHeight() {
    return this.height * PANEL_DIGIT_HORIZONTAL_SIZE.height;
  }

  setVerticalContent(content) {
    this._setSegmentContent(
      content,
      PANEL_DIGIT_VERTICAL_SIZE,
      PANEL_SEGMENTS.VERTICAL
    );
  }

  setHorizontalContent(content) {
    this._setSegmentContent(
      content,
      PANEL_DIGIT_HORIZONTAL_SIZE,
      PANEL_SEGMENTS.HORIZONTAL
    );
  }

  _setSegmentContent(content, digitSize, segmentIndices) {
    const slicedContent = this._sliceContent(content, digitSize);
    slicedContent.forEach((slice, i) => {
      segmentIndices.forEach((segmentIndex, j) => {
        this._content[i][segmentIndex] = slice[j];  
      });
    });

  }

  _sliceContent(content, { width, height }) {
    const rows = Math.floor(content.length / height);
    const cols = Math.floor(content[0].length / width);
    const sliced = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const slice = content
          .slice(r * height, (r + 1) * height)
          .flatMap(row => row.slice(c * width, (c + 1) * width));
        sliced.push(slice);
      }
    }
    return sliced;
  }

  get content() {
    return this.segments.map(segment => {
      segment = segment.slice().reverse();
      return parseInt(segment.join(''), 2)
    })
  }

  get segments() {
    // an alias for content
    return this._content;
  }

  get horizontalContentSize() {
    return {
      width: PANEL_DIGIT_HORIZONTAL_SIZE.width * this.width,
      height: PANEL_DIGIT_HORIZONTAL_SIZE.height * this.height,
    }
  }

  get verticalContentSize() {
    return {
      width: PANEL_DIGIT_VERTICAL_SIZE.width * this.width,
      height: PANEL_DIGIT_VERTICAL_SIZE.height * this.height,
    }
  }

  static get style() {
    return PanelStyles.segment;
  }
}