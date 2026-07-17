// Debug interface
class V2Debug extends V2WebModule {
  #device = null;
  #element = null;

  constructor(device) {
    super('debug', 'Debug', 'Show the last reply');
    this.#device = device;

    new V2WebMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Copy';
        e.addEventListener('click', () => {
          navigator.clipboard.writeText(this.#element.textContent);
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      V2Web.addElement(e, 'pre', (pre) => {
        this.#element = pre;
      });
    });

    this.#device.addNotifier('show', (data) => {
      this.#element.textContent = '"com.versioduo.device": ' + JSON.stringify(data, null, '  ');
    });

    this.#device.addNotifier('reset', (data) => {
      this.#element.textContent = '';
    });

    this.#device.addNotifier('show', (data) => {
      this.attach();
    });

    this.#device.addNotifier('reset', () => {
      this.detach();
    });

    return Object.seal(this);
  }
}
