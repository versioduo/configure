// MIDI Input controllers and notes.
class V2Input extends V2WebModule {
  #device = null;
  #channel = Object.seal({
    value: null,
    addEntry: null
  });

  #controls = Object.seal({
    element: null,
    program: null,
    bank: null
  });

  #controllers = Object.seal({
    element: null,
    elementList: null
  });

  #notes = Object.seal({
    element: null,
    controls: Object.seal({
      element: null,
      velocity: Object.seal({
        input: null,
        range: null,
        update: null,
        value: 15
      }),
      release: Object.seal({
        input: null,
        range: null,
        update: null,
        value: 64
      })
    }),

    elementList: null,
    chromatic: Object.seal({
      element: null,
      start: 0,
      count: 0,
      keyboard: null
    })
  });

  constructor(device) {
    super('input', 'MIDI In', 'Play notes and adjust controllers');
    this.#device = device;

    this.#device.addNotifier('show', (data) => {
      if (!data.input)
        return;

      this.#show(data);
      this.attach();
    });

    this.#device.addNotifier('reset', () => {
      this.#channel.value = null;
      this.detach();
      this.#clear();
    });

    return Object.seal(this);
  }

  #addController(controller) {
    const type = controller.type || 'range';
    const value = controller.value || 0;

    let input = null;
    let inputFine = null;
    let range = null;

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
          menu.addElement('input', (e) => {
            input = e;
            e.type = 'number';
            e.min = controller.min ?? 0;
            e.max = controller.max ?? 127;
            e.value = value;
            e.addEventListener('input', () => {
              if (!inputFine) {
                range.value = input.value;
                this.#device.sendControlChange(this.#channel.value, controller.number, e.value);

              } else {
                range.value = (e.value << 7) | inputFine.value;
                this.#device.sendControlChange(this.#channel.value, controller.number, e.value);
                this.#device.sendControlChange(this.#channel.value, V2MIDI.CC.controllerLSB + controller.number, inputFine.value);
              }
            });
          });

          // Support high-resolution, 14 bits controllers. Controllers 0-31 (MSB)
          // have matching high-resolution values with controllers 32-63 (LSB).
          if (!isNull(controller.valueFine)) {
            menu.addElement('input', (e) => {
              inputFine = e;
              e.type = 'number';
              e.max = 127;
              e.value = value;
              e.addEventListener('input', () => {
                range.value = (input.value << 7) | e.value;
                this.#device.sendControlChange(this.#channel.value, controller.number, input.value);
                this.#device.sendControlChange(this.#channel.value, V2MIDI.CC.controllerLSB + controller.number, e.value);
              });
            });
          }

          // The range slider is added after the menu.
          break;

        case 'toggle':
          menu.addElement('input', (e) => {
            e.type = 'checkbox';
            e.checked = value > 63;
            e.addEventListener('input', () => {
              this.#device.sendControlChange(this.#channel.value, controller.number, e.checked ? 127 : 0);
            });
          });
          break;

        case 'momentary':
          menu.addElement('button', (e) => {
            e.classList.add('link');
            e.classList.add('momentary');

            e.addEventListener('mousedown', () => {
              this.#device.sendControlChange(this.#channel.value, controller.number, 127);
            });
            e.addEventListener('mouseup', () => {
              this.#device.sendControlChange(this.#channel.value, controller.number, 0);
            });
            e.addEventListener('touchstart', (event) => {
              e.dispatchEvent(new MouseEvent('mousedown'));
            }, {
              passive: true
            });
            e.addEventListener('touchend', (event) => {
              e.dispatchEvent(new MouseEvent('mouseup'));
              if (event.cancellable)
                event.preventDefault();
            });
          });
          break;
      }
    });

    if (type === 'range') {
      V2Web.addElement(this.#controllers.elementList, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        if (!inputFine) {
          e.min = controller.min ?? 0;
          e.max = controller.max ?? 127;
          e.value = value;

        } else {
          e.min = controller.min ?? 0;
          e.max = controller.max ?? (127 << 7) + 127;;
          e.value = (value << 7) + controller.valueFine;
        }

        e.addEventListener('input', () => {
          if (!inputFine) {
            input.value = e.value;
            this.#device.sendControlChange(this.#channel.value, controller.number, e.value);

          } else {
            const msb = (e.value >> 7) & 0x7f;
            const lsb = e.value & 0x7f;
            input.value = msb;
            inputFine.value = lsb;
            this.#device.sendControlChange(this.#channel.value, controller.number, msb);
            this.#device.sendControlChange(this.#channel.value, V2MIDI.CC.controllerLSB + controller.number, lsb);
          }
        });
      });
    }
  }

  #addNote(name, note) {
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

      menu.addElement('button', (e) => {
        e.classList.add('link');
        e.classList.add('momentary');
        e.addEventListener('mousedown', () => {
          this.#device.sendNote(this.#channel.value, note, this.#notes.controls.velocity.value);
        });
        e.addEventListener('mouseup', () => {
          this.#device.sendNoteOff(this.#channel.value, note, this.#notes.controls.release.value);
        });
        e.addEventListener('touchstart', (event) => {
          e.dispatchEvent(new MouseEvent('mousedown'));
        }, {
          passive: true
        });
        e.addEventListener('touchend', (event) => {
          e.dispatchEvent(new MouseEvent('mouseup'));
          if (event.cancellable)
            event.preventDefault();
        });
      });
    });
  }

  #addChannel(channel) {
    // Program change.
    if (channel.programs) {
      // Look for the currently selected program number.
      channel.programs.find((program) => {
        if (!program.selected)
          return false;

        this.#controls.program = program.number;

        if (!isNull(program.bank))
          this.#controls.bank = program.bank;

        return true;
      });

      new V2WebMenu(this.#controls.element, (menu) => {
        menu.addElement('span', (e) => {
          e.classList.add('label');
          e.textContent = 'Program';
        });

        menu.addElement('select', (select) => {
          for (const [index, program] of channel.programs.entries())
            V2Web.addElement(select, 'option', (e) => {
              if (this.#controls.bank !== null) {
                const bankNumber = this.#controls.bank !== null ? ' Bank ' + (program.bank + 1) : '';
                e.text = (program.number + 1) + bankNumber + ' – ' + program.name;
                e.selected = (program.number === this.#controls.program) && (program.bank === this.#controls.bank);

              } else {
                e.text = (program.number + 1) + ' – ' + program.name;
                e.selected = program.number === this.#controls.program;
              }
            });

          select.addEventListener('change', () => {
            if (!isNull(channel.programs[select.selectedIndex].bank)) {
              this.#controls.bank = channel.programs[select.selectedIndex].bank;

              const msb = (channel.programs[select.selectedIndex].bank >> 7) & 0x7f;
              const lsb = channel.programs[select.selectedIndex].bank & 0x7f;
              this.#device.sendControlChange(this.#channel.value, V2MIDI.CC.bankSelect, msb);
              this.#device.sendControlChange(this.#channel.value, V2MIDI.CC.bankSelectLSB, lsb);
            }

            this.#controls.program = channel.programs[select.selectedIndex].number;
            this.#device.sendProgramChange(this.#channel.value, channel.programs[select.selectedIndex].number);
            this.#device.sendGetAll();
          });
        });
      });
    }

    // Controllers Section.
    if (channel.controllers) {
      for (const controller of channel.controllers)
        this.#addController(controller);

      this.#controllers.element.style.display = '';
    }

    // Notes Section.
    if (channel.chromatic || channel.notes) {
      this.#notes.controls.velocity.update = (number) => {
        if (isNull(number))
          return;

        if (number < 0)
          number = 0;

        else if (number > 127)
          number = 127;

        this.#notes.controls.velocity.value = Number(number);
        this.#notes.controls.velocity.input.value = number;
        this.#notes.controls.velocity.range.value = number;
      };

      new V2WebMenu(this.#notes.controls.element, (menu) => {
        menu.addElement('span', (e) => {
          e.classList.add('label');
          e.textContent = 'Velocity';
        });

        menu.addElement('input', (e) => {
          this.#notes.controls.velocity.input = e;
          e.type = 'number';
          e.min = 1;
          e.max = 127;
          e.value = this.#notes.controls.velocity.value;
          e.addEventListener('input', () => {
            this.#notes.controls.velocity.update(e.value);
          });
        });
      });

      V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
        this.#notes.controls.velocity.range = e;
        e.type = 'range';
        e.min = 1;
        e.max = 127;
        e.value = this.#notes.controls.velocity.value;
        e.addEventListener('input', () => {
          this.#notes.controls.velocity.update(e.value);
        });
      });

      this.#notes.controls.release.update = (number) => {
        if (isNull(number))
          return;

        if (number < 0)
          number = 0;

        else if (number > 127)
          number = 127;

        this.#notes.controls.release.value = Number(number);
        this.#notes.controls.release.input.value = number;
        this.#notes.controls.release.range.value = number;
      };

      new V2WebMenu(this.#notes.controls.element, (menu) => {
        menu.addElement('span', (e) => {
          e.classList.add('label');
          e.textContent = 'Release';
        });

        menu.addElement('input', (e) => {
          this.#notes.controls.release.input = e;
          e.type = 'number';
          e.min = 1;
          e.max = 127;
          e.value = this.#notes.controls.release.value;
          e.addEventListener('input', () => {
            this.#notes.controls.release.update(e.value);
          });
        });
      });

      V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
        this.#notes.controls.release.range = e;
        e.type = 'range';
        e.min = 1;
        e.max = 127;
        e.value = this.#notes.controls.release.value;
        e.addEventListener('input', () => {
          this.#notes.controls.release.update(e.value);
        });
      });

      // Aftertouch Channel.
      if (channel.aftertouch) {
        let input = null;
        let range = null;

        const update = (number) => {
          if (isNull(number))
            return;

          if (number < 0)
            number = 0;

          else if (number > 127)
            number = 127;

          input.value = number;
          range.value = number;
        };

        new V2WebMenu(this.#notes.controls.element, (menu) => {
          menu.addElement('span', (e) => {
            e.classList.add('label');
            e.textContent = 'Aftertouch';
          });

          menu.addElement('input', (e) => {
            input = e;
            e.type = 'number';
            e.min = 0;
            e.max = 127;
            e.value = channel.aftertouch.value;
            e.addEventListener('input', () => {
              update(e.value);
              this.#device.sendAftertouchChannel(this.#channel.value, input.value);
            });
          });
        });

        V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
          range = e;
          e.type = 'range';
          e.max = 127;
          e.value = channel.aftertouch.value;
          e.addEventListener('input', () => {
            update(e.value);
            this.#device.sendAftertouchChannel(this.#channel.value, input.value);
          });

          e.addEventListener('mouseup', () => {
            update(0);
            this.#device.sendAftertouchChannel(this.#channel.value, 0);
          });

          e.addEventListener('touchend', (event) => {
            e.dispatchEvent(new MouseEvent('mouseup'));
            if (event.cancellable)
              event.preventDefault();
          });
        });
      }

      // Pitch Bend.
      if (channel.pitchbend) {
        let input = null;
        let range = null;

        const update = (number) => {
          if (isNull(number))
            return;

          if (number < -8192)
            number = -8192;

          else if (number > 8191)
            number = 8191;

          input.value = number;
          range.value = number;
        };

        new V2WebMenu(this.#notes.controls.element, (menu) => {
          menu.addElement('span', (e) => {
            e.classList.add('label');
            e.textContent = channel.pitchbend.name || 'Pitch Bend';
          });

          menu.addElement('input', (e) => {
            input = e;
            e.type = 'number';
            e.min = -8192;
            e.max = 8191;
            e.value = channel.pitchbend.value;
            e.addEventListener('input', () => {
              update(e.value);
              this.#device.sendPitchBend(this.#channel.value, input.value);
            });
          });
        });

        V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
          range = e;
          e.type = 'range';
          e.min = -8192;
          e.max = 8191;
          e.value = channel.pitchbend.value;
          e.addEventListener('input', () => {
            update(e.value);
            this.#device.sendPitchBend(this.#channel.value, input.value);
          });

          e.addEventListener('mouseup', () => {
            // Do not reset value to 0 if pitchbend is used for something else.
            if (!isNull(channel.pitchbend.name))
              return;

            e.value = 0;
            input.value = 0;
            this.#device.sendPitchBend(this.#channel.value, 0);
          });

          e.addEventListener('touchend', (event) => {
            e.dispatchEvent(new MouseEvent('mouseup'));
            if (event.cancellable)
              event.preventDefault();
          });
        });
      }

      // A range of chromatic notes.
      if (channel.chromatic) {
        const chromatic = channel.chromatic;

        // Range of chromatic notes.
        this.#notes.chromatic.start = chromatic.start;
        this.#notes.chromatic.count = chromatic.count;

        this.#notes.chromatic.keyboard = new V2Keyboard(this.#notes.chromatic.element, this.#notes.chromatic.start, this.#notes.chromatic.count);
        this.#notes.chromatic.keyboard.handler.down = (note) => {
          this.#device.sendNote(this.#channel.value, note, this.#notes.controls.velocity.value);
        };

        this.#notes.chromatic.keyboard.handler.up = (note) => {
          this.#device.sendNoteOff(this.#channel.value, note, this.#notes.controls.release.value);
        };

        this.#notes.chromatic.keyboard.handler.velocity.down = () => {
          if (this.#notes.controls.velocity.value === 1)
            return;

          this.#notes.controls.velocity.update(this.#notes.controls.velocity.value - Math.min(10, (this.#notes.controls.velocity.value - 1)));
        };

        this.#notes.chromatic.keyboard.handler.velocity.up = () => {
          if (this.#notes.controls.velocity.value === 127)
            return;

          this.#notes.controls.velocity.update(this.#notes.controls.velocity.value + Math.min(10, 127 - this.#notes.controls.velocity.value));
        };
      }

      // A list of individual notes.
      if (channel.notes) {
        for (const note of channel.notes)
          this.#addNote(note.name, note.number);
      }

      this.#notes.element.style.display = '';
    }
  }

  #show(data) {
    this.#clear();

    new V2WebMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Notes Off';
        e.addEventListener('click', () => {
          this.#device.sendControlChange(this.#channel.value, V2MIDI.CC.allNotesOff, 0);
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Reset';
        e.addEventListener('click', () => {
          this.#channel.value = null;
          this.#device.sendReset();
        });
      });

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
            this.#channel.value = data.input.channels[select.selectedIndex].number;

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
      this.#controls.element = e;
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#controllers.element = e;
      e.style.display = 'none';

      V2Web.addElement(e, 'hr', (e) => {
      });

      V2Web.addElement(e, 'p', (e) => {
        e.classList.add('title');
        e.textContent = 'Controllers';
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#controllers.elementList = e;
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#notes.element = e;
      e.style.display = 'none';

      V2Web.addElement(e, 'hr', (e) => {
      });

      V2Web.addElement(e, 'p', (e) => {
        e.classList.add('title');
        e.textContent = 'Notes';
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#notes.controls.element = e;
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#notes.elementList = e;
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#notes.chromatic.element = e;
      });
    });

    if (data.input.channels) {
      // Find the currently selected channel number.
      data.input.channels.find((channel) => {
        if (!channel.selected)
          return false;

        this.#channel.value = channel.number;
        return true;
      });

      // Use the first entry.
      if (this.#channel.value === null)
        this.#channel.value = data.input.channels[0].number;

      // Update the channel selector.
      for (const channel of data.input.channels)
        this.#channel.addEntry(channel.number, channel.name, this.#channel.value === channel.number);

      // Add the currently selected channel.
      data.input.channels.find((channel) => {
        if (channel.number !== this.#channel.value)
          return false;

        this.#addChannel(channel);
        return true;
      });

    } else {
      if (!isNull(data.input.channel))
        this.#channel.value = data.input.channel;

      else
        this.#channel.value = 0;

      this.#channel.addEntry(this.#channel.value);
      this.#addChannel(data.input);
    }
  }

  #clear() {
    this.#controls.program = null;
    if (this.#notes.chromatic.keyboard)
      this.#notes.chromatic.keyboard.cleanup();

    super.reset();
  }
}
