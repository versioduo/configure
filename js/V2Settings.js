class V2SettingsModule {
  device = null;
  settings = null;
  setting = null;

  constructor(device, settings, setting) {
    this.device = device;
    this.settings = settings;
    this.setting = setting;

    return Object.seal(this);
  }

  addHeading(canvas, text) {
    V2Web.addElement(canvas, 'h3', (e) => {
      e.classList.add('title');
      e.classList.add('subsection');
      e.textContent = text;
    });
  }

  addSection(canvas, setting) {
    if (setting.title) {
      V2Web.addElement(canvas, 'hr', (e) => {
        e.classList.add('subsection');
      });

      this.addHeading(canvas, setting.title);
      return;
    }

    if (setting.ruler) {
      V2Web.addElement(canvas, 'hr', (e) => {
        e.classList.add('break');
      });
    }
  }

  // Access nested property; the path elements are separated by '/': 'devices[4]/name'.
  setConfiguration(data, value) {
    // Split at '/', and convert array indices to distinct path elements.
    const path = this.setting.path.replaceAll('[', '/').replaceAll(']', '').split('/');

    let object = data;
    for (let i = 0; i < path.length; i++) {
      const element = path[i];

      if (!isNull(value)) {
        // Assign the value to the last element.
        if (i === path.length - 1)
          object[element] = value;

        // Create path; add empty array if the next element is an index.
        else if (isNull(object[element]))
          object[element] = (path[i + 1].match(/^[0-9]+$/)) ? [] : {};
      }

      object = object[element];
    }

    return object;
  }

  getConfiguration(data) {
    return this.setConfiguration(data);
  }
}

// The chromatic note calibration. Every note defines the the raw
// velocity values to play the velocities 1 and 127.
// The raw values are played by switching to a specific MIDI program.
class V2SettingsCalibration extends V2SettingsModule {
  static type = 'calibration';

  #device = null;
  #settings = null;
  #currentProgram = Object.seal({
    bank: 0,
    number: 0
  });
  #values = null;
  #playTimer = null;
  #notes = Object.seal({
    element: null,
    bank: 0,
    program: 0
  });

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    // Find current program.
    const programs = data.input.channels?.[0].programs || data.input.programs;
    if (programs) {
      programs.find((program) => {
        if (!program.selected)
          return false;

        this.#currentProgram.bank = program.bank;
        this.#currentProgram.number = program.number;
        return true;
      });
    }

    if (!isNull(setting.program)) {
      this.#notes.bank = setting.program.bank;
      this.#notes.program = setting.program.number;
    }

    const changeProgram = (program, bank) => {
      const msb = (bank >> 7) & 0x7f;
      const lsb = bank & 0x7f;
      this.device.sendControlChange(0, V2MIDI.CC.bankSelect, msb);
      this.device.sendControlChange(0, V2MIDI.CC.bankSelectLSB, lsb);
      this.device.sendProgramChange(0, program);
    };

    const playAll = (field) => {
      const reset = () => {
        clearInterval(this.#playTimer);
        this.#playTimer = null;
        changeProgram(this.#currentProgram.number, this.#currentProgram.bank);
      };

      if (this.#playTimer) {
        reset();
        return;
      }

      changeProgram(this.#notes.program, this.#notes.bank);

      let index = 0;
      this.#playTimer = setInterval(() => {
        const note = index + this.setting.chromatic.start;
        const velocity = this.#values[index][field];
        this.device.sendNote(0, note, velocity);
        setTimeout(() => {
          this.device.sendNoteOff(0, note);
        }, 100);

        index++;
        if (index === this.#values.length)
          reset();
      }, 150);
    };

    const playNote = (note, velocity) => {
      changeProgram(this.#notes.program, this.#notes.bank);
      this.device.sendNote(0, note, velocity);
      changeProgram(this.#currentProgram.number, this.#currentProgram.bank);

      setTimeout(() => {
        this.device.sendNoteOff(0, note);
      }, 100);
    };

    V2Web.addButtons(canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Play Min';
        e.addEventListener('click', () => {
          playAll('min');
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Play Max';
        e.addEventListener('click', () => {
          playAll('max');
        });
      });
    });

    const addCalibrationNote = (i, note) => {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = V2MIDI.Note.getName(note) + ' (' + note + ')';
          e.classList.add(V2MIDI.Note.isBlack(note) ? 'is-dark' : 'has-background-grey-lighter');
        });

        field.addButton((e) => {
          e.textContent = 'Min';
          e.addEventListener('mousedown', () => {
            playNote(note, this.#values[i].min);
          });
        });

        field.addInput('number', (e) => {
          e.classList.add('width-number');
          e.min = 1;
          e.max = 127;
          e.value = this.#values[i].min;
          e.addEventListener('change', () => {
            this.#values[i].min = e.value;
            playNote(note, this.#values[i].min);
          });
        });

        field.addButton((e) => {
          e.textContent = 'Max';
          e.addEventListener('mousedown', () => {
            playNote(note, this.#values[i].max);
          });
        });

        field.addInput('number', (e) => {
          e.classList.add('width-number');
          e.min = 1;
          e.max = 127;
          e.value = this.#values[i].max;
          e.addEventListener('change', () => {
            this.#values[i].max = e.value;
            playNote(note, this.#values[i].max);
          });
        });
      });
    };

    const calibration = this.getConfiguration(data.configuration);
    this.#values = [];
    for (let i = 0; i < this.setting.chromatic.count; i++) {
      this.#values.push({
        'min': calibration[i].min,
        'max': calibration[i].max
      });
    }

    for (let i = 0; i < this.setting.chromatic.count; i++)
      addCalibrationNote(i, this.setting.chromatic.start + i);

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#values);
  }

  clear() {
    if (this.#playTimer) {
      clearInterval(this.#playTimer);
      this.#playTimer = null;
    }
  }
}

