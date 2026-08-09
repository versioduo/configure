// Show HTML formatted log messages.
class V2Log extends V2AppSection {
  #element = null;

  // Early initialization to store messages before the section is added.
  constructor(app) {
    super(app, 'log', '--console', 'Log', 'View System Events');
    Object.seal(this);

    this.#element = document.createElement('div');
    this.#element.style.height = '20rem';
    this.#element.style.overflowX = 'auto';
    this.#element.style.overflowY = 'scroll';
    this.#element.style.padding = '0.5rem';
    this.#element.style.width = '100%';
    this.#element.style.whiteSpace = 'nowrap';
  }

  show() {
    this.removeSection();
    this.addSection();

    new V2AppMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Status';
        e.addEventListener('click', () => {
          this.app.main.printStatus();
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Clear';
        e.addEventListener('click', () => {
          this.#element.replaceChildren();
        });
      });
    });

    this.canvas.append(this.#element);
  }

  reset() {
    this.removeSection();
  }

  print(line) {
    V2App.addElement(this.#element, 'div', (e) => {
      e.innerHTML = line;
    });

    while (this.#element.childElementCount > 100)
      this.#element.firstChild.remove();

    this.#element.scrollTop = this.#element.scrollHeight;
  }
}
