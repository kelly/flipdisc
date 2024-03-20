import { createDisplay } from '../index.js'

const display = createDisplay([[1], [2]], '/dev/cu.usbserial-AB0OJSKG', { isMirrored: true })

const sleep = (ms) => { return new Promise(r => setTimeout(r, ms)) }

const fill = (color) => {
  let frame = Array.from({ length: display.height }, () => Array.from({ length: display.width }, () => color));
  return frame;
}

while (true) {
  display.send(fill(0))
  await sleep(400)

  display.send(fill(1))
  await sleep(400)
}