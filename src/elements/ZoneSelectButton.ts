class ZoneSelectButton {
    element: HTMLElement;
    constructor(zone: Zone) {
        this.element = document.createElement('li');

        this.element.className = 'popup-item';
        if (zone.id === App.zone?.id)
            this.element.classList.add('selected')

        this.element.innerText = zone.name;
        this.element.setAttribute('data', zone.id);
        this.element.setAttribute('onclick', 'UI.showLevels(this)');
    }
}
