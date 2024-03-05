export default {
  concatTypedArrays(a, b) { // a, b TypedArray of same type
    var c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  },

  packBits(content, axis, bitorder) {
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
  },

  reverseBits(byte) {
    let result = 0;
    for (let i = 0; i < 8; i++) {
        result |= ((byte >> i) & 1) << (7 - i);
    }
    return result;
  },


  sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
}