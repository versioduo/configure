// Debug interface
class V2Debug extends V2AppSection {
  #device = null;
  #element = null;

  constructor(device) {
    super('debug', '--bug', 'Debug', 'Show the Device Reply');
    this.#device = device;

    this.#device.addNotifier('show', (data) => {
      this.removeSection();
      this.addSection();
      this.#show(data);
    });

    this.#device.addNotifier('reset', () => {
      this.removeSection();
    });

    return Object.seal(this);
  }

  #show(data) {
    new V2AppMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Copy';
        e.addEventListener('click', () => {
          navigator.clipboard.writeText(this.#element.textContent);
        });
      });
    });

    V2App.addElement(this.canvas, 'pre', (e) => {
      e.style.overflowX = 'auto';
      e.style.paddingRight = '0.5rem';
      e.style.width = '100%';
      e.textContent = '"com.versioduo.device": ' + JSON.stringify(data, null, '  ');
    });
  }
}
