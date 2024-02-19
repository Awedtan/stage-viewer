function openPopup() {
    togglePlay(true);
    const type = document.querySelector(`ul#popup-nav [data="${G.type.id}"]`);
    if (type) showZones(type);
    const zone = document.querySelector(`ul#popup-zone [data="${G.zone.id}"],[data="${G.activity ? G.activity.id : 'none'}"]`);
    if (zone) showLevels(zone);
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('popup').style.display = 'block';
}

function closePopup() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('popup').style.display = 'none';
}

function showZones(element) {
    const id = element.getAttribute('data');
    const popupZone = document.getElementById('popup-zone');
    popupZone.replaceChildren();
    document.getElementById('popup-level').replaceChildren();
    const type = Type.get(id);
    if (type.id === 'activity') {
        Activity.getAll().forEach(activity => {
            if (!activity.hasLevels()) return;
            const item = document.createElement('li');
            item.innerText = activity.name.split(' - Rerun')[0];
            item.className = 'popup-item';
            item.setAttribute('onclick', 'showLevels(this)');
            item.setAttribute('data', activity.id);
            popupZone.appendChild(item);
        });
    }
    else {
        type.getZones().forEach(zone => {
            if (!zone.hasLevels()) return;
            const item = document.createElement('li');
            item.innerText = zone.name;
            item.className = 'popup-item';
            item.setAttribute('onclick', 'showLevels(this)');
            item.setAttribute('data', zone.id);
            popupZone.appendChild(item);
        });
    }
    document.querySelectorAll('ul#popup-nav .selected').forEach(e => { e.classList.remove('selected'); });
    element.classList.add('selected');
}

function showLevels(element) {
    const id = element.getAttribute('data');
    const popupLevel = document.getElementById('popup-level');
    popupLevel.replaceChildren();
    const zone = Zone.get(id);
    if (zone) {
        zone.getLevels().forEach(level => {
            if (level.hidden) return;
            const item = document.createElement('li');
            item.innerText = `${level.code} - ${level.name}`;
            item.className = 'popup-item';
            item.setAttribute('onclick', 'changeLevel(this)');
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
                item.innerText = `${level.code} - ${level.name}`;
                item.className = 'popup-item';
                item.setAttribute('onclick', 'changeLevel(this)');
                item.setAttribute('data', level.id);
                popupLevel.appendChild(item);
            });
    }
    document.querySelectorAll('ul#popup-zone .selected').forEach(e => { e.classList.remove('selected'); });
    element.classList.add('selected');
}

function changeLevel(element) {
    const id = element.getAttribute('data');
    closePopup();
    G.level = Level.get(id);
    G.zone = Zone.get(G.level.zone);
    G.activity = Activity.get(G.zone.id.split('_')[0]);
    G.type = Type.get(G.zone.type);
    togglePlay(true);
    G.restartApp();
}

function togglePlay(pause) {
    G.autoplay = pause ? false : !G.autoplay;
    if (G.autoplay) {
        document.getElementById('play').innerText = '⏸';
    }
    else {
        document.getElementById('play').innerText = '⏵';
    }
}

function toggleSpeed() {
    G.doubleSpeed = !G.doubleSpeed;
    if (G.doubleSpeed)
        document.getElementById('speed').innerText = '2x';
    else
        document.getElementById('speed').innerText = '1x';
}

function updateTick(onchange) {
    if (!onchange) {
        G.tempPause = true;
    }
    else {
        G.stageTick = parseInt(document.getElementById('tick').value);
        G.tempPause = false;
    }
}