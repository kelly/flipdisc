# flipdisc

A javascript library for flip dot, flip disc, and flip digit displays.

![panel](https://github.com/kelly/flipdisc/assets/36345/d047c0b2-4fda-4fbf-9702-5808e23f5a3f)

- [flip disc website](https://flipdisc.io/)
- [Github](http://www.github.com/kelly/flipdisc)
- [NPM](https://www.npmjs.com/package/flipdisc)

### Examples

- [flip digit server](https://github.com/kelly/flipdisc-server) draw elaborate visualizations on your flipdisc
- [flipdot iOS app](https://apps.apple.com/us/app/flipdisc/id6504055618) control your flipdisc from iOS
- [depth camera](https://github.com/kelly/flipdisc-depth-camera) 
- [flip digit canvas](https://github.com/kelly/flipdigit)

### Install

```bash
$ npm install flipdisc
```

### Simple Usage

```js

import { createDisplay } from 'flipdisc' 

const device = '/dev/cu.usbserial-AB0OJSKG' 
const display = createDisplay([[1], [2]], device)
display.send(frameData)

```

### Advanced Usage 

```js

import { createDisplay, Panels } from 'flipdisc' 

// layout as a 2D array of panel addresses
const layout = [[1, 3, 5], [2, 4, 6]]

// supports multiple RS485 devices
const dev = [{
  path: '/dev/cu.usbserial-AB0OJSKG',
  addresses: [1, 3, 5],
  baudRate: 57600
}, {
  path: '/dev/cu.usbserial-AB0ODKET',
  addresses: [2, 4, 6],
  baudRate: 57600
}]

// or network devices
const devices = [{
  path: 'tcp://192.168.0.100:3000',
  addresses: [1, 2, 3, 4, 5, 6],
}]


const opt = {
  isMirrored: true,
  rotation: 90,
  panel: {
    width: 28,
    height: 7,
    type: Panels.AlfaZetaPanel
  }
}

// or flipdigit
const opt = {
  panel: Panels.AlfaZetaSegmentPanel
}


const display = createDisplay(layout, dev, opt)
```


### Methods

```js

// send a single 2D array of frame data. 
// (0 = not-flipped, 1 = flipped)
display.send(frameData)
// also accepts imageData buffer from a gl or canvas instance

display.sendSegmentData(verticalSegmentData, horizontalSegmentData)
// for segment displays: send array data for the vertical and/or horizontal aligned segments. 

// get width
display.width

// get height
display.height

// get current display data
display.content

// set inverted
display.setInverted()

// get general display info
display.info


```

### Requirements

- RS485 serial device. e.g. [USB to RS485] (https://a.co/d/7IHOosr) or [Ethernet to RS485] (https://a.co/d/1TIwvfq)
- A flipdisc panel. Currently [AlfaZeta panels](https://flipdots.com/en/home/) and [Hanover panels](https://www.hanoverdisplays.com/) supported. [Reach out](http://x.com/korevec) if you want me to support your panel.


