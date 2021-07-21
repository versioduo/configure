// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// MIDI Output controllers and notes.
class V2Output extends V2WebModule {
  #device = null;
  #channel = {
    element: null,
    elementValue: null,
    value: null
  };
  #controllers = {
    element: null,
    elementList: null,
    list: null
  };
  #notes = {
    element: null,
    elementList: null,
    list: null
  };

  constructor(device) {
    super('output', 'MIDI Out', 'Receive notes and control changes');
    super.attach();
    this.#device = device;

    this.#device.notifiers.show.push((data) => {
      this.#show(data);
    });

    this.#device.notifiers.reset.push(() => {
      this.#clear();
    });

    const updateNote = (channel, note, velocity) => {
      if (this.#channel.value != null && this.#channel.value != channel)
        return;

      if (!this.#notes.list || !this.#notes.list[note])
        return;

      if (velocity > 0) {
        this.#notes.list[note].input.value = velocity;
        this.#notes.list[note].progress.value = velocity;

      } else {
        this.#notes.list[note].input.value = null;
        this.#notes.list[note].progress.value = 0;
        if (this.#notes.list[note].aftertouch)
          this.#notes.list[note].aftertouch.value = 0;
      }
    }

    this.#device.device.notifiers.message.note.push((channel, note, velocity) => {
      updateNote(channel, note, velocity);
    });

    this.#device.device.notifiers.message.noteOff.push((channel, note, velocity) => {
      updateNote(channel, note, 0);
    });

    this.#device.device.notifiers.message.aftertouch.push((channel, note, pressure) => {
      if (this.#channel.value != null && this.#channel.value != channel)
        return;

      if (!this.#notes.list[note] || !this.#notes.list[note].aftertouch)
        return;

      this.#notes.list[note].aftertouch.value = pressure;
    });

    this.#device.device.notifiers.message.controlChange.push((channel, controller, value) => {
      if (this.#channel.value != null && this.#channel.value != channel)
        return;

      if (!this.#controllers.list || !this.#controllers.list[controller])
        return;

      if (this.#controllers.list[controller].input) {
        this.#controllers.list[controller].input.value = value;
        if (this.#controllers.list[controller].progress)
          this.#controllers.list[controller].progress.value = value;

      } else if (this.#controllers.list[controller].switch) {
        this.#controllers.list[controller].switch.checked = value > 63;

      } else if (this.#controllers.list[controller].button) {
        if (value > 63)
          this.#controllers.list[controller].button.classList.add('is-link');
        else
          this.#controllers.list[controller].button.classList.remove('is-link');
      }
    });
  }

  #addController(name, controller, type, value, valueFine) {
    new V2WebField(this.#controllers.elementList, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'CC ' + controller;
        e.tabIndex = -1;

      });

      field.addButton((e) => {
        e.classList.add('width-text');
        e.classList.add('has-background-light');
        e.classList.add('inactive');
        e.textContent = name;
        e.tabIndex = -1;
      });

      switch (type) {
        case 'range':
          field.addInput('number', (e) => {
            e.classList.add('width-number');
            e.classList.add('inactive');
            e.value = value || 0;
            e.readOnly = true;
            e.tabIndex = -1;
            this.#controllers.list[controller] = {
              'input': e
            };
          });

          // Support high-resolution, 14 bits controllers. Controllers 0-31 (MSB)
          // have matching high-resolution values with controllers 32-63 (LSB).
          if (valueFine != null) {
            field.addInput('number', (e) => {
              e.classList.add('width-number');
              e.classList.add('inactive');
              e.value = valueFine;
              e.readOnly = true;
              e.tabIndex = -1;
              this.#controllers.list[controller + V2MIDI.CC.controllerLSB] = {
                'input': e
              };
            });
          }

          // The range progress bar is added after the field.

          break;

        case 'toggle':
          field.addElement('label', (label) => {
            label.classList.add('switch');
            label.classList.add('inactive');

            V2Web.addElement(label, 'input', (e) => {
              e.disabled = true;
              e.type = 'checkbox';
              e.title = 'Toggle Switch';
              e.checked = value > 63;
              this.#controllers.list[controller] = {
                'switch': e
              };
            });

            V2Web.addElement(label, 'span', (e) => {
              e.classList.add('check');
            });
          });
          break;

        case 'momentary':
          field.addButton((e) => {
            e.classList.add('width-label');
            e.classList.add('inactive');
            if (value > 63)
              e.classList.add('is-link');
            e.title = 'Momentary Switch';
            e.tabIndex = -1;
            this.#controllers.list[controller] = {
              'button': e
            };
          });
          break;
      }
    });

    if (type == 'range') {
      V2Web.addElement(this.#controllers.elementList, 'progress', (e) => {
        e.classList.add('progress');
        e.classList.add('is-small');
        e.value = value || 0;
        e.max = '127';
        this.#controllers.list[controller].progress = e;
      });
    }
  }

  #addNote(name, note, hasAftertouch) {
    new V2WebField(this.#notes.elementList, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.textContent = V2MIDI.Note.name(note);
        if (V2MIDI.Note.isBlack(note))
          e.classList.add('is-dark');
        else
          e.classList.add('has-background-grey-lighter');
        e.tabIndex = -1;
      });

      field.addButton((e) => {
        e.classList.add('button');
        e.classList.add('width-text');
        e.classList.add('inactive');
        e.classList.add('has-background-light');
        e.textContent = name;
        e.tabIndex = -1;
      });

      field.addInput('number', (e) => {
        e.classList.add('width-number');
        e.classList.add('inactive');
        e.title = 'Velocity';
        e.readOnly = true;
        e.tabIndex = -1;
        this.#notes.list[note] = {
          'input': e,
        }
      });
    });

    V2Web.addElement(this.#notes.elementList, 'progress', (e) => {
      e.classList.add('progress');
      e.classList.add('is-small');
      e.value = '0';
      e.max = '127';
      this.#notes.list[note].progress = e;
    });

    if (hasAftertouch) {
      V2Web.addElement(this.#notes.elementList, 'progress', (e) => {
        e.classList.add('progress');
        e.classList.add('is-small');
        e.value = '0';
        e.max = '127';
        this.#notes.list[note].aftertouch = e;
      });
    }
  }

  #show(data) {
    this.#clear();

    if (!data.output)
      return;

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#channel.element = e;
      e.style.display = 'none';

      new V2WebField(e, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Channel';
          e.tabIndex = -1;
        });

        field.addButton((e) => {
          this.#channel.elementValue = e;
          e.classList.add('inactive');
          e.tabIndex = -1;
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#controllers.element = e;
      e.style.display = 'none';

      V2Web.addElement(e, 'h3', (e) => {
        e.classList.add('title');
        e.classList.add('subsection');
        e.textContent = 'Controllers';
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#controllers.elementList = e;
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#notes.element = e;
      e.style.display = 'none';

      V2Web.addElement(e, 'h3', (e) => {
        e.classList.add('title');
        e.classList.add('subsection');
        e.textContent = 'Notes';
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#notes.elementList = e;
      });
    });

    if (data.output.channel != null) {
      this.#channel.elementValue.textContent = data.output.channel + 1;
      this.#channel.element.style.display = '';
      this.#channel.value = data.output.channel;
    }

    if (data.output.controllers) {
      this.#controllers.list = {};
      data.output.controllers.forEach((controller) => {
        this.#addController(controller.name, controller.number, controller.type || 'range', controller.value, controller.valueFine);
      });

      this.#controllers.element.style.display = '';
    }

    if (data.output.notes) {
      this.#notes.list = {};
      data.output.notes.forEach((note) => {
        this.#addNote(note.name, note.number, note.aftertouch);
      });

      this.#notes.element.style.display = '';
    }
  }

  #clear() {
    super.reset();
  }
}
