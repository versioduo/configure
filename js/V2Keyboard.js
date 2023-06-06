// © Kay Sievers <kay@versioduo.com>, 2023
// SPDX-License-Identifier: Apache-2.0

// Draw keyboard-like rows of octaves.
class V2Keyboard {
  handler = Object.seal({
    velocity: Object.seal({
      down: null,
      up: null,
    }),

    down: null,
    up: null
  });

  #element = null;
  #octave = 3;
  #pads = null;

  constructor(element, noteStart, noteCount) {
    this.#element = element;

    document.addEventListener('keydown', (ev) => {
      if (ev.repeat)
        return;

      const note = this.#handleKey(ev);
      if (note != null)
        this.handler.down(note);
    });

    document.addEventListener('keyup', (ev) => {
      const note = this.#handleKey(ev);
      if (note != null)
        this.handler.up(note);
    });

    // If the middle C is not in the given range of notes, switch to the octave of the first note.
    if (V2MIDI.Note.getNote(this.#octave) < noteStart || V2MIDI.Note.getNote(this.#octave) > (noteStart + noteCount - 1))
      this.#octave = V2MIDI.Note.getOctave(noteStart);

    const firstOctave = V2MIDI.Note.getOctave(noteStart);
    const lastOctave = V2MIDI.Note.getOctave(noteStart + noteCount - 1);
    this.#pads = [];

    this.#addOctave(firstOctave, noteStart % 12, Math.min(11, (noteStart % 12) + noteCount - 1));
    if (lastOctave > firstOctave) {
      for (let i = firstOctave + 1; i < lastOctave; i++)
        this.#addOctave(i, 0, 11);

      this.#addOctave(lastOctave, 0, (noteStart + noteCount - 1) % 12);
    }

    this.#pads = Object.seal(this.#pads);
    return Object.seal(this);
  }

  // Arrange two rows of keys in piano layout.
  #handleKey(ev) {
    let index = null;

    // Use the key code to avoid localization issues.
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
        if (ev.type === 'keydown' && this.#octave > -2) {
          this.#octave--;
          if (this.#pads[V2MIDI.Note.getNote(this.#octave)])
            this.#pads[V2MIDI.Note.getNote(this.#octave)].focus();

          else
            document.activeElement.blur();
        }
        return null;

      case 88: // X
        if (ev.type === 'keydown' && this.#octave < 8) {
          this.#octave++;
          if (this.#pads[V2MIDI.Note.getNote(this.#octave)])
            this.#pads[V2MIDI.Note.getNote(this.#octave)].focus();

          else
            document.activeElement.blur();
        }
        return null;

      case 67: // C
        if (ev.type === 'keydown' && this.handler.velocity.down)
          this.handler.velocity.down();
        return null;

      case 86: // V
        if (ev.type === 'keydown' && this.handler.velocity.up)
          this.handler.velocity.up();
        return null;

      default:
        return null;
    }

    if (index === null)
      return;

    const note = V2MIDI.Note.getNote(this.#octave, index);
    if (note > 127)
      return;

    if (this.#pads[note])
      this.#pads[note].focus();

    return note;
  };

  #addOctave(octave, firstIndex, lastIndex) {
    new V2WebField(this.#element, (field) => {
      for (let i = 0; i < 12; i++) {
        field.addButton((e, p) => {
          e.classList.add('keyboard-button');
          p.classList.add('is-expanded');

          const note = V2MIDI.Note.getNote(octave, i);
          this.#pads[note] = e;

          e.textContent = V2MIDI.Note.getName(note);
          if (V2MIDI.Note.isBlack(note))
            e.classList.add('is-dark');

          e.addEventListener('mousedown', () => {
            this.handler.down(note);
          });

          e.addEventListener('mouseup', () => {
            this.handler.up(note);
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

          if (i < firstIndex || i > lastIndex)
            e.style.visibility = 'hidden';
        });
      }
    });
  };
};
