// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// Send generic MIDI test messages.
class V2Test extends V2WebModule {
  #device = null;

  constructor(device) {
    const note = {
      channel: null,
      note: null,
      velocity: null,
      range: null
    };
    const noteOff = {
      channel: null,
      note: null,
      velocity: null
    };
    const program = {
      channel: null,
      number: null
    };
    const control = {
      channel: null,
      controller: null,
      value: null
    };
    let json = null;

    super('test', 'Test', 'Send generic MIDI messages');
    super.attach();
    this.#device = device;

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('isEnabled');
        e.textContent = 'Note On';
        e.title = 'Send a NoteOn message';
        e.disabled = true;
        e.addEventListener('click', () => {
          this.#device.sendNote(note.channel.value - 1, note.note.value, note.velocity.value);
        });
      });

      field.addInput('number', (e) => {
        note.channel = e;
        e.classList.add('width-number');
        e.title = 'Channel';
        e.min = 1;
        e.max = 16;
        e.value = 1;
      });

      field.addInput('number', (e) => {
        note.note = e;
        e.classList.add('width-number');
        e.title = 'Note';
        e.min = 0;
        e.max = 127;
        e.value = 60;
      });

      field.addInput('number', (e) => {
        note.velocity = e;
        e.classList.add('width-number');
        e.title = 'Velocity';
        e.min = 0;
        e.max = 127;
        e.value = 10;
        e.addEventListener('input', (event) => {
          note.range.value = e.value;
        });
      });
    });

    V2Web.addElement(this.canvas, 'input', (e) => {
      note.range = e;
      e.type = 'range';
      e.classList.add('range');
      e.title = 'Velocity';
      e.min = 0;
      e.max = 127;
      e.value = 10;
      e.addEventListener('input', (event) => {
        note.velocity.value = e.value;
      });
    });

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('isEnabled');
        e.textContent = 'Note Off';
        e.title = 'Send a NoteOff message';
        e.disabled = true;
        e.addEventListener('click', () => {
          this.#device.sendNoteOff(noteOff.channel.value - 1, noteOff.note.value, noteOff.velocity.value);
        });
      });

      field.addInput('number', (e) => {
        noteOff.channel = e;
        e.classList.add('width-number');
        e.title = 'Channel';
        e.min = 1;
        e.max = 16;
        e.value = 1;
      });

      field.addInput('number', (e) => {
        noteOff.note = e;
        e.classList.add('width-number');
        e.title = 'Note';
        e.min = 0;
        e.max = 127;
        e.value = 60;
      });

      field.addInput('number', (e) => {
        noteOff.velocity = e;
        e.classList.add('width-number');
        e.title = 'Velocity';
        e.min = 0;
        e.max = 127;
        e.value = 10;
      });
    });

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('isEnabled');
        e.textContent = 'Program';
        e.title = 'Send a Program Change Message';
        e.disabled = true;
        e.addEventListener('click', () => {
          this.#device.sendProgramChange(program.channel.value - 1, program.number.value - 1);
        });
      });

      field.addInput('number', (e) => {
        program.channel = e;
        e.classList.add('width-number');
        e.title = 'Channel';
        e.min = 1;
        e.max = 16;
        e.value = 1;
      });

      field.addInput('number', (e) => {
        program.number = e;
        e.classList.add('width-number');
        e.title = 'Number';
        e.min = 0;
        e.max = 127;
        e.value = 1;
      });
    });

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('isEnabled');
        e.textContent = 'Controller';
        e.title = 'Send a Control Change Message (CC)';
        e.disabled = true;
        e.addEventListener('click', () => {
          this.#device.sendControlChange(control.channel.value - 1, control.controller.value, control.value.value);
        });
      });

      field.addInput('number', (e) => {
        control.channel = e;
        e.classList.add('width-number');
        e.title = 'Channel';
        e.min = 1;
        e.max = 16;
        e.value = 1;
      });

      field.addInput('number', (e) => {
        control.controller = e;
        e.classList.add('width-number');
        e.title = 'Controller';
        e.min = 0;
        e.max = 127;
        e.value = 1;
      });

      field.addInput('number', (e) => {
        control.value = e;
        e.classList.add('width-number');
        e.title = 'Value';
        e.min = 0;
        e.max = 127;
        e.value = 64;
      });
    });

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('isEnabled');
        e.textContent = 'JSON';
        e.title = 'Send a System Exclusive JSON message';
        e.disabled = true;
        e.addEventListener('click', () => {
          this.#device.sendJSON(json.value);
        });
      });

      field.addInput('text', (e, p) => {
        json = e;
        p.classList.add('is-expanded');
        e.title = 'Message';
        e.value = '{}';
      });
    });
  };
}
