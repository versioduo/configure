// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// Div showing HTML formatted log messages.
class V2Log {
  #element = null;
  #lines = [];
  #refresh = false;
  #timeout = null;

  constructor(element) {
    this.#element = element;
  }

  print(line) {
    this.#lines.push(line);
    if (this.#lines.length > 25)
      this.#lines.shift();

    this.#refresh = true;

    if (this.#timeout)
      return;

    this.update();

    // Set timout to rate-limit the updating.
    this.#timeout = setTimeout(() => {
      this.#timeout = null;
      this.update();
    }, 250);
  }

  update() {
    if (!this.#refresh)
      return;

    this.#refresh = false;

    this.#element.innerHTML = '';
    this.#lines.forEach((line) => {
      this.#element.innerHTML += line + '<br>\n';
    });

    this.#element.scrollTop = this.#element.scrollHeight;
  }

  clear() {
    this.#lines = [];
    this.#element.innerHTML = '';
  }
}
