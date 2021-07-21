# WebMIDI device configuration tool

A simple configuration tool for small MIDI devices. It runs in the web browser on a desktop or mobile phone without the need to download or install any additional software. It is suited for devices which do not have a network connection themselves.

The Web browser connects over [webMIDI](https://webaudio.github.io/web-midi-api/#extensions-to-the-navigator-interface) to the MIDI device. The messages between the browser and the device are [MIDI System Exclusive](https://en.wikipedia.org/wiki/MIDI#System_Exclusive_messages) messages.

The used MIDI System Exclusive ID is the _research/private ID_ `0x7d`. The  messages contain a single valid [JSON](https://www.json.org/json-en.html) object. The first byte of the message must be `{`, the last byte must be `}`. All unicode codepoints must be escaped with the `\u0000` notation to satisfy the MIDI 7 bit byte stream requirement; escaping and unescaping must support unicode [surrogate pairs](https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF).

All messages use the globally unique object `com.versioduo.device` with a simple method call convention.

The devices implement the JSON interface with [V2Device](https://github.com/versioduo/V2Device/) and send and receive MIDI System Exclusive messages with [V2MIDI](https://github.com/versioduo/V2MIDI/).

:bulb: _This repository if fully self-contained. It does not require or load anything from external resources. It can be cloned or downloaded, and used offline as as a local web application._

## Example Request

A host connects to the device and calls the method `getAll()` of `com.versioduo.device`:

```json
{
  "com.versioduo.device": {
    "method": "getAll"
  }
}
```

## Example Reply

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

A reply from the device:

```json
"com.versioduo.device": {
  "token": 1351435976,
  "metadata": {
    "vendor": "Versio Duo",
    "product": "glockenspiel-37",
    "description": "37 Bar Glockenspiel",
    "home": "https://versioduo.com/#glockenspiel-37",
    "serial": "4A7E4D075334574347202020FF021F46",
    "version": 27
  },
  "system": {
    "board": "versioduo:samd:control",
    "usb": {
      "vid": 26214,
      "pid": 59664
    },
    "ports": {
      "configured": 1,
      "announce": 6,
      "current": 1
    },
    "firmware": {
      "download": "https://versioduo.com/download",
      "id": "com.versioduo.glockenspiel-37",
      "board": "versioduo:samd:control",
      "hash": "584934ab05689d6c541828fca56268c3f11f6823",
      "start": 16384,
      "size": 113383
    },
    "ram": {
      "size": 196608,
      "free": 51495
    },
    "flash": {
      "size": 524288
    },
    "eeprom": {
      "size": 4096
    },
    "boot": {
      "uptime": 129,
      "id": 1351435976
    },
    "input": {
      "note": 0,
      "noteOff": 0,
      "aftertouch": 0,
      "control": 0,
      "program": 0,
      "aftertouchChannel": 0,
      "pitchbend": 0,
      "system": {
        "exclusive": 3,
        "reset": 0,
        "clock": {
          "tick": 0
        }
      }
    },
    "output": {
      "note": 0,
      "noteOff": 0,
      "aftertouch": 0,
      "control": 0,
      "program": 0,
      "aftertouchChannel": 0,
      "pitchbend": 0,
      "system": {
        "exclusive": 0,
        "reset": 0,
        "clock": {
          "tick": 0
        }
      }
    }
  },
  "settings": {
    "calibration": {
      "program": 3,
      "configuration": "calibration"
    }
  },
  "configuration": {
    "#name": "The device name (USB product string)",
    "name": "",
    "#ports": "The number of MIDI ports to create",
    "ports": 1,
    "#calibration": "The “Raw” velocity values to play a note with velocity 1 and 127",
    "calibration": [{
        "min": 71,
        "max": 127
      },
      ...
      {
        "min": 60,
        "max": 127
      },
      {
        "min": 79,
        "max": 127
      }
    ]
  },
  "input": {
    "controllers": [{
        "name": "Sustain",
        "number": 64,
        "value": 0
      },
      {
        "name": "Light",
        "number": 89,
        "value": 127
      },
      {
        "name": "Rainbow",
        "number": 90
      }
    ],
    "programs": [{
        "name": "Standard",
        "number": 0,
        "selected": true
      },
      {
        "name": "Damper",
        "number": 1
      },
      {
        "name": "Trigger and Damper",
        "number": 2
      },
      {
        "name": "Calibration (raw values)",
        "number": 3
      }
    ],
    "chromatic": {
      "start": 72,
      "count": 37
    }
  },
  "output": {}
}
```

## Screenshots

### Information

![Screenshot](screenshots/information.png?raw=true)

### Details

![Screenshot](screenshots/details.png?raw=true)

### Firmware Update

![Screenshot](screenshots/update.png?raw=true)

### Notes

![Screenshot](screenshots/notes.png?raw=true)

### System Configuration

![Screenshot](screenshots/system.png?raw=true)

### Test, Log

![Screenshot](screenshots/log.png?raw=true)
