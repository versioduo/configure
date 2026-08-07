class V2Configuration extends V2AppSection {
  #tabs = Object.seal({
    object: null,
    current: null,
    overview: Object.seal({
      element: null
    }),
    edit: Object.seal({
      element: null,
      object: null,
      notify: null,
      timeout: null
    }),
    file: Object.seal({
      element: null,
      object: null,
      notify: null,
      timeout: null
    })
  });

  constructor(app) {
    super(app, 'configuration', '--gear', 'Configuration', 'Edit, Backup, Restore, Reset');
    Object.seal(this);
  }

  show(data) {
    this.removeSection();
    this.addSection();

    new V2AppTabs(this.canvas, (tabs) => {
      this.#tabs.object = tabs;
      tabs.element.id = this.id + '.tabs';

      tabs.add('overview', '--book-open-reader', 'Overview', (e) => {
        this.#tabs.overview.element = e;
        e.id = tabs.element.id + '.overview';
      });

      tabs.add('edit', '--sliders', 'Edit', (e) => {
        this.#tabs.edit.element = e;
        this.#tabs.edit.object = new V2ConfigurationEdit(this.app.device, this.#tabs.edit);
        e.id = tabs.element.id + '.edit';
      });

      tabs.add('file', '--file-code', 'File', (e) => {
        this.#tabs.file.element = e;
        this.#tabs.file.object = new V2ConfigurationFile(this.app.device, this.#tabs.file);
        e.id = tabs.element.id + '.file';
      });

      tabs.addNotifier((name) => {
        this.#tabs.current = name;
      });
    });

    V2App.addElement(this.#tabs.overview.element, 'header', (e) => {
      V2App.addMarkup(e,
        'The configuration can be edited and saved to the device. ' +
        'Changes will not be stored or modify the device\'s behavior until the Save ' +
        'button is pressed. Some changes require a device reboot to become active.\n' +
        'The current configuration can be backed-up as a human ' +
        'readable text file. Or the device reset to its factory defaults.');

      if (data.help?.configuration) {
        V2App.addElement(e, 'hr');
        V2App.addMarkup(e, data.help.configuration);
      }
    });

    this.#tabs.edit.object.show(data);
    this.#tabs.file.object.show(data.configuration);
    this.#tabs.object.switch(this.#tabs.current || 'overview');
  }

  reset() {
    this.#tabs.edit.object?.clear();
    this.#tabs.file.object?.clear();
    this.#tabs.current = null;
    this.removeSection();
  }

  register(module) {
    this.#tabs.edit.object.register(module);
  }
}

class V2ConfigurationEdit {
  #device = null;
  #tab = null;
  #modules = {};
  #entries = [];

  constructor(device, tab) {
    Object.seal(this);
    this.#device = device;
    this.#tab = tab;

    this.register(V2SettingsCalibration);
    this.register(V2SettingsColour);
    this.register(V2SettingsController);
    this.register(V2SettingsDrum);
    this.register(V2SettingsFilter);
    this.register(V2SettingsJSON);
    this.register(V2SettingsNote);
    this.register(V2SettingsToggle);
    this.register(V2SettingsNumber);
    this.register(V2SettingsPulse);
    this.register(V2SettingsText);
    this.register(V2SettingsTitle);
    this.register(V2SettingsUSB);
  }

  register(module) {
    this.#modules[module.type] = module;
  }

  show(data) {
    new V2AppMenu(this.#tab.element, (menu) => {
      menu.addElement('button', (e) => {
        e.classList.add('danger');
        e.textContent = 'Erase';
        e.addEventListener('click', () => {
          this.#erase();
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Reboot';
        e.addEventListener('click', () => {
          this.#device.sendReboot();
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Refresh';
        e.addEventListener('click', () => {
          this.#tab.notify.clear();
          this.#device.sendGetAll();
        });
      });

      menu.addElement('button', (e) => {
        e.classList.add('primary');
        e.textContent = 'Save';
        e.addEventListener('click', () => {
          this.save();
        });
      });
    });

    if (this.#tab.notify)
      this.#tab.element.appendChild(this.#tab.notify.element);
    else
      this.#tab.notify = new V2AppNotify(this.#tab.element);

    if (this.#tab.timeout !== null) {
      this.#tab.notify.info('The configuration was updated.');
      clearTimeout(this.#tab.timeout);
      this.#tab.timeout = null;
    }

    V2App.addElement(this.#tab.element, 'ul', (cards) => {
      cards.classList.add('cards');

      // USB is a core part of V2Device, and not explicitly exported in the settings array.
      V2App.addElement(cards, 'li', (c) => {
        this.#entries.push(new this.#modules['usb'](this.#device, this, c, null, data));
      });

      // Iterate over the device's 'settings' entries. If we find a matching module,
      // instantiate it and show its controls.
      if (data.settings) {
        let card = null;

        for (const setting of data.settings) {
          const module = this.#modules[setting.type];
          if (!module)
            continue;

          if ('save' in module.prototype && !setting.path)
            continue;

          if (!card || setting.type === 'title')
            card = V2App.addElement(cards, 'li');

          this.#entries.push(new module(this.#device, this, card, setting, data));
        }
      }
    });
  }

  clear() {
    this.#tab.notify.clear();

    if (this.#tab.timeout) {
      clearTimeout(this.#tab.timeout);
      this.#tab.timeout = null;
    }

    for (const entry of this.#entries)
      if (entry.clear)
        entry.clear();

    this.#entries = [];
  }

  save() {
    const configuration = {};

    for (const entry of this.#entries)
      if (entry.save)
        entry.save(configuration);

    this.#device.printDevice('Calling <b>writeConfiguration()</b> ');
    this.#device.sendRequest({
      'method': 'writeConfiguration',
      'configuration': configuration
    });

    this.#tab.timeout = setTimeout(() => {
      this.#tab.timeout = null;
      this.#tab.notify.error('No reply from device. Changes might not be not saved.');
      this.#device.printDevice('No reply from device');
    }, 1000);
  }

  // Factory reset.
  #erase() {
    this.#device.printDevice('Calling <b>eraseConfiguration()</b> command');
    this.#device.sendRequest({
      'method': 'eraseConfiguration'
    });

    this.#device.disconnect();
  }
}

