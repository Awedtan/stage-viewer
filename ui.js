function openPopup() {
    showZones(G.type.id);
    showLevels(G.zone.id);
    document.getElementById('overlay').style.display = 'flex';
    document.getElementById('popup').style.display = 'flex';
}

function closePopup() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('popup').style.display = 'none';
    document.getElementById('popup-zone').replaceChildren();
    document.getElementById('popup-level').replaceChildren();
}

function showZones(id) {
    const popupZone = document.getElementById('popup-zone');
    popupZone.replaceChildren();
    document.getElementById('popup-level').replaceChildren();
    const type = Type.get(id);
    if (type.id === 'activity') {
        Activity.getAll().forEach(activity => {
            if (!activity.hasLevels()) return;
            const item = document.createElement('li');
            item.innerHTML = activity.name.split(' - Rerun')[0];
            item.className = 'popup-zone-item';
            item.setAttribute('onclick', 'showLevels(this.getAttribute(\'data\'))');
            item.setAttribute('data', activity.id);
            popupZone.appendChild(item);
        });
    }
    else {
        type.getZones().forEach(zone => {
            if (!zone.hasLevels()) return;
            const item = document.createElement('li');
            item.innerHTML = zone.name;
            item.className = 'popup-zone-item';
            item.setAttribute('onclick', 'showLevels(this.getAttribute(\'data\'))');
            item.setAttribute('data', zone.id);
            popupZone.appendChild(item);
        });
    }
}

function showLevels(id) {
    const popupLevel = document.getElementById('popup-level');
    popupLevel.replaceChildren();
    const zone = Zone.get(id);
    if (zone) {
        zone.getLevels().forEach(level => {
            if (level.hidden) return;
            const item = document.createElement('li');
            item.innerHTML = `${level.code} - ${level.name}`;
            item.className = 'popup-level-item';
            item.setAttribute('onclick', 'changeLevel(this.getAttribute(\'data\'))');
            item.setAttribute('data', level.id);
            popupLevel.appendChild(item);
        });
    }
    else {
        const activity = Activity.get(id);
        for (const zone of activity.getZones())
            zone.getLevels().forEach(level => {
                if (level.hidden) return;
                const item = document.createElement('li');
                item.innerHTML = `${level.code} - ${level.name}`;
                item.className = 'popup-level-item';
                item.setAttribute('onclick', 'changeLevel(this.getAttribute(\'data\'))');
                item.setAttribute('data', level.id);
                popupLevel.appendChild(item);
            });
    }
}

function changeLevel(id) {
    closePopup();
    G.level = Level.get(id);
    G.zone = Zone.get(G.level.zone);
    G.type = Type.get(G.zone.type);
    Elem.updateOptions('type');
    Elem.get('type').value = G.type.id;
    Elem.updateOptions('zone');
    Elem.get('zone').value = G.zone.id;
    Elem.updateOptions('level');
    Elem.get('level').value = G.level.id;
    if (G.autoplay) Elem.event('play');
    G.resetApp();
    main();
}