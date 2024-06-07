function concatTypedArrays(a, b) { // a, b TypedArray of same type
  var c = new (a.constructor)(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

function areArraysEqual(arr1, arr2) {
  // Check if the arrays have the same dimensions
  if (arr1.length !== arr2.length || arr1[0].length !== arr2[0].length) {
    return false;
  }

  const rows = arr1.length;
  const cols = arr1[0].length;

  // Flatten both arrays into typed arrays
  const flatArr1 = new Uint8Array(rows * cols);
  const flatArr2 = new Uint8Array(rows * cols);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      flatArr1[i * cols + j] = arr1[i][j];
      flatArr2[i * cols + j] = arr2[i][j];
    }
  }

  // Compare typed arrays
  for (let i = 0; i < flatArr1.length; i++) {
    if (flatArr1[i] !== flatArr2[i]) {
      return false;
    }
  }

  return true;
}

function packBits(content, axis, bitorder) {
  const numRows = content.length;
  const numCols = content[0].length;

  return Array.from({ length: axis === 0 ? numCols : numRows }, (_, i) => {
      let packedByte = 0;
      const range = axis === 0 ? numRows : numCols;
      for (let j = 0; j < range; j++) {
          const [row, col] = axis === 0 ? [j, i] : [i, j];
          if (content[row][col] !== 0) {
              packedByte |= 1 << (range - 1 - j);
          }
      }
      return bitorder === 'little' ? this.reverseBits(packedByte) : packedByte;
  });
}

function reverseBits(byte) {
  let result = 0;
  for (let i = 0; i < 8; i++) {
      result |= ((byte >> i) & 1) << (7 - i);
  }
  return result;
}

function mergeFrames(frameDatas, mergeStrategy = 'invert') {
  const numRows = frameDatas[0].length;
  const numCols = frameDatas[0][0].length;
  return Array.from({ length: numRows }, (_, i) => {
      return Array.from({ length: numCols }, (_, j) => {
          return frameDatas.reduce((acc, frameData) => {
              if (mergeStrategy === 'invert') {
                  return acc ^ frameData[i][j];
              } else {
                  return acc | frameData[i][j];
              }
          }, 0);
      });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function getLuminanceRGB(r, g, b) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5 ? 0 : 1;
}

function formatRGBAPixels(imageData) {
  const pixelArray = new Array(this.height)
  const width = this.width
  const height = this.height

  for (let y = 0; y < height; y++) {
    const row = new Array(width);
    const yWidth = y * width * 4;

    for (let x = 0; x < width; x++) {
      const i = yWidth + x * 4;
      row[x] = getLuminanceRGB(imageData[i], imageData[i + 1], imageData[i + 2]);
    }

    pixelArray[y] = row;
  }

  return pixelArray;
}

function isImageData(data) {
  if (!data) return false;
  return !Array.isArray(data[0])
}

function isEmptyArray(arr) {
  // if 1d or 2d array only has elements that are 0
  return arr.every(row => row.every(el => el === 0))
}


export { concatTypedArrays, packBits, reverseBits, sleep, mergeFrames, areArraysEqual, formatRGBAPixels, isImageData, isEmptyArray }