// HSV colour configuration.
class V2SettingsColour extends V2SettingsModule {
  static type = 'colour';

  #colour = Object.seal({
    element: null,
    h: 0,
    s: 0,
    v: 0
  });
  #hue = null;
  #saturation = null;
  #brightness = null;
  #configuration = null;

  #updateColour() {
    // Convert HSV to HSL.
    let s = 0;
    let l = this.#colour.v * (1 - this.#colour.s / 2);
    if (l > 0 && l < 1)
      s = (this.#colour.v - l) / (l < 0.5 ? l : 1 - l);

    this.#colour.element.style.backgroundColor = 'hsl(' + this.#colour.h + ', ' + (s * 100) + '%, ' + (l * 100) + '%)';
  };

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    this.#configuration = setting.configuration;
    V2Web.addButtons(canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.tabIndex = -1;
        e.textContent = 'Colour';
      });

      V2Web.addButton(buttons, (e) => {
        this.#colour.element = e;
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });
    });

    {
      let range = null;

      const update = (value) => {
        this.#colour.h = value / 127 * 360;
        this.#hue.value = value;
        range.value = value;
        this.#updateColour();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Hue';
        });

        field.addInput('number', (e) => {
          this.#hue = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(this.getConfiguration(data.configuration)[0]);
    }

    {
      let range = null;

      const update = (value) => {
        this.#colour.s = value / 127;
        this.#saturation.value = value;
        range.value = value;
        this.#updateColour();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Saturation';
        });

        field.addInput('number', (e) => {
          this.#saturation = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });

        update(this.getConfiguration(data.configuration)[1]);
      });
    }

    {
      let range = null;

      const update = (value) => {
        this.#colour.v = value / 127;
        this.#brightness.value = value;
        range.value = value;
        this.#updateColour();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Brightness';
        });

        field.addInput('number', (e) => {
          this.#brightness = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 0;
        e.max = 127;
        e.value = this.#brightness.value;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(this.getConfiguration(data.configuration)[2]);
    }

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, [
      this.#hue.value,
      this.#saturation.value,
      this.#brightness.value
    ]);
  }
}

// Single controller configuration.
class V2SettingsController extends V2SettingsModule {
  static type = 'controller';

  #controller = Object.seal({
    element: null,
  });

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    let text = null;
    let range = null;

    const update = (number) => {
      if (number < 0)
        number = 0;
      else if (number > 127)
        number = 127;
      text.textContent = V2MIDI.CC.Name[number] || 'Controller ' + number;
      this.#controller.element.value = number;
      range.value = number;
    };

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.textContent = setting.label || 'Controller';

        if (setting.test) {
          e.classList.add('is-link');
          e.addEventListener('click', () => {
            device.sendSystemExclusive({
              test: {
                controller: Number(this.#controller.element.value)
              }
            });
          });

        } else {
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
        }
      });

      field.addButton((e) => {
        text = e;
        e.classList.add('width-text-wide');
        e.classList.add('has-background-light');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });

      field.addInput('number', (e) => {
        this.#controller.element = e;
        e.classList.add('width-number');
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });
    });

    V2Web.addElement(canvas, 'input', (e) => {
      range = e;
      e.classList.add('range');
      e.type = 'range';
      e.min = 0;
      e.max = 127;
      e.addEventListener('input', () => {
        update(e.value);
      });
    });

    update(this.getConfiguration(data.configuration));
    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#controller.element.value);
  }
}

