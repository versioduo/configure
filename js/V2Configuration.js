class V2Configuration extends V2WebModule {
  #device = null;
  #tabs = null;
  #overview = Object.seal({
    element: null
  });
  #edit = Object.seal({
    element: null,
    object: null
  });
  #file = Object.seal({
    element: null,
    object: null
  });

  constructor(device) {
    super('configuration', 'Configuration', 'Edit, backup, restore, reset');
    this.#device = device;

    new V2WebTabs(this.canvas, (tabs) => {
      this.#tabs = tabs;

      tabs.addTab('overview', 'Overview', 'book-open-reader', (e) => {
        this.#overview.element = e;
      });

      tabs.addTab('edit', 'Edit', 'screwdriver-wrench', (e) => {
        this.#edit.element = e;
        this.#edit.object = new V2ConfigurationEdit(device, this.#edit.element);
      });

      tabs.addTab('file', 'File', 'file-code', (e) => {
        this.#file.element = e;
        this.#file.object = new V2ConfigurationFile(device, this.#file.element);
      });
    });

    this.#device.addNotifier('show', (data) => {
      this.#tabs.resetTab('overview');
      this.#tabs.resetTab('edit');
      this.#tabs.resetTab('file');

      V2Web.addMarkup(this.#overview.element, 2,
        'The configuration can be edited and saved to the device. ' +
        'Changes will not be stored or modify the device\'s behavior until the Save ' +
        'button is pressed. Some changes require a device reboot to become active.\n' +
        'The current configuration can be backed-up as a human ' +
        'readable text file. Or the device reset to its factory defaults.');

      if (data.help?.configuration) {
        V2Web.addElement(this.#overview.element, 'hr', (e) => {
          e.classList.add('break');
        });

        V2Web.addMarkup(this.#overview.element, 2, data.help.configuration);
      }

      this.#edit.object.show(data);
      this.#file.object.show(data.configuration);

      if (!this.#tabs.current)
        this.#tabs.switchTab('overview');

      this.attach();
    });

    this.#device.addNotifier('reset', () => {
      this.#tabs.switchTab();
      this.#edit.object.clear();
      this.#file.object.clear();
      this.#tabs.resetTab('overview');
      this.#tabs.resetTab('edit');
      this.#tabs.resetTab('file');

      this.detach();
    });

    return Object.seal(this);
  }

  register(module) {
    this.#edit.object.register(module);
  }
}

class V2ConfigurationEdit {
  #device = null;
  #canvas = null;

  // List of all available/registered modules.
  #modules = {};

  // List of all instantiated modules/sections.
  #sections = [];

  #notify = null;
  #timeout = null;

  constructor(device, canvas) {
    this.#device = device;
    this.#canvas = canvas;

    this.register(V2SettingsCalibration);
    this.register(V2SettingsColour);
    this.register(V2SettingsController);
    this.register(V2SettingsDrum);
    this.register(V2SettingsJSON);
    this.register(V2SettingsNote);
    this.register(V2SettingsToggle);
    this.register(V2SettingsNumber);
    this.register(V2SettingsPulse);
    this.register(V2SettingsText);
    this.register(V2SettingsTitle);
    this.register(V2SettingsUSB);

    return Object.seal(this);
  }

  register(module) {
    this.#modules[module.type] = module;
  }