class V2ConfigurationFile {
  #device = null;
  #tab = null;
  #elementJSON = null;

  constructor(device, tab) {
    Object.seal(this);
    this.#device = device;
    this.#tab = tab;
  }

  show(data) {
    new V2AppMenu(this.#tab.element, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Backup';
        e.addEventListener('click', () => {
          this.#saveFile();
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Restore';
        e.addEventListener('click', () => {
          this.#tab.notify.clear();
          this.#openFile();
        });

        V2App.addFileDrop(e, this.#tab.element, ['warn'], (file) => {
          this.#tab.notify.clear();
          this.#readFile(file);
        });
      });

      menu.addElement('button', (e) => {
        e.classList.add('primary');
        e.textContent = 'Save';
        e.addEventListener('click', () => {
          this.#tab.notify.clear();
          this.#send();
        });
      });
    });

    if (this.#tab.notify)
      this.#tab.element.appendChild(this.#tab.notify.element);
    else
      this.#tab.notify = new V2AppNotify(this.#tab.element);

    if (this.#tab.timeout !== null) {
      this.#tab.notify.info('The configuration was updated.');
      clearTimeout(this.#tab.timeout);
      this.#tab.timeout = null;
    }

    V2App.addElement(this.#tab.element, 'textarea', (e) => {
      this.#elementJSON = e;
      e.placeholder = 'No configuration loaded';
      e.disabled = true;
    });

    this.#elementJSON.value = JSON.stringify(data, null, '  ');
    this.#elementJSON.rows = this.#elementJSON.value.split('\n').length + 1;
    this.#elementJSON.disabled = false;
  }

  clear() {
    this.#tab.notify?.clear();

    if (this.#tab.timeout) {
      clearTimeout(this.#tab.timeout);
      this.#tab.timeout = null;
    }
  }

  // Parse the JSON text field and reformat it.
  #parse() {
    let configuration;

    try {
      configuration = JSON.parse(this.#elementJSON.value);

    } catch (error) {
      this.#tab.notify.warn(error.toString());

      // Try to find the position in the error string and place the cursor.
      const match = error.toString().match(/position (\d+)/);
      if (match) {
        const position = Number(match[1]);
        this.#elementJSON.setSelectionRange(position, position + 1);
      }
      this.#elementJSON.focus();
      this.#device.print('Unable to parse JSON: ' + error);
      return;
    }

    return configuration;
  }

  // Save the current JSON text field to a file.
  #saveFile() {
    this.#tab.notify.clear();
    const configuration = this.#parse();
    if (!configuration)
      return;

    const date = new Date();
    const config = {
      '#': 'Device configuration export',
      'vendor': this.#device.getData().metadata.vendor,
      'product': this.#device.getData().metadata.product,
      'version': this.#device.getData().metadata.version,
      'serial': this.#device.getData().metadata.serial,
      'creator': window.location.href,
      'date': date.toISOString(),
      'configuration': configuration
    };

    const json = JSON.stringify(config, null, '  ');

    let filename = this.#device.getData().metadata.product;
    const name = this.#device.getData().system.name;
    if (name) {
      if (name.startsWith(filename))
        filename = name;

      else
        filename += '-' + name;
    }
    filename = filename.replace(/ /g, '-') + '.json';

    const url = URL.createObjectURL(new Blob([json], {
      type: 'application/json'
    }));

    // Temporarily create an anchor and download the file as URI.
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  #readFile(file) {
    const reader = new FileReader();
    reader.onload = (element) => {

      try {
        const config = JSON.parse(reader.result);

        if (!config.configuration) {
          this.#tab.notify.warn('No valid configuration found in file');
          return;
        }

        const json = JSON.stringify(config.configuration, null, '  ');
        this.#elementJSON.value = json;
        this.#parse();

      } catch (error) {
        this.#tab.notify.warn('Unable to parse JSON from file');
      }
    };

    reader.readAsText(file);
  }

  // Load a JSON file into the text field.
  #openFile() {
    // Create a temporary 'browse button' and trigger a file upload.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt,.conf';

    input.addEventListener('change', () => {
      this.#readFile(input.files[0]);
    }, false);

    input.click();
  }

  // Send the configuration to the device.
  #send() {
    const data = this.#parse();
    if (data) {
      this.#device.printDevice('Calling <b>writeConfiguration()</b>');
      this.#device.sendRequest({
        'method': 'writeConfiguration',
        'configuration': data
      });

      this.#tab.timeout = setTimeout(() => {
        this.#tab.timeout = null;
        this.#tab.notify.error('No reply from device. Configuration might not be not saved.');
        this.#device.printDevice('No reply from device');
      }, 1000);
    }
  }
}
