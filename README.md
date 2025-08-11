# WebMIDI Device Configuration

A simple configuration tool for small MIDI devices. It runs in the web browser on a desktop or mobile phone without the need to download or install any additional software. It is suited for devices which do not have a network connection themselves.

The Web browser connects over [webMIDI](https://webaudio.github.io/web-midi-api/#extensions-to-the-navigator-interface) to the MIDI device. The messages between the browser and the device are [MIDI System Exclusive](https://en.wikipedia.org/wiki/MIDI#System_Exclusive_messages) messages.

The used MIDI System Exclusive ID is the _research/private ID_ `0x7d`. The  messages contain a single valid [JSON](https://www.json.org/json-en.html) object. The first byte of the message must be `{`, the last byte must be `}`. All unicode codepoints must be escaped with the `\u0000` notation to satisfy the MIDI 7 bit byte stream requirement; escaping and unescaping must support unicode [surrogate pairs](https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF).

All messages use the globally unique object `com.versioduo.device` with a simple method call convention.

The devices implement the JSON interface with [V2Device](https://github.com/versioduo/V2Device/) and send and receive MIDI System Exclusive messages with [V2MIDI](https://github.com/versioduo/V2MIDI/).

:bulb: _This application is copied into client-side storage; it can be used without an active network connection. Alternatively, this repository can be cloned or downloaded and used offline; it is fully self-contained, does not require or load anything from external resources._

## Request

A host connects to the device and calls the method `getAll()` of `com.versioduo.device`:

```json
{
  "com.versioduo.device": {
    "method": "getAll"
  }
}
```

## Reply

The device replies with a `com.versioduo.device` object.

### Metadata Section

The `metadata` object is a human-readable flat list of key/value pairs which describe the device.

### System Section

The `system` object is machine-readable information about the device, like the USB name, the number of MIDI ports, the available memory, ...

### Settings Section

The `settings` entries point to data objects in the configuration section, they provide metadata and properties to specific settings plugins.

### Configuration Section

The `configuration` object is the entire custom configuration of the device. The device configuration can be edited, and updated by calling the `writeConfiguration()` method with a new `configuration` object. The device is reset to factory defaults by calling the `eraseConfiguration()` method.

### MIDI Input Section

The `input` object lists the notes and controllers the device sends.

### MIDI Output Section

The `output` object lists the notes and controllers the device listens to.

## Example

A reply from the device:

```json
"com.versioduo.device": {
  "token": 2452833130,
  "metadata": {
    "vendor": "Versio Duo",
    "product": "glockenspiel-37",
    "description": "37 Bar Glockenspiel",
    "home": "https://versioduo.com/#glockenspiel-37",
    "serial": "4A7E4D075334574347202020FF021F46",
    "version": 53
  },
  "system": {
    "boot": {
      "uptime": 26,
      "id": 2452833130
    },
    "firmware": {
      "download": "https://versioduo.com/download",
      "configure": "https://versioduo.com/configure",
      "id": "com.versioduo.glockenspiel-37",
      "board": "versioduo:samd:control",
      "hash": "ead8d3328288d228a475df5bc45a03550b060a5d",
      "start": 16384,
      "size": 131653
    },
    "hardware": {
      "board": "versioduo:samd:control",
      "ram": {
        "size": 196608,
        "free": 69111
      },
      "flash": {
        "size": 524288
      },
      "eeprom": {
        "size": 4096,
        "used": true
      },
      "usb": {
        "connection": {
          "active": true,
          "sequence": 1
        },
        "vid": 26214,
        "pid": 59664,
        "ports": {
          "standard": 1,
          "access": 6,
          "current": 1
        }
      }
    },
    "midi": {
      "input": {
        "packet": 33,
        "system": {
          "exclusive": 3
        }
      },
      "output": {
        "packet": 932,
        "system": {
          "exclusive": 1
        }
      }
    },
    "link": {
      "plug": {
        "input": 0,
        "output": 0
      },
      "socket": {
        "input": 0,
        "output": 5
      }
    }
  },
  "settings": [
    {
      "type": "calibration",
      "program": {
        "number": 9,
        "bank": 3
      },
      "chromatic": {
        "start": 72,
        "count": 37
      },
      "path": "calibration"
    },
    {
      "type": "color",
      "title": "Light",
      "path": "color"
    }
  ],
  "configuration": {
    "#usb": "USB Settings",
    "usb": {
      "#name": "Device Name",
      "name": "",
      "#vid": "USB Vendor ID",
      "vid": 0,
      "#pid": "USB Product ID",
      "pid": 0,
      "#ports": "Number of MIDI ports",
      "ports": 1
    },
    "#calibration": "The “Raw” velocity values to play a note with velocity 1 and 127",
    "calibration": [
      {
        "min": 37,
        "max": 127
      },
      ...
      {
        "min": 44,
        "max": 127
      }
    ],
    "#color": "The LED color. Hue, saturation, brightness, 0..127",
    "color": [
      15,
      40,
      100
    ]
  },
  "input": {
    "programs": [
      {
        "name": "Standard",
        "number": 9,
        "bank": 0,
        "selected": true
      },
      {
        "name": "Damper",
        "number": 9,
        "bank": 1
      },
      {
        "name": "Trigger + Damper",
        "number": 9,
        "bank": 2
      },
      {
        "name": "Calibration",
        "number": 9,
        "bank": 3
      }
    ],
    "controllers": [
      {
        "name": "Volume",
        "number": 7,
        "value": 100
      },
      {
        "name": "Sustain",
        "number": 64,
        "value": 0
      },
      {
        "name": "Hue",
        "number": 14,
        "value": 15
      },
      {
        "name": "Saturation",
        "number": 15,
        "value": 40
      },
      {
        "name": "Brightness",
        "number": 89,
        "value": 100
      },
      {
        "name": "Rainbow",
        "number": 90,
        "value": 0
      }
    ],
    "chromatic": {
      "start": 72,
      "count": 37
    }
  }
}
```

## Screenshots

### Information

![Screenshot](screenshots/information.png?raw=true)

### Details

![Screenshot](screenshots/details.png?raw=true)

### Firmware Update

![Screenshot](screenshots/update.png?raw=true)

### System Configuration

![Screenshot](screenshots/system.png?raw=true)

### System Log

![Screenshot](screenshots/log.png?raw=true)

### Install as stand-alone application

![Screenshot](screenshots/install.png?raw=true)

## Copying

Anyone can use this public domain work without having to seek authorisation, no one can ever own it.