// Drum pad MIDI settings.
class V2SettingsDrum extends V2SettingsModule {
  static type = 'drum';

  #sensitivity = null;
  #note = null;
  #aftertouch = null;
  #controller = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    const drum = this.getConfiguration(data.configuration);
    if (!isNull(drum.sensitivity)) {
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
          this.#sensitivity = e;
          e.classList.add('width-label'); // -0.99 does not fit
          e.min = -0.99;
          e.max = 0.99;
          e.step = 0.01;
          e.value = drum.sensitivity;
          e.addEventListener('input', () => {
            range.value = e.value;
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = -0.99;
        e.max = 0.99;
        e.step = 0.01;
        e.value = this.#sensitivity.value;
        e.addEventListener('input', () => {
          this.#sensitivity.value = Number(e.value);
        });
      });
    }

    if (!isNull(drum.note)) {
      let note = null;
      let range = null;

      const updateNote = (number) => {
        if (number > 0) {
          note.textContent = V2MIDI.Note.getName(number) + (V2MIDI.GM.Percussion.Name[number] ? ' – ' + V2MIDI.GM.Percussion.Name[number] : '');
          if (V2MIDI.Note.isBlack(number)) {
            note.classList.add('is-dark');
            note.classList.remove('has-background-light');

          } else {
            note.classList.remove('is-dark');
            note.classList.add('has-background-light');
          }

        } else
          note.textContent = 'Disabled';
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Note';
        });

