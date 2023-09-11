async function loadLevels() {
    const zoneTable = await (await fetch(Path.zoneTable)).json();
    for (const zoneData of Object.values(zoneTable.zones)) {
        const id = zoneData.zoneID.toLowerCase();
        let name = ((zoneData.zoneNameFirst ? zoneData.zoneNameFirst : '') + ' ' + (zoneData.zoneNameSecond ? zoneData.zoneNameSecond : '')).trim();
        if (name === '') name = zoneData.zoneID;
        const type = zoneData.type.toLowerCase();
        if (type === 'roguelike') continue;
        Zone.add(id, name, type, zoneData);
    }
    const levelTable = await (await fetch(Path.levelTable)).json();
    for (const levelData of Object.values(levelTable.stages)) {
        const id = levelData.stageId.toLowerCase();
        const zone = levelData.zoneId.toLowerCase();
        Level.add(id, zone, levelData);
    }
    const rogueTable = await (await fetch(Path.rogueTable)).json();
    for (const rogueData of Object.values(rogueTable.topics)) {
        const id = rogueData.id.toLowerCase();
        const name = rogueData.name;
        const type = 'roguelike';
        Zone.add(id, name, type, rogueData);
    }
    for (let i = 0; i < Object.values(rogueTable.details).length; i++) {
        for (const levelData of Object.values(Object.values(rogueTable.details)[i].stages)) {
            const levelId = levelData.id.toLowerCase();
            const zone = `rogue_${i + 1}`;
            Level.add(levelId, zone, levelData);
        }
    }
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
    // console.log(Type.getAll())
    // console.log(Zone.getAll())
    // console.log(Level.getAll())
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

    await loadLevelData();
    await Enemy.loadData();
    await createAppStage();
    await Enemy.loadAssets();

    await G.loader.load(async (loader, resources) => {
        await sleep(1000);
        for (const key of Object.keys(resources))
            Enemy.assetCache[key] = resources[key];

        await loadLevelWaves();

        G.app.start();
        G.app.ticker.add(loop); // Main loop
        for (let i = 0; i < Elem.getAll().length; i++)
            Elem.getAll()[i][0].disabled = false;
        Elem.get('tick').max = G.stageMaxTick;
    });
}

