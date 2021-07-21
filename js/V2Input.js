// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// MIDI Input controllers and notes.
class V2Input extends V2WebModule {
  #device = null;
  #channel = 0;
  #controls = {
    element: null,
    program: null
  };
  #controllers = {
    element: null,
    elementList: null
  };
  #notes = {
    element: null,
    controls: {
      element: null,
      velocity: 15
    },
    elementList: null,
    chromatic: {
      element: null,
      start: 0,
      count: 0
    }
  };

  constructor(device) {
    super('input', 'MIDI In', 'Play notes and adjust controllers');
    super.attach();
    this.#device = device;

    this.#device.notifiers.show.push((data) => {
      this.#show(data);
    });

    this.#device.notifiers.reset.push(() => {
      this.#channel = 0;
      this.#clear();
    });
  }

  #addController(name, controller, type, value, valueFine) {
    let input = null;
    let inputFine = null;
    let range = null;

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
            input = e;
            e.classList.add('width-number');
            e.title = 'The controller value';
            e.min = 0;
            e.max = 127;
            e.value = value || 0;
            e.addEventListener('input', () => {
              if (!inputFine) {
                range.value = input.value;
                this.#device.sendControlChange(this.#channel, controller, e.value);

              } else {
                range.value = (e.value << 7) | inputFine.value;
                this.#device.sendControlChange(this.#channel, controller, e.value);
                this.#device.sendControlChange(this.#channel, V2MIDI.CC.controllerLSB + controller, inputFine.value);
              }
            });
          });

          // Support high-resolution, 14 bits controllers. Controllers 0-31 (MSB)
          // have matching high-resolution values with controllers 32-63 (LSB).
          if (valueFine != null) {
            field.addInput('number', (e) => {
              inputFine = e;
              e.classList.add('width-number');
              e.title = 'The controller value';
              e.min = 0;
              e.max = 127;
              e.value = value;
              e.addEventListener('input', () => {
                range.value = (input.value << 7) | e.value;
                this.#device.sendControlChange(this.#channel, controller, input.value);
                this.#device.sendControlChange(this.#channel, V2MIDI.CC.controllerLSB + controller, e.value);
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
              e.title = 'Toggle Switch';
              e.checked = value > 63;
              e.addEventListener('input', () => {
                this.#device.sendControlChange(this.#channel, controller, e.checked ? 127 : 0);
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
            e.title = 'Momentary Switch';

            e.addEventListener('mousedown', () => {
              this.#device.sendControlChange(this.#channel, controller, 127);
            });
            e.addEventListener('mouseup', () => {
              this.#device.sendControlChange(this.#channel, controller, 0);
            });
            e.addEventListener('touchstart', (event) => {
              e.classList.add('is-active');
              e.dispatchEvent(new MouseEvent('mousedown'));
              if (event.cancelable)
                event.preventDefault()
            });
            e.addEventListener('touchend', (event) => {
              e.classList.remove('is-active');
              e.dispatchEvent(new MouseEvent('mouseup'));
              if (event.cancelable)
                event.preventDefault()
            });
          });
          break;
      }
    });

    if (type == 'range') {
      V2Web.addElement(this.#controllers.elementList, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The controller value';
        if (!inputFine) {
          e.max = 127;
          e.value = value || 0;

        } else {
          e.max = (127 << 7) + 127;
          e.value = (value << 7) + valueFine;
        }
        e.addEventListener('input', () => {
          if (!inputFine) {
            input.value = e.value;
            this.#device.sendControlChange(this.#channel, controller, e.value);

          } else {
            const msb = (e.value >> 7) & 0x7f;
            const lsb = e.value & 0x7f;
            input.value = msb;
            inputFine.value = lsb;
            this.#device.sendControlChange(this.#channel, controller, msb);
            this.#device.sendControlChange(this.#channel, V2MIDI.CC.controllerLSB + controller, lsb);
          }
        });
      });
    }
  }

  // Draw keyboard-like rows of octaves.
  #addKeyboard(start, count) {
    const addOctave = (octave, first, last) => {
      new V2WebField(this.#notes.chromatic.element, (field) => {
        for (let i = 0; i < 12; i++) {
          field.addButton((e, p) => {
            e.classList.add('keyboard-button');
            p.classList.add('is-expanded');

            const note = (octave * 12) + i;
            e.textContent = V2MIDI.Note.name(note);
            if (V2MIDI.Note.isBlack(note))
              e.classList.add('is-dark');

            e.title = '#' + note;

            e.addEventListener('mousedown', () => {
              this.#device.sendNote(this.#channel, note, this.#notes.controls.velocity);
            });
            e.addEventListener('mouseup', () => {
              this.#device.sendNoteOff(this.#channel, note);
            });
            e.addEventListener('touchstart', (event) => {
              e.classList.add('is-active');
              e.dispatchEvent(new MouseEvent('mousedown'));
              if (event.cancelable)
                event.preventDefault()
            });
            e.addEventListener('touchend', (event) => {
              e.classList.remove('is-active');
              e.dispatchEvent(new MouseEvent('mouseup'));
              if (event.cancelable)
                event.preventDefault()
            });

            if (i < first || i > last)
              e.style.visibility = 'hidden';
          });
        }
      });
    }

    const firstOctave = Math.trunc(start / 12);
    const lastOctave = Math.trunc((start + (count - 1)) / 12);
    addOctave(firstOctave, start % 12, Math.min(11, (start % 12) + count - 1));
    if (lastOctave > firstOctave) {
      for (let i = firstOctave + 1; i < lastOctave; i++)
        addOctave(i, 0, 11);

      addOctave(lastOctave, 0, (start + count - 1) % 12);
    }
  }

  #addNote(name, note) {
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
        e.classList.add('width-text');
        e.classList.add('has-background-light');
        e.classList.add('inactive');
        e.textContent = name;
        e.tabIndex = -1;
      });

      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('is-link');
        e.title = '#' + note;
        e.addEventListener('mousedown', () => {
          this.#device.sendNote(this.#channel, note, this.#notes.controls.velocity);
        });
        e.addEventListener('mouseup', () => {
          this.#device.sendNoteOff(this.#channel, note);
        });
        e.addEventListener('touchstart', (event) => {
          e.classList.add('is-active');
          e.dispatchEvent(new MouseEvent('mousedown'));
          if (event.cancelable)
            event.preventDefault()
        });
        e.addEventListener('touchend', (event) => {
          e.classList.remove('is-active');
          e.dispatchEvent(new MouseEvent('mouseup'));
          if (event.cancelable)
            event.preventDefault()
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
            select.title = 'Send MIDI Program Change';

            channel.programs.forEach((program, index) => {
              V2Web.addElement(select, 'option', (e) => {
                e.title = '#' + (program.number + 1);
                e.value = program.number;
                e.text = (program.number + 1) + ' - ' + program.name;
                e.selected = (program.number == this.#controls.program);
              })
            });

            select.addEventListener('change', () => {
              this.#controls.program = channel.programs[select.selectedIndex].number;
              this.#device.sendProgramChange(this.#channel, channel.programs[select.selectedIndex].number);
              this.#device.sendGetAll();
            });
          });
        });
      });
    }

    // Controllers Section.
    if (channel.controllers) {
      channel.controllers.forEach((controller, index) => {
        this.#addController(controller.name, controller.number, controller.type || 'range', controller.value || 0, controller.valueFine);
      });

      this.#controllers.element.style.display = '';
    }

    // Notes Section.
    if (channel.chromatic || channel.notes) {
      let input = null;
      let range = null;

      new V2WebField(this.#notes.controls.element, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Velocity';
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          input = e;
          e.classList.add('width-number');
          e.title = 'The velocity value to play the notes with';
          e.min = 1;
          e.max = 127;
          e.value = this.#notes.controls.velocity;
          e.addEventListener('input', () => {
            this.#notes.controls.velocity = Number(input.value);
            range.value = e.value;
          });
        });
      });

      V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The velocity value to play the notes with';
        e.min = 1;
        e.max = 127;
        e.value = this.#notes.controls.velocity;
        e.addEventListener('input', () => {
          this.#notes.controls.velocity = Number(e.value);
          input.value = e.value;
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
            e.title = 'Channel Aftertouch';
            e.min = 0;
            e.max = 127;
            e.value = channel.aftertouch.value;
            e.addEventListener('input', () => {
              this.#device.sendAftertouchChannel(this.#channel, Number(e.value));
              range.value = e.value;
            });
          });
        });

        V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
          e.classList.add('range');
          e.title = 'Channel Aftertouch';
          e.type = 'range';
          e.min = 0;
          e.max = 127;
          e.value = channel.aftertouch.value;
          e.addEventListener('input', () => {
            this.#device.sendAftertouchChannel(this.#channel, Number(e.value));
            input.value = e.value;
          });

          e.addEventListener('mouseup', () => {
            e.value = 0;
            e.value = 0;
            this.#device.sendAftertouchChannel(this.#channel, 0);
          });

          e.addEventListener('touchend', (event) => {
            e.dispatchEvent(new MouseEvent('mouseup'));
            if (event.cancelable)
              event.preventDefault()
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
            e.classList.add('width-number');
            e.title = 'Pitch Bend';
            e.min = -8192;
            e.max = 8191;
            e.value = channel.pitchbend.value;
            e.addEventListener('input', () => {
              this.#device.sendPitchBend(this.#channel, Number(e.value));
              range.value = e.value;
            });
          });
        });

        V2Web.addElement(this.#notes.controls.element, 'input', (e) => {
          e.classList.add('range');
          e.title = 'Pitch Bend';
          e.type = 'range';
          e.min = -8192;
          e.max = 8191;
          e.value = channel.pitchbend.value;
          e.addEventListener('input', () => {
            this.#device.sendPitchBend(this.#channel, Number(e.value));
            input.value = e.value;
          });

          e.addEventListener('mouseup', () => {
            // Do not reset value to 0 if pitchbend is used for something else.
            if (channel.pitchbend.name != null)
              return;
            e.value = 0;
            input.value = 0;
            this.#device.sendPitchBend(this.#channel, 0);
          });

          e.addEventListener('touchend', (event) => {
            e.dispatchEvent(new MouseEvent('mouseup'));
            if (event.cancelable)
              event.preventDefault()
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
        channel.notes.forEach((note) => {
          this.#addNote(note.name, note.number);
        });
      }

      this.#notes.element.style.display = '';
    }
  }

  #show(data) {
    this.#clear();

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.textContent = 'Notes Off';
        e.title = 'Silence all active notes';
        e.addEventListener('click', () => {
          this.#device.sendControlChange(this.#channel, V2MIDI.CC.allNotesOff, 0);
        });
      });

      field.addButton((e) => {
        e.textContent = 'Reset';
        e.title = 'Reset the device';
        e.addEventListener('click', () => {
          this.#device.sendReset();
        });
      });

      field.addButton((e) => {
        e.classList.add('is-link');
        e.textContent = 'Refresh';
        e.title = 'Refresh the data';
        e.addEventListener('click', () => {
          this.#device.sendGetAll();
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#controls.element = e;
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
        this.#notes.controls.element = e;
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#notes.elementList = e;
      });

      V2Web.addElement(e, 'div', (e) => {
        this.#notes.chromatic.element = e;
      });
    });

    // The controls for all channels.
    this.#addChannel(data.input);

    // A separate set of controls per channel.
    if (data.input.channels) {
      new V2WebField(this.#controls.element, (field) => {
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
            select.title = 'MIDI Channel';

            // Look for the currently selected channel number.
            data.input.channels.find((channel) => {
              if (!channel.selected)
                return false;

              this.#channel = channel.number;
              return true;
            });

            data.input.channels.forEach((channel, index) => {
              V2Web.addElement(select, 'option', (e) => {
                e.title = '#' + (channel.number + 1);
                e.value = index;
                e.text = (channel.number + 1);
                if (channel.name)
                  e.text += ' - ' + channel.name;
                e.selected = (channel.number == this.#channel);
              });
            });

            select.addEventListener('change', () => {
              this.#channel = data.input.channels[select.selectedIndex].number;
              // Request a refresh with the values of the selected channel.
              this.#device.sendRequest({
                'method': 'switchChannel',
                'channel': data.input.channels[select.selectedIndex].number
              });
            });
          });
        });
      });

      data.input.channels.find((channel) => {
        if (channel.number != this.#channel)
          return false;

        this.#addChannel(channel);
        return true;
      });
    }
  }

  #clear() {
    this.#controls.program = null;
    super.reset();
  }
}
