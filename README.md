# flipdisc

A javascript library for flipdot and flipdisc displays.

## Install

````bash
$ npm install flipdisc
````

## Simple Usage

```javascript

import { createDisplay } from 'flipdisc' // ...or const { createDisplay } = require('flipdisc')

const display = createDisplay([[1], [2]], '/dev/cu.usbserial-AB0OJSKG')
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
  bausdRate: 57600
}]
const options = {
  isMirrored: true,
  rotation: 90,
  panelWidth: 28,
  panelHeight: 14

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
display.width()

// get height
display.height()

// get current display data
display.getContent()

// set inverted
display.setInverted()

````


## Requirements

- RS485 serial device. e.g. [USB to RS485] (https://a.co/d/7IHOosr)
- A flipdisc panel. Currently [AlfaZeta panels](https://flipdots.com/en/home/) supported. [Reach out](http://x.com/korevec) if you want me to support your panel.

## Projects

*Coming Soon!*