        field.addButton((e) => {
          note = e;
          e.classList.add('width-text-wide');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#note = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.value = drum.note;
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
        e.min = 0;
        e.max = 127;
        e.value = this.#note.value;
        e.addEventListener('input', () => {
          this.#note.value = Number(e.value);
          updateNote(e.value);
        });
      });
    }

    if (!isNull(drum.aftertouch)) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Aftertouch';
          e.tabIndex = -1;
        });

        field.addElement('label', (label) => {
          label.classList.add('switch');

          V2Web.addElement(label, 'input', (e) => {
            this.#aftertouch = e;
            e.type = 'checkbox';
            e.checked = drum.aftertouch;
          });

          V2Web.addElement(label, 'span', (e) => {
            e.classList.add('check');
          });
        });
      });
    }

    if (!isNull(drum.controller)) {
      let text = null;
      let range = null;

      const updateController = (number) => {
        if (number > 0)
          text.textContent = V2MIDI.CC.Name[number] || 'Controller ' + number;

        else
          text.textContent = 'Disabled';
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Pressure';
        });

        field.addButton((e) => {
          text = e;
          e.classList.add('width-text-wide');
          e.classList.add('has-background-light');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#controller = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.value = drum.controller;
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
        e.min = 0;
        e.max = 127;
        e.value = this.#controller.value;
        e.addEventListener('input', () => {
          this.#controller.value = Number(e.value);
          updateController(e.value);
        });
      });
    }

    return Object.seal(this);
  }

  save(configuration) {
    const drum = {};
    if (this.#controller)
      drum.controller = this.#controller.value;

    if (this.#note)
      drum.note = this.#note.value;

    if (this.#aftertouch)
      drum.aftertouch = this.#aftertouch.checked;

    if (this.#sensitivity)
      drum.sensitivity = this.#sensitivity.value;

    this.setConfiguration(configuration, drum);
  }
}


// JSON text field.
class V2SettingsJSON extends V2SettingsModule {
  static type = 'json';

  #json = null;

  // Named object wrapping the JSON data.
  #name = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    if (setting.text) {
      V2Web.addElement(canvas, 'p', (e) => {
        e.classList.add('subtitle');
        e.textContent = setting.text;
      });
    }

    V2Web.addButtons(canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Copy';

        e.addEventListener('click', () => {
          navigator.clipboard.writeText(this.#json.value);
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Paste';

        e.addEventListener('click', () => {
          navigator.clipboard.readText().then((data) => {
            let jsonObject;

            try {
              jsonObject = JSON.parse(data);

            } catch (error) {
              return;
            }

            const entry = jsonObject['com.versioduo.sequencer.pattern'];
            if (!entry)
              return;

            this.#json.value = JSON.stringify(jsonObject);
          });
        });
      });
    });

    V2Web.addElement(canvas, 'textarea', (e) => {
      this.#json = e;
      e.classList.add('textarea');

      if (setting.name) {
        this.#name = setting.name;

        e.value = JSON.stringify({
          [setting.name]: this.getConfiguration(data.configuration)
        });

      } else
        e.value = JSON.stringify(this.getConfiguration(data.configuration));
    });

    return Object.seal(this);
  }

  save(configuration) {
    let pattern;

    try {
      pattern = JSON.parse(this.#json.value);

      if (this.#name) {
        if (!pattern[this.#name])
          return;

        pattern = pattern[this.#name];
      }

    } catch (error) {
      return;
    }

    this.setConfiguration(configuration, pattern);
  }
}

// Note selector.
class V2SettingsNote extends V2SettingsModule {
  static type = 'note';

  #note = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    let note = null;
    let range = null;

    const update = (number) => {
      if (isNull(number) || number < 0 || number > 127)
        return;

      note.textContent = V2MIDI.Note.getName(number);
      if (V2MIDI.Note.isBlack(number)) {
        note.classList.add('is-dark');
        note.classList.remove('has-background-light');
      } else {
        note.classList.remove('is-dark');
        note.classList.add('has-background-light');
      }

      this.#note.value = Number(number);
      range.value = number;

      if (!isNull(setting.default)) {
        if (number === setting.default)
          this.#note.classList.add('has-text-grey-lighter');
        else
          this.#note.classList.remove('has-text-grey-lighter');
      }
    };

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.tabIndex = -1;
        e.textContent = setting.label;
      });

      field.addButton((e) => {
        note = e;
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });

      field.addInput('number', (e) => {
        this.#note = e;
        e.classList.add('width-number');
        e.min = setting.min ?? 0;
        e.max = setting.max ?? 127;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      field.addButton((e) => {
        e.textContent = '-';
        e.style.width = '3rem';
        e.addEventListener('click', () => {
          update(Number(this.#note.value) - 1);
        });
      });

      field.addButton((e) => {
        e.textContent = '+';
        e.style.width = '3rem';
        e.addEventListener('click', () => {
          update(Number(this.#note.value) + 1);
        });
      });
    });

    V2Web.addElement(canvas, 'input', (e) => {
      range = e;
      e.classList.add('range');
      e.type = 'range';
      e.min = this.#note.min;
      e.max = this.#note.max;
      e.addEventListener('input', () => {
        update(e.value);
      });
    });

    update(this.getConfiguration(data.configuration));
    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#note.value);
  }
}

// On/Off switch.
class V2SettingsToggle extends V2SettingsModule {
  static type = 'toggle';

  #toggle = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      if (setting.text)
        field.addButton((e) => {
          e.classList.add('width-text');
          e.classList.add('has-background-light');
          e.classList.add('inactive');
          e.textContent = setting.text;
          e.tabIndex = -1;
        });

      field.addElement('label', (label) => {
        label.classList.add('switch');

        V2Web.addElement(label, 'input', (e) => {
          this.#toggle = e;
          e.type = 'checkbox';
          e.checked = this.getConfiguration(data.configuration);
        });

        V2Web.addElement(label, 'span', (e) => {
          e.classList.add('check');
        });
      });
    });

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#toggle.checked);
  }
}

// Numeric field.
class V2SettingsNumber extends V2SettingsModule {
  static type = 'number';

  #number = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    this.#number = null;
    let number = null;
    let range = null;
    const min = setting.min ?? 0;
    const max = setting.max ?? 127;
    const step = setting.step ?? 1;
    const select = setting.input === 'select';

    const update = (value) => {
      if (value === this.#number || isNull(value) || value < min || value > max)
        return;

      this.#number = Number(value);
      number.value = value;
      range.value = value;

      if (!isNull(setting.default)) {
        if (value === setting.default)
          number.classList.add('has-text-grey-lighter');
        else
          number.classList.remove('has-text-grey-lighter');
      }
    };

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      if (setting.text) {
        field.addButton((e) => {
          e.classList.add('width-text');
          e.classList.add('inactive');
          e.classList.add('has-background-light');
          e.textContent = setting.text;
          e.tabIndex = -1;
        });
      }

      if (!select) {
        field.addInput('number', (e) => {
          number = e;
          e.classList.add((step === 1) ? 'width-number' : 'width-number-wide');
          e.min = min;
          e.max = max;
          e.step = step;
          e.value = this.#number;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });

        if (step === 1) {
          field.addButton((e) => {
            e.textContent = '-';
            e.style.width = '3rem';
            e.addEventListener('click', () => {
              update(this.#number - 1);
            });
          });

          field.addButton((e) => {
            e.textContent = '+';
            e.style.width = '3rem';
            e.addEventListener('click', () => {
              update(this.#number + 1);
            });
          });
        }

      } else {
        this.#number = this.getConfiguration(data.configuration);

        field.addElement('span', (e) => {
          e.classList.add('select');

          V2Web.addElement(e, 'select', (select) => {
            for (let i = min; i < max + 1; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.value = i;
                e.text = i;
                if (setting.names && setting.names[i])
                  e.text += ' – ' + setting.names[i];

                if (i === this.#number)
                  e.selected = true;
              });
            }

            select.addEventListener('change', () => {
              this.#number = Number(select.value);
            });
          });
        });
      }
    });

    if (!select) {
      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = number.min;
        e.max = number.max;
        e.step = number.step;
        e.value = number.value;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(this.getConfiguration(data.configuration));
    }

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#number);
  }
}

// Pulse values.
class V2SettingsPulse extends V2SettingsModule {
  static type = 'pulse';

  #watts = Object.seal({
    limit: 100,
    number: null,
    updateNumber: null,
    setNumber: null,
    setRange: null
  });

  #seconds = Object.seal({
    limit: 100,
    number: null,
    updateNumber: null,
    setNumber: null,
    setRange: null
  });

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    if (setting.limit?.watts)
      this.#watts.limit = setting.limit.watts;

    if (setting.limit?.seconds)
      this.#seconds.limit = setting.limit.seconds;

    V2Web.addButtons(canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Reset';
        e.addEventListener('click', () => {
          if (setting.default?.watts) {
            this.#watts.setNumber(setting.default.watts);
            this.#watts.setRange(setting.default.watts);
          }

          if (setting.default?.seconds) {
            this.#seconds.setNumber(setting.default.seconds);
            this.#seconds.setRange(setting.default.seconds);
          }
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Test';
        e.disabled = isNull(setting.index);
        e.addEventListener('click', () => {
          device.sendSystemExclusive({
            pulse: {
              index: setting.index,
              watts: this.#watts.number.value,
              seconds: this.#seconds.number.value
            }
          });
        });
      });
    });

    const pulse = this.getConfiguration(data.configuration);
    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.textContent = 'Watts';
        e.tabIndex = -1;
      });

      field.addInput('number', (e) => {
        this.#watts.number = e;
        e.classList.add('width-number-wide');
        e.min = 0;
        e.max = this.#watts.limit;
        e.addEventListener('input', () => {
          this.#watts.updateNumber();
          this.#watts.setRange(e.value);
        });

        this.#watts.updateNumber = () => {
          e.step = (e.value < 10) ? 0.1 : 1;

          if (!isNull(setting.default?.watts)) {
            if (e.value === setting.default.watts)
              e.classList.add('has-text-grey-lighter');

            else
              e.classList.remove('has-text-grey-lighter');
          }
        };

        this.#watts.setNumber = (watts) => {
          const digits = (watts < 10) ? 1 : 0;
          e.value = Number.parseFloat(watts).toFixed(digits);
          this.#watts.updateNumber();
        };
      });
    });

    V2Web.addElement(canvas, 'input', (e) => {
      e.classList.add('range');
      e.type = 'range';
      e.min = 0.11;
      e.max = 1;
      e.step = 0.002;
      e.addEventListener('input', () => {
        this.#watts.setNumber(this.#watts.limit * Math.pow(e.value, 3));
      });

      this.#watts.setRange = (watts) => {
        e.value = Math.pow(watts / this.#watts.limit, 1 / 3);
      };
    });

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.textContent = 'Seconds';
        e.tabIndex = -1;
      });

      field.addInput('number', (e) => {
        this.#seconds.number = e;
        e.classList.add('width-number-wide');
        e.min = 0;
        e.max = this.#seconds.limit;
        e.addEventListener('input', () => {
          this.#seconds.updateNumber();
          this.#seconds.setRange(e.value);
        });

        this.#seconds.updateNumber = () => {
          e.step = (e.value < 0.1) ? 0.001 : (e.value < 1) ? 0.01 : (e.value < 10) ? 0.1 : 1;

          if (!isNull(setting.default?.seconds)) {
            if (e.value === setting.default.seconds)
              e.classList.add('has-text-grey-lighter');

            else
              e.classList.remove('has-text-grey-lighter');
          }
        };

        this.#seconds.setNumber = (seconds) => {
          const digits = (seconds < 0.1) ? 3 : (seconds < 1) ? 2 : (seconds < 10) ? 1 : 0;
          e.value = Number.parseFloat(seconds).toFixed(digits);
          this.#seconds.updateNumber();
        };
      });
    });

    V2Web.addElement(canvas, 'input', (e) => {
      e.classList.add('range');
      e.type = 'range';
      e.min = 0.22;
      e.max = 1;
      e.step = 0.002;
      e.addEventListener('input', () => {
        this.#seconds.setNumber(this.#seconds.limit * Math.pow(e.value, 8));
      });

      this.#seconds.setRange = (seconds) => {
        e.value = Math.pow(seconds / this.#seconds.limit, 1 / 8);
      };
    });

    this.#watts.setNumber(pulse.watts);
    this.#watts.setRange(pulse.watts);
    this.#seconds.setNumber(pulse.seconds);
    this.#seconds.setRange(pulse.seconds);
    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, {
      watts: this.#watts.number.value,
      seconds: this.#seconds.number.value
    });
  }
}

