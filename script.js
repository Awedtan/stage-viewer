async function startApp() {
    Print.time('Load UI');
    await loadUI();
    Print.timeEnd('Load UI');
    document.getElementById('stage-name').innerText = 'Loading stage...';
    Print.time('Load level');
    await loadLevelStage();
    Print.timeEnd('Load level');
    document.getElementById('stage-name').innerText = 'Loading enemies...';
    Print.time('Load enemies');
    await Enemy.loadAll();
    Print.timeEnd('Load enemies');
    while (!Enemy.assetsLoaded) await sleep(250); // Ensure enemy assets are loaded before creating enemy spines
    document.getElementById('stage-name').innerText = 'Creating enemy paths...';
    Print.time('Load paths');
    await Enemy.loadPaths();
    Print.timeEnd('Load paths');

    G.disableUI(false);
    document.getElementById('tick').max = G.stageMaxTick;
    document.getElementById('stage-name').innerText = G.level.code + ' - ' + G.level.name;
    G.app.ticker.add(loop);
    G.app.start();
    Print.time('loop');
}

async function loadUI() {
    history.pushState(null, null, `${window.location.pathname}?level=${G.level.id}`);
    G.disableUI(true); // Disable UI until app is ready

    document.getElementById('stage-name').innerText = 'Loading...';
    document.getElementById('zone-name').innerText = G.activity ? G.activity.name : G.zone.name;
    const levelList = document.getElementById('zone-level');
    levelList.replaceChildren();
    const addLevelListItem = level => {
        if (level.hidden) return;
        const item = document.createElement('li');
        item.innerText = `${level.code} - ${level.name}`;
        item.className = 'popup-item';
        item.setAttribute('onclick', 'changeLevel(this)');
        item.setAttribute('data', level.id);
        if (level.id === G.level.id) item.classList.add('selected')
        levelList.appendChild(item);
    }
    const activity = Activity.get(G.zone.id.split('_')[0]);
    if (activity && activity.hasLevels()) {
        // Activities can have multiple zones (events usually have separate zones for normal, EX, and other special stages)
        // We need to get all levels from all zones in the activity
        activity.getZones().forEach(zone => {
            zone.getLevels().forEach(addLevelListItem);
        })
    }
    else {
        G.zone.getLevels().forEach(addLevelListItem);
    }
}

async function loadLevelStage() {
    // Calculate app sizes, create tile and predefine graphics
    G.stageGraphics = [];
    const levelRes = await fetch(`${Path.levels}/${G.level.path}.json`);
    G.levelData = await levelRes.json();
    const map = G.levelData.mapData.map;
    G.gridSize = G.maxStageWidth / (map[0].length + 2);
    if ((G.levelData.mapData.height + 2) * G.gridSize > G.maxStageHeight)
        G.gridSize = G.maxStageHeight / (G.levelData.mapData.height + 2);
    if (G.gridSize > G.defaultGridSize)
        G.gridSize = G.defaultGridSize;
    G.enemyScale = G.defaultEnemyScale * (G.gridSize / G.defaultGridSize);
    for (let i = 0; i < map.length; i++) for (let j = 0; j < map[i].length; j++)
        G.stageGraphics.push(MapTile.get({ row: i, col: j }).createGraphics());
    MapPredefine._array.forEach(e => G.stageGraphics.push(e.createGraphics()));

    // Create PIXI app and add stage graphics
    const appWidth = (G.levelData.mapData.width + 2) * G.gridSize;
    const appHeight = (G.levelData.mapData.height + 2) * G.gridSize;
    G.app = new PIXI.Application({ width: appWidth, height: appHeight });
    document.getElementById('tick').setAttribute('style', `width:${appWidth}px`); // Scale slider with app size
    document.getElementById('app-stage').appendChild(G.app.view);
    G.app.renderer.backgroundColor = Color.bg;
    G.stageGraphics.forEach(e => G.app.stage.addChild(e));
}

async function loop(delta) {
    try {
        if (++G.skipCount < Math.round(G.app.ticker.FPS / G.fps)) return; // Adjust for high fps displays
        G.skipCount = 0;

        if (G.autoplay && !G.tempPause) {
            G.stageTick += G.doubleSpeed ? 2 : 1; // Increment by 2 ticks if double speed is on
            document.getElementById('tick').value = G.stageTick;
            if (G.stageTick >= G.stageMaxTick)
                togglePlay(true);
        }
        else {
            G.stageTick = parseInt(document.getElementById('tick').value);
        }
        Enemy.updateAll(G.stageTick);

        G.inc++;
        if (G.inc % 20 === 0) {
            G.updateEnemyCount(); // Update enemy count every 20 frames
        }
        if (G.inc >= 120) {
            Print.timeEnd('loop');
            Print.time('loop');
            G.inc = 0;
        }
    } catch (e) {
        Print.error(e);
        G.app.stop();
    }
}

function gridToPos({ row, col }, centered) {
    if (centered) {
        const x = G.gridSize * (1.5 + col);
        const y = G.gridSize * (0.5 + G.levelData.mapData.height - row);
        return { x, y };
    }
    else {
        const randX = Math.random() / 6;
        const randY = Math.random() / 6;
        const x = G.gridSize * (1.5 + col + randX);
        const y = G.gridSize * (0.7 + G.levelData.mapData.height - row + randY);
        return { x, y };
    }
}

