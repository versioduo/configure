// © Kay Sievers <kay@versioduo.com>, 2019-2023
// SPDX-License-Identifier: Apache-2.0

// Show HTML formatted log messages.
class V2Log extends V2WebModule {
  #device = null;
  #element = null;

  // Early initialization to store messages before the section is added.
  constructor() {
    super('log', 'Log', 'View system events');

    V2Web.addButtons(this.canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Status';
        e.addEventListener('click', () => {
          this.#device.printStatus();
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Clear';
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

    return Object.seal(this);
  }

  print(line) {
    V2Web.addElement(this.#element, 'div', (e) => {
      e.innerHTML = line;
    });

    while (this.#element.childElementCount > 100)
      this.#element.firstChild.remove();

    this.#element.scrollTop = this.#element.scrollHeight;
  }

  setup(device) {
    this.#device = device;
  }

  #clear() {
    while (this.#element.firstChild)
      this.#element.firstChild.remove();
  }
}
