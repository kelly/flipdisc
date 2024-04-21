import { createDisplay } from '../index.js'

const display = createDisplay([[1], [2]], '/dev/cu.usbserial-B0027K5M', { isMirrored: true })

const fill = (color) => {
  let frame = Array.from({ length: display.height }, () => Array.from({ length: display.width }, () => color));
  return frame;
}

setInterval(() => {
  display.send(fill(0))
}, 1000)

setInterval(() => {
  display.send(fill(1))
}, 500)
