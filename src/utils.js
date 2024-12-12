import { createHash } from 'node:crypto';

function hashFrameData(...arrays) {
  const flatData = flatten(arrays);
  const buffer = Buffer.from(flatData);
  const hash = createHash('md5').update(buffer).digest('hex');
  return hash;
}

function flatten(arr) {
  return arr.reduce((acc, val) => {
    return acc.concat(Array.isArray(val) ? flatten(val) : val);
  }, []);
}

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

function getLuminanceRGB(r = 0, g = 0, b = 0) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5 ? 0 : 1;
}

function createImageData(data, width, height) {
  // convert an array from  [[1, 1, 1, 1], [0, 1, 0, 1]] to RGBA format
  const imageData = new Uint8ClampedArray(width * height * 4); // Output RGBA array
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const value = data[y][x] * 255;
      imageData[i] = value;       // Red
      imageData[i + 1] = value; // Green
      imageData[i + 2] = value; // Blue
      imageData[i + 3] = 255; // Alpha
    }
  }     
  return imageData;
}

function resizeImageData(imageData, width, height, newWidth, newHeight) {
  if (width === newWidth && height === newHeight) {
    return imageData
  }
  
  const resizedData = new Uint8ClampedArray(newWidth * newHeight * 4); // Output RGBA array
  const xRatio = width / newWidth;
  const yRatio = height / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const nearestX = Math.floor(x * xRatio);
      const nearestY = Math.floor(y * yRatio);
      const index = (y * newWidth + x) * 4;
      const nearestIndex = (nearestY * width + nearestX) * 4;

      // Copy RGBA values
      resizedData[index] = imageData[nearestIndex];       // Red
      resizedData[index + 1] = imageData[nearestIndex + 1]; // Green
      resizedData[index + 2] = imageData[nearestIndex + 2]; // Blue
      resizedData[index + 3] = imageData[nearestIndex + 3]; // Alpha
    }
  }

  return Array.from(resizedData); 
}

function formatRGBAPixels(imageData, width, height) {
  const pixelArray = new Array(height)

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


export { concatTypedArrays, packBits, reverseBits, sleep, mergeFrames, areArraysEqual, 
        formatRGBAPixels, isImageData, isEmptyArray, resizeImageData, createImageData, hashFrameData }