// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

class V2SettingsModule {
  device = null;
  settings = null;

  constructor(device, settings) {
    this.device = device;
    this.settings = settings;
  }

  addTitle(canvas, text) {
    V2Web.addElement(canvas, 'h3', (e) => {
      e.classList.add('title');
      e.classList.add('subsection');
      e.textContent = text;
    });
  }
}

// The USB properties. All devices support a custom name, the ports value is optional.
class V2SettingsUSB extends V2SettingsModule {
  static type = 'usb';

  #name = {
    element: null
  };
  #ports = {
    element: null
  };

  constructor(device, settings, canvas, setting, data) {
    super(device, settings);
    super.addTitle(canvas, 'USB');

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'Name';
        e.tabIndex = -1;
      });

      field.addInput('text', (e) => {
        this.#name.element = e;
        e.title = 'The USB device name';
        e.maxLength = 31;
        if (data.system.name)
          e.value = data.system.name;
        e.placeholder = data.metadata.product;
      });
    });

    // The number of MIDI ports.
    if (data.system.ports && data.system.ports.announce > 0) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Ports';
          e.tabIndex = -1;
        });

        field.addElement('span', (e) => {
          e.classList.add('select');

          V2Web.addElement(e, 'select', (select) => {
            this.#ports.element = select;
            select.title = 'The number of MIDI ports';

            for (let i = 1; i < 17; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.title = i;
                e.value = i;
                e.text = i;
                if (i == data.system.ports.configured)
                  e.selected = true;
              });
            }
          });
        });
      });
    }
  }

  save(configuration) {
    configuration.usb = {
      'name': this.#name.element.value
    };

    if (this.#ports.element)
      configuration.usb.ports = Number(this.#ports.element.value);
  }
}

// The MIDI properties. Some devices support to configure the outgoing MIDI channel.
class V2SettingsMIDI extends V2SettingsModule {
  static type = 'midi';

  #channel = {
    element: null
  };

  constructor(device, settings, canvas, setting, data) {
    super(device, settings);
    super.addTitle(canvas, 'MIDI');

    new V2WebField(canvas, (field) => {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Channel';
          e.tabIndex = -1;
        });

        field.addElement('span', (e) => {
          e.classList.add('select');

          V2Web.addElement(e, 'select', (select) => {
            this.#channel.element = select;
            select.title = 'The MIDI Channel';

            for (let i = 1; i < 17; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.title = i;
                e.value = i;
                e.text = i;
                if (i == data.output.channel + 1)
                  e.selected = true;
              });
            }
          });
        });
      });
    });
  }

  save(configuration) {
    configuration.midi = {
      'channel': Number(this.#channel.element.value)
    };
  }
}

// Single controller configuration.
class V2SettingsController extends V2SettingsModule {
  static type = 'controller';

  #controller = {
    element: null,
    configuration: null
  };

  constructor(device, settings, canvas, setting, data) {
    super(device, settings);
    super.addTitle(canvas, 'Controller');

    this.#controller.configuration = setting.configuration;

    let controller = null;
    let range = null;

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        controller = e;
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.tabIndex = -1;
        e.textContent = 'CC ' + data.configuration.controller;
      });

      field.addInput('number', (e) => {
        this.#controller.element = e;
        e.classList.add('width-number');
        e.title = 'The controller number';
        e.min = 0;
        e.max = 127;
        e.value = data.configuration.controller;
        e.addEventListener('input', () => {
          controller.textContent = 'CC ' + e.value;
          range.value = e.value;
        });
      });
    });

    V2Web.addElement(canvas, 'input', (e) => {
      range = e;
      e.classList.add('range');
      e.type = 'range';
      e.title = 'The controller number';
      e.min = 0;
      e.max = 127;
      e.value = this.#controller.element.value;
      e.addEventListener('input', () => {
        this.#controller.element.value = Number(e.value);
        controller.textContent = 'CC ' + e.value;
      });
    });
  }

  save(configuration) {
    configuration[this.#controller.configuration] = this.#controller.element.value;
  }
}

