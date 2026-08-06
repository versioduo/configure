class V2Device extends V2Connection {
  #device = null;
  #node = Object.seal({
    element: null,
    menu: null,
    controller: null
  });
  #tabs = Object.seal({
    object: null,
    current: null,
    data: null,
    statistics: null,
    firmware: Object.seal({
      element: null,
      elementSelect: null,
      notify: null,
      elementNewFirmware: null,
      elementUpload: null,
      elementProgress: null,
      update: Object.seal({
        bytes: null,
        hash: null,
        current: null
      })
    })
  });

  #timeout = null;
  #sequence = 0;
  #token = null;

  constructor(app, log, connect) {
    super(app, log, connect);
    Object.seal(this);

    V2App.addElement(this.canvas, 'div', (e) => {
      e.id = this.id + '.node';
      this.#node.element = e;
    });

    this.device.addNotifier('systemExclusive', (message) => {
      const json = new TextDecoder().decode(message);
      let data;

      try {
        data = JSON.parse(json);

      } catch (error) {
        this.printDevice('Received unknown message format');
        return;
      }

      const device = data['com.versioduo.device'];
      if (!device) {
        this.printDevice('Received data for unknown interface');
        return;
      }

      if (this.#timeout) {
        clearTimeout(this.#timeout);
        this.#timeout = null;
      }

      this.#handleReply(device);
    });
  }

  getData() {
    return this.#tabs.data;
  }

  sendRequest(request) {
    // Requests and replies contain the device's current bootID.
    if (this.#token);
    request.token = this.#token;

    this.sendSystemExclusive({
      'com.versioduo.device': request
    });
  }

  sendGetAll() {
    this.printDevice('Calling <b>getAll()</b>');
    this.sendRequest({
      'method': 'getAll'
    });
  }

  #disconnectDevice() {
    this.#reset();

    if (!this.device.input)
      return;

    this.printDevice('Disconnecting');

    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    this.notify.clear();
    this.device.disconnect();
    this.#token = null;
    this.#reset();

    this.app.callSections('reset');
    window.scroll(0, 0);
  }

  disconnect() {
    this.#disconnectDevice();
    this.select.setDisconnected();
  }

  sendReset(mode) {
    if (mode === 'token')
      this.#token = null;

    this.sendSystemReset();
    this.sendGetAll();
  }

  sendReboot(ports = false) {
    const method = ports ? 'rebootWithPorts' : 'reboot';
    this.printDevice('Calling <b>' + method + '()</b>');
    this.sendRequest({
      'method': method
    });
    this.disconnect();
  }

  sendBootloader() {
    this.printDevice('Calling <b>bootloader()</b>');
    this.sendRequest({
      'method': 'bootloader'
    });
    this.disconnect();
  }

  #showNode() {
    if (!this.#tabs.data || !this.#tabs.data.system.midi.passthrough || this.#tabs.data.system.midi.transport !== "usb") {
      this.#removeNode();
      return;
    }

    if (this.#node.menu)
      return;

    new V2AppMenu(this.#node.element, (menu) => {
      this.#node.menu = menu;

      menu.addElement('span', (e) => {
        e.textContent = 'Node';
      });

      menu.addElement('select', (s) => {
        s.classList.add('primary');

        for (let i = 0; i < 16; i++) {
          V2App.addElement(s, 'option', (e) => {
            e.value = i;
            e.text = (i === 0) ? '–' : '#' + i;
          });
        }

        s.addEventListener('change', () => {
          this.sendControlChange(0, this.#node.controller, Number(s.value));
          this.#token = null;
          this.sendGetAll();

          this.#timeout = setTimeout(() => {
            this.#timeout = null;
            this.printDevice('Unable to connect to node address <b>#' + Number(s.value) + '</b>. Disconnecting ...');
            this.#reset();

            for (const notifier of this.notifiers.reset)
              notifier();
          }, 1000);
        });
      });

      this.#node.controller = this.#tabs.data.system.midi.passthrough.controller;
    });
  }

  #removeNode() {
    if (!this.#node.menu)
      return;

    this.#node.menu.remove();
    this.#node.menu = null;
    this.#node.controller = null;
  }

  #show(data) {
    this.#clear();

    this.#tabs.data = data;
    this.title(null, data.metadata.product, data.metadata.description);
    this.#showNode();

    new V2AppTabs(this.canvas, (tabs) => {
      this.#tabs.object = tabs;
      tabs.element.id = this.id + '.tabs';

      tabs.add('device', '--plug', 'Device', (e) => {
        this.#device = e;
        e.id = tabs.element.id + '.device';
      });

      tabs.add('statistics', '--magnifying-glass-chart', 'Statistics', (e) => {
        this.#tabs.statistics = e;
        e.id = tabs.element.id + '.statistics';
      });

      tabs.add('firmware', '--microchip', 'Firmware', (e) => {
        this.#tabs.firmware.element = e;
        e.id = tabs.element.id + '.firmware';
      });

      tabs.addNotifier((name) => {
        this.#tabs.current = this.#tabs.object.current || null;

        if (name === 'firmware')
          this.#loadFirmwareIndex();
      });
    });

    // The Information tab.
    if (data.help?.device) {
      V2App.addElement(this.#device, 'header', (e) => {
        const paragraphs = data.help.device.split("\n");
        for (const p of paragraphs) {
          V2App.addElement(e, 'p', (e) => {
            e.textContent = p;
          });
        }
      });
    }

    V2App.addElement(this.#device, 'table', (e) => {
      V2App.addElement(e, 'tbody', (body) => {
        for (const key of Object.keys(data.metadata)) {
          if (key === 'product' || key === 'description')
            continue;

          const name = key.charAt(0).toUpperCase() + key.slice(1);
          const value = data.metadata[key];

          V2App.addElement(body, 'tr', (row) => {
            V2App.addElement(row, 'td', (e) => {
              e.textContent = name;
            });

            V2App.addElement(row, 'td', (e) => {
              if (typeof value === 'string' && value.match(/^https?:\/\//)) {
                V2App.addElement(e, 'a', (a) => {
                  a.href = value;
                  a.target = 'home';
                  a.textContent = value.replace(/^https?:\/\//, '');
                });
              } else
                e.textContent = value;
            });
          });
        }
      });
    });

    for (const link of data.links) {
      new V2AppMenu(this.#device, (menu) => {
        menu.addElement('span', (e) => {
          e.textContent = link.description;
        });

        menu.addElement('a', (e) => {
          e.href = link.target;
          e.target = 'links';
          const target = link.target.replace(/^https?:\/\//, '');
          e.innerText = target.split("?")[0];
        });
      });
    }

    // The Statistics tab.
    new V2AppMenu(this.#tabs.statistics, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Refresh';
        e.addEventListener('click', () => {
          this.sendGetAll();
        });
      });
    });

    V2App.addElement(this.#tabs.statistics, 'div', (scroll) => {
      scroll.id = this.id + '.statistics';
      scroll.style.overflowX = 'auto';
      scroll.style.hyphens = 'none';
      scroll.style.width = '100%';
      scroll.style.whiteSpace = 'nowrap';

      V2App.addElement(scroll, 'table', (e) => {
        V2App.addElement(e, 'tbody', (body) => {
          const printObject = (parent, object) => {
            for (const key of Object.keys(object)) {
              let name = key;
              if (parent)
                name = parent + '.' + name;

              const value = object[key];
              if (!isNull(value) && (typeof value === 'object')) {
                printObject(name, value);

              } else {
                V2App.addElement(body, 'tr', (row) => {

                  V2App.addElement(row, 'td', (e) => {
                    e.textContent = name;
                  });

                  V2App.addElement(row, 'td', (e) => {
                    e.textContent = value;
                  });
                });
              }
            }
          };
          printObject(null, data.system);

        });
      });
    });

    // The Firmware tab.
    new V2AppMenu(this.#tabs.firmware.element, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Boot';
        e.addEventListener('click', () => {
          this.sendReboot();
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Ports';
        if (!data.system.hardware?.usb?.ports?.access && !data.system.usb?.ports?.access)
          e.disabled = true;

        e.addEventListener('click', () => {
          this.sendReboot(true);
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Loader';

        e.addEventListener('click', () => {
          this.sendBootloader(true);
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'File';
        e.addEventListener('click', () => {
          this.#openFirmware();
        });

        V2App.addFileDrop(e, this.#tabs.firmware.element, ['warn'], (file) => {
          this.#readFirmware(file);
        });
      });

      menu.addElement('button', (e) => {
        this.#tabs.firmware.elementUpload = e;
        e.classList.add('primary');
        e.disabled = true;
        e.textContent = 'Install';
        e.addEventListener('click', () => {
          this.#uploadFirmware();
        });
      });
    });

    V2App.addElement(this.#tabs.firmware.element, 'progress', (e) => {
      this.#tabs.firmware.elementProgress = e;
      e.style.display = 'none';
      e.value = 0;
    });

    V2App.addElement(this.#tabs.firmware.element, 'div', (e) => {
      e.id = this.id + '.firmware.seclect';
      this.#tabs.firmware.elementSelect = e;
    });

    this.#tabs.firmware.notify = new V2AppNotify(this.#tabs.firmware.element);

    V2App.addElement(this.#tabs.firmware.element, 'div', (e) => {
      e.id = this.id + '.firmware.list';
      this.#tabs.firmware.elementNewFirmware = e;
    });

    this.#tabs.object.switch(this.#tabs.current || 'device');
  }

  #clear() {
    if (this.#tabs.object) {
      this.#tabs.object.element.remove();
      this.#tabs.object = null;
    }

    this.title();

    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    this.#tabs.data = null;
    this.#removeNode();
    this.#tabs.firmware.update.bytes = null;
    this.#tabs.firmware.update.hash = null;
  }

  #reset() {
    this.#tabs.current = null;

    this.#clear();
  }

  // Process the com.versioduo.device message reply message.
  #handleReply(data) {
    this.printDevice('Received <b>com.versioduo.device</b> message');

    // Remember the token from the first reply.
    if (!this.#token && data['token'])
      this.#token = data['token'];

    if (!isNull(data['token']) && (data['token'] !== this.#token)) {
      this.notify.error('The device context changed. Please disconnect and reconnect.');
      this.printDevice('The device context changed. Please disconnect and reconnect.');
      return;
    }

    this.notify.clear();

    if (data.firmware?.status) {
      this.#uploadFirmwareBlock(data.firmware.status);
      return;
    }

    if (!data.metadata) {
      this.printDevice('Missing device info');
      this.disconnect();
      return;
    }

    // If this is the first reply, update the interface;
    if (!this.#tabs.data) {
      this.printDevice('Device is connected');
      this.select.setConnected();
    }

    this.#show(data);
    this.app.callSections('show', data);
  }

  // Connect or switch to a device.
  connect(device) {
    if (this.version) {
      this.version.remove();
      this.version = null;
    }

    this.#disconnectDevice();

    // Give this connection attempt a #sequence number, so we can 'cancel'
    // the promise which might be resolved later, when a new connection
    // attempt is already submitted from the user interface.
    this.#sequence++;
    let sequence = this.#sequence;

    // Try to open the input device.
    device.in.open().then(() => {
      if (sequence !== this.#sequence)
        return;

      // We got the input, try to open the corresponding output device.
      device.out.open().then(() => {
        if (sequence !== this.#sequence)
          return;

        // We have input and output.
        this.device.input = device.in;
        this.device.output = device.out;

        // Dispatch incoming messages to V2MIDIDevice.
        this.device.input.onmidimessage = this.device.handleMessage.bind(this.device);

        // Request info from device.
        this.printDevice('Device is ready');
        this.sendGetAll();
      });
    });

    this.#timeout = setTimeout(() => {
      this.#timeout = null;
      this.log.print('Unable to connect to device <b>' + device.name + '</b>');
    }, 1000);
  }

  // Load 'index.json' and from the 'download' URL and check if there is a firmware update available.
  #loadFirmwareIndex() {
    if (!this.#tabs.data.system?.firmware?.download)
      return;

    this.printDevice('Requesting firmware info: <b>' + this.#tabs.data.system.firmware.download + '/index.json</b>');

    fetch(this.#tabs.data.system.firmware.download + '/index.json', {
      cache: 'no-cache'
    })
      .then((response) => {
        if (!response.ok)
          throw new Error('Status=' + response.status);

        return response.json();
      })
      .then((json) => {
        this.printDevice('Retrieved firmware update index');

        let updates = json[this.#tabs.data.system.firmware.id];
        if (!updates) {
          this.#tabs.firmware.notify.info('No firmware update found for this device.');
          this.printDevice('No firmware update found for this device.');
          return;
        }

        // Remove firmware images for different boards.
        if (this.#tabs.data.system.hardware?.board) {
          updates = updates.filter((update) => {
            return update.board === this.#tabs.data.system.hardware.board;
          });
        }

        if (updates.length === 0) {
          this.#tabs.firmware.notify.info('No firmware update found for this board.');
          this.printDevice('No firmware update found for this board.');
          return;
        }

        // Sort by version number.
        updates.sort((a, b) => {
          return b.version - a.version;
        });

        // Find the first update with a release flag.
        const releaseIndex = updates.findIndex((update) => {
          return update.release;
        });

        // Select the highest version number if no version tagged as release is found, or a higher
        // version number than the last release is already installed. This way, a higher version
        // number which is not tagged as release is manually installed, will continue to update
        // with newer versions ignoring the older release tag. The device stays in "beta releases"
        // until the next release.
        const useRelease = releaseIndex >= 0 && this.#tabs.data.metadata.version <= updates[releaseIndex].version;
        const updateIndex = useRelease ? releaseIndex : 0;

        if (this.#tabs.data.metadata.version > updates[updateIndex].version)
          this.#tabs.firmware.notify.info('A more recent firmware is already installed.');

        this.#tabs.firmware.elementSelect.replaceChildren();

        new V2AppMenu(this.#tabs.firmware.elementSelect, (menu) => {
          menu.addElement('button', (e) => {
            e.textContent = 'Version';
          });

          menu.addElement('select', (select) => {
            if (updates.length === 1)
              select.disabled = true;

            for (let i = 0; i < updates.length; i++) {
              V2App.addElement(select, 'option', (e) => {
                e.value = i;
                e.text = updates[i].version + (i < releaseIndex ? ' (preview)' : '');
                e.selected = i === updateIndex;
              });
            }

            select.addEventListener('change', () => {
              this.#loadFirmware(this.#tabs.data.system.firmware.download + '/' + updates[select.value].file);
            });
          });
        });

        if (this.#tabs.data.system.firmware.hash === updates[updateIndex].hash)
          this.#tabs.firmware.notify.info('The firmware is up-to-date.');

        this.#loadFirmware(this.#tabs.data.system.firmware.download + '/' + updates[updateIndex].file);
      })
      .catch((error) => {
        this.printDevice('Error requesting firmware info: ' + error.message);
      });
  }

  #loadFirmware(filename) {
    this.printDevice('Requesting firmware image: <b>' + filename + '</b>');

    fetch(filename, {
      cache: 'no-cache'
    })
      .then((response) => {
        if (!response.ok)
          throw new Error('Status=' + response.status);

        return response.arrayBuffer();
      })
      .then((buffer) => {
        this.printDevice('Retrieved firmware image, length=' + buffer.byteLength);
        this.#showFirmware(new Uint8Array(buffer));
      })
      .catch((error) => {
        this.printDevice('Error requesting firmware image: ' + error.message);
      });
  }

  #readFirmware(file) {
    const reader = new FileReader();
    reader.onload = (element) => {
      this.#showFirmware(new Uint8Array(reader.result));
    };

    reader.readAsArrayBuffer(file);
  }

  // Load a firmware image from the local disk.
  #openFirmware() {
    this.#tabs.firmware.update.bytes = null;
    this.#tabs.firmware.update.hash = null;

    // Create a temporary 'browse button' and trigger a file upload.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bin';

    input.addEventListener('change', () => {
      this.#readFirmware(input.files[0]);
    }, false);

    input.click();
  }

  // Present a new firmware image to update the current one.
  #showFirmware(bytes) {
    this.#tabs.firmware.notify.clear();
    this.#tabs.firmware.elementNewFirmware.replaceChildren();

    // Read the metadata in the image; the very end of the image contains
    // the the JSON metadata record with a leading and trailing NUL character.
    let metaStart = bytes.length - 2;
    while (bytes[metaStart] !== 0) {
      metaStart--;
      if (metaStart < 4) {
        this.#tabs.firmware.notify.warn('Unknown file type. No valid device metadata found.');
        return;
      }
    }

    const metaBytes = bytes.slice(metaStart + 1, bytes.length - 1);
    const metaString = new TextDecoder().decode(metaBytes);

    let meta;
    try {
      meta = JSON.parse(metaString);

    } catch (error) {
      this.#tabs.firmware.notify.error('Unknown file type. Unable to parse metadata.');
      return;
    }

    const firmware = meta['com.versioduo.firmware'];
    if (!firmware) {
      this.#tabs.firmware.notify.error('Unknown file type. Missing metadata.');
      return;
    }

    // We found metadata in the loaded image.
    this.#tabs.firmware.update.bytes = bytes;

    let elementHash = null;

    V2App.addElement(this.#tabs.firmware.elementNewFirmware, 'table', (table) => {
      V2App.addElement(table, 'tbody', (body) => {
        V2App.addElement(body, 'tr', (row) => {
          V2App.addElement(row, 'td', (e) => {
            e.textContent = 'Version';
          });
          V2App.addElement(row, 'td', (e) => {
            e.textContent = firmware.version;
          });
        });

        V2App.addElement(body, 'tr', (row) => {
          V2App.addElement(row, 'td', (e) => {
            e.textContent = 'Id';
          });
          V2App.addElement(row, 'td', (e) => {
            e.textContent = firmware.id;
          });
        });

        V2App.addElement(body, 'tr', (row) => {
          V2App.addElement(row, 'td', (e) => {
            e.textContent = 'Board';
          });
          V2App.addElement(row, 'td', (e) => {
            e.textContent = firmware.board;
          });
        });

        V2App.addElement(body, 'tr', (row) => {
          V2App.addElement(row, 'td', (e) => {
            e.textContent = 'Hash';
          });
          V2App.addElement(row, 'td', (e) => {
            elementHash = e;
          });
        });
      });
    });

    crypto.subtle.digest('SHA-1', this.#tabs.firmware.update.bytes).then((hash) => {
      const array = Array.from(new Uint8Array(hash));
      const hex = array.map((b) => {
        return b.toString(16).padStart(2, '0');
      }).join('');
      this.#tabs.firmware.update.hash = hex;
      elementHash.textContent = hex;
      const backup = this.#tabs.data.system.hardware?.eeprom?.used ? ' Please backup the configuration before the installation.' : '';

      if (this.#tabs.data.system.hardware?.board && firmware.board !== this.#tabs.data.system.hardware.board)
        this.#tabs.firmware.notify.error('The firmware update is for a different board which has the name <b>' + firmware.board + '</b>.');

      else if (firmware.id !== this.#tabs.data.system.firmware.id)
        this.#tabs.firmware.notify.warn('The firmware update appears to provide a different functionality, it has the name <b>' + firmware.id + '</b>.');

      else if (firmware.version < this.#tabs.data.metadata.version)
        this.#tabs.firmware.notify.warn('The firmware is older than the currently installed version.' + backup);

      else if (this.#tabs.firmware.update.hash === this.#tabs.data.system.firmware.hash)
        this.#tabs.firmware.notify.info('This firmware is currently installed.');

      else
        this.#tabs.firmware.notify.warn('A firmware update is available.' + backup);

      this.#tabs.firmware.elementUpload.disabled = false;
    });
  }

  // Transfer the loded image to the device.
  #uploadFirmware() {
    this.#tabs.firmware.elementProgress.value = 0;
    this.#tabs.firmware.elementProgress.max = this.#tabs.firmware.update.bytes.length;
    this.#tabs.firmware.elementProgress.style.display = '';

    // Send the first block; the reply messages will trigger the remaining blocks.
    this.#tabs.firmware.update.current = 0;
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
          this.#tabs.firmware.notify.error('Error while verifying the transferred firmware.');
          return;

        case 'invalidOffset':
          this.#tabs.firmware.notify.error('Invalid parameters for firmware update.');
          return;

        default:
          this.#tabs.firmware.notify.error('Error while updating the firmware: ' + status);
          return;
      }
    }

    // The last update packet was successful. If the device is connected
    // over USB we will notice the automatic reboot, we will not detect the reboot
    // of a children device, so disconnect it here.
    if (this.#tabs.firmware.update.current === null) {
      this.printDevice('Firmware update successful. Disconnecting device');
      this.disconnect();
      return;
    }

    const offset = this.#tabs.firmware.update.current;
    // The block size is fixed to 8k. Daisy-chained devices might not be able to forward larger packets.
    const block = this.#tabs.firmware.update.bytes.slice(offset, offset + 0x2000);
    const data = btoa(String.fromCharCode.apply(null, block));
    let request = {
      'method': 'writeFirmware',
      'firmware': {
        'offset': offset,
        'data': data
      }
    };

    if (this.#tabs.firmware.update.current + 0x2000 <= this.#tabs.firmware.update.bytes.length) {
      // Prepare for next block.
      this.#tabs.firmware.elementProgress.value = offset;
      this.#tabs.firmware.update.current += 0x2000;

    } else {
      // Last block.
      this.#tabs.firmware.elementProgress.value = this.#tabs.firmware.update.bytes.length;
      this.#tabs.firmware.update.current = null;

      // Add our hash to the request; if the device has received
      // the correct image it copies it over and reboots.
      this.printDevice('Firmware submitted. Requesting device update with hash <b>' + this.#tabs.firmware.update.hash + '</b>');
      request.firmware.hash = this.#tabs.firmware.update.hash;
    }

    this.sendRequest(request);
  }
}
