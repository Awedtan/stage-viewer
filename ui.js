function openPopup() {
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('popup').style.display = 'block';
}

function closePopup() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('popup').style.display = 'none';
}

function showZones(element) {
    const type = Type.get(element.getAttribute('data'));
    const popupZone = document.getElementById('popup-zone');
    popupZone.replaceChildren();
    type.getZones().forEach(zone => {
        const item = document.createElement('li');
        item.innerHTML = zone.name;
        item.className = 'popup-zone-item';
        item.setAttribute('onclick', 'showLevels(this)');
        item.setAttribute('data', zone.id);
        popupZone.appendChild(item);
    });
}

function showLevels(element) {
    const zone = Zone.get(element.getAttribute('data'));
    const popupLevel = document.getElementById('popup-level');
    popupLevel.replaceChildren();
    zone.getLevels().forEach(level => {
        const item = document.createElement('li');
        item.innerHTML = level.code;
        item.className = 'popup-level-item';
        item.data = level.id;
        popupLevel.appendChild(item);
    });
}