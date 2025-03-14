class LevelSelectButton {
    element: HTMLElement;
    constructor(level: Level) {
        this.element = document.createElement('li');

        this.element.className = 'popup-item';
        if (level.id === App.level.id)
            this.element.classList.add('selected')

        this.element.innerText = `${level.code} - ${level.name}`;
        this.element.setAttribute('data', level.id);
        this.element.setAttribute('onclick', 'UI.changeLevel(this)');
    }
}
