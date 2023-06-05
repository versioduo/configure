// © Kay Sievers <kay@versioduo.com>, 2019-2023
// SPDX-License-Identifier: Apache-2.0

class V2Connection extends V2WebModule {
  log = null;
  midi = null;
  bannerNotify = null;
  select = null;
  device = null;
  version = null;
  notifiers = Object.seal({
    show: [],
    reset: []
  });

  constructor(log, connect) {
    super();
    this.log = log;
    this.midi = new V2MIDI();
    this.bannerNotify = new V2WebNotify(this.canvas);

    this.select = new V2MIDISelect(this.canvas, (e) => {
      e.classList.add('is-link');
    });

    this.select.addNotifier('select', (device) => {
      if (device) {
        this.log.attach();
        this.connect(device);

      } else {
        this.log.detach();
        this.disconnect();
      }
    });

    // Focus the device selector when new devices arrive and we are
    // not currently connected.
    this.select.addNotifier('add', () => {
      if (this.device.input)
        return;

      this.select.focus();
      window.scroll(0, 0);
    });

    this.device = new V2MIDIDevice();
    this.device.addNotifier('note', (channel, note, velocity) => {
      if (velocity > 0)
        this.print('Received <b>Note</b> <i>' +
          V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity <i>' + velocity + '</i> on channel <i>#' + (channel + 1)) + '</i>';

      else
        this.print('Received <b>NoteOff</b> <i>' +
          V2MIDI.Note.name(note) + '(' + note + ')</i> on channel #' + (channel + 1));
    });

    this.device.addNotifier('noteOff', (channel, note, velocity) => {
      this.print('Received <b>NoteOff</b> <i>' +
        V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity <i>' + velocity + '</i> on channel #' + (channel + 1));
    });

    this.device.addNotifier('aftertouch', (channel, note, pressure) => {
      this.print('Received <b>Aftertouch</b> for note <i>' + V2MIDI.Note.name(note) + '(' + note + ')</i>' + ' with pressure <i>' + pressure + '</i> on channel <i>#' + (channel + 1) + '</i>');
    });

    this.device.addNotifier('controlChange', (channel, controller, value) => {
      this.print('Received <b>ControlChange</b> <i>' + controller +
        '</i> with value <i>' + value + '</i> on channel <i>#' + (channel + 1) + '</i>');
    });

    this.device.addNotifier('aftertouchChannel', (channel, pressure) => {
      this.print('Received <b>Aftertouch Channel</b> with value <i>' + pressure + '</i> on channel <i>#' + (channel + 1) + '</i>');
    });

    this.device.addNotifier('systemExclusive', (message) => {
      this.printDevice('Received <b>SystemExclusive</b> length=' + message.length);
    });

    this.midi.setup((error) => {
      if (error) {
        this.log.print(error);
        this.bannerNotify.error(error);
        return;
      }

      // Subscribe to device connect/disconnect events.
      this.midi.addNotifier('state', (event) => {
        if (event) {
          if (event.port.type === 'input')
            this.log.print('<b>' + event.port.name + '</b> (' + event.port.id + ':): Port is ' + event.port.state);

          else if (event.port.type === 'output')
            this.log.print('<b>' + event.port.name + '</b> (:' + event.port.id + '): Port is ' + event.port.state);

          // Disconnect if the current device is unplugged.
          if (this.device.input === event.port && event.port.state === 'disconnected')
            this.disconnect();
        }

        this.select.update(this.midi.getDevices('both'));
      });

      // Adding '?connect=<device name>' to the URL will try to connect to a device with the given name.
      if (connect) {
        this.log.print('Found URL request to auto-connect to device: <b>' + connect + '</b>');

        const tryConnect = (device, portName = '') => {
          const name = connect + portName;
          if (name !== device.name)
            return false;

          this.log.print('Trying to connect to <b>' + name + '</b> ...');
          this.select.update(this.midi.getDevices('both'));
          this.select.select(device);
          this.connect(device);
          return true;
        };

        for (const device of this.midi.getDevices().values()) {
          if (tryConnect(device))
            break;

          // First MIDI port on MacOS.
          if (tryConnect(device, ' Port 1'))
            break;

          // First MIDI port on Linux.
          if (tryConnect(device, ' MIDI 1'))
            break;
        }
      }
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.version = e;
      e.classList.add('mt-4');
      e.classList.add('is-flex');
      e.classList.add('is-justify-content-end');
      e.innerHTML = '<a href=' + document.querySelector('link[rel="source"]').href +
        ' target="software">' + document.querySelector('meta[name="name"]').content +
        '</a>, version ' + Number(document.querySelector('meta[name="version"]').content);
    });

    this.attach();
  }

  addNotifier(type, handler) {
    this.notifiers[type].push(handler);
  }

  print(line) {
    this.log.print('<b>' + this.device.getName() + '</b>: ' + line);
  }

  printDevice(line) {
    this.log.print('<b>' + this.device.getName() + '</b> (' + this.device.getID() + '): ' + line);
  }

  getDevice() {
    return this.device;
  }

  getMIDI() {
    return this.midi;
  }

  // Print available MIDI ports. Their names might be different on different
  // operating systems.
  printStatus() {
    this.log.print(document.querySelector('meta[name="name"]').content + ', version <b>' + Number(document.querySelector('meta[name="version"]').content) + '</b>');

    for (const device of this.midi.getDevices().values()) {
      let what = (device.in && device.in === this.device.input) ? 'Connected to' : 'Found';
      if (device.in && device.out)
        this.log.print(what + ' <b>' + device.in.name + '</b> (' + device.in.id + ':' + device.out.id + ')');

      else if (device.in)
        this.log.print(what + ' <b>' + device.in.name + '</b> (' + device.in.id + ':)');

      else if (device.out)
        this.log.print(what + ' <b>' + device.out.name + '</b> (:' + device.out.id + ')');
    }
  }

  sendNote(channel, note, velocity) {
    this.device.sendNote(channel, note, velocity);
    this.print('Sending <b>Note</b> <i>' +
      V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity <i>' + velocity + '</i> on channel #' + (channel + 1));
  }

  sendNoteOff(channel, note, velocity = 64) {
    this.device.sendNoteOff(channel, note, velocity);
    this.print('Sending <b>NoteOff</b> <i>' +
      V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity <i>' + velocity + '</i> on channel #' + (channel + 1));
  }

  sendControlChange(channel, controller, value) {
    this.device.sendControlChange(channel, controller, value);
    this.print('Sending <b>Control Change</b> <i>#' + controller +
      '</i> with value <i>' + value + '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendProgramChange(channel, value) {
    this.device.sendProgramChange(channel, value);
    this.print('Sending <b>Program Change</b> <i>#' + (value + 1) +
      '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendAftertouchChannel(channel, value) {
    this.device.sendAftertouchChannel(channel, value);
    this.print('Sending <b>Aftertouch Channel</b> <i>#' + value +
      '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendPitchBend(channel, value) {
    this.device.sendPitchBend(channel, value);
    this.print('Sending <b>Pitch Bend</b> <i>#' + value +
      '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendSystemReset() {
    this.device.sendSystemReset();
    this.print('Sending <b>SystemReset</b>');
  }

  sendSystemExclusive(message) {
    const length = this.device.sendSystemExclusive(message);
    this.printDevice('Sending <b>SystemExclusive</b> length=' + length);
  }

  sendJSON(json) {
    let request;
    try {
      request = JSON.parse(json);

    } catch (error) {
      this.printDevice('Unable to parse JSON string: <i>' + error.toString() + '</i>');
      return;
    }

    this.sendSystemExclusive(request);
  }
}
