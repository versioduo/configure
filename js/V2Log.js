// Show HTML formatted log messages.
class V2Log extends V2WebModule {
  #device = null;
  #element = null;

  // Early initialization to store messages before the section is added.
  constructor() {
    super('log', '--console', 'Log', 'View System Events');

    new V2WebMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Status';
        e.addEventListener('click', () => {
          this.#device.printStatus();
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Clear';
        e.addEventListener('click', () => {
          this.#clear();
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#element = e;
      e.style.height = '20rem';
      e.style.overflowX = 'auto';
      e.style.overflowY = 'scroll';
      e.style.padding = '0.5rem';
      e.style.width = '100%';
      e.style.whiteSpace = 'nowrap';
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
