async function loadLevels() {
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
        Zone.create(id, name, type, zoneData);
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
    Print.time('Load sandbox levels');
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
    Print.table(Type.getAll());
    Print.table(Activity.getAll());
    Print.table(Zone.getAll());
    Print.table(Level.getAll());
}

async function loadUI() {
    Elem.init();

    const query = new URL(window.location.href).searchParams;
    const levelId = query.has('level') ? query.get('level') : 'main_00-01';
    let level, zone, type;
    try {
        level = Level.get(levelId);
        zone = Zone.get(level.zone);
        type = Type.get(zone.type);
    } catch (e) {
        level = Level.get('main_00-01');
        zone = Zone.get(level.zone);
        type = Type.get(zone.type);
    }
    G.type = type;
    G.zone = zone;
    G.level = level;
}

async function main() {
    history.pushState(null, null, `${window.location.pathname}?level=${G.level.id}`);
    Elem.getAll().forEach(e => e[0].disabled = true);

    document.getElementById('stage-name').innerText = 'Loading...';
    document.getElementById('zone-name').innerText = G.zone.name;
    const levelList = document.getElementById('zone-level');
    levelList.replaceChildren();
    const activity = Activity.get(G.zone.id.split('_')[0]);
    if (activity && activity.hasLevels()) {
        activity.getZones().forEach(zone => {
            zone.getLevels().forEach(level => {
                if (level.hidden) return;
                const item = document.createElement('li');
                item.innerText = `${level.code} - ${level.name}`;
                item.className = 'popup-item';
                item.setAttribute('onclick', 'changeLevel(this)');
                item.setAttribute('data', level.id);
                if (level.id === G.level.id) item.classList.add('selected')
                levelList.appendChild(item);
            });
        })
    }
    else {
        G.zone.getLevels().forEach(level => {
            if (level.hidden) return;
            const item = document.createElement('li');
            item.innerText = `${level.code} - ${level.name}`;
            item.className = 'popup-item';
            item.setAttribute('onclick', 'changeLevel(this)');
            item.setAttribute('data', level.id);
            if (level.id === G.level.id) item.classList.add('selected')
            levelList.appendChild(item);
        });
    }

    document.getElementById('stage-name').innerText = 'Loading stage data...';
    Print.time('Load level data');
    await loadLevelData();
    Print.timeEnd('Load level data');
    document.getElementById('stage-name').innerText = 'Loading enemy data...';
    Print.time('Load enemy data');
    await Enemy.loadData();
    Print.timeEnd('Load enemy data');
    document.getElementById('stage-name').innerText = 'Creating stage...';
    Print.time('Load app stage');
    await createAppStage();
    Print.timeEnd('Load app stage');
    document.getElementById('stage-name').innerText = 'Loading assets...';
    Print.time('Load enemy assets');
    await Enemy.loadAssets();
    Print.timeEnd('Load enemy assets');

    while (!Enemy.assetsLoaded) await sleep(250);

    document.getElementById('stage-name').innerText = 'Creating enemy paths...';
    Print.time('Load level waves');
    await loadLevelWaves();
    Print.timeEnd('Load level waves');
    G.app.start();
    G.app.ticker.add(loop); // Main loop
    Elem.getAll().forEach(e => e[0].disabled = false);
    Elem.get('tick').max = G.stageMaxTick;
    Print.timeEnd('Start app');
    Print.time('loop');
    document.getElementById('stage-name').innerText = G.level.code + ' - ' + G.level.name;
}

async function loadLevelData() {
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
}

async function createAppStage() {
    const appWidth = (G.levelData.mapData.width + 2) * G.gridSize;
    const appHeight = (G.levelData.mapData.height + 2) * G.gridSize;
    G.app = new PIXI.Application({ width: appWidth, height: appHeight });
    Elem.get('tick').setAttribute('style', `width:${appWidth}px`);
    document.getElementById('app-stage').appendChild(G.app.view);
    G.app.renderer.backgroundColor = Color.bg;
    G.stageGraphics.forEach(e => G.app.stage.addChild(e));
}

async function loadLevelWaves() {
    let precalcTick = 0; // Precalculated global tick for all actions
    let waveBlockTick = 0; // Wave blocker tick
    for (const wave of G.levelData.waves) {
        for (const fragment of wave.fragments) {
            precalcTick += fragment.preDelay * G.fps; // Add wave fragment predelay
            for (const action of fragment.actions) {
                if (action.actionType !== 0 || action.key === '' || Enemy._errorArray.includes(action.key)) continue;
                // action types
                // 0: spawn
                // 1: skip??
                // 2: tutorial/story popup
                // 3: not used
                // 4: change bgm
                // 5: enemy intro popup
                // 6: spawn npc/trap
                // 7: stage effect (rumble)
                // 8: environmental effect (blizzards)
                // 9: some sss tutorial thing idk

                precalcTick += action.preDelay * G.fps; // Action predelays are relative to the wave fragment predelay and do not stack
                for (let i = 0; i < action.count; i++) {
                    precalcTick += action.interval * G.fps * i;
                    const enemy = Enemy.create(precalcTick, action); // Mark an enemy to spawn at current tick
                    if (!enemy) continue;
                    const enemyMaxTick = precalcTick + enemy.frameData.length;
                    G.stageMaxTick = Math.max(G.stageMaxTick, enemyMaxTick); // Keep track of how long the level takes with stageMaxTick
                    if (!action.dontBlockWave)
                        waveBlockTick = Math.max(waveBlockTick, enemyMaxTick); // Only update waveBlockTick if the enemy is blocking
                    precalcTick -= action.interval * G.fps * i;
                }
                precalcTick -= action.preDelay * G.fps;
            }
            const maxActionDelay = fragment.actions.reduce((prev, curr) => (prev.preDelay > curr.preDelay) ? prev.preDelay : curr.preDelay, 1)
            precalcTick += maxActionDelay * G.fps;
        }
        precalcTick = Math.max(precalcTick, waveBlockTick);
    }

    const enems = Enemy.getUnique().sort((a, b) => a._data.value.excel.enemyIndex.localeCompare(b._data.value.excel.enemyIndex));
    for (const enem of enems)
        Elem.get('enemy-container').appendChild(enem.createBoxElement());
}

async function loop(delta) {
    try {
        if (++G.skipCount < Math.round(G.app.ticker.FPS / G.fps)) return; // Adjust for high fps displays
        G.skipCount = 0;

        // Update app tick
        if (G.autoplay) {
            for (let i = 0; i < (G.doubleSpeed ? 2 : 1); i++)  // Increment by 2 ticks if double speed is on
                Elem.get('tick').value = ++G.stageTick;
            if (G.stageTick >= G.stageMaxTick)
                Elem.event('pause');
        }
        else {
            G.stageTick = parseInt(Elem.get('tick').value);
        }

        Enemy.updateAll(G.stageTick);

        G.inc++;
        if (G.inc % 20 === 0) {
            Elem.event('count');
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
    Print.time('Start app');
    await loadLevels();
    Print.time('Load UI');
    await loadUI();
    Print.timeEnd('Load UI');
    main();
}