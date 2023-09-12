async function loadLevels() {
    Print.time('Load zones')
    const zoneTable = await (await fetch(Path.zoneTable)).json();
    for (const zoneData of Object.values(zoneTable.zones)) {
        const id = zoneData.zoneID.toLowerCase();
        let name = ((zoneData.zoneNameFirst ? zoneData.zoneNameFirst : '') + ' ' + (zoneData.zoneNameSecond ? zoneData.zoneNameSecond : '')).trim();
        if (name === '') name = zoneData.zoneID;
        const type = zoneData.type.toLowerCase();
        if (type === 'roguelike') continue;
        Zone.add(id, name, type, zoneData);
    }
    Print.timeEnd('Load zones');
    Print.time('Load levels')
    const levelTable = await (await fetch(Path.levelTable)).json();
    for (const levelData of Object.values(levelTable.stages)) {
        const id = levelData.stageId.toLowerCase();
        const zone = levelData.zoneId.toLowerCase();
        Level.add(id, zone, levelData);
    }
    Print.timeEnd('Load levels');
    Print.time('Load rogue zones');
    const rogueTable = await (await fetch(Path.rogueTable)).json();
    for (const rogueData of Object.values(rogueTable.topics)) {
        const id = rogueData.id.toLowerCase();
        const name = rogueData.name;
        const type = 'roguelike';
        Zone.add(id, name, type, rogueData);
    }
    Print.timeEnd('Load rogue zones');
    Print.time('Load rogue levels');
    for (let i = 0; i < Object.values(rogueTable.details).length; i++) {
        for (const levelData of Object.values(Object.values(rogueTable.details)[i].stages)) {
            const levelId = levelData.id.toLowerCase();
            const zone = `rogue_${i + 1}`;
            Level.add(levelId, zone, levelData);
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
        Zone.add(id, name, type, sandboxData);
        for (const levelData of Object.values(sandboxData.stageDatas)) {
            const levelId = levelData.stageId.toLowerCase();
            const zone = sandboxId.toLowerCase();
            Level.add(levelId, zone, levelData);
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

    await G.loader.load(async (loader, resources) => {
        await sleep(1000);
        for (const key of Object.keys(resources))
            Enemy.assetCache[key] = resources[key];

        Print.time('Load level waves');
        await loadLevelWaves();
        Print.timeEnd('Load level waves');
        G.app.start();
        G.app.ticker.add(loop); // Main loop
        for (let i = 0; i < Elem.getAll().length; i++)
            Elem.getAll()[i][0].disabled = false;
        Elem.get('tick').max = G.stageMaxTick;
        Print.timeEnd('Start app');
    });
}

async function loadLevelData() {
    G.stageDrawTiles = [];
    const levelRes = await fetch(`${Path.levels}/${G.level.path}.json`);
    G.levelData = await levelRes.json();
    const map = G.levelData.mapData.map;
    for (let i = 0; i < map.length; i++) {
        for (let j = 0; j < map[i].length; j++) {
            const drawTile = new MapTile({ row: i, col: j }).createDrawTile();
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
    Enemy.levelArray = [];
    Enemy.errorArray = [];
    let precalcTick = 0; // Precalculated global tick for all actions
    let waveBlockTick = 0; // Wave blocker tick

    const createEnemy = async (precalcTick, action) => {
        if (Enemy.errorArray.includes(action.key)) return false;
        try {
            const enemy = new Enemy(precalcTick, action.key, action.routeIndex); // Mark an enemy to spawn at current tick
            if (enemy) {
                Enemy.levelArray.push(enemy); // Only add enemy if everything went ok
                const enemyMaxTick = precalcTick + enemy.frameData.length;
                G.stageMaxTick = enemyMaxTick > G.stageMaxTick ? enemyMaxTick : G.stageMaxTick; // Keep track of how long the level takes with stageMaxTick
                if (!action.dontBlockWave)
                    waveBlockTick = enemyMaxTick > waveBlockTick ? enemyMaxTick : waveBlockTick; // Only update waveBlockTick if the enemy is blocking
            }
            else {
                throw new Error('Could not create enemy');
            }
        } catch (e) {
            Print.error(e + ': ' + action.key);
            Enemy.errorArray.push(action.key);
            return false;
        }
        return true;
    }
    for (const wave of G.levelData.waves) {
        for (const fragment of wave.fragments) {
            precalcTick += fragment.preDelay * G.fps; // Add wave fragment predelay

            for (const action of fragment.actions) {
                precalcTick += action.preDelay * G.fps; // Action predelays are relative to the wave fragment predelay and do not stack
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
                if (action.actionType === 0 && action.key !== '') {
                    await createEnemy(precalcTick, action);
                }
                for (let i = 1; i < action.count; i++) {
                    precalcTick += action.interval * G.fps;
                    if (action.actionType === 0 && action.key !== '') {
                        await createEnemy(precalcTick, action);
                    }
                }
                precalcTick -= action.preDelay * G.fps + action.interval * G.fps * (action.count - 1); // Revert precalcTick to the wave fragment predelay
            }
            const maxActionDelay = fragment.actions.reduce((prev, curr) => (prev.preDelay > curr.preDelay) ? prev.preDelay : curr.preDelay, 1)
            precalcTick += maxActionDelay * G.fps;
        }
        if (precalcTick < waveBlockTick) {
            precalcTick = waveBlockTick;
        }
    }
}

async function loop(delta) {
    try {
        if (++G.skipCount < Math.round(G.app.ticker.FPS / G.fps)) return; // Adjust for high fps displays
        G.skipCount = 0;
        const loop = G.doubleSpeed ? 2 : 1; // Increment by 2 ticks if double speed is on
        for (let i = 0; i < loop; i++) {
            if (G.autoplay) {
                if (G.stageTick >= G.stageMaxTick) {
                    Elem.event('play');
                }
                G.stageTick += 1;
                Elem.get('tick').value = G.stageTick;
                if (++G.sec >= 120) {
                    Print.timeEnd('loop');
                    Print.time('loop');
                    G.sec = 0;

                }
            } else {
                G.stageTick = parseInt(Elem.get('tick').value);
            }
            for (const enemy of Enemy.levelArray) {
                enemy.update(G.stageTick);
            }
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