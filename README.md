# WebMIDI device configuration tool

A simple configuration tool for small MIDI devices. It runs in the web browser on a desktop or mobile phone without the need to download or install any additional software. It is suited for devices which do not have a network connection themselves.

The Web browser connects over [webMIDI](https://webaudio.github.io/web-midi-api/#extensions-to-the-navigator-interface) to the MIDI device. The messages between the browser and the device are [MIDI System Exclusive](https://en.wikipedia.org/wiki/MIDI#System_Exclusive_messages) messages.

The used MIDI System Exclusive ID is the _research/private ID_ `0x7d`. The  messages contain a single valid [JSON](https://www.json.org/json-en.html) object. The first byte of the message must be `{`, the last byte must be `}`. All unicode codepoints must be escaped with the `\u0000` notation to satisfy the MIDI 7 bit byte stream requirement; escaping and unescaping must support unicode [surrogate pairs](https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF).

All messages use the globally unique object `com.versioduo.device` with a simple method call convention.

The devices implement the JSON interface with [V2Device](https://github.com/versioduo/V2Device/) and send and receive MIDI System Exclusive messages with [V2MIDI](https://github.com/versioduo/V2MIDI/).

## Example Request

A host connects to the device by calling the method `getAll()` of `com.versioduo.device`:

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

The `system` object is machine-readable information about the device, like the USB name, number of MIDI ports, and the available memory.

### MIDI Input Section

The `input` object is machine-readable information which notes and controls the device plays.

### MIDI Output Section

The `output` object is machine-readable information which notes and controls the device plays listens to.

### Configuration Section

The `configuration` object is the entire custom configuration of the device. The device configuration can be updated by calling the `writeConfiguration()` method with a new `configuration` object. The device is reset to factory defaults by calling the `eraseConfiguration()` method.

A reply from the device:

```json
"com.versioduo.device": {
  "metadata": {
    "vendor": "Versio Duo",
    "product": "Glockenspiel-37",
    "description": "37 chromatic notes acoustic instrument",
    "home": "https://versioduo.com/#glockenspiel-37",
    "serial": "77F608A15333395336202020FF093113",
    "version": 5
  },
  "system": {
    "board": "versioduo:samd:control",
    "ports": {
      "configured": 1,
      "announce": 6,
      "current": 1
    },
    "firmware": {
      "download": "https://versioduo.com/download",
      "id": "com.versioduo.glockenspiel-37",
      "board": "versioduo:samd:control",
      "size": 97946,
      "hash": "99c77a4dcb40a138b4b14fc936fb80dc86e29690"
    },
    "ram": {
      "size": 196608,
      "free": 52119
    },
    "flash": {
      "size": 524288,
      "start": 16384,
      "end": 507904,
      "blocksize": 8192,
      "pagesize": 512
    },
    "eeprom": {
      "size": 4096,
      "allocated": 16384
    }
  },
  "input": {
    "controllers": [{
      "name": "Sustain",
      "number": 64,
      "value": 0
    }],
    "program": {
      "names": [
        "Standard",
        "Damper",
        "Trigger and Damper",
        "Calibration (raw values)"
      ],
      "current": 0
    },
    "chromatic": {
      "start": 72,
      "count": 37,
      "calibration": {
        "program": 3
      }
    }
  },
  "output": {},
  "configuration": {
    "#name": "The USB product string",
    "name": "",
    "#ports": "The number of MIDI ports to create",
    "ports": 1,
    "#calibration": "The “Raw” velocity values to play a note with velocity 1 and 127",
    "calibration": [{
        "min": 46,
        "max": 127
      },
      ...
      {
        "min": 65,
        "max": 127
      }
    ]
  }
}
```

## Screenshots

### Info

![Screenshot](screenshots/1.png?raw=true)

### Details

![Screenshot](screenshots/2.png?raw=true)

### Firmware Update

![Screenshot](screenshots/3.png?raw=true)

### Notes and Calibration

![Screenshot](screenshots/4.png?raw=true)

### Configuration Editor, Test, Log

![Screenshot](screenshots/5.png?raw=true)