  show(data) {
    const notify = this.#timeout !== null;
    this.clear();

    V2Web.addButtons(this.#canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Erase';
        e.addEventListener('click', () => {
          this.#erase();
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Reboot';
        e.addEventListener('click', () => {
          this.#device.sendReboot();
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.classList.add('is-link');
        e.textContent = 'Save';
        e.addEventListener('click', () => {
          this.save();
        });
      });
    });

    this.#notify = new V2WebNotify(this.#canvas);

    if (this.#timeout !== null) {
      this.#notify.success('Settings updated.');
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    // USB is a core part of V2Device, andnot ex[licitley exported in the settings array.
    const section = new this.#modules['usb'](this.#device, this, this.#canvas, null, data);
    this.#sections.push(section);

    // Iterate over the device's 'settings' entries. If we find a matching module,
    // instantiate it and show its controls.
    if (data.settings) {
      for (const setting of data.settings) {
        const module = this.#modules[setting.type];
        if (!module)
          continue;

        if ('save' in module.prototype && !setting.path)
          continue;

        const section = new module(this.#device, this, this.#canvas, setting, data);
        this.#sections.push(section);
      }
    }

    if (notify)
      this.#notify.success('Configuration updated.');
  }

  clear() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    for (const section of this.#sections)
      if (section.clear)
        section.clear();

    this.#sections = [];
  }

  save() {
    const configuration = {};

    for (const section of this.#sections)
      if (section.save)
        section.save(configuration);

    this.#device.printDevice('Calling <b>writeConfiguration()</b> ');
    this.#device.sendRequest({
      'method': 'writeConfiguration',
      'configuration': configuration
    });

    this.#timeout = setTimeout(() => {
      this.#timeout = null;
      this.#notify.error('No reply from device. Changes might not be not saved.');
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
  #canvas = null;
  #notify = null;
  #elementJSON = null;
  #timeout = null;
  #maximized = false;

  constructor(device, canvas) {
    this.#device = device;
    this.#canvas = canvas;

    return Object.seal(this);
  }

  show(data) {
    const notify = this.#timeout !== null;
    this.clear();

    V2Web.addButtons(this.#canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Backup';
        e.addEventListener('click', () => {
          this.#save();
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Restore';
        e.addEventListener('click', () => {
          this.#openFile();
        });

        V2Web.addFileDrop(e, this.#canvas, ['is-focused', 'is-link', 'is-light'], (file) => {
          this.#readFile(file);
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.classList.add('is-link');
        e.textContent = 'Save';
        e.addEventListener('click', () => {
          this.#send();
        });
      });
    });

    this.#notify = new V2WebNotify(this.#canvas);

    V2Web.addElement(this.#canvas, 'textarea', (e) => {
      this.#elementJSON = e;
      e.classList.add('textarea');
      e.placeholder = 'No configuration loaded';
      e.rows = 1;
      e.disabled = true;
      e.addEventListener('click', (event) => {
        this.#expand(event);
      });
    });

    this.#elementJSON.value = JSON.stringify(data, null, '  ');
    this.#resize();
    this.#elementJSON.disabled = false;

    if (notify)
      this.#notify.success('Configuration updated.');
  }

  clear() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }

  #resize() {
    const lines = this.#elementJSON.value.split('\n').length;
    if (this.#maximized) {
      this.#elementJSON.rows = lines;

    } else {
      this.#elementJSON.style.height = 'initial';
      this.#elementJSON.rows = Math.min(15, lines);
    }
  }

  // Click to maximize, many-click to minimize.
  #expand(event) {
    if (this.#maximized && event.detail > 3) {
      this.#elementJSON.setSelectionRange(1, 1);
      this.#maximized = false;

    } else if (!this.#maximized)
      this.#maximized = true;

    this.#resize();
  }

  // Parse the JSON text field and reformat it.
  #parse() {
    let configuration;

    try {
      configuration = JSON.parse(this.#elementJSON.value);

    } catch (error) {
      this.#notify.warn(error.toString());

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
  #save() {
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
      this.#notify.clear();

      try {
        const config = JSON.parse(reader.result);

        if (!config.configuration) {
          this.#notify.warn('No valid configuration found in file');
          return;
        }

        const json = JSON.stringify(config.configuration, null, '  ');
        this.#elementJSON.value = json;
        this.#parse();

      } catch (error) {
        this.#notify.warn('Unable to parse JSON from file');
      }
    };

    reader.readAsText(file);
  }

  // Load a JSON file into the text field.
  #openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt,.conf';

    input.addEventListener('change', () => {
      this.#readFile(input.files[0]);
    }, false);

    input.click();

    this.#maximized = true;
    this.#resize();
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

      this.#timeout = setTimeout(() => {
        this.#timeout = null;
        this.#notify.error('No reply from device. Configuration might not be not saved.');
        this.#device.printDevice('No reply from device');
      }, 1000);
    }
  }
}
