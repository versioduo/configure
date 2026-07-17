// MIDI Output controllers and notes.
class V2Output extends V2WebModule {
  #device = null;
  #channel = Object.seal({
    value: null,
    addEntry: null
  });
  #controllers = Object.seal({
    element: null,
    elementList: null,
    list: null
  });
  #aftertouch = Object.seal({
    update: null
  });
  #notes = Object.seal({
    element: null,
    elementList: null,
    list: null
  });

  constructor(device) {
    super('output', 'MIDI Out', 'Receive notes and control changes');
    this.#device = device;

    this.#device.addNotifier('show', (data) => {
      if (!data.output)
        return;

      this.#show(data);
      this.attach();
    });

    this.#device.addNotifier('reset', () => {
      this.#channel.value = null;
      this.detach();
      this.#clear();
    });

    const updateNote = (channel, note, velocity) => {
      if (this.#channel.value !== channel)
        return;

      if (!this.#notes.list[note])
        return;

      if (velocity > 0) {
        this.#notes.list[note].input.textContent = velocity;
        this.#notes.list[note].progress.value = velocity;

      } else {
        this.#notes.list[note].input.textContent = null;
        this.#notes.list[note].progress.value = 0;

        if (this.#notes.list[note].aftertouch)
          this.#notes.list[note].aftertouch.value = 0;

        if (this.#aftertouch.update)
          this.#aftertouch.update(0);
      }
    };

    this.#device.getDevice().addNotifier('note', (channel, note, velocity) => {
      updateNote(channel, note, velocity);
    });

    this.#device.getDevice().addNotifier('noteOff', (channel, note, velocity) => {
      updateNote(channel, note, 0);
    });

    this.#device.getDevice().addNotifier('aftertouch', (channel, note, pressure) => {
      if (this.#channel.value !== channel)
        return;

      if (!this.#notes.list[note] || !this.#notes.list[note].aftertouch)
        return;

      this.#notes.list[note].aftertouch.value = pressure;
    });

    this.#device.getDevice().addNotifier('aftertouchChannel', (channel, pressure) => {
      if (this.#channel.value !== channel)
        return;

      if (this.#aftertouch.update)
        this.#aftertouch.update(pressure);
    });

    this.#device.getDevice().addNotifier('controlChange', (channel, controller, value) => {
      if (this.#channel.value !== channel)
        return;

      if (!this.#controllers.list[controller])
        return;

      if (this.#controllers.list[controller].input) {
        this.#controllers.list[controller].input.textContent = value;
        if (this.#controllers.list[controller].progress)
          this.#controllers.list[controller].progress.value = value;

      } else if (this.#controllers.list[controller].switch) {
        this.#controllers.list[controller].switch.checked = value > 63;

      } else if (this.#controllers.list[controller].button) {
        if (value > 63)
          this.#controllers.list[controller].button.classList.add('link');
        else
          this.#controllers.list[controller].button.classList.remove('link');
      }
    });

    return Object.seal(this);
  }

  #addController(controller) {
    const type = controller.type || 'range';

    new V2WebMenu(this.#controllers.elementList, (menu) => {
      menu.addElement('span', (e) => {
        e.classList.add('label');
        e.textContent = 'CC ' + controller.number;
      });

      menu.addElement('span', (e) => {
        e.classList.add('text');
        e.textContent = controller.name;
      });

      switch (type) {
        case 'range':
          menu.addElement('span', (e) => {
            e.classList.add('field');
            e.textContent = controller.value || 0;
            this.#controllers.list[controller.number] = {
              'input': e
            };
          });

          // Support high-resolution, 14 bits controllers. Controllers 0-31 (MSB)
          // have matching high-resolution values with controllers 32-63 (LSB).
          if (!isNull(controller.valueFine)) {
            menu.addElement('span', (e) => {
              e.classList.add('field');
              e.textContent = controller.valueFine;
              this.#controllers.list[controller.number + V2MIDI.CC.controllerLSB] = {
                'input': e
              };
            });
          }

          // The range progress bar is added after the menu.
          break;

        case 'toggle':
          menu.addElement('input', (e) => {
            e.disabled = true;
            e.type = 'checkbox';
            e.checked = controller.value > 63;
            this.#controllers.list[controller.number] = {
              'switch': e
            };
          });
          break;

        case 'momentary':
          menu.addElement('button', (e) => {
            e.disabled = true;
            e.classList.add('momentary');
            if (controller.value > 63)
              e.classList.add('link');
            this.#controllers.list[controller.number] = {
              'button': e
            };
          });
          break;
      }
    });

    if (type === 'range') {
      V2Web.addElement(this.#controllers.elementList, 'progress', (e) => {
        e.value = controller.value || 0;
        e.min = controller.min ?? 0;
        e.max = controller.max ?? 127;
        this.#controllers.list[controller.number].progress = e;
      });
    }
  }

  #addNote(name, note, hasAftertouch) {
    new V2WebMenu(this.#notes.elementList, (menu) => {
      menu.addElement('span', (e) => {
        e.classList.add('label');
        e.textContent = V2MIDI.Note.getName(note) + ' (' + note + ')';
        e.classList.add(V2MIDI.Note.isBlack(note) ? 'dark' : 'light');
      });

      menu.addElement('span', (e) => {
        e.classList.add('text');
        e.textContent = name;
      });

      menu.addElement('span', (e) => {
        e.classList.add('field');
        this.#notes.list[note] = {
          'input': e,
        };
      });
    });

    V2Web.addElement(this.#notes.elementList, 'progress', (e) => {
      e.value = '0';
      e.max = '127';
      this.#notes.list[note].progress = e;
    });

    if (hasAftertouch) {
      V2Web.addElement(this.#notes.elementList, 'progress', (e) => {
        e.value = '0';
        e.max = '127';
        this.#notes.list[note].aftertouch = e;
      });
    }
  }

  #addChannel(channel) {
    if (channel.controllers) {
      for (const controller of channel.controllers)
        this.#addController(controller);

      this.#controllers.element.style.display = '';
    }

    if (channel.notes) {
      // Aftertouch Channel.
      if (channel.aftertouch) {
        let input = null;
        let progress = null;

        new V2WebMenu(this.#notes.elementList, (menu) => {
          menu.addElement('span', (e) => {
            e.textContent = 'Aftertouch';
          });

          menu.addElement('span', (e) => {
            input = e;
            e.type = 'number';
            e.classList.add('field');
            e.textContent = channel.aftertouch.value;
          });
        });

        V2Web.addElement(this.#notes.elementList, 'progress', (e) => {
          progress = e;
          e.value = channel.aftertouch.value;
          e.max = '127';
        });

        this.#aftertouch.update = (pressure) => {
          input.value = pressure;
          progress.value = pressure;
        };
      }

      for (const note of channel.notes)
        this.#addNote(note.name, note.number, note.aftertouch);

      this.#notes.element.style.display = '';
    }
  }

  #show(data) {
    this.#clear();

    if (!data.output)
      return;

    new V2WebMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
        e.classList.add('link');
        e.textContent = 'Refresh';
        e.addEventListener('click', () => {
          this.#device.sendGetAll();
        });
      });
    });

    new V2WebMenu(this.canvas, (menu) => {
      menu.addElement('span', (e) => {
        e.classList.add('label');
        e.textContent = 'Channel';
      });

      menu.addElement('select', (select) => {
        this.#channel.addEntry = (channel, name, selected) => {
          V2Web.addElement(select, 'option', (e) => {
            e.text = channel + 1;
            if (name)
              e.text += ' - ' + name;

            if (selected)
              e.selected = true;
          });

          select.disabled = select.options.length === 1;

          select.addEventListener('change', () => {
            this.#channel.value = data.output.channels[select.selectedIndex].number;

            // Request a refresh with the values of the selected channel.
            this.#device.sendRequest({
              'method': 'switchChannel',
              'channel': this.#channel.value
            });
          });
        };
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#controllers.element = e;
      e.style.display = 'none';

      V2Web.addElement(e, 'hr');
      V2Web.addElement(e, 'h3', (e) => {
        e.textContent = 'Controllers';
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#controllers.elementList = e;
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#notes.element = e;
      e.style.display = 'none';

      V2Web.addElement(e, 'hr');
      V2Web.addElement(e, 'h3', (e) => {
        e.textContent = 'Notes';
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#notes.elementList = e;
      });
    });

    this.#controllers.list = {};
    this.#notes.list = {};

    if (data.output.channels) {
      // Find the currently selected channel number.
      data.output.channels.find((channel) => {
        if (!channel.selected)
          return false;

        this.#channel.value = channel.number;
        return true;
      });

      // Use the first entry.
      if (this.#channel.value === null)
        this.#channel.value = data.output.channels[0].number;

      // Update the channel selector.
      for (const channel of data.output.channels)
        this.#channel.addEntry(channel.number, channel.name, this.#channel.value === channel.number);

      // Add the currently selected channel.
      data.output.channels.find((channel) => {
        if (channel.number !== this.#channel.value)
          return false;

        this.#addChannel(channel);
        return true;
      });

    } else {
      if (!isNull(data.output.channel))
        this.#channel.value = data.output.channel;

      else
        this.#channel.value = 0;

      this.#channel.addEntry(this.#channel.value);
      this.#addChannel(data.output);
    }
  }

  #clear() {
    super.reset();
  }
}