// Drum pad MIDI settings.
class V2SettingsDrum extends V2SettingsModule {
  static type = 'drum';

  #controller = {
    element: null
  };
  #note = {
    element: null
  };
  #sensitivity = {
    element: null
  };

  constructor(device, settings, canvas, setting, data) {
    super(device, settings);
    super.addTitle(canvas, 'Drum');

    if (data.configuration.drum.controller != null) {
      let controller = null;
      let range = null;

      const updateController = (value) => {
        if (value > 0)
          controller.textContent = 'CC ' + value;
        else
          controller.textContent = 'Off';
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          controller = e;
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#controller.element = e;
          e.classList.add('width-number');
          e.title = 'The controller number';
          e.min = 0;
          e.max = 127;
          e.value = data.configuration.drum.controller;
          e.addEventListener('input', () => {
            updateController(e.value);
            range.value = e.value;
          });

          updateController(e.value);
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The controller number';
        e.min = 0;
        e.max = 127;
        e.value = this.#controller.element.value;
        e.addEventListener('input', () => {
          this.#controller.element.value = Number(e.value);
          updateController(e.value);
        });
      });
    }

    if (data.configuration.drum.note != null) {
      let note = null;
      let range = null;

      const updateNote = (number) => {
        note.textContent = V2MIDI.Note.name(number);
        if (V2MIDI.Note.isBlack(number)) {
          note.classList.add('is-dark');
          note.classList.remove('has-background-grey-lighter');
        } else {
          note.classList.remove('is-dark');
          note.classList.add('has-background-grey-lighter');
        }
      }

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          note = e;
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#note.element = e;
          e.classList.add('width-number');
          e.title = 'The note number';
          e.min = 0;
          e.max = 127;
          e.value = data.configuration.drum.note;
          e.addEventListener('input', () => {
            updateNote(e.value);
            range.value = e.value;
          });

          updateNote(e.value);
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The note number';
        e.min = 0;
        e.max = 127;
        e.value = this.#note.element.value;
        e.addEventListener('input', () => {
          this.#note.element.value = Number(e.value);
          updateNote(e.value);
        });
      });
    }

    if (data.configuration.drum.sensitivity != null) {
      let sensitivity = null;
      let range = null;

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          sensitivity = e;
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.classList.add('has-background-grey-lighter');
          e.tabIndex = -1;
          e.textContent = 'Sensitivity';
        });

        field.addInput('number', (e) => {
          this.#sensitivity.element = e;
          e.classList.add('width-label'); // -0.99 does not fit
          e.title = 'The sensitivity';
          e.min = -0.99;
          e.max = 0.99;
          e.step = 0.01;
          e.value = data.configuration.drum.sensitivity;
          e.addEventListener('input', () => {
            range.value = e.value;
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The sensitivity';
        e.min = -0.99;
        e.max = 0.99;
        e.step = 0.01;
        e.value = this.#sensitivity.element.value;
        e.addEventListener('input', () => {
          this.#sensitivity.element.value = Number(e.value);
        });
      });
    }
  }

  save(configuration) {
    configuration.drum = {};
    if (this.#controller.element)
      configuration.drum.controller = this.#controller.element.value

    if (this.#note.element)
      configuration.drum.note = this.#note.element.value

    if (this.#sensitivity.element)
      configuration.drum.sensitivity = this.#sensitivity.element.value
  }
}

// The chromatic note calibration. Every note defines the the raw
// velociy values to play the velocities 1 and 127.
// The raw values are played by switching to a specific MIDI program.
class V2SettingsCalibration extends V2SettingsModule {
  static type = 'calibration';

  #device = null;
  #settings = null;
  #element = null;
  #program = 0;
  #values = null;
  #playTimer = null;
  #notes = {
    element: null,
    channel: 0,
    program: 0,
    start: 0,
    count: 0
  };

  constructor(device, settings, canvas, setting, data) {
    super(device, settings);
    super.addTitle(canvas, 'Calibration');

    data.input.programs.find((program) => {
      if (!program.selected)
        return false;

      this.#program = program.number;
      return true;
    });

    if (setting.channel != null)
      this.#notes.channel = setting.channel;

    if (setting.program != null)
      this.#notes.program = setting.program;

    this.#notes.start = data.input.chromatic.start;
    this.#notes.count = data.input.chromatic.count;

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.textContent = 'Play Min';
        e.title = 'Play all notes with velocity 1';
        e.addEventListener('click', () => {
          this.#playAll('min');
        });
      });

      field.addButton((e) => {
        e.textContent = 'Play Max';
        e.title = 'Play all notes with velocity 127';
        e.addEventListener('click', () => {
          this.#playAll('max');
        });
      });
    });

    const addCalibrationNote = (i, note) => {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = V2MIDI.Note.name(note);
          e.classList.add(V2MIDI.Note.isBlack(note) ? 'is-dark' : 'has-background-grey-lighter');
        });

        field.addButton((e) => {
          e.title = 'Play note #' + note + ' with velocity 1';
          e.textContent = 'Min';
          e.addEventListener('mousedown', () => {
            this.device.sendProgramChange(this.#notes.channel, this.#notes.program);
            this.device.sendNote(this.#notes.channel, note, this.#values[i].min);
            this.device.sendProgramChange(this.#notes.channel, this.#program);
          });
        });

        field.addInput('number', (e) => {
          e.classList.add('width-number');
          e.title = 'The raw value to play note #' + note + ' with velocity 1';
          e.min = 1;
          e.max = 127;
          e.value = this.#values[i].min;
          e.addEventListener('change', () => {
            this.#values[i].min = e.value
            this.device.sendProgramChange(this.#notes.channel, this.#notes.program);
            this.device.sendNote(this.#notes.channel, note, e.value);
            this.device.sendProgramChange(this.#notes.channel, this.#program);
          });
        });

        field.addButton((e) => {
          e.title = 'Play note #' + note + ' with velocity 127';
          e.textContent = 'Max';
          e.addEventListener('mousedown', () => {
            this.device.sendProgramChange(this.#notes.channel, this.#notes.program);
            this.device.sendNote(this.#notes.channel, note, this.#values[i].max);
            this.device.sendProgramChange(this.#notes.channel, this.#program);
          });
        });

        field.addInput('number', (e) => {
          e.classList.add('width-number');
          e.title = 'The raw value to play the note #' + note + ' with velocity 127';
          e.min = 1;
          e.max = 127;
          e.value = this.#values[i].max;
          e.addEventListener('change', () => {
            this.#values[i].max = e.value;
            this.device.sendProgramChange(this.#notes.channel, this.#notes.program);
            this.device.sendNote(this.#notes.channel, note, e.value);
            this.device.sendProgramChange(this.#notes.channel, this.#program);
          });
        });
      });
    }

    const calibration = data.configuration[setting.configuration]
    this.#values = [];
    for (let i = 0; i < this.#notes.count; i++) {
      this.#values.push({
        'min': calibration[i].min,
        'max': calibration[i].max
      });
    }

    for (let i = 0; i < this.#notes.count; i++)
      addCalibrationNote(i, this.#notes.start + i);
  }

  save(configuration) {
    configuration.calibration = this.#values;
  }

  clear() {
    if (this.#playTimer) {
      clearInterval(this.#playTimer);
      this.#playTimer = null;
    }
  }

  #playAll(field) {
    const reset = () => {
      clearInterval(this.#playTimer);
      this.#playTimer = null;
      this.device.sendProgramChange(this.#notes.channel, this.#program);
    }

    if (this.#playTimer) {
      reset();
      return;
    }

    this.device.sendProgramChange(this.#notes.channel, this.#notes.program);

    let index = 0;
    this.#playTimer = setInterval(() => {
      const note = index + this.#notes.start;
      const velocity = this.#values[index][field];
      this.device.sendNote(this.#notes.channel, note, velocity);

      index++;
      if (index == this.#values.length)
        reset();
    }, 150);
  }
}
