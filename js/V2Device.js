// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

class V2Device extends V2WebModule {
  // The WebMIDI system context.
  midi = null;

  // The currently connected MIDI device.
  device = null;

  // Subscription of modules to device events/data.
  notifiers = {
    show: [],
    reset: []
  };

  // The current device information.
  data = null;

  #log = null;
  #sessionID = null;
  #bannerNotify = null;
  #select = {
    element: null,
    isLoading: null
  };
  #tabs = null;
  #info = null;
  #details = null;
  #update = {
    element: null,
    elementUpload: null,
    elementProgress: null,
    notify: null,
    firmware: {
      bytes: null,
      hash: null,
      current: null
    }
  }
  #timeout = null;
  #sequence = 0;
  #token = null;

  constructor(log) {
    super();
    super.attach();
    this.#log = log;
    this.#sessionID = Math.random().toString(36).substr(2, 6);

    this.#bannerNotify = new V2WebNotify(this.canvas);

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'Device';
        e.title = 'The connected MIDI device';
        e.tabIndex = -1;
      });

      field.addElement('span', (e) => {
        this.#select.isLoading = e;
        e.classList.add('select');

        V2Web.addElement(e, 'select', (select) => {
          this.#select.element = select;
          select.title = 'Select the MIDI device to connect to';
          select.disabled = true;
          select.addEventListener('change', () => {
            this.#connect();
          });

          V2Web.addElement(select, 'option', (e) => {
            e.textContent = 'Connect to ...';
            e.value = '';
          });
        });
      });
    });

    new V2WebTabs(this.canvas, (tabs) => {
      this.#tabs = tabs;

      tabs.addTab('information', 'Information', (e) => {
        this.#info = e;
      });

      tabs.addTab('details', 'Details', (e) => {
        this.#details = e;
      });

      tabs.addTab('update', 'Update', (e) => {
        this.#update.element = e;
      });

      // Check for firmware updates when activating the tab.
      tabs.addNotifier((name) => {
        if (name == 'update')
          this.#loadFirmwareIndex();
      });
    });

    this.midi = new V2MIDI();
    this.device = new V2MIDIDevice();
    this.midi.setup((error) => {
      if (error) {
        this.#log.print(error);
        this.#bannerNotify.error(error);
        return;
      }

      // Subscribe to device connect/disconnect events.
      this.midi.notifiers.state.push((event) => {
        if (event.port.type == 'input')
          this.#log.print('<b>' + event.port.name + '</b> (' + event.port.id + ', –): Port is ' + event.port.state);

        else if (event.port.type == 'output')
          this.#log.print('<b>' + event.port.name + '</b> (–, ' + event.port.id + '): Port is ' + event.port.state);

        // Disconnect if the current device is unplugged.
        if (this.device.input == event.port && event.port.state == 'disconnected')
          this.disconnect();

        this.#updateList();
      });

      this.#log.print('WebMIDI initialized');
      this.printStatus();
      this.#updateList();
    });
  }

  print(line) {
    this.#log.print('<b>' + this.device.input.name + '</b>: ' + line);
  }

  printDevice(line) {
    this.#log.print('<b>' + this.device.input.name + '</b> (' + this.device.input.id + ', ' + this.device.output.id + '): ' + line);
  }

  // Print available MIDI ports. Their names might be different on different
  // operating systems.
  printStatus() {
    this.midi.forEachDevice((inputPort, outputPort) => {
      let what = (inputPort && inputPort == this.device.input) ? 'Connected to' : 'Found';
      if (inputPort && outputPort)
        this.#log.print(what + ' <b>' + inputPort.name + '</b> (' + inputPort.id + ', ' + outputPort.id + ')');

      else if (inputPort)
        this.#log.print(what + ' <b>' + inputPort.name + '</b> (' + inputPort.id + ', –)');

      else if (outputPort)
        this.#log.print(what + ' <b>' + outputPort.name + '</b> (–, ' + outputPort.id + ')');
    });
  }

  // Dim UI elements when no device is connected, or an action waits for a reply.
  setEnabled(enabled) {
    const isEnabled = Array.prototype.slice.call(document.querySelectorAll('.isEnabled'), 0);
    isEnabled.forEach((e) => {
      e.disabled = !enabled;
    });
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

  sendRequest(request) {
    // Requests and replies contain the device's current bootID.
    if (this.#token)
      request.token = this.#token;

    this.sendSystemExclusive({
      'com.versioduo.device': request
    });
  }

  sendGetAll() {
    this.printDevice('Calling <b>getAll()</>');
    this.sendRequest({
      'method': 'getAll'
    });
    this.printDevice('Waiting for reply ...');
  }

  // Disconnect the current device.
  disconnect() {
    if (!this.device.input)
      return;

    this.printDevice('Disconnecting');

    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    this.device.disconnect();

    this.#token = null;
    this.#tabs.switchTab();
    this.#clear();
    this.#select.element.options[0].text = 'Connect to ...';
    this.#updateList();
    this.setEnabled(false);

    this.notifiers.reset.forEach((notifier) => {
      notifier();
    })

    window.scroll(0, 0);
    this.#select.element.focus();
  }

  sendReset() {
    this.sendSystemReset();
    this.sendGetAll();
  }

  sendReboot() {
    this.printDevice('Calling <b>reboot()</>');
    this.sendRequest({
      'method': 'reboot'
    });
    this.disconnect();
  }

  // Reboot the device and temporarily create MIDI ports/virtual
  // cables to access children devices. The device can describe itself
  // how many children devices are expected to be connected.
  rebootWithPorts() {
    let ports = this.data.system.ports.announce;

    // Ports enabled but no custom number of ports specified, use the maximum.
    if (ports == 1)
      ports = 16;

    this.printDevice('Calling <b>reboot()</>');
    this.sendRequest({
      'method': 'reboot',
      'reboot': {
        'ports': ports
      }
    });
    this.disconnect();
  }

  sendNote(channel, note, velocity) {
    this.device.sendNote(channel, note, velocity);
    this.print('Sending <b>NoteOn</b> <i>#' + note +
      '</i> with velocity <i>' + velocity + '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendNoteOff(channel, note, velocity) {
    this.device.sendNoteOff(channel, note, velocity);
    this.print('Sending <b>NoteOff</b> <i>#' + note +
      '</i> with velocity <i>' + (velocity || 64) + '</i> on channel <i>#' + (channel + 1) + '</i>');
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

  #show(data) {
    this.#clear();
    this.data = data;

    // The Information tab.
    V2Web.addElement(this.#info, 'div', (container) => {
      container.classList.add('table-container');

      V2Web.addElement(container, 'table', (e) => {
        e.classList.add('table');
        e.classList.add('is-fullwidth');
        e.classList.add('istriped');
        e.classList.add('is-narrow');

        V2Web.addElement(e, 'tbody', (body) => {
          Object.keys(data.metadata).forEach((key) => {
            const name = key.charAt(0).toUpperCase() + key.slice(1);
            const value = data.metadata[key];

            V2Web.addElement(body, 'tr', (row) => {
              V2Web.addElement(row, 'td', (e) => {
                e.textContent = name;
              });

              V2Web.addElement(row, 'td', (e) => {
                if (typeof value == 'string' && value.match(/^https?:\/\//)) {
                  V2Web.addElement(e, 'a', (a) => {
                    a.setAttribute('href', value);
                    a.setAttribute('target', 'home');
                    a.textContent = value.replace(/^https?:\/\//, '');
                  });
                } else
                  e.textContent = value;
              });
            });
          });
        });
      });
    });

    // The Details tab.
    new V2WebField(this.#details, (field) => {
      field.addButton((e) => {
        e.classList.add('is-link');
        e.textContent = 'Refresh';
        e.title = 'Refresh the data';
        e.addEventListener('click', () => {
          this.sendGetAll();
        });
      });
    });

    V2Web.addElement(this.#details, 'div', (container) => {
      container.classList.add('table-container');

      V2Web.addElement(container, 'table', (e) => {
        e.classList.add('table');
        e.classList.add('is-fullwidth');
        e.classList.add('istriped');
        e.classList.add('is-narrow');

        V2Web.addElement(e, 'tbody', (body) => {
          const printObject = (parent, object) => {
            Object.keys(object).forEach((key) => {
              let name = key;
              if (parent)
                name = parent + '.' + name;

              const value = object[key];
              if (typeof value == 'object') {
                printObject(name, value);

              } else {
                V2Web.addElement(body, 'tr', (row) => {

                  V2Web.addElement(row, 'td', (e) => {
                    e.textContent = name;
                  });

                  V2Web.addElement(row, 'td', (e) => {
                    e.textContent = value;
                  });
                });
              }
            });
          }
          printObject(null, data.system);

        });
      });
    });

    // The Update tab.
    new V2WebField(this.#update.element, (field) => {
      field.addButton((e) => {
        e.textContent = 'Enable Ports';
        e.title = 'Enable MIDI ports to access the children devices';
        if (!data.system.ports || data.system.ports.announce == 0)
          e.disabled = true;
        e.addEventListener('click', () => {
          this.rebootWithPorts();
        });
      });

      field.addButton((e) => {
        e.textContent = 'Load';
        e.title = 'Load a firmware image';
        e.addEventListener('click', () => {
          this.#loadFirmware();
        });
      });

      field.addButton((e) => {
        this.#update.elementUpload = e;
        e.classList.add('is-link');
        e.disabled = true;
        e.textContent = 'Upload';
        e.title = 'Update the device with the new firmware';
        e.addEventListener('click', () => {
          this.#uploadFirmware();
        });
      });
    });

    V2Web.addElement(this.#update.element, 'progress', (e) => {
      this.#update.elementProgress = e;
      e.style.display = 'none';
      e.classList.add('progress');
      e.classList.add('is-small');
      e.value = 0;
    });

    this.#update.notify = new V2WebNotify(this.#update.element);

    V2Web.addElement(this.#update.element, 'p', (e) => {
      e.classList.add('subtitle');
      e.textContent = 'Firmware';
    });

    V2Web.addElement(this.#update.element, 'div', (e) => {
      e.classList.add('table-container');

      V2Web.addElement(e, 'table', (table) => {
        table.classList.add('table');
        table.classList.add('is-fullwidth');
        table.classList.add('istriped');
        table.classList.add('is-narrow');

        V2Web.addElement(table, 'tbody', (body) => {
          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Version';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = this.data.metadata.version;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Id';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = this.data.system.firmware.id;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Board';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = this.data.system.firmware.board;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Hash';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = this.data.system.firmware.hash;
            });
          });
        });
      });
    });

    if (!this.#tabs.current)
      this.#tabs.switchTab('information');
  }

  #clear() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    this.#select.isLoading.classList.remove('is-loading');
    this.data = null;

    this.#tabs.resetTab('information');
    this.#tabs.resetTab('details');
    this.#tabs.resetTab('update');

    this.#update.firmware.bytes = null;
    this.#update.firmware.hash = null;
  }

  #updateList() {
    this.#select.element.options.length = 1;
    // Iterate over the input ports, only add the device to the list if we
    // find an output port with the same name and index.
    this.midi.forEachDevice((inputPort, outputPort) => {
      if (!inputPort || !outputPort)
        return;

      V2Web.addElement(this.#select.element, 'option', (e) => {
        e.value = inputPort.id;
        e.text = inputPort.name;
        if (inputPort == this.device.input)
          e.selected = true
      });
    });

    const disable = this.#select.element.options.length == 1;
    const isDisabled = this.#select.element.disabled;
    this.#select.element.disabled = disable;

    // If we enable the previously disabled selector, select it.
    if (!disable && isDisabled)
      this.#select.element.focus();
  }

  // Process the com.versioduo.device message reply message.
  #handleReply(data) {
    this.printDevice('Received <b>com.versioduo.device<b> message');

    // Remember the token from the first reply.
    if (!this.#token && data['token'])
      this.#token = data['token'];

    if (this.#token != data['token']) {
      this.printDevice('Wrong token, ignoring message');
      return;
    }

    if (data.firmware && data.firmware.status) {
      this.#uploadFirmwareBlock(data.firmware.status);
      return;
    }

    if (!data.metadata) {
      this.printDevice('Missing device information');
      this.disconnect();
      return;
    }

    this.#select.isLoading.classList.remove('is-loading');
    this.#select.element.options[0].text = 'Disconnect ...';
    this.#updateList();
    this.setEnabled(true);
    this.#show(data);

    this.notifiers.show.forEach((notifier) => {
      notifier(data);
    })
  }

  // Connect or switch to a device. We always need the matching pair of
  // 'input' and 'output' device.
  #connect() {
    if (this.#select.element.selectedIndex == 0) {
      this.disconnect();
      return;
    }

    const input = this.midi.system.inputs.get(this.#select.element.value);
    if (!input) {
      this.#log.print('Unable to find input port <b>' + this.#select.element.value + '</b>');
      return;
    }

    // Find the corresponding output port.
    const output = this.midi.findOutputPort(input);
    if (!output) {
      this.#log.print('Unable to find output port for <b>' + input.id + '</b>');
      return;
    }

    this.disconnect();

    // Give this connection attempt a #sequence number, so we can 'cancel'
    // the promise which might be resolved later, when a new connection
    // attempt is already submitted from the user interface.
    this.#sequence++;
    let sequence = this.#sequence;

    // Try to open the input device.
    input.open().then(() => {
      if (sequence != this.#sequence)
        return;

      // We got the input, try to open the corresponding output device.
      output.open().then(() => {
        if (sequence != this.#sequence)
          return;

        // We have input and output.
        this.device.input = input;
        this.device.output = output;

        // Subscribe to incoming messages.
        this.device.notifiers.message.note.push((channel, note, velocity) => {
          if (velocity > 0)
            this.print('Received <b>NoteOn</b> <i>' +
              V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity ' + velocity + ' on channel <i>#' + (channel + 1)) + '</i>';

          else
            this.print('Received <b>NoteOff</b> <i>' +
              V2MIDI.Note.name(note) + '(' + note + ')</i> on channel #' + (channel + 1));
        });

        this.device.notifiers.message.noteOff.push((channel, note, velocity) => {
          this.print('Received <b>NoteOff</b> <i>' +
            V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity ' + velocity + ' on channel #' + (channel + 1));
        });

        this.device.notifiers.message.aftertouch.push((channel, note, pressure) => {
          this.print('Received <b>Aftertouch</b> for note <i>' + V2MIDI.Note.name(note) + '(' + note + ')</i>' + ' with pressure <i>' + pressure + '</i> on channel <i>#' + (channel + 1) + '</i>');
        });

        this.device.notifiers.message.controlChange.push((channel, controller, value) => {
          this.print('Received <b>ControlChange</b> <i>' + controller +
            '</i> with value <i>' + value + '</i> on channel <i>#' + (channel + 1) + '</i>');
        });

        this.device.notifiers.message.aftertouchChannel.push((pressure) => {
          this.print('Received <b>Aftertouch Channel</b> with value <i>' + value + '</i> on channel <i>#' + (channel + 1) + '</i>');
        });

        this.device.notifiers.message.systemExclusive.push((message) => {
          this.printDevice('Received <b>SystemExclusive</b> length=' + message.length);

          const json = new TextDecoder().decode(message);
          let data;

          try {
            data = JSON.parse(json);

          } catch (error) {
            this.printDevice('Received unknown message format');
            return;
          }

          if (!data['com.versioduo.device']) {
            this.printDevice('Received data for unknown interface');
            return;
          }

          if (this.#timeout) {
            clearTimeout(this.#timeout);
            this.#timeout = null;
          }

          this.#handleReply(data['com.versioduo.device']);
        });

        // Dispatch incoming messages to V2MIDIDevice.
        this.device.input.onmidimessage = this.device.handleMessage.bind(this.device);

        // Request information from device.
        this.sendGetAll();
      });
    });

    this.#timeout = setTimeout(() => {
      this.#timeout = null;
      this.#log.print('Unable to connect to device <b>' + input.name + '</b>');
      this.disconnect();
    }, 2000);

    this.#select.isLoading.classList.add('is-loading');
  }

  // Load 'index.json' and from the 'download' URL and check if there is a firmware update available.
  #loadFirmwareIndex() {
    if (!this.data.system || !this.data.system.firmware.download)
      return;

    if (this.#update.firmware.bytes)
      return;

    this.printDevice('Downloading firmware update index: <b>' + this.data.system.firmware.download + '/index.json</b>');
    const request = new XMLHttpRequest();
    request.onreadystatechange = () => {
      let index;

      if (request.readyState == 4 && request.status == 200) {
        try {
          index = JSON.parse(request.responseText);

        } catch (error) {
          this.printDevice('Unable to parse firmware update index: <b>' + this.data.system.firmware.download + '/index.json</b>');
          return;
        }

        this.printDevice('Retrieved firmware update index');

        const update = index[this.data.system.firmware.id];
        if (!update) {
          this.printDevice('No firmware update found for this device.');
          return;
        }

        if (this.data.system.board != update.board) {
          this.printDevice('No firmware update found for this board.');
          return;
        }

        if (this.data.system.firmware.hash == update.hash) {
          this.#update.notify.success('The firmware is up-to-date.');
          return;
        }

        if (this.data.system.firmware.version > update.version) {
          this.#update.notify.warn('A more recent firmware is already installed.');
          return;
        }

        this.printDevice('Downloading firmware update: <b>' + update.file + '</b>');
        const firmware = new XMLHttpRequest();
        firmware.onreadystatechange = () => {
          if (firmware.readyState == 4) { // DONE
            if (firmware.status == 200) {
              const bytes = firmware.response;
              this.printDevice('Retrieved firmware image, length=' + bytes.byteLength);
              this.#showFirmware(new Uint8Array(bytes));

            } else
              this.printDevice('Failed to download firmware image: ' + firmware.status);
          }
        }

        firmware.open('GET', this.data.system.firmware.download + '/' + update.file, true);
        firmware.responseType = 'arraybuffer';
        firmware.send();
      }
    };

    // Append the session ID to prevent the index file from being cached
    // in the browser. Reloading the browser will create a new ID.
    request.open('GET', this.data.system.firmware.download + '/index.json?s=' + this.#sessionID, true);
    request.send();
  }

  // Load a firmware image from the local disk.
  #loadFirmware() {
    this.#update.firmware.bytes = null;
    this.#update.firmware.hash = null;

    // Temporarily create a hidden 'browse button' and trigger a file upload.
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', '.bin');
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const reader = new FileReader();
      reader.onload = (element) => {
        this.#showFirmware(new Uint8Array(reader.result));
      }

      reader.readAsArrayBuffer(input.files[0]);
      input.remove();
    });

    input.click();
  }

  // Present a new firmware image to update the current one.
  #showFirmware(bytes) {
    // Read the metadata in the image; the very end of the image contains
    // the the JSON metadata record with a leading and trailing NUL character.
    let metaStart = bytes.length - 2;
    while (bytes[metaStart] != 0) {
      metaStart--;
      if (metaStart < 4) {
        this.#update.notify.warn('Unknown file type. No valid device metadata found.');
        return;
      }
    }

    const metaBytes = bytes.slice(metaStart + 1, bytes.length - 1);
    const metaString = new TextDecoder().decode(metaBytes);

    let meta;
    try {
      meta = JSON.parse(metaString);

    } catch (error) {
      this.#update.notify.warn('Unknown file type. Unable to parse metadata.');
      return;
    }

    if (meta.interface != 'com.versioduo.firmware') {
      this.#update.notify.warn('Unknown file type. Missing metadata.');
      return;
    }

    // We found metadata in the loaded image.
    this.#update.firmware.bytes = bytes;

    V2Web.addElement(this.#update.element, 'p', (e) => {
      e.classList.add('subtitle');
      e.textContent = 'Firmware Update';
    });

    let elementHash = null;

    V2Web.addElement(this.#update.element, 'div', (e) => {
      e.classList.add('table-container');

      V2Web.addElement(e, 'table', (table) => {
        table.classList.add('table');
        table.classList.add('is-fullwidth');
        table.classList.add('istriped');
        table.classList.add('is-narrow');

        V2Web.addElement(table, 'tbody', (body) => {
          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Version';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = meta.version;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Id';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = meta.id;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Board';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = meta.board;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Hash';
            });
            V2Web.addElement(row, 'td', (e) => {
              elementHash = e;
            });
          });
        });
      });
    });

    crypto.subtle.digest('SHA-1', this.#update.firmware.bytes).then((hash) => {
      const array = Array.from(new Uint8Array(hash));
      const hex = array.map(b => b.toString(16).padStart(2, '0')).join('');
      this.#update.firmware.hash = hex;
      elementHash.textContent = hex;

      if (this.data.system.board && meta.board != this.data.system.board)
        this.#update.notify.error('The firmware update is for a different board which has the name <b>' + meta.board + '</>.');

      else if (meta.id != this.data.system.firmware.id)
        this.#update.notify.warn('The firmware update appears to provide a different functionality, it has the name <b>' + meta.id + '</>.');

      else if (meta.version < this.data.metadata.version)
        this.#update.notify.warn('The firmware update is version <b>' + meta.version + '</b>, which is older than the current firmware.');

      else if (this.#update.firmware.hash == this.data.system.firmware.hash)
        this.#update.notify.success('The firmware is up-to-date.');

      else
        this.#update.notify.warn('Press <b>Upload</b> to install version <b>' + meta.version + '</b> of the firmware.');

      this.#update.elementUpload.disabled = false;
    });
  }

  // Transfer the loded image to the device.
  #uploadFirmware() {
    this.#update.elementProgress.value = 0;
    this.#update.elementProgress.max = this.#update.firmware.bytes.length;
    this.#update.elementProgress.style.display = '';

    // Send the first block; the reply messages will trigger the remaining blocks.
    this.#update.firmware.current = 0;
    this.#uploadFirmwareBlock();
  }

  // Send one block of our firmware image. This will be called from
  // the incoming message handler, when the previous block was sucessfully written.
  #uploadFirmwareBlock(status) {
    if (status) {
      switch (status) {
        case 'success':
          break;

        case 'hashMismatch':
          this.#update.notify.error('Error while verifying the transferred firmware.');
          return;

        case 'invalidOffset':
          this.#update.notify.error('Invalid parameters for firmware update.');
          return;

        default:
          this.#update.notify.error('Error while updating the firmware: ' + status);
          return;
      }
    }

    // The last update packet was successful. If the device is connected
    // over USB we will notice the automatic reboot, we will not detect the reboot
    // of a children device, so disconnect it here.
    if (this.#update.firmware.current == null) {
      this.printDevice('Firmware update successful. Disconnecting device');
      this.disconnect();
      return;
    }

    const offset = this.#update.firmware.current;
    // The block size is fixed to 8k. Daisy-chained devices might not be able to forward larger packets.
    const block = this.#update.firmware.bytes.slice(offset, offset + 0x2000);
    const data = btoa(String.fromCharCode.apply(null, block));
    let request = {
      'method': 'writeFirmware',
      'firmware': {
        'offset': offset,
        'data': data
      }
    };

    if (this.#update.firmware.current + 0x2000 <= this.#update.firmware.bytes.length) {
      // Prepare for next block.
      this.#update.elementProgress.value = offset;
      this.#update.firmware.current += 0x2000;

    } else {
      // Last block.
      this.#update.elementProgress.value = this.#update.firmware.bytes.length;
      this.#update.firmware.current = null;

      // Add our hash to the request; if the device has received
      // the correct image it copies it over and reboots.
      this.printDevice('Firmware submitted. Requesting device update with hash <b>' + this.#update.firmware.hash + '</b>');
      request.firmware.hash = this.#update.firmware.hash;
    }

    this.sendRequest(request);
  }
}
