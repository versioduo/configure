// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// The main menu/navigation.
class Menu {
  static setup() {
    const home = document.querySelector('.navbar-home');
    const burger = document.querySelector('.navbar-burger');
    const menu = document.querySelector('.navbar-menu');

    // Close menu at Home/Brand.
    home.addEventListener('click', () => {
      burger.classList.remove('is-active');
      menu.classList.remove('is-active');
    })

    // Toggle menu with burger.
    burger.addEventListener('click', () => {
      burger.classList.toggle('is-active');
      menu.classList.toggle('is-active');
    })

    // Close menu at menu element click.
    menu.addEventListener('click', () => {
      burger.classList.remove('is-active');
      menu.classList.remove('is-active');
    })
  }
}

// Inline element to show a notification.
class Notify {
  #element = null;
  #elementText = null;

  constructor(element) {
    this.#element = element;

    this.#element.style.display = 'none';
    this.#element.classList.add('notification');
    this.#element.classList.add('is-light');

    const button = document.createElement('button');
    button.classList.add('delete');
    button.addEventListener('click', () => {
      this.clear();
    });
    this.#element.appendChild(button);

    this.#elementText = document.createElement('div');
    this.#element.appendChild(this.#elementText);
  }

  clear(text) {
    this.#element.style.display = 'none';
    this.#element.classList.remove('is-info');
    this.#element.classList.remove('is-success');
    this.#element.classList.remove('is-warning');
    this.#element.classList.remove('is-danger');
    this.#elementText.innerHTML = '';
  }

  info(text) {
    this.clear();
    this.#element.classList.add('is-info');
    this.#element.style.display = '';
    this.#elementText.innerHTML = text;
  }

  success(text) {
    this.clear();
    this.#element.classList.add('is-success');
    this.#element.style.display = '';
    this.#elementText.innerHTML = text;
  }

  warn(text) {
    this.clear();
    this.#element.classList.add('is-warning');
    this.#element.style.display = '';
    this.#elementText.innerHTML = text;
  }

  error(text) {
    this.clear();
    this.#element.classList.add('is-danger');
    this.#element.style.display = '';
    this.#elementText.innerHTML = text;
  }
}
