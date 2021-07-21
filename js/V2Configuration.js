// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

class V2Configuration extends V2WebModule {
  #device = null;
  #tabs = null;
  #settings = {
    element: null,
    object: null
  };
  #system = {
    element: null,
    object: null
  };

  constructor(device) {
    super('configuration', 'Configuration', 'Setup, backup, restore, reset');
    super.attach();
    this.#device = device;

    new V2WebTabs(this.canvas, (tabs) => {
      this.#tabs = tabs;

      tabs.addTab('settings', 'Settings', (e) => {
        this.#settings.element = e;
        this.#settings.object = new V2ConfigurationSettings(device, this.#settings.element);
      });

      tabs.addTab('system', 'System', (e) => {
        this.#system.element = e;
        this.#system.object = new V2ConfigurationSystem(device, this.#system.element);
      });
    });

    this.#device.notifiers.show.push((data) => {
      this.#tabs.resetTab('settings');
      this.#tabs.resetTab('system');
      this.#settings.object.show(data);
      this.#system.object.show(data.configuration);

      if (!this.#tabs.current)
        this.#tabs.switchTab('settings');
    });

    this.#device.notifiers.reset.push(() => {
      this.#tabs.switchTab();
      this.#settings.object.clear();
      this.#system.object.clear();
      this.#tabs.resetTab('settings');
      this.#tabs.resetTab('system');
    });
  }

  register(module) {
    this.#settings.object.modules[module.type] = module;
  }
}

class V2ConfigurationSettings {
  #device = null;
  #canvas = null;

  // List of all available/registered modules.
  modules = {};

  // List of all instantiated modules/sections.
  #sections = [];

  #notify = null;
  #timeout = null;

  constructor(device, canvas) {
    this.#device = device;
    this.#canvas = canvas;
  }

  show(data) {
    this.clear();

    new V2WebField(this.#canvas, (field) => {
      field.addButton((e) => {
        e.textContent = 'Reboot';
        e.title = 'Reboot the device';
        e.addEventListener('click', () => {
          this.#device.sendReboot();
        });
      });

      field.addButton((e) => {
        e.classList.add('is-link');
        e.textContent = 'Save';
        e.title = 'Store the settings';
        e.addEventListener('click', () => {
          this.save();
        });
      });
    });

    this.#notify = new V2WebNotify(this.#canvas);

    if (this.#timeout != null) {
      this.#notify.success('Settings updated.');
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    // All devices have a USB section.
    if (this.modules['usb']) {
      const section = new this.modules['usb'](this.#device, this, this.#canvas, null, data);
      this.#sections.push(section);
    }

    // Iterate over the device's 'settings' entries. If we find a matching module,
    // instantiate it and show the content.
    if (Array.isArray(data.settings)) {
      data.settings.forEach((setting) => {
        const module = this.modules[setting.type];
        if (!module)
          return;

        const section = new module(this.#device, this, this.#canvas, setting, data);
        this.#sections.push(section);
      });
    }
  }

  clear() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    this.#sections.forEach((section) => {
      if (section.clear)
        section.clear();
    });

    this.#sections = [];
  }

  save() {
    const configuration = {};

    this.#sections.forEach((section) => {
      section.save(configuration);
    });

    this.#device.printDevice('Calling <b>writeConfiguration()</b> ');
    this.#device.sendRequest({
      'method': 'writeConfiguration',
      'configuration': configuration
    });
    this.#device.setEnabled(false);

    this.#timeout = setTimeout(() => {
      this.#timeout = null;
      this.#notify.error('No reply from device. Changes might not be not saved.');
      this.#device.setEnabled(true);
      this.#device.printDevice('No reply from device');
    }, 1000);
  }
}

class V2ConfigurationSystem {
  #device = null;
  #canvas = null;
  #notify = null;
  #elementJSON = null;
  #timeout = null;
  #maximized = false;

  constructor(device, canvas) {
    this.#device = device;
    this.#canvas = canvas;
  }

  show(data) {
    const notify = this.#timeout != null;
    this.clear();

    new V2WebField(this.#canvas, (field) => {
      field.addButton((e) => {
        e.textContent = 'Backup';
        e.title = 'Write the configuration to a file';
        e.addEventListener('click', () => {
          this.#save();
        });
      });

      field.addButton((e) => {
        e.textContent = 'Restore';
        e.title = 'Read a configuration from a file';
        e.addEventListener('click', () => {
          this.#open();
        });
      });

      field.addButton((e) => {
        e.textContent = 'Erase';
        e.title = 'Reset everything to defaults and reboot the device';
        e.addEventListener('click', () => {
          this.#erase();
        });
      });

      field.addButton((e) => {
        e.classList.add('is-link');
        e.textContent = 'Save';
        e.title = 'Store this configuration in the device';
        e.addEventListener('click', () => {
          this.#send();
        });
      });
    });

    this.#notify = new V2WebNotify(this.#canvas);

    V2Web.addElement(this.#canvas, 'textarea', (e) => {
      this.#elementJSON = e;
      e.classList.add('textarea');
      e.classList.add('isEnabled');
      e.placeholder = 'No configuration loaded';
      e.rows = 1;
      e.disabled = true;
      e.addEventListener('click', (event) => {
        this.#expand(event);
      });
    });

    if (notify)
      this.#notify.success('Configuration updated.');

    this.#elementJSON.value = JSON.stringify(data, null, '  ');
    this.#resize();
    this.#elementJSON.disabled = false;
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

  // Click to maximize, triple-click to minimize.
  #expand(event) {
    if (this.#maximized && event.detail == 3) {
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

    this.show(configuration);
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
      'vendor': this.#device.data.metadata.vendor,
      'product': this.#device.data.metadata.product,
      'version': this.#device.data.metadata.version,
      'serial': this.#device.data.metadata.serial,
      'creator': window.location.href,
      'date': date.toISOString(),
      'configuration': configuration
    };

    const json = JSON.stringify(config, null, '  ');
    let name = this.#device.data.metadata.product;
    if (this.#device.data.metadata.name)
      name += '-' + this.#device.data.metadata.name;
    name += '.json';

    // Temporarily create an anchor and download the file as URI.
    const a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(json));
    a.setAttribute('download', name.replace(/ /g, '-'));
    a.style.display = 'none';
    a.click();
  }

  // Load a JSON file into the text field.
  #open() {
    // Temporarily create a 'browse button' and trigger a file upload.
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', '.json,.txt,.conf');
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const reader = new FileReader();
      reader.onload = (element) => {
        let config;

        try {
          config = JSON.parse(reader.result);

        } catch (error) {
          this.#notify.warn('Unable to parse JSON from file');
          return;
        }

        if (!config.configuration) {
          this.#notify.warn('No valid configuration found in file');
          return;
        }

        const json = JSON.stringify(config.configuration, null, '  ');
        this.#elementJSON.value = json;
        this.#parse();
      };

      reader.readAsText(input.files[0]);
      input.remove();
    });

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

      this.#device.setEnabled(false);

      this.#timeout = setTimeout(() => {
        this.#timeout = null;
        this.#notify.error('No reply from device. Configuration might not be not saved.');
        this.#device.printDevice('No reply from device');
        this.#device.setEnabled(true);
      }, 1000);
    }
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
