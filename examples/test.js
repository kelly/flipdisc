import { createDisplay, Panels } from '../index.js'

const device = '/dev/tty.usbserial-AB0OJSKG'
const layout = [[1], [2], [3], [4], [5], [6]]

const display = createDisplay(layout, device, { 
  isMirrored: true,
  panel: Panels.AlfaZetaPanel
})

const fill = (color) => {
  let frame = Array.from({ length: display.height }, () => Array.from({ length: display.width }, () => color));
  return frame;
}

const row = (color, row = 0) => {
  let frame = Array.from({ length: display.height }, () => Array.from({ length: display.width }, () => 0));
  frame[row] = Array.from({ length: display.width }, () => color)
  return frame;
}

const topLeftPixel = (color) => {
  let frame = Array.from({ length: display.height }, () => Array.from({ length: display.width }, () => 0));
  frame[0][0] = color
  return frame;
}

const border = (color, inset) => {
  let frame = Array.from({ length: display.height }, () => Array.from({ length: display.width }, () => 0));
  for (let y = 0; y < display.height; y++) {
    for (let x = 0; x < display.width; x++) {
      if (y < inset || x < inset || y >= display.height - inset || x >= display.width - inset) {
        frame[y][x] = color;
      }
    }
  }
  return frame;
}

let i = 0 
setInterval(() => {
  display.send(border(1, i))
  i = (i + 1) % 10
}, 1000)