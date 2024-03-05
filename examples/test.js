import Display from '../src/display.js'
import Utilities from '../src/utilities.js'

const flipdisc = new Display([[1], [2]], '/dev/cu.usbserial-AB0OJSKG')

while (true) {
  // Turn entire screen from black to white 10 times
  for (let i = 0; i < 10; i++) {
    // Set whole panel to black
    let frame = Array.from({ length: flipdisc.height }, () => Array.from({ length: flipdisc.width }, () => 0));
    flipdisc.send(frame)
    await Utilities.sleep(400)

    // Set whole panel to white
    frame = Array.from({ length: flipdisc.height }, () => Array.from({ length: flipdisc.width }, () => 1));
    flipdisc.send(frame)
    await Utilities.sleep(400)
  }
}