async function loadLevels() {
    Print.time('Load zones')
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
    Print.time('Load levels')
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
    Print.time('Load sandbox levels');
    const sandboxTable = await (await fetch(Path.sandboxTable)).json();
    for (const sandboxId of Object.keys(sandboxTable.sandboxActTables)) {
        const sandboxData = sandboxTable.sandboxActTables[sandboxId];
        const id = sandboxId.toLowerCase();
        const name = 'Fire Within the Sand';
        const type = 'sandbox';
        Zone.create(id, name, type, sandboxData);
        for (const levelData of Object.values(sandboxData.stageDatas)) {
            const levelId = levelData.stageId.toLowerCase();
            const zone = sandboxId.toLowerCase();
            Level.create(levelId, zone, levelData);
        }
    }
    Print.timeEnd('Load sandbox levels');
    Print.table(Type.getAll());
    Print.table(Zone.getAll());
    Print.table(Level.getAll());
}

async function loadUI() {
    const eArr = Elem.getAll();
    for (let i = 0; i < eArr.length; i++) {
        eArr[i][0] = document.getElementById(eArr[i][1]);
        if (eArr[i][2])
            eArr[i][0].addEventListener(eArr[i][2], () => Elem.event(eArr[i][1]));
    }
    Elem.updateOptions('type');
    G.type = Type.get(Elem.get('type').value)
    Elem.updateOptions('zone');
    G.zone = Zone.get(Elem.get('zone').value);
    Elem.updateOptions('level');
    G.level = Level.get(Elem.get('level').value);

    const query = new URL(window.location.href).searchParams; if (!query.has('level')) return;
    const levelId = query.get('level');
    const level = Level.get(levelId); if (!level) return;
    const zone = Zone.get(level.zone); if (!zone) return;
    const type = Type.get(zone.type); if (!type) return;
    G.type = type;
    G.zone = zone;
    G.level = level;
    Elem.get('type').value = G.type.id;
    Elem.updateOptions('zone');
    Elem.get('zone').value = G.zone.id;
    Elem.updateOptions('level');
    Elem.get('level').value = G.level.id;
}

async function main() {
    history.pushState(null, null, `${window.location.pathname}?level=${G.level.id}`);
    for (let i = 0; i < Elem.getAll().length; i++)
        Elem.getAll()[i][0].disabled = true;

    Print.time('Load level data');
    await loadLevelData();
    Print.timeEnd('Load level data');
    Print.time('Load enemy data');
    await Enemy.loadData();
    Print.timeEnd('Load enemy data');
    Print.time('Load app stage');
    await createAppStage();
    Print.timeEnd('Load app stage');
    Print.time('Load enemy assets');
    await Enemy.loadAssets();
    Print.timeEnd('Load enemy assets');

    while (!Enemy.assetsLoaded) await sleep(250);

    Print.time('Load level waves');
    await loadLevelWaves();
    Print.timeEnd('Load level waves');
    G.app.start();
    G.app.ticker.add(loop); // Main loop
    for (let i = 0; i < Elem.getAll().length; i++)
        Elem.getAll()[i][0].disabled = false;
    Elem.get('tick').max = G.stageMaxTick;
    Print.timeEnd('Start app');
    Print.time('loop');
}

async function loadLevelData() {
    G.stageDrawTiles = [];
    const levelRes = await fetch(`${Path.levels}/${G.level.path}.json`);
    G.levelData = await levelRes.json();
    const map = G.levelData.mapData.map;
    for (let i = 0; i < map.length; i++) {
        for (let j = 0; j < map[i].length; j++) {
            const drawTile = MapTile.get({ row: i, col: j }).createTileGraphic();
            G.stageDrawTiles.push(drawTile);
        }
    }
}

async function createAppStage() {
    G.app = new PIXI.Application({ width: (G.levelData.mapData.width + 2) * G.gridSize, height: (G.levelData.mapData.height + 2) * G.gridSize });
    document.body.appendChild(G.app.view);
    G.app.renderer.backgroundColor = Color.bg;
    // G.app.renderer.view.style.position = 'absolute';
    // G.app.renderer.view.style.left = '50%';
    // G.app.renderer.view.style.top = '50%';
    // G.app.renderer.view.style.transform = 'translate3d( -50%, -50%, 0 )';
    for (const drawTile of G.stageDrawTiles)
        G.app.stage.addChild(drawTile);
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
                Elem.event('play');
        }
        else {
            G.stageTick = parseInt(Elem.get('tick').value);
        }

        Enemy.updateAll(G.stageTick);

        G.inc++;
        if (G.inc % 10 === 0) {
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