// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// Show HTML formatted log messages.
class V2Log extends V2WebModule {
  #device = null;
  #element = null;
  #lines = [];
  #refresh = false;
  #timeout = null;

  // Early initialization to store messages before the section is added.
  constructor() {
    super('log', 'Log', 'View system events');

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.textContent = 'Status';
        e.title = 'Print all available MIDI ports'
        e.addEventListener('click', () => {
          this.#device.printStatus();
        });
      });

      field.addButton((e) => {
        e.textContent = 'Clear';
        e.title = 'Clear this log'
        e.addEventListener('click', () => {
          this.#clear();
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#element = e;
      e.classList.add('log');
      e.classList.add('content');
      e.classList.add('is-small');
    });
  }

  print(line) {
    this.#lines.push(line);
    if (this.#lines.length > 25)
      this.#lines.shift();

    this.#refresh = true;

    if (this.#timeout)
      return;

    this.#update();

    // Set timout to rate-limit the updating.
    this.#timeout = setTimeout(() => {
      this.#timeout = null;
      this.#update();
    }, 250);
  }

  setup(device) {
    super.attach();
    this.#device = device;
  }

  #update() {
    if (!this.#refresh)
      return;

    this.#refresh = false;

    this.#element.innerHTML = '';
    this.#lines.forEach((line) => {
      this.#element.innerHTML += line + '<br>\n';
    });

    this.#element.scrollTop = this.#element.scrollHeight;
  }

  #clear() {
    this.#lines = [];
    this.#element.innerHTML = '';
  }
}
