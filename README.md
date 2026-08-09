# WebMIDI Device Configuration
A simple configuration tool for V2 MIDI devices. It runs in the web browser on a desktop or mobile phone without the need to download or install any additional software.

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
  "token": 1264979491,
  "metadata": {
    "product": "V2 glockenspiel-37",
    "description": "37 Bar Glockenspiel",
    "vendor": "Versio Duo",
    "home": "https://versioduo.com/#glockenspiel-37",
    "serial": "7A2D45875334574347202020FF024518",
    "version": 75
  },
  "links": [],
  "help": {
    "device": "Notes are controlled by a trigger and a damper, it allows a piano-like velocity and tone duration control; MIDI Note-Off will cause the currently playing tone to be damped."
  },
  "system": {
    "boot": {
      "uptime": 284.641,
      "id": 1264979491
    },
    "connection": {
      "port": "usb",
      "midi": {
        "input": {
          "packet": 44,
          "system": {
            "exclusive": 4
          }
        },
        "output": {
          "packet": 3048,
          "system": {
            "exclusive": 1
          }
        }
      }
    },
    "track": {
      "title": "Beethoven – Hammerklaviersonate, 3. Satz",
      "creator": "Bernd Krueger, 2008"
    },
    "firmware": {
      "download": "https://versioduo.com/download",
      "configure": "https://versioduo.com/configure",
      "id": "com.versioduo.glockenspiel-37",
      "board": "versioduo:samd:control",
      "hash": "a0caf4f1b9ff07faf7ea858bc60b8572d9b3e9a2",
      "start": 16384,
      "size": 190337
    },
    "hardware": {
      "board": "versioduo:samd:control",
      "ram": {
        "size": 196608,
        "free": 63124,
        "data": {
          "size": 64176,
          "initialized": 1760
        },
        "heap": {
          "size": 60116,
          "allocated": 17628
        },
        "stack": {
          "size": 9184
        }
      },
      "flash": {
        "size": 524288
      },
      "eeprom": {
        "size": 4096,
        "used": false
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
        },
        "midi": {
          "input": {
            "packet": 44
          },
          "output": {
            "packet": 3048
          }
        }
      },
      "port": {
        "packet": {
          "output": 5
        },
        "midi": {
          "input": {
            "packet": 0
          },
          "output": {
            "packet": 5
          }
        }
      },
      "serial": {
        "midi": {
          "input": {
            "packet": 0
          },
          "output": {
            "packet": 0
          }
        }
      }
    }
  },
  "settings": [
    {
      "type": "calibration",
      "title": "Calibration",
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
      "type": "colour",
      "title": "Light",
      "path": "colour"
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
      "ports": 0
    },
    "#calibration": "The “Raw” velocity values to play a note with velocity 1 and 127",
    "calibration": [
      {
        "min": 1,
        "max": 127
      },
      {
        "min": 1,
        "max": 127
      },
      [...]
    ],
    "#colour": "The LED colour. Hue, saturation, brightness, 0..127",
    "colour": [
      15,
      40,
      100
    ]
  },
  "input": {
    "channels": [
      {
        "number": 0,
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
            "name": "Dampened",
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
            "name": "Sustain Pedal",
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
        },
        [...]
      }
    ]
  }
}
```

## Screenshots

### Information
![Screenshot](screenshots/information.png?raw=true)

### Details
![Screenshot](screenshots/details.png?raw=true)

### Firmware
![Screenshot](screenshots/firmware.png?raw=true)

### Configuration
![Screenshot](screenshots/configuration.png?raw=true)

### Log
![Screenshot](screenshots/log.png?raw=true)

## Copying
Anyone can use this public domain work without having to seek authorisation, no one can ever own it.
