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

  #listener = null;

  #notes = Object.seal({
    start: 21,
    count: 88,
  });

  #octave = Object.seal({
    min: -2,
    max: 7,
    current: 3,
  });

  #pads = null;

  constructor(element, noteStart, noteCount) {
    this.#listener = new AbortController();
    this.#notes.start = noteStart;
    this.#notes.count = noteCount;
    this.#octave.min = V2MIDI.Note.getOctave(noteStart);
    this.#octave.max = V2MIDI.Note.getOctave(noteStart + noteCount - 1);

    // Remove any focus, the keyboard listens to key presses.
    document.activeElement.blur();

    // If an input text element is currently in focus, do not steal the key presses from it.
    const play = () => {
      if (!document.activeElement || document.activeElement === document.body)
        return true;

      if (document.activeElement.tagName !== 'INPUT')
        return true;

      if (document.activeElement.type !== 'text')
        return true;

      return false;
    };

    document.addEventListener('keydown', (ev) => {
      if (!play())
        return;

      if (ev.repeat)
        return;

      const note = this.#handleKey(ev);
      if (note != null)
        this.handler.down(note);
    }, {
      signal: this.#listener.signal
    });

    document.addEventListener('keyup', (ev) => {
      if (!play())
        return;

      const note = this.#handleKey(ev);
      if (note != null)
        this.handler.up(note);
    }, {
      signal: this.#listener.signal
    });

    // If the middle C is not in the given range of notes, switch to the octave of the first note.
    if (V2MIDI.Note.getNote(this.#octave.current) < noteStart || V2MIDI.Note.getNote(this.#octave.current) > (noteStart + noteCount - 1))
      this.#octave.current = this.#octave.min;

    this.#pads = [];

    this.#addOctave(element, this.#octave.min, noteStart % 12, Math.min(11, (noteStart % 12) + noteCount - 1));
    if (this.#octave.max > this.#octave.min) {
      for (let i = this.#octave.min + 1; i < this.#octave.max; i++)
        this.#addOctave(element, i, 0, 11);

      this.#addOctave(element, this.#octave.max, 0, (noteStart + noteCount - 1) % 12);
    }

    this.#pads = Object.seal(this.#pads);
    return Object.seal(this);
  }

  // Unregister from global document events.
  cleanup() {
    this.#listener.abort();
  }

  // Arrange two rows of keys in piano layout.
  #handleKey(ev) {
    let index = null;

    // Use the key's code to avoid localization issues.
    switch (ev.code) {
      case 'KeyA':
        index = 0;
        break;

      case 'KeyW':
        index = 1;
        break;

      case 'KeyS':
        index = 2;
        break;

      case 'KeyE':
        index = 3;
        break;

      case 'KeyD':
        index = 4;
        break;

      case 'KeyF':
        index = 5;
        break;

      case 'KeyT':
        index = 6;
        break;

      case 'KeyG':
        index = 7;
        break;

      case 'KeyY':
        index = 8;
        break;

      case 'KeyH':
        index = 9;
        break;

      case 'KeyU':
        index = 10;
        break;

      case 'KeyJ':
        index = 11;
        break;

      case 'KeyK':
        index = 12;
        break;

      case 'KeyO':
        index = 13;
        break;

      case 'KeyZ':
        if (ev.type === 'keydown' && this.#octave.current > this.#octave.min)
          this.#octave.current--;
        if (V2MIDI.Note.getNote(this.#octave.current) >= this.#notes.start)
          this.#pads[V2MIDI.Note.getNote(this.#octave.current)].focus({ preventScroll: true });
        else
          this.#pads[this.#notes.start].focus({ preventScroll: true });
        return null;

      case 'KeyX':
        if (ev.type === 'keydown' && this.#octave.current < this.#octave.max)
          this.#octave.current++;
        this.#pads[V2MIDI.Note.getNote(this.#octave.current)].focus({ preventScroll: true });
        return null;

      case 'KeyC':
        if (ev.type === 'keydown' && this.handler.velocity.down)
          this.handler.velocity.down();
        return null;

      case 'KeyV':
        if (ev.type === 'keydown' && this.handler.velocity.up)
          this.handler.velocity.up();
        return null;

      default:
        return null;
    }

    if (index === null)
      return;

    const note = V2MIDI.Note.getNote(this.#octave.current, index);
    if (note < this.#notes.start || note > (this.#notes.start + this.#notes.count - 1))
      return;

    if (this.#pads[note])
      this.#pads[note].focus({ preventScroll: true });

    return note;
  };

  #addOctave(element, octave, firstIndex, lastIndex) {
    new V2WebField(element, (field) => {
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
