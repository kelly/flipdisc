# flipdisc

A javascript library for flipdot and flipdisc displays.

![panel](https://github.com/kelly/flipdisc/assets/36345/d047c0b2-4fda-4fbf-9702-5808e23f5a3f)


## Install

````bash
$ npm install flipdisc
````

## Simple Usage

```javascript

import { createDisplay } from 'flipdisc' // ...or const { createDisplay } = require('flipdisc')

const display = createDisplay([[1], [2]], '/dev/cu.usbserial-AB0OJSKG') // ... or network address of RS485 server e.g. 'tcp://192.168.1.100:3000'
display.send(frameData)

````

## Advanced Usage 

```javascript

import { createDisplay } from 'flipdisc' 

// layout as a 2D array of panel addresses
const layout = [[1, 3, 5], [2, 4, 6]]

// supports multiple RS485 devices
const devices = [{
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


const options = {
  isMirrored: true,
  rotation: 90,
  panel: {
    width: 28,
    height: 7,
    type: 'AlfaZeta' // or 'Hanover'
  }

}
const display = createDisplay(layout, device, options)
````


## Methods

```javascript

// send a single 2D array of frame data. (0 = not-flipped, 1 = flipped)
display.send(frameData)

// send imageData from a gl or canvas instance
display.sendImageData(imageData)

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


````

## Requirements

- RS485 serial device. e.g. [USB to RS485] (https://a.co/d/7IHOosr) or [Ethernet to RS485] (https://a.co/d/1TIwvfq)
- A flipdisc panel. Currently [AlfaZeta panels](https://flipdots.com/en/home/) and [Hanover panels](https://www.hanoverdisplays.com/) supported. [Reach out](http://x.com/korevec) if you want me to support your panel.

## Projects

*Coming Soon!*
