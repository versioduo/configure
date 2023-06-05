// © Kay Sievers <kay@versioduo.com>, 2019-2022
// SPDX-License-Identifier: Apache-2.0

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
    pads: null,
    controls: Object.seal({
      element: null,
      velocity: Object.seal({
        number: null,
        update: null,
        value: 15
      }),
    }),

    elementList: null,
    chromatic: Object.seal({
      element: null,
      start: 0,
      count: 0,
      octave: 3
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

    new V2WebField(this.#controllers.elementList, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'CC ' + controller.number;
        e.tabIndex = -1;
      });

      field.addButton((e) => {
        e.classList.add('width-text');
        e.classList.add('has-background-light');
        e.classList.add('inactive');
        e.textContent = controller.name;
        e.tabIndex = -1;
      });

      switch (type) {
        case 'range':
          field.addInput('number', (e) => {
            input = e;
            e.classList.add('width-number');
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
            field.addInput('number', (e) => {
              inputFine = e;
              e.classList.add('width-number');
              e.max = 127;
              e.value = value;
              e.addEventListener('input', () => {
                range.value = (input.value << 7) | e.value;
                this.#device.sendControlChange(this.#channel.value, controller.number, input.value);
                this.#device.sendControlChange(this.#channel.value, V2MIDI.CC.controllerLSB + controller.number, e.value);
              });
            });
          }

          // The range slider is added after the field.
          break;

        case 'toggle':
          field.addElement('label', (label) => {
            label.classList.add('switch');

            V2Web.addElement(label, 'input', (e) => {
              e.type = 'checkbox';
              e.checked = value > 63;
              e.addEventListener('input', () => {
                this.#device.sendControlChange(this.#channel.value, controller.number, e.checked ? 127 : 0);
              });
            });

            V2Web.addElement(label, 'span', (e) => {
              e.classList.add('check');
            });
          });
          break;

        case 'momentary':
          field.addButton((e) => {
            e.classList.add('width-label');
            e.classList.add('is-link');

            if (value > 63)
              e.classList.add('is-active');

            e.addEventListener('mousedown', () => {
              this.#device.sendControlChange(this.#channel.value, controller.number, 127);
            });
            e.addEventListener('mouseup', () => {
              this.#device.sendControlChange(this.#channel.value, controller.number, 0);
            });
            e.addEventListener('touchstart', (event) => {
              e.classList.add('is-active');
              e.dispatchEvent(new MouseEvent('mousedown'));
            }, {
              passive: true
            });
            e.addEventListener('touchend', (event) => {
              e.classList.remove('is-active');
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

  // Draw keyboard-like rows of octaves.
  #addKeyboard(start, count) {
    // Subscribe to key presses, arranged in piano layout.
    const handleKey = (ev) => {
      let index = null;

      // Use the key code to void localization issues.
      switch (ev.keyCode) {
        case 65: // A
          index = 0;
          break;

        case 87: // W
          index = 1;
          break;

        case 83: // S
          index = 2;
          break;

        case 69: // E
          index = 3;
          break;

        case 68: // D
          index = 4;
          break;

        case 70: // F
          index = 5;
          break;

        case 84: // T
          index = 6;
          break;

        case 71: // G
          index = 7;
          break;

        case 89: // Y
          index = 8;
          break;

        case 72: // H
          index = 9;
          break;

        case 85: // U
          index = 10;
          break;

        case 74: // J
          index = 11;
          break;

        case 75: // K
          index = 12;
          break;

        case 79: // O
          index = 13;
          break;

        case 90: // Z
          if (ev.type === 'keydown' && this.#notes.chromatic.octave > -2) {
            this.#notes.chromatic.octave--;
            if (this.#notes.pads[(this.#notes.chromatic.octave + 2) * 12])
              this.#notes.pads[(this.#notes.chromatic.octave + 2) * 12].focus();

            else
              document.activeElement.blur();
          }
          return null;

        case 88: // X
          if (ev.type === 'keydown' && this.#notes.chromatic.octave < 8) {
            this.#notes.chromatic.octave++;
            if (this.#notes.pads[(this.#notes.chromatic.octave + 2) * 12])
              this.#notes.pads[(this.#notes.chromatic.octave + 2) * 12].focus();

            else
              document.activeElement.blur();
          }
          return null;

        case 67: // C
          if (ev.type === 'keydown' && this.#notes.controls.velocity.value > 1) {
            this.#notes.controls.velocity.update(this.#notes.controls.velocity.value - Math.min(10, (this.#notes.controls.velocity.value - 1)));
            this.#notes.controls.velocity.number.focus();
          }
          return null;

        case 86: // V
          if (ev.type === 'keydown' && this.#notes.controls.velocity.value < 127) {
            this.#notes.controls.velocity.update(this.#notes.controls.velocity.value + Math.min(10, 127 - this.#notes.controls.velocity.value));
            this.#notes.controls.velocity.number.focus();
          }
          return null;

        default:
          return null;
      }

      if (index === null)
        return;

      const base = (this.#notes.chromatic.octave + 2) * 12;
      const note = base + index;

      if (note > 127)
        return;

      if (this.#notes.pads[note])
        this.#notes.pads[note].focus();

      return note;
    };

    document.addEventListener('keydown', (ev) => {
      if (ev.repeat)
        return;

      const note = handleKey(ev);
      if (note != null)
        this.#device.sendNote(this.#channel.value, note, this.#notes.controls.velocity.value);
    });

    document.addEventListener('keyup', (ev) => {
      const note = handleKey(ev);
      if (note != null)
        this.#device.sendNoteOff(this.#channel.value, note);
    });

    this.#notes.chromatic.octave = Math.trunc(start / 12) - 2;

    const addOctave = (octave, first, last) => {
      new V2WebField(this.#notes.chromatic.element, (field) => {
        for (let i = 0; i < 12; i++) {
          field.addButton((e, p) => {
            e.classList.add('keyboard-button');
            p.classList.add('is-expanded');

            const note = (octave * 12) + i;
            this.#notes.pads[note] = e;

            e.textContent = V2MIDI.Note.name(note);
            if (V2MIDI.Note.isBlack(note))
              e.classList.add('is-dark');


            e.addEventListener('mousedown', () => {
              this.#device.sendNote(this.#channel.value, note, this.#notes.controls.velocity.value);
            });

            e.addEventListener('mouseup', () => {
              this.#device.sendNoteOff(this.#channel.value, note);
            });

            e.addEventListener('touchstart', (event) => {
              e.classList.add('is-active');
              e.dispatchEvent(new MouseEvent('mousedown'));
            }, {
              passive: true
            });

            e.addEventListener('touchend', (event) => {
              e.classList.remove('is-active');
              e.dispatchEvent(new MouseEvent('mouseup'));
              if (event.cancelable)
                event.preventDefault();
            });

            if (i < first || i > last)
              e.style.visibility = 'hidden';
          });
        }
      });
    };

    const firstOctave = Math.trunc(start / 12);
    const lastOctave = Math.trunc((start + (count - 1)) / 12);
    this.#notes.pads = [];

    addOctave(firstOctave, start % 12, Math.min(11, (start % 12) + count - 1));
    if (lastOctave > firstOctave) {
      for (let i = firstOctave + 1; i < lastOctave; i++)
        addOctave(i, 0, 11);

      addOctave(lastOctave, 0, (start + count - 1) % 12);
    }
  }

  #addNote(name, note) {
    V2Web.addButtons(this.#notes.elementList, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.textContent = V2MIDI.Note.name(note) + ' (' + note + ')';
        if (V2MIDI.Note.isBlack(note))
          e.classList.add('is-dark');
        else
          e.classList.add('has-background-grey-lighter');
        e.tabIndex = -1;
      });

      V2Web.addButton(buttons, (e) => {
        e.classList.add('width-text');
        e.classList.add('has-background-light');
        e.classList.add('inactive');
        e.textContent = name;
        e.tabIndex = -1;
      });

      V2Web.addButton(buttons, (e) => {
        e.classList.add('width-label');
        e.classList.add('is-link');
        e.addEventListener('mousedown', () => {
          this.#device.sendNote(this.#channel.value, note, this.#notes.controls.velocity.value);
        });
        e.addEventListener('mouseup', () => {
          this.#device.sendNoteOff(this.#channel.value, note);
        });
        e.addEventListener('touchstart', (event) => {
          e.classList.add('is-active');
          e.dispatchEvent(new MouseEvent('mousedown'));
        }, {
          passive: true
        });
        e.addEventListener('touchend', (event) => {
          e.classList.remove('is-active');
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

      new V2WebField(this.#controls.element, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Program';
          e.tabIndex = -1;
        });

        field.addElement('span', (e) => {
          e.classList.add('select');

          V2Web.addElement(e, 'select', (select) => {

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
      let input = null;
      let range = null;

      this.#notes.controls.velocity.update = (number) => {
        if (isNull(number) || number < 0 || number > 127)
          return;

        this.#notes.controls.velocity.value = Number(number);
        input.value = number;
        range.value = number;
      };

      new V2WebField(this.#notes.controls.element, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Velocity';
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#notes.controls.velocity.number = e;
          input = e;
          e.classList.add('width-number');
          e.min = 1;
          e.max = 127;
          e.value = this.#notes.controls.velocity.value;
          e.addEventListener('input', () => {
            this.#notes.controls.velocity.update(e.value);
          });
        });
      });

      V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 1;
        e.max = 127;
        e.value = this.#notes.controls.velocity.value;
        e.addEventListener('input', () => {
          this.#notes.controls.velocity.update(e.value);
        });
      });

      // Aftertouch Channel.
      if (channel.aftertouch) {
        let input = null;
        let range = null;

        new V2WebField(this.#notes.controls.element, (field) => {
          field.addButton((e) => {
            e.classList.add('width-label');
            e.classList.add('has-background-grey-lighter');
            e.classList.add('inactive');
            e.textContent = 'Aftertouch';
            e.tabIndex = -1;
          });

          field.addInput('number', (e) => {
            input = e;
            e.classList.add('input');
            e.classList.add('width-number');
            e.max = 127;
            e.value = channel.aftertouch.value;
            e.addEventListener('input', () => {
              this.#device.sendAftertouchChannel(this.#channel.value, Number(e.value));
              range.value = e.value;
            });
          });
        });

        V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
          e.classList.add('range');
          e.type = 'range';
          e.max = 127;
          e.value = channel.aftertouch.value;
          e.addEventListener('input', () => {
            this.#device.sendAftertouchChannel(this.#channel.value, Number(e.value));
            input.value = e.value;
          });

          e.addEventListener('mouseup', () => {
            e.value = 0;
            e.value = 0;
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

        new V2WebField(this.#notes.controls.element, (field) => {
          field.addButton((e) => {
            e.classList.add('width-label');
            e.classList.add('has-background-grey-lighter');
            e.classList.add('inactive');
            e.textContent = channel.pitchbend.name || 'Pitch Bend';
            e.tabIndex = -1;
          });

          field.addInput('number', (e) => {
            input = e;
            e.classList.add('width-label');
            e.min = -8192;
            e.max = 8191;
            e.value = channel.pitchbend.value;
            e.addEventListener('input', () => {
              this.#device.sendPitchBend(this.#channel.value, Number(e.value));
              range.value = e.value;
            });
          });
        });

        V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
          e.classList.add('range');
          e.type = 'range';
          e.min = -8192;
          e.max = 8191;
          e.value = channel.pitchbend.value;
          e.addEventListener('input', () => {
            this.#device.sendPitchBend(this.#channel.value, Number(e.value));
            input.value = e.value;
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
        this.#addKeyboard(this.#notes.chromatic.start, this.#notes.chromatic.count);
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

    V2Web.addButtons(this.canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Notes Off';
        e.addEventListener('click', () => {
          this.#device.sendControlChange(this.#channel.value, V2MIDI.CC.allNotesOff, 0);
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Reset';
        e.addEventListener('click', () => {
          this.#channel.value = null;
          this.#device.sendReset();
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.classList.add('is-link');
        e.textContent = 'Refresh';
        e.addEventListener('click', () => {
          this.#device.sendGetAll();
        });
      });
    });

    new V2WebField(this.canvas, (field) => {
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
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#controls.element = e;
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#controllers.element = e;
      e.style.display = 'none';

      V2Web.addElement(e, 'hr', (e) => {
        e.classList.add('subsection');
      });

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

      V2Web.addElement(e, 'hr', (e) => {
        e.classList.add('subsection');
      });

      V2Web.addElement(e, 'h3', (e) => {
        e.classList.add('title');
        e.classList.add('subsection');
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
    super.reset();
  }
}
