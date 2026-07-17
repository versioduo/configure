class V2Device extends V2Connection {
  #data = null;
  #title = null;
  #tabs = null;
  #device = null;
  #statistics = null;
  #update = Object.seal({
    element: null,
    elementSelect: null,
    elementNewFirmware: null,
    elementUpload: null,
    elementProgress: null,
    notify: null,
    firmware: Object.seal({
      bytes: null,
      hash: null,
      current: null
    })
  });
  #timeout = null;
  #sequence = 0;
  #token = null;

  constructor(log, connect) {
    super(log, connect);

    this.select.element.classList.add('center');

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

    return Object.seal(this);
  }

  getData() {
    return this.#data;
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
    this.printDevice('Calling <b>getAll()</b>');
    this.sendRequest({
      'method': 'getAll'
    });
    this.printDevice('Waiting for reply ...');
  }

  #disconnectDevice() {
    if (!this.device.input)
      return;

    this.printDevice('Disconnecting');

    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    this.device.disconnect();
    this.#token = null;
    this.#clear();

    for (const notifier of this.notifiers.reset)
      notifier();

    this.select.focus();
    window.scroll(0, 0);
  }

  disconnect() {
    this.#disconnectDevice();
    this.select.setDisconnected();
  }

  sendReset() {
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

  #show(data) {
    this.#data = data;

    if (!this.#title) {
      this.title(data.metadata.product, data.metadata.description);
    }

    if (!this.#tabs) {
      new V2WebTabs(this.canvas, (tabs) => {
        this.#tabs = tabs;

        tabs.addTab('device', 'Device', 'plug', (e) => {
          this.#device = e;
        });

        tabs.addTab('statistics', 'Statistics', 'magnifying-glass-chart', (e) => {
          this.#statistics = e;
        });

        tabs.addTab('firmware', 'Firmware', 'microchip', (e) => {
          this.#update.element = e;
        });

        // Check for firmware updates when activating the tab.
        tabs.addNotifier((name) => {
          if (name === 'firmware')
            this.#loadFirmwareIndex();
        });
      });

    } else {
      this.#tabs.resetTab('device');
      this.#tabs.resetTab('statistics');
      this.#tabs.resetTab('firmware');
      this.#update.firmware.bytes = null;
      this.#update.firmware.hash = null;
    }

    // The Information tab.
    if (data.help?.device) {
      V2Web.addElement(this.#device, 'header', (e) => {
        const paragraphs = data.help.device.split("\n");
        for (const p of paragraphs) {
          V2Web.addElement(e, 'p', (e) => {
            e.textContent = p;
          });
        }
      });
    }

    V2Web.addElement(this.#device, 'table', (e) => {
      V2Web.addElement(e, 'tbody', (body) => {
        for (const key of Object.keys(data.metadata)) {
          if (key === 'product' || key === 'description')
            continue;

          const name = key.charAt(0).toUpperCase() + key.slice(1);
          const value = data.metadata[key];

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = name;
            });

            V2Web.addElement(row, 'td', (e) => {
              if (typeof value === 'string' && value.match(/^https?:\/\//)) {
                V2Web.addElement(e, 'a', (a) => {
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
      new V2WebMenu(this.#device, (menu) => {
        menu.addElement('span', (e) => {
          e.textContent = link.description;
        });

        menu.addElement('a', (e) => {
          e.href = link.target;
          const target = link.target.replace(/^https?:\/\//, '');
          e.innerText = target.split("?")[0];
        });
      });
    }


    // The Details tab.
    new V2WebMenu(this.#statistics, (menu) => {
      menu.addElement('button', (e) => {
        e.classList.add('link');
        e.textContent = 'Refresh';
        e.addEventListener('click', () => {
          this.sendGetAll();
        });
      });
    });

    V2Web.addElement(this.#statistics, 'table', (e) => {
      V2Web.addElement(e, 'tbody', (body) => {
        const printObject = (parent, object) => {
          for (const key of Object.keys(object)) {
            let name = key;
            if (parent)
              name = parent + '.' + name;

            const value = object[key];
            if (!isNull(value) && (typeof value === 'object')) {
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
          }
        };
        printObject(null, data.system);

      });
    });

    // The Firmware tab.
    new V2WebMenu(this.#update.element, (menu) => {
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

        V2Web.addFileDrop(e, this.#update.element, ['is-focused', 'link', 'is-light'], (file) => {
          this.#readFirmware(file);
        });
      });

      menu.addElement('button', (e) => {
        this.#update.elementUpload = e;
        e.classList.add('link');
        e.disabled = true;
        e.textContent = 'Install';
        e.addEventListener('click', () => {
          this.#uploadFirmware();
        });
      });
    });

    V2Web.addElement(this.#update.element, 'progress', (e) => {
      this.#update.elementProgress = e;
      e.style.display = 'none';
      e.value = 0;
    });

    this.#update.notify = new V2WebNotify(this.#update.element);

    V2Web.addElement(this.#update.element, 'div', (e) => {
      this.#update.elementSelect = e;
    });

    V2Web.addElement(this.#update.element, 'div', (e) => {
      this.#update.elementNewFirmware = e;
    });

    if (!this.#tabs.current || this.#tabs.current === 'firmware')
      this.#tabs.switchTab('device');
  }

  #clear() {
    this.title();

    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    if (!this.#data)
      return;

    this.#data = null;
    this.#tabs.remove();
    this.#tabs = null;
    this.#update.firmware.bytes = null;
    this.#update.firmware.hash = null;
  }

  // Process the com.versioduo.device message reply message.
  #handleReply(data) {
    this.printDevice('Received <b>com.versioduo.device</b> message');

    // Remember the token from the first reply.
    if (!this.#token && data['token'])
      this.#token = data['token'];

    if (!isNull(data['token']) && (data['token'] !== this.#token)) {
      this.printDevice('Wrong token, ignoring message');
      return;
    }

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
    if (!this.#data) {
      this.printDevice('Device is connected');
      this.select.setConnected();
    }

    this.#show(data);

    // Detach the Log section and attach it again after all other sections.
    this.log.detach();

    for (const notifier of this.notifiers.show)
      notifier(data);

    this.log.attach();
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
      this.disconnect();
    }, 2000);
  }

  // Load 'index.json' and from the 'download' URL and check if there is a firmware update available.
  #loadFirmwareIndex() {
    if (!this.#data.system?.firmware?.download)
      return;

    this.printDevice('Requesting firmware info: <b>' + this.#data.system.firmware.download + '/index.json</b>');

    fetch(this.#data.system.firmware.download + '/index.json', {
      cache: 'no-cache'
    })
      .then((response) => {
        if (!response.ok)
          throw new Error('Status=' + response.status);

        return response.json();
      })
      .then((json) => {
        this.printDevice('Retrieved firmware update index');

        let updates = json[this.#data.system.firmware.id];
        if (!updates) {
          this.#update.notify.info('No firmware update found for this device.');
          this.printDevice('No firmware update found for this device.');
          return;
        }

        // Remove firmware images for different boards.
        if (this.#data.system.hardware?.board) {
          updates = updates.filter((update) => {
            return update.board === this.#data.system.hardware.board;
          });
        }

        if (updates.length === 0) {
          this.#update.notify.info('No firmware update found for this board.');
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
        const useRelease = releaseIndex >= 0 && this.#data.metadata.version <= updates[releaseIndex].version;
        const updateIndex = useRelease ? releaseIndex : 0;

        if (this.#data.metadata.version > updates[updateIndex].version)
          this.#update.notify.info('A more recent firmware is already installed.');

        while (this.#update.elementSelect.firstChild)
          this.#update.elementSelect.firstChild.remove();

        new V2WebMenu(this.#update.elementSelect, (menu) => {
          menu.addElement('button', (e) => {
            e.textContent = 'Version';
          });

          menu.addElement('select', (select) => {
            if (updates.length === 1)
              select.disabled = true;

            for (let i = 0; i < updates.length; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.value = i;
                e.text = updates[i].version + (i < releaseIndex ? ' (preview)' : '');
                e.selected = i === updateIndex;
              });
            }

            select.addEventListener('change', () => {
              this.#loadFirmware(this.#data.system.firmware.download + '/' + updates[select.value].file);
            });
          });
        });

        if (this.#data.system.firmware.hash === updates[updateIndex].hash)
          this.#update.notify.info('The firmware is up-to-date.');

        else
          this.#loadFirmware(this.#data.system.firmware.download + '/' + updates[updateIndex].file);

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
    this.#update.firmware.bytes = null;
    this.#update.firmware.hash = null;

    // Temporarily create a hidden 'browse button' and trigger a file upload.
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
    this.#update.notify.clear();
    while (this.#update.elementNewFirmware.firstChild)
      this.#update.elementNewFirmware.firstChild.remove();

    // Read the metadata in the image; the very end of the image contains
    // the the JSON metadata record with a leading and trailing NUL character.
    let metaStart = bytes.length - 2;
    while (bytes[metaStart] !== 0) {
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
      this.#update.notify.error('Unknown file type. Unable to parse metadata.');
      return;
    }

    const firmware = meta['com.versioduo.firmware'];
    if (!firmware) {
      this.#update.notify.error('Unknown file type. Missing metadata.');
      return;
    }

    // We found metadata in the loaded image.
    this.#update.firmware.bytes = bytes;

    let elementHash = null;

    V2Web.addElement(this.#update.elementNewFirmware, 'table', (table) => {
      V2Web.addElement(table, 'tbody', (body) => {
        V2Web.addElement(body, 'tr', (row) => {
          V2Web.addElement(row, 'td', (e) => {
            e.textContent = 'Version';
          });
          V2Web.addElement(row, 'td', (e) => {
            e.textContent = firmware.version;
          });
        });

        V2Web.addElement(body, 'tr', (row) => {
          V2Web.addElement(row, 'td', (e) => {
            e.textContent = 'Id';
          });
          V2Web.addElement(row, 'td', (e) => {
            e.textContent = firmware.id;
          });
        });

        V2Web.addElement(body, 'tr', (row) => {
          V2Web.addElement(row, 'td', (e) => {
            e.textContent = 'Board';
          });
          V2Web.addElement(row, 'td', (e) => {
            e.textContent = firmware.board;
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

    crypto.subtle.digest('SHA-1', this.#update.firmware.bytes).then((hash) => {
      const array = Array.from(new Uint8Array(hash));
      const hex = array.map((b) => {
        return b.toString(16).padStart(2, '0');
      }).join('');
      this.#update.firmware.hash = hex;
      elementHash.textContent = hex;
      const backup = this.#data.system.hardware?.eeprom?.used ? ' Please backup the configuration before the installation.' : '';

      if (this.#data.system.hardware?.board && firmware.board !== this.#data.system.hardware.board)
        this.#update.notify.error('The firmware update is for a different board which has the name <b>' + firmware.board + '</b>.');

      else if (firmware.id !== this.#data.system.firmware.id)
        this.#update.notify.warn('The firmware update appears to provide a different functionality, it has the name <b>' + firmware.id + '</b>.');

      else if (firmware.version < this.#data.metadata.version)
        this.#update.notify.warn('The firmware is older than the currently installed version.' + backup);

      else if (this.#update.firmware.hash === this.#data.system.firmware.hash)
        this.#update.notify.info('This firmware is currently installed.');

      else
        this.#update.notify.warn('A firmware update is available.' + backup);

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
    if (this.#update.firmware.current === null) {
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