function posToGrid({ x, y }) {
    const col = Math.floor(x / G.gridSize - 1.5);
    const row = G.levelData.mapData.height - Math.floor(y / G.gridSize - 0.5);
    return { row, col };
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

window.onload = async () => {
    // Load data from all ArknightsGameData table files
    ['mainline', 'weekly', 'campaign', 'climb_tower', 'activity', 'roguelike', 'storymission', 'rune', 'sandbox']
        .forEach(id => Type.create(id));
    Print.time('Load activities');
    const activityTable = await (await fetch(Path.activityTable)).json();
    for (const activityData of Object.values(activityTable.basicInfo)) {
        const id = activityData.id;
        const name = activityData.name;
        Activity.create(id, name, activityData);
    }
    Print.timeEnd('Load activities');
    Print.time('Load zones');
    const zoneTable = await (await fetch(Path.zoneTable)).json();
    for (const zoneData of Object.values(zoneTable.zones)) {
        const id = zoneData.zoneID.toLowerCase();
        let name = ((zoneData.zoneNameFirst ? zoneData.zoneNameFirst : '') + ' ' + (zoneData.zoneNameSecond ? zoneData.zoneNameSecond : '')).trim();
        if (name === '') name = zoneData.zoneID;
        const type = zoneData.type.toLowerCase();
        if (type === 'roguelike') continue;
        Zone.create(id, name, type, zoneData); // Types are automatically created inside the zone constructor
    }
    Print.timeEnd('Load zones');
    Print.time('Load levels');
    const levelTable = await (await fetch(Path.levelTable)).json();
    for (const levelData of Object.values(levelTable.stages)) {
        const id = levelData.stageId.toLowerCase();
        const zone = levelData.zoneId.toLowerCase();
        Level.create(id, zone, levelData);
    }
    Print.timeEnd('Load levels');
    Print.time('Load rogue zones');
    const rogueTable = await (await fetch(Path.rogueTable)).json();
    for (const rogueData of Object.values(rogueTable.topics)) {
        const id = rogueData.id.toLowerCase();
        const name = rogueData.name;
        const type = 'roguelike';
        Zone.create(id, name, type, rogueData);
    }
    Print.timeEnd('Load rogue zones');
    Print.time('Load rogue levels');
    for (let i = 0; i < Object.values(rogueTable.details).length; i++) {
        for (const levelData of Object.values(Object.values(rogueTable.details)[i].stages)) {
            const levelId = levelData.id.toLowerCase();
            const zone = `rogue_${i + 1}`;
            Level.create(levelId, zone, levelData);
        }
    }
    Print.timeEnd('Load rogue levels');
    Print.time('Load paradox simulations');
    const charNames = await (await fetch(`${Path.api}/operator?include=data.name`)).json();
    const paradoxTable = await (await fetch(Path.paradoxTable)).json();
    for (const levelData of Object.values(paradoxTable.handbookStageData)) {
        const id = levelData.stageId.toLowerCase();
        const charId = levelData.charId.toLowerCase();
        const charName = charNames.find(e => e.keys[0] === charId).value.data.name;
        const type = 'storymission';
        Zone.create(charId, charName, type, null);
        Level.create(id, charId, levelData);
    }
    Print.timeEnd('Load paradox simulations');
    Print.time('Load rune levels');
    const constants = await (await fetch(Path.constants)).json();
    const ccSeasons = constants.gameConsts.ccSeasons;
    const ccStages = constants.gameConsts.ccStages;
    for (const season of Object.keys(ccSeasons)) {
        const zoneId = season.toLowerCase();
        const zoneName = `CC ${season}`;
        const type = 'rune';
        const ccData = ccSeasons[season];
        Zone.create(zoneId, zoneName, type, ccData);
        for (const levelName of ccData) {
            const levelData = ccStages.find(e => e.name === levelName);
            const levelId = levelData.levelId;
            Level.create(levelId, zoneId, levelData);
        }
    }
    Print.timeEnd('Load rune levels');
    Print.time('Load sandbox levels'); // If RA gets more events, it should be separated into its own type
    const sandboxTable = await (await fetch(Path.sandboxTable)).json();
    for (const sandboxId of Object.keys(sandboxTable.sandboxActTables)) {
        const id = sandboxId.toLowerCase();
        const name = 'Fire Within the Sand';
        const type = 'sandbox';
        const sandboxData = sandboxTable.sandboxActTables[sandboxId];
        Zone.create(id, name, type, sandboxData);
        for (const levelData of Object.values(sandboxData.stageDatas)) {
            const levelId = levelData.stageId.toLowerCase();
            const zone = sandboxId.toLowerCase();
            Level.create(levelId, zone, levelData);
        }
    }
    Print.timeEnd('Load sandbox levels');

    // All tables have been loaded
    Print.table(Type.getAll());
    Print.table(Activity.getAll());
    Print.table(Zone.getAll());
    Print.table(Level.getAll());

    // Load level from query string, default to 0-1 if not valid
    const query = new URL(window.location.href).searchParams;
    const levelId = query.has('level') ? query.get('level') : 'main_00-01';
    try {
        G.level = Level.get(levelId);
        G.zone = Zone.get(G.level.zone);
        G.activity = Activity.get(G.zone.id.split('_')[0]);
        G.type = Type.get(G.zone.type);
    } catch (e) {
        G.level = Level.get('main_00-01');
        G.zone = Zone.get(G.level.zone);
        G.activity = Activity.get(G.zone.id.split('_')[0]);
        G.type = Type.get(G.zone.type);
    }

    Print.time('Start app');
    startApp();
    Print.timeEnd('Start app');
};