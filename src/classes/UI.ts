class UI {
    static changeLevel(element) {
        const id = element.getAttribute('data');
        this.closePopup();
        this.togglePlay(true);
        App.changeLevel(id);
    }

    static clearSelected() {
        App.selectedEnemies.forEach(e => e.disableHighlight());
        App.selectedEnemies = [];
        App.selectedPath.forEach(p => App.app.stage.removeChild(p));
        App.selectedPath = [];
        // document.querySelectorAll('.enemy-timeline-right').forEach(e => e.remove());
        App.selectedTimelineBox?.element.lastChild.remove();
        App.selectedTimelineBox?.element.classList.remove('selected');
        App.selectedTimelineBox = null;
        App.selectedInfoBox?.element.classList.remove('selected');
        App.selectedInfoBox = null;
    }

    static closePopup() {
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('popup').style.display = 'none';
    }

    static openPopup() {
        this.togglePlay(true);
        const typeElement = document.querySelector(`ul#popup-nav [data="${App.type.id}"]`);
        if (typeElement) {
            const id = typeElement.getAttribute('data');
            const popupZone = document.getElementById('popup-zone');
            popupZone.replaceChildren();
            document.getElementById('popup-level').replaceChildren();
            const type = Type.get(id);
            if (type.id === 'activity') {
                Activity.getAll().forEach(activity => {
                    if (!activity.hasLevels()) return;
                    const button = new ActivitySelectButton(activity);
                    popupZone.appendChild(button.element);
                    if (activity.id === App.activity?.id)
                        this.showLevels(button.element);
                });
            }
            else {
                type.getZones().forEach(zone => {
                    if (!zone.hasLevels()) return;
                    const button = new ZoneSelectButton(zone);
                    popupZone.appendChild(button.element);
                    if (zone.id === App.zone?.id)
                        this.showLevels(button.element);
                });
            }
            document.querySelectorAll('ul#popup-nav .selected').forEach(e => { e.classList.remove('selected'); });
            typeElement.classList.add('selected');
        }
        const zoneElement = document.querySelector(`ul#popup-zone [data="${App.zone.id}"],[data="${App.activity ? App.activity.id : 'none'}"]`);
        if (zoneElement) {
            const id = zoneElement.getAttribute('data');
            const popupLevel = document.getElementById('popup-level');
            popupLevel.replaceChildren();
            const zone = Zone.get(id);
            if (zone) {
                zone.getLevels().forEach(level => {
                    if (level.hidden) return;
                    popupLevel.appendChild(new LevelSelectButton(level).element);
                });
            }
            else {
                const activity = Activity.get(id);
                for (const zone of activity.getZones())
                    zone.getLevels().forEach(level => {
                        if (level.hidden) return;
                        popupLevel.appendChild(new LevelSelectButton(level).element);
                    });
            }
            document.querySelectorAll('ul#popup-zone .selected').forEach(e => { e.classList.remove('selected'); });
            zoneElement.classList.add('selected');
        }
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('popup').style.display = 'block';
    }

    static showZones(element) {
        const id = element.getAttribute('data');
        const popupZone = document.getElementById('popup-zone');
        popupZone.replaceChildren();
        document.getElementById('popup-level').replaceChildren();
        const type = Type.get(id);
        if (type.id === 'activity') {
            Activity.getAll().forEach(activity => {
                if (!activity.hasLevels()) return;
                const button = new ActivitySelectButton(activity);
                popupZone.appendChild(button.element);
                if (activity.id === App.activity?.id)
                    this.showLevels(button.element);
            });
        }
        else {
            type.getZones().forEach(zone => {
                if (!zone.hasLevels()) return;
                const button = new ZoneSelectButton(zone);
                popupZone.appendChild(button.element);
                if (zone.id === App.zone?.id)
                    this.showLevels(button.element);
            });
        }
        document.querySelectorAll('ul#popup-nav .selected').forEach(e => { e.classList.remove('selected'); });
        element.classList.add('selected');
    }

    static showLevels(element) {
        const id = element.getAttribute('data');
        const popupLevel = document.getElementById('popup-level');
        popupLevel.replaceChildren();
        const zone = Zone.get(id);
        if (zone) {
            zone.getLevels().forEach(level => {
                if (level.hidden) return;
                popupLevel.appendChild(new LevelSelectButton(level).element);
            });
        }
        else {
            const activity = Activity.get(id);
            for (const zone of activity.getZones())
                zone.getLevels().forEach(level => {
                    if (level.hidden) return;
                    popupLevel.appendChild(new LevelSelectButton(level).element);
                });
        }
        document.querySelectorAll('ul#popup-zone .selected').forEach(e => { e.classList.remove('selected'); });
        element.classList.add('selected');
    }

    static togglePlay(forcePause = false) {
        App.autoplay = forcePause ? false : !App.autoplay;
        document.getElementById('play').innerText = App.autoplay ? '⏸' : '⏵';
    }

    static toggleSpeed() {
        App.doubleSpeed = !App.doubleSpeed;
        if (App.doubleSpeed)
            document.getElementById('speed').innerText = '2x';
        else
            document.getElementById('speed').innerText = '1x';
    }

    static updateTick(onchange) {
        if (!onchange) {
            App.tempPause = true;
        }
        else {
            App.tick = parseInt(App.getTickBar().value);
            App.tempPause = false;
        }
    }
}