async function loadLevelData() {
    G.stageDrawTiles = [];
    const levelRes = await fetch(`${Path.levels}/${G.level.path}.json`);
    G.levelData = await levelRes.json();
    const tileMap = [];
    G.levelData.mapData.map.forEach(mapRow => {
        const row = mapRow.map(tile => G.levelData.mapData.tiles[tile]);
        tileMap.push(row);
    });
    G.levelRoutes = G.levelData.routes;
    for (let i = 0; i < tileMap.length; i++) {
        for (let j = 0; j < tileMap[i].length; j++) {
            const drawTiles = createDrawTile(tileMap[i][j], i, j);
            G.stageDrawTiles.push(drawTiles);
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
            console.error(e + ': ' + action.key);
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
                    const now = Date.now()
                    console.log(now - G.frameTime)
                    G.frameTime = now;
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
        console.error(e);
        G.app.stop();
    }
}

class Color {
    static bg = 0x101010;
    static start = 0xe21818;
    static end = 0x0c8aff;
    static void = 0x202020;
    static road = 0x484848;
    static wall = 0xa8a8a8;
    static floor = 0xc08438;
    static tunnel = 0xeb9072;
    static fence = 0xe8ba23;
    static hole = Color.wall;
    static push = 0xb85b0a;
    static defdown = 0xc03722;
    static defup = Color.push;
    static air = Color.push;
}

const LINEWIDTH = 3;
const OUTWIDTH = 6;
const TRILEN = 5;

function createDrawTile(mapTile, i, j) {
    const tileKey = mapTile.tileKey;
    const heightType = mapTile.heightType;
    let defaultColor = Color.void;
    if (heightType === 0) defaultColor = Color.road;
    else if (heightType === 1) defaultColor = Color.wall;
    let tile = new PIXI.Graphics().beginFill(defaultColor)
        .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
        .endFill();

    switch (tileKey) {
        // BASICS
        case 'tile_end': {
            const yAdj = TRILEN / 4;
            const rad30 = 30 * Math.PI / 180
            tile = new PIXI.Graphics().lineStyle(LINEWIDTH, Color.end)
                .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - TRILEN / Math.cos(rad30) + yAdj) / 16))
                .lineTo(G.gridSize * (j + (24 + TRILEN) / 16), G.gridSize * (i + (24 + (TRILEN * Math.tan(rad30)) + yAdj) / 16))
                .lineTo(G.gridSize * (j + (24 - TRILEN) / 16), G.gridSize * (i + (24 + (TRILEN * Math.tan(rad30)) + yAdj) / 16))
                .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - TRILEN / Math.cos(rad30) + yAdj) / 16))
                .lineStyle(LINEWIDTH, Color.end)
                .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - TRILEN / 3) / 16))
                .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 + TRILEN / 3) / 16))
                .beginFill(Color.end)
                .drawCircle(G.gridSize * (j + 1.5), G.gridSize * (i + (24 + TRILEN * 9 / 16) / 16), LINEWIDTH / 4)
                .endFill()
                .lineStyle(OUTWIDTH, Color.end, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_fence':
        case 'tile_fence_bound': {
            tile = new PIXI.Graphics().beginFill(Color.road)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill()
                .lineStyle(OUTWIDTH, Color.fence, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_flowerf':
        case 'tile_creepf':
        case 'tile_floor': {
            tile = new PIXI.Graphics().beginFill(Color.road)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill()
                .lineStyle(OUTWIDTH, Color.floor, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_flystart': {
            tile = new PIXI.Graphics().beginFill(Color.start)
                .drawPolygon([
                    G.gridSize * (j + 21 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 24 / 16), G.gridSize * (i + 23 / 16),
                    G.gridSize * (j + 27 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 24 / 16),
                    G.gridSize * (j + 27 / 16), G.gridSize * (i + 27 / 16),
                    G.gridSize * (j + 24 / 16), G.gridSize * (i + 25 / 16),
                    G.gridSize * (j + 21 / 16), G.gridSize * (i + 27 / 16),
                    G.gridSize * (j + 23 / 16), G.gridSize * (i + 24 / 16),
                ])
                .endFill()
                .lineStyle(LINEWIDTH, Color.start)
                .drawCircle(G.gridSize * (j + 21 / 16), G.gridSize * (i + 21 / 16), G.gridSize * 2.5 / 16)
                .drawCircle(G.gridSize * (j + 27 / 16), G.gridSize * (i + 21 / 16), G.gridSize * 2.5 / 16)
                .drawCircle(G.gridSize * (j + 27 / 16), G.gridSize * (i + 27 / 16), G.gridSize * 2.5 / 16)
                .drawCircle(G.gridSize * (j + 21 / 16), G.gridSize * (i + 27 / 16), G.gridSize * 2.5 / 16)
                .lineStyle(OUTWIDTH, Color.start, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_forbidden': {
            tile = new PIXI.Graphics().beginFill(Color.void)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill();
            break;
        }
        case 'tile_empty':
        case 'tile_hole': {
            tile = new PIXI.Graphics().beginFill(Color.void)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill()
                .lineStyle(OUTWIDTH, Color.hole, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_flower':
        case 'tile_creep':
        case 'tile_road': {
            tile = new PIXI.Graphics().beginFill(Color.road)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill();
            break;
        }
        case 'tile_start': {
            const yAdj = TRILEN / 4;
            const rad30 = 30 * Math.PI / 180
            tile = new PIXI.Graphics().lineStyle(LINEWIDTH, Color.start)
                .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - TRILEN / Math.cos(rad30) + yAdj) / 16))
                .lineTo(G.gridSize * (j + (24 + TRILEN) / 16), G.gridSize * (i + (24 + (TRILEN * Math.tan(rad30)) + yAdj) / 16))
                .lineTo(G.gridSize * (j + (24 - TRILEN) / 16), G.gridSize * (i + (24 + (TRILEN * Math.tan(rad30)) + yAdj) / 16))
                .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - TRILEN / Math.cos(rad30) + yAdj) / 16))
                .lineStyle(LINEWIDTH, Color.start)
                .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - TRILEN / 3) / 16))
                .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 + TRILEN / 3) / 16))
                .beginFill(Color.start)
                .drawCircle(G.gridSize * (j + 1.5), G.gridSize * (i + (24 + TRILEN * 9 / 16) / 16), LINEWIDTH / 4)
                .endFill()
                .lineStyle(OUTWIDTH, Color.start, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_telin': {
            tile = new PIXI.Graphics().beginFill(Color.road)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill()
                .beginFill(Color.tunnel)
                .drawPolygon([
                    G.gridSize * (j + 4 / 4), G.gridSize * (i + 5 / 4),
                    G.gridSize * (j + 5 / 4), G.gridSize * (i + 5 / 4),
                    G.gridSize * (j + 5 / 4), G.gridSize * (i + 6 / 4),
                    G.gridSize * (j + 6 / 4), G.gridSize * (i + 6 / 4),
                    G.gridSize * (j + 6 / 4), G.gridSize * (i + 7 / 4),
                    G.gridSize * (j + 7 / 4), G.gridSize * (i + 7 / 4),
                    G.gridSize * (j + 7 / 4), G.gridSize * (i + 8 / 4),
                    G.gridSize * (j + 4 / 4), G.gridSize * (i + 8 / 4),
                ])
                .drawPolygon([
                    G.gridSize * (j + 24 / 16), G.gridSize * (i + 19 / 16),
                    G.gridSize * (j + 28 / 16), G.gridSize * (i + 23 / 16),
                    G.gridSize * (j + 29 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 29 / 16), G.gridSize * (i + 25 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 25 / 16),
                    G.gridSize * (j + 27 / 16), G.gridSize * (i + 24 / 16),
                    G.gridSize * (j + 23 / 16), G.gridSize * (i + 20 / 16),
                ])
                .endFill();
            break;
        }
        case 'tile_telout': {
            tile = new PIXI.Graphics().beginFill(Color.road)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill()
                .beginFill(Color.tunnel)
                .drawPolygon([
                    G.gridSize * (j + 8 / 4), G.gridSize * (i + 5 / 4),
                    G.gridSize * (j + 7 / 4), G.gridSize * (i + 5 / 4),
                    G.gridSize * (j + 7 / 4), G.gridSize * (i + 6 / 4),
                    G.gridSize * (j + 6 / 4), G.gridSize * (i + 6 / 4),
                    G.gridSize * (j + 6 / 4), G.gridSize * (i + 7 / 4),
                    G.gridSize * (j + 5 / 4), G.gridSize * (i + 7 / 4),
                    G.gridSize * (j + 5 / 4), G.gridSize * (i + 8 / 4),
                    G.gridSize * (j + 8 / 4), G.gridSize * (i + 8 / 4),
                ])
                .drawPolygon([
                    G.gridSize * (j + 19 / 16), G.gridSize * (i + 24 / 16),
                    G.gridSize * (j + 23 / 16), G.gridSize * (i + 20 / 16),
                    G.gridSize * (j + 21 / 16), G.gridSize * (i + 19 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 19 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 23 / 16),
                    G.gridSize * (j + 24 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 20 / 16), G.gridSize * (i + 25 / 16),
                ])
                .endFill();
            break;
        }
        case 'tile_passable_wall':
        case 'tile_passable_wall_forbidden':
        case 'tile_wall': {
            tile = new PIXI.Graphics().beginFill(Color.wall)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill();
            break;
        }
        // WATER
        case 'tile_deepwater':
        case 'tile_shallowwater':
        case 'tile_deepsea':
        case 'tile_water': {
            tile = new PIXI.Graphics().beginFill(Color.end)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                .endFill();
            break;
        }
        // SPECIAL
        case 'tile_bigforce': {
            tile.beginFill(Color.push)
                .drawRect(G.gridSize * (j + 21 / 16), G.gridSize * (i + 19 / 16), LINEWIDTH * 2, G.gridSize * 10 / 16)
                .endFill()
                .lineStyle(LINEWIDTH, Color.push, 1, 0)
                .drawPolygon([
                    G.gridSize * (j + 22 / 16), G.gridSize * (i + 22 / 16),
                    G.gridSize * (j + 26 / 16), G.gridSize * (i + 18 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 22 / 16),
                    G.gridSize * (j + 28 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 24 / 16),
                    G.gridSize * (j + 28 / 16), G.gridSize * (i + 27 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 26 / 16),
                    G.gridSize * (j + 26 / 16), G.gridSize * (i + 30 / 16),
                    G.gridSize * (j + 22 / 16), G.gridSize * (i + 26 / 16),
                ])
                .lineStyle(OUTWIDTH, Color.push, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_corrosion':
        case "tile_defbreak": {
            tile.beginFill(Color.defdown)
                .drawPolygon([
                    G.gridSize * (j + 20 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 23 / 16), G.gridSize * (i + 20 / 16),
                    G.gridSize * (j + 24 / 16), G.gridSize * (i + 19 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 20 / 16),
                    G.gridSize * (j + 28 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 27 / 16), G.gridSize * (i + 26 / 16),
                    G.gridSize * (j + 24 / 16), G.gridSize * (i + 29 / 16),
                    G.gridSize * (j + 21 / 16), G.gridSize * (i + 26 / 16),
                ])
                .drawPolygon([
                    G.gridSize * (j + 22 / 16), G.gridSize * (i + 23 / 16),
                    G.gridSize * (j + 20 / 16), G.gridSize * (i + 18 / 16),
                    G.gridSize * (j + 23 / 16), G.gridSize * (i + 23 / 16),
                    G.gridSize * (j + 26 / 16), G.gridSize * (i + 25 / 16),
                    G.gridSize * (j + 28 / 16), G.gridSize * (i + 30 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 25 / 16),
                ])
                .endFill()
                .beginFill(defaultColor)
                .drawPolygon([
                    G.gridSize * (j + 23 / 16), G.gridSize * (i + 23 / 16),
                    G.gridSize * (j + 20 / 16), G.gridSize * (i + 18 / 16),
                    G.gridSize * (j + 22 / 16), G.gridSize * (i + 20 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 25 / 16),
                    G.gridSize * (j + 28 / 16), G.gridSize * (i + 30 / 16),
                    G.gridSize * (j + 26 / 16), G.gridSize * (i + 28 / 16),
                ])
                .endFill()
                .lineStyle(OUTWIDTH, Color.defdown, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_defup': {
            tile.beginFill(Color.defup)
                .drawPolygon([
                    G.gridSize * (j + 20 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 23 / 16), G.gridSize * (i + 20 / 16),
                    G.gridSize * (j + 24 / 16), G.gridSize * (i + 19 / 16),
                    G.gridSize * (j + 25 / 16), G.gridSize * (i + 20 / 16),
                    G.gridSize * (j + 28 / 16), G.gridSize * (i + 21 / 16),
                    G.gridSize * (j + 27 / 16), G.gridSize * (i + 26 / 16),
                    G.gridSize * (j + 24 / 16), G.gridSize * (i + 29 / 16),
                    G.gridSize * (j + 21 / 16), G.gridSize * (i + 26 / 16),
                ])
                .endFill()
                .lineStyle(OUTWIDTH, Color.defup, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);;
            break;
        }
        case 'tile_gazebo': {
            tile.lineStyle(LINEWIDTH, Color.air)
                .drawCircle(G.gridSize * (j + 1.5), G.gridSize * (i + 1.5), G.gridSize * 3 / 16)
                .drawCircle(G.gridSize * (j + 1.5), G.gridSize * (i + 1.5), G.gridSize * 4 / 16)
                .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + 19 / 16))
                .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + 23 / 16))
                .moveTo(G.gridSize * (j + 29 / 16), G.gridSize * (i + 1.5))
                .lineTo(G.gridSize * (j + 25 / 16), G.gridSize * (i + 1.5))
                .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + 29 / 16))
                .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + 25 / 16))
                .moveTo(G.gridSize * (j + 19 / 16), G.gridSize * (i + 1.5))
                .lineTo(G.gridSize * (j + 23 / 16), G.gridSize * (i + 1.5))
                .lineStyle(OUTWIDTH, Color.air, 1, 0)
                .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
            break;
        }
        case 'tile_grass': {
            break;
        }
        case 'tile_healing': {
            break;
        }
        case 'tile_infection': {
            break;
        }
        case 'tile_rcm_crate': {
            break;
        }
        case 'tile_rcm_operator': {
            break;
        }
        case 'tile_volcano': {
            break;
        }
        case 'tile_volspread': {
            break;
        }
        case 'tile_defbreak': {
            break;
        }
        case 'tile_smog': {
            break;
        }
        case 'tile_yinyang_road': {
            break;
        }
        case 'tile_yinyang_wall': {
            break;
        }
        case 'tile_yinyang_switch': {
            break;
        }
        case 'tile_poison': {
            break;
        }
        case 'tile_icestr': {
            break;
        }
        case 'tile_icetur_lb': {
            break;
        }
        case 'tile_icetur_lt': {
            break;
        }
        case 'tile_icetur_rb': {
            break;
        }
        case 'tile_icetur_rt': {
            break;
        }
        case 'tile_magic_circle': {
            break;
        }
        case 'tile_magic_circle_h': {
            break;
        }
        case 'tile_aircraft': {
            break;
        }
        case 'tile_volcano_emp': {
            break;
        }
        case 'tile_reed': {
            break;
        }
        case 'tile_reedf': {
            break;
        }
        case 'tile_reedw': {
            break;
        }
        case 'tile_mire': {
            break;
        }
        case 'tile_passable_wall': {
            break;
        }
        case 'tile_passabe_wall_forbidden': {
            break;
        }
        case 'tile_stairs': {
            break;
        }
        case 'tile_grvtybtn': {
            break;
        }
        case 'tile_woodrd': {
            break;
        }
    }
    tile.lineStyle(1, 0x000000, 1, 0)
        .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
    return tile;
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
    await loadLevels();
    await loadUI();
    main();
}