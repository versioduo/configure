class V2Device extends V2AppSection {
  connection = Object.seal({
    element: null,
    select: null
  });
  log = null;
  midi = null;
  notify = null;
  device = null;

  constructor(app, log) {
    super(app, 'device', '--plug', 'Device');
    this.log = log;

    new V2AppMenu(this.canvas, (menu) => {
      this.connection.element = menu.element;

      let reset = null;
      menu.addItem((li) => {
        this.connection.select = new V2MIDISelect(li);
        this.connection.select.element.classList.add('primary');

        this.connection.select.addNotifier('select', (device) => {
          if (device) {
            this.connect(device);
            reset.disabled = false;

          } else {
            this.disconnect();
            reset.disabled = true;
          }
        });

        this.connection.select.addNotifier('disconnect', () => {
          reset.disabled = true;
        });

        this.connection.select.addNotifier('add', () => {
          if (this.device.input)
            return;

          window.scroll(0, 0);
        });
      });

      menu.addElement('button', (e) => {
        reset = e;
        e.disabled = true;
        e.classList.add('icon', 'field');

        V2App.addElement(e, 'i', (i) => {
          i.classList.add('icon', '--rotate', '--nospace');
        });

        e.addEventListener('click', () => {
          this.sendReset('token');
        });
      });
    });

    this.log = log;
    this.midi = new V2MIDI();
    this.notify = new V2AppNotify(this.canvas);
    this.device = new V2MIDIDevice();
    this.device.addNotifier('note', (channel, note, velocity) => {
      if (velocity > 0)
        this.print('Received NoteOn ' + V2MIDI.Note.getName(note) + '(' + note + ') with velocity ' + velocity + ' on channel #' + (channel + 1));
      else
        this.print('Received NoteOff ' + V2MIDI.Note.getName(note) + '(' + note + ') on channel #' + (channel + 1));
    });

    this.device.addNotifier('noteOff', (channel, note, velocity) => {
      this.print('Received NoteOff ' + V2MIDI.Note.getName(note) + '(' + note + ') with velocity ' + velocity + ' on channel #' + (channel + 1));
    });

    this.device.addNotifier('aftertouch', (channel, note, pressure) => {
      this.print('Received Aftertouch for note ' + V2MIDI.Note.getName(note) + '(' + note + ')' + ' with pressure «' + pressure + '» on channel #' + (channel + 1));
    });

    this.device.addNotifier('controlChange', (channel, controller, value) => {
      this.print('Received ControlChange ' + controller + ' with value ' + value + ' on channel #' + (channel + 1));
    });

    this.device.addNotifier('aftertouchChannel', (channel, pressure) => {
      this.print('Received AftertouchChannel with value ' + pressure + ' on channel #' + (channel + 1));
    });

    this.device.addNotifier('systemExclusive', (message) => {
      this.printDevice('Received SystemExclusive length=' + message.length);
    });

    this.midi.setup((error) => {
      if (error) {
        this.log.print(error);
        this.notify.error(error);
        return;
      }

      // Subscribe to device connect/disconnect events.
      this.midi.addNotifier('state', (event) => {
        if (event) {
          if (event.port.type === 'input')
            this.log.print('«' + event.port.name + '» (' + event.port.id + ':): Port is ' + event.port.state);

          else if (event.port.type === 'output')
            this.log.print('«' + event.port.name + '» (:' + event.port.id + '): Port is ' + event.port.state);

          // Disconnect if the current device is unplugged.
          if (this.device.input === event.port && event.port.state === 'disconnected')
            this.disconnect();
        }

        this.connection.select.update(this.midi.getDevices('both'));
      });

      // Adding '?connect=<device name>' to the URL will try to connect to a device with the given name.
      if (app.url.connect) {
        this.log.print('Found URL request to auto-connect to device: «' + app.url.connect + '»');

        const tryConnect = (device, portName = '') => {
          const name = app.url.connect + portName;
          if (name !== device.name)
            return false;

          this.log.print('Trying to connect to «' + name + '» ...');
          this.connection.select.update(this.midi.getDevices('both'));
          this.connection.select.select(device);
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
  }

  print(line) {
    this.log.print('«' + this.device.getName() + '»: ' + line);
  }

  printDevice(line) {
    this.log.print('«' + this.device.getName() + '» (' + this.device.getID() + '): ' + line);
  }

  getDevice() {
    return this.device;
  }

  getMIDI() {
    return this.midi;
  }

  // Print available MIDI ports. Their names might be different on different operating systems.
  printStatus() {
    this.log.print(document.querySelector('meta[name="name"]').content + ', version ' + Number(document.querySelector('meta[name="version"]').content));

    for (const device of this.midi.getDevices().values()) {
      let what = (device.in && device.in === this.device.input) ? 'Connected to' : 'Found';
      if (device.in && device.out)
        this.log.print(what + ' «' + device.in.name + '» (' + device.in.id + ':' + device.out.id + ')');

      else if (device.in)
        this.log.print(what + ' «' + device.in.name + '» (' + device.in.id + ':)');

      else if (device.out)
        this.log.print(what + ' «' + device.out.name + '» (:' + device.out.id + ')');
    }
  }

  sendNote(channel, note, velocity) {
    this.device.sendNote(channel, note, velocity);
    this.print('Sending NoteOn ' + V2MIDI.Note.getName(note) + '(' + note + ') with velocity ' + velocity + ' on channel #' + (channel + 1));
  }

  sendNoteOff(channel, note, velocity = 64) {
    this.device.sendNoteOff(channel, note, velocity);
    this.print('Sending NoteOff ' + V2MIDI.Note.getName(note) + '(' + note + ') with velocity ' + velocity + ' on channel #' + (channel + 1));
  }

  sendControlChange(channel, controller, value) {
    this.device.sendControlChange(channel, controller, value);
    this.print('Sending ControlChange #' + controller + ' with value ' + value + ' on channel #' + (channel + 1));
  }

  sendProgramChange(channel, value) {
    this.device.sendProgramChange(channel, value);
    this.print('Sending ProgramChange #' + (value + 1) + ' on channel #' + (channel + 1));
  }

  sendAftertouchChannel(channel, value) {
    this.device.sendAftertouchChannel(channel, value);
    this.print('Sending AftertouchChannel #' + value + ' on channel #' + (channel + 1));
  }

  sendPitchBend(channel, value) {
    this.device.sendPitchBend(channel, value);
    this.print('Sending PitchBend #' + value + ' on channel #' + (channel + 1));
  }

  sendSystemReset() {
    this.device.sendSystemReset();
    this.print('Sending SystemReset');
  }

  sendSystemExclusive(message) {
    const length = this.device.sendSystemExclusive(message);
    this.printDevice('Sending SystemExclusive length=' + length);
  }

  sendJSON(json) {
    let request;
    try {
      request = JSON.parse(json);

    } catch (error) {
      this.printDevice('Unable to parse JSON string: «' + error.toString() + '»');
      return;
    }

    this.sendSystemExclusive(request);
  }
}
