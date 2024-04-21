import USBDevice from "./usb.js";
import NetworkDevice from "./network.js";

function deviceForInput(input) {
  if (input.match(/tty|cu/)) {
    return USBDevice;
  } else {
    return NetworkDevice;
  }
}

export {
  USBDevice,
  NetworkDevice,
  deviceForInput
}