// Text field.
class V2SettingsText extends V2SettingsModule {
  static type = 'text';

  #text = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      field.addInput('text', (e) => {
        this.#text = e;
        e.classList.add('text-wide');
        e.maxLength = 31;
        e.value = this.getConfiguration(data.configuration);
      });
    });

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#text.value);
  }
}

// Title / header.
class V2SettingsTitle extends V2SettingsModule {
  static type = 'title';

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addSection(canvas, setting);
  }
}

// The USB properties. There is no settings entry specified. All devices
// support a custom name, the ports value is optional.
class V2SettingsUSB extends V2SettingsModule {
  static type = 'usb';

  #name = null;
  #vid = null;
  #pid = null;
  #ports = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addHeading(canvas, 'USB');

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'Name';
        e.tabIndex = -1;
      });

      field.addInput('text', (e) => {
        this.#name = e;
        e.classList.add('text-wide');
        e.maxLength = 31;
        if (data.system.name)
          e.value = data.system.name;
        e.placeholder = data.metadata.product;
      });
    });

    const usbID = (number) => {
      if (isNull(number))
        return '';

      return ('0000' + number.toString(16)).substr(-4);
    };

    if (!isNull(data.configuration.usb.vid)) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Vendor ID';
          e.tabIndex = -1;
        });

        field.addInput('text', (e) => {
          this.#vid = e;
          e.classList.add('width-number');
          e.maxLength = 4;
          if (data.configuration.usb.vid > 0)
            e.value = usbID(data.configuration.usb.vid);

          e.placeholder = usbID(data.system.hardware?.usb?.vid);
        });
      });
    }

    if (!isNull(data.configuration.usb.pid)) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Product ID';
          e.tabIndex = -1;
        });

        field.addInput('text', (e) => {
          this.#pid = e;
          e.classList.add('width-number');
          e.maxLength = 4;
          if (data.configuration.usb.pid > 0)
            e.value = usbID(data.configuration.usb.pid);

          e.placeholder = usbID(data.system.hardware?.usb?.pid);
        });
      });
    }

    // The number of MIDI ports.
    if (data.system.hardware?.usb?.ports?.standard > 0) {
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
            this.#ports = select;

            for (let i = 0; i < 17; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.value = i;
                e.text = i > 0 ? i : '–';
                if (i === data.configuration.usb.ports)
                  e.selected = true;
              });
            }
          });
        });
      });
    }

    return Object.seal(this);
  }

  save(configuration) {
    configuration.usb = {
      'name': this.#name.value
    };

    if (this.#vid)
      configuration.usb.vid = parseInt(this.#vid.value || 0, 16);

    if (this.#pid)
      configuration.usb.pid = parseInt(this.#pid.value || 0, 16);

    if (this.#ports)
      configuration.usb.ports = Number(this.#ports.value);
  }
}
