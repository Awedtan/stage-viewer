const apiPath = 'https://hellabotapi.cyclic.app/enemy';
const assetPath = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';
const levelPath = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/levels';

class Enemy {
    static levelArray;
    static errorArray;
    static dataCache;
    static assetCache;
    static selectedRoute;
    static async create(startTick, enemyId, routeIndex) {
        const data = Enemy.dataCache[enemyId];
        if (!data) {
            return null;
        }
        return new Enemy(startTick, data, enemyId, routeIndex);
    }
    constructor(startTick, data, enemyId, routeIndex) {
        this.startTick = startTick;
        this.data = data;
        this.routeIndex = routeIndex;
        this.route = levelRoutes[routeIndex];
        this.spine = new PIXI.spine.Spine(Enemy.assetCache[enemyId].spineData);
        this.state = 'waiting';
        this.frameData = [];
        // x: number, 
        // y: number, 
        // state: ['waiting', 'start', 'idle', 'moving', 'disappear', 'reappear', 'end'], 
        // direction: ['left', 'right'] | false

        // Spine setup
        app.stage.addChild(this.spine);
        this.spine.skeleton.setSkin(this.spine.state.data.skeletonData.skins[0]);
        const loadPos = gridToPos({ row: -1, col: -1 })
        this.spine.x = loadPos.x;
        this.spine.y = loadPos.y;
        this.spine.scale.x = .25;
        this.spine.scale.y = .25;
        this.spine.interactive = true;
        this.spine.on('click', event => { // Draw route lines on click
            app.stage.removeChild(Enemy.selectedRoute);
            const startPos = gridToPos(this.route.startPosition, true);
            const endPos = gridToPos(this.route.endPosition, true);
            Enemy.selectedRoute = new PIXI.Graphics()
                .lineStyle(6, 0xff0000)
                .moveTo(startPos.x, startPos.y);
            for (const checkpoint of this.route.checkpoints)
                switch (checkpoint.type) {
                    case 0: { // Regular move
                        const checkPos = gridToPos(checkpoint.position, true);
                        Enemy.selectedRoute.lineTo(checkPos.x, checkPos.y);
                        break;
                    }
                    case 6: { // Teleport move
                        const checkPos = gridToPos(checkpoint.position, true);
                        Enemy.selectedRoute.lineStyle(1, 0xff0000)
                            .lineTo(checkPos.x, checkPos.y)
                            .lineStyle(6, 0xff0000);
                        break;
                    }
                }

            Enemy.selectedRoute.lineTo(endPos.x, endPos.y);
            app.stage.addChild(Enemy.selectedRoute);
        });

        // Generate frameData array
        const moveCloser = (currPos, movePos) => {
            while (currPos.x !== movePos.x || currPos.y !== movePos.y) {
                // Check for overshoot
                const distance = Math.sqrt(Math.pow((movePos.x - currPos.x), 2) + Math.pow((movePos.y - currPos.y), 2)); // Pythagoras
                if (distance <= 1) {
                    currPos.x = movePos.x;
                    currPos.y = movePos.y;
                    break;
                }
                // Move currPos closer to movePos
                const angle = Math.atan2(movePos.y - currPos.y, movePos.x - currPos.x); // Angle relative to +x axis
                const deltaX = localSpeed * Math.cos(angle);
                const deltaY = localSpeed * Math.sin(angle);
                currPos.x += deltaX;
                currPos.y += deltaY;
                let direction = false; // Only change direction if sufficient deltaX
                if (deltaX < -0.05) {
                    direction = 'left';
                }
                else if (deltaX > 0.05) {
                    direction = 'right';
                }
                this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving', direction };
                localTick++;
            }
        }
        const startPoint = this.route.startPosition;
        const endPoint = this.route.endPosition;
        const checkpoints = this.route.checkpoints;
        const dataSpeed = this.data.value.levels.Value[0].enemyData.attributes.moveSpeed.m_defined ? this.data.value.levels.Value[0].enemyData.attributes.moveSpeed.m_value : 1;
        const localSpeed = dataSpeed * BASESPEED;
        let localTick = 0;
        // Jump to start position
        let currPos = gridToPos(startPoint);
        this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving', direction: 'right' };
        // Go to each checkpoint
        for (const checkpoint of checkpoints) {
            switch (checkpoint.type) {
                case 0: { // Move
                    const checkPos = gridToPos(checkpoint.position);
                    moveCloser(currPos, checkPos);
                    break;
                }
                case 1:
                case 3: { // Idle
                    const idleTicks = checkpoint.time * FPS;
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'idle' };
                    for (let i = 1; i < idleTicks; i++) {
                        this.frameData[localTick + i] = this.frameData[localTick];
                    }
                    localTick += idleTicks;
                    break;
                }
                case 5: { // Disappear
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'disappear' };
                    localTick++;
                    break;
                }
                case 6: { // Reappear
                    currPos = gridToPos(checkpoint.position);
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'reappear' };
                    localTick++;
                    break;
                }
            }
        }
        // Go to end position
        const endPos = gridToPos(endPoint);
        moveCloser(currPos, endPos);
    }
    update(currTick) {
        const localTick = currTick - this.startTick;
        if (localTick < 0) {
            this.state = 'waiting';
            app.stage.removeChild(this.spine);
            return;
        }
        if (localTick === 0) {
            this.state = 'start';
            app.stage.addChild(this.spine);
        }
        if (localTick >= this.frameData.length) {
            this.state = 'end';
            app.stage.removeChild(this.spine);
            return;
        }

        const currFrameData = this.frameData[localTick];
        this.spine.x = currFrameData.x;
        this.spine.y = currFrameData.y;
        const skeletonData = this.spine.state.data.skeletonData;

        if (this.state !== currFrameData.state) {
            const animArr = skeletonData.animations.map(anim => anim.name.toLowerCase());
            const getBestMatch = (...stringArr) => { // Get animation name closest to an entry in stringArr, lower index preferred
                const matchArr = stringArr.map(str => stringSimilarity.findBestMatch(str, animArr));
                const bestMatch = matchArr.reduce((prev, curr) => prev.bestMatch.rating >= curr.bestMatch.rating ? prev : curr);
                return bestMatch;
            }
            switch (currFrameData.state) {
                case 'moving': {
                    app.stage.addChild(this.spine);
                    const bestMatch = getBestMatch('run_loop', 'run', 'move_loop', 'move');
                    const bestAnim = skeletonData.animations[bestMatch.bestMatchIndex];
                    this.spine.state.setAnimation(0, bestAnim.name, true);
                    break;
                }
                case 'idle': {
                    if (this.state !== 'disappear')
                        app.stage.addChild(this.spine);

                    const bestMatch = getBestMatch('idle_loop', 'idle');
                    const bestAnim = skeletonData.animations[bestMatch.bestMatchIndex];
                    this.spine.state.setAnimation(0, bestAnim.name, true);
                    break;
                }
                case 'disappear': {
                    app.stage.removeChild(this.spine);
                    break;
                }
                case 'reappear': {
                    app.stage.addChild(this.spine);
                    break;
                }
            }
            this.state = currFrameData.state;
        }
        if (currFrameData.direction) {
            if (currFrameData.direction === 'right') {
                this.spine.scale.x = .25;
            }
            else if (currFrameData.direction === 'left') {
                this.spine.scale.x = -.25;
            }
        }
    }
}

const GRIDSIZE = 71;
const FPS = 60;
const BASESPEED = 0.65; // Arbitrary number

let loader = new PIXI.loaders.Loader();
let app;
let levelId;
let levelData;
let levelRoutes;
let stageGridTiles;
let stageTick = 0;
let stageMaxTick = 0;
let skipCount = 0;

let playButton;
let tickSlider;
let selectMenu;
let autoplay = false;

let frameTime = Date.now(), sec = 0;

async function main() {
    playButton = document.getElementById('autoplay');
    playButton.addEventListener('click', switchPlay);
    playButton.disabled = true;
    tickSlider = document.getElementById('tick');
    tickSlider.disabled = true;
    selectMenu = document.getElementById('select');
    selectMenu.addEventListener('change', changeLevel);
    selectMenu.disabled = true;
    levelId = selectMenu.value;

    console.log('load level data');
    await loadLevelData();

    console.log('load enemy data');
    await loadEnemyData();

    console.log('create app stage');
    await createAppStage();

    console.log('load enemy assets')
    await loadEnemyAssets();

    await loader.load(async (loader, resources) => {
        await sleep(1000);
        for (const key of Object.keys(resources)) {
            if (Enemy.assetCache[key]) continue;
            Enemy.assetCache[key] = resources[key];
        }

        console.log('load enemy waves');
        await loadLevelWaves();

        console.log(stageMaxTick);
        console.log(Enemy.levelArray);
        console.log('start');
        app.start();
        app.ticker.add(loop); // Main loop

        playButton.disabled = false;
        tickSlider.disabled = false;
        tickSlider.max = stageMaxTick;
        selectMenu.disabled = false;
    });
}

async function loadLevelData() {
    stageGridTiles = [];
    const levelRes = await fetch(`${levelPath}/${levelId}.json`);
    levelData = await levelRes.json();
    const stageMap = [];
    levelData.mapData.map.forEach(mapRow => {
        const row = mapRow.map(tile => levelData.mapData.tiles[tile]);
        stageMap.push(row);
    });
    levelRoutes = levelData.routes;
    for (let i = 0; i < stageMap.length; i++) {
        const row = stageMap[i];
        for (let j = 0; j < row.length; j++) {
            const gridTile = createGridTile(row[j], i, j);
            stageGridTiles.push(gridTile);
        }
    }
}

async function loadEnemyData(recache) {
    if (!Enemy.dataCache || recache) {
        Enemy.dataCache = {};
        const enemyRes = await fetch(apiPath);
        data = await enemyRes.json();
        for (const obj of data) {
            Enemy.dataCache[obj.keys[0]] = obj;
        }
    }
}

async function createAppStage() {
    app = new PIXI.Application({ width: (levelData.mapData.width + 2) * GRIDSIZE, height: (levelData.mapData.height + 2) * GRIDSIZE });
    document.body.appendChild(app.view);
    app.renderer.backgroundColor = BGCOLOR;
    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.left = '50%';
    app.renderer.view.style.top = '50%';
    app.renderer.view.style.transform = 'translate3d( -50%, -50%, 0 )';
    for (const gridSquare of stageGridTiles) {
        app.stage.addChild(gridSquare);
    }
}

async function loadEnemyAssets(recache) {
    if (!Enemy.assetCache || recache)
        Enemy.assetCache = {};
    const urlExists = async url => (await fetch(url)).status === 200;
    for (const enemy of levelData.enemyDbRefs) {
        if (Enemy.assetCache[enemy.id]) continue;
        try {
            let spinePath = assetPath + `/${enemy.id}/${enemy.id}`;
            if (await urlExists(assetPath + `/${enemy.id}/${enemy.id}` + '.skel')) {
            }
            else if (await urlExists(assetPath + `/${enemy.id}/${enemy.id.split('_2').join('')}` + '.skel')) {
                spinePath = assetPath + `/${enemy.id}/${enemy.id.split('_2').join('')}`;
            }
            else if (await urlExists(assetPath + `/${enemy.id}/${enemy.id}`.split('sbr').join('sabr') + '.skel')) {
                spinePath = assetPath + `/${enemy.id}/${enemy.id}`.split('sbr').join('sabr');
            }
            else if (await urlExists(assetPath + `/${enemy.id}/${enemy.id.split('_2').join('')}`.split('sbr').join('sabr') + '.skel')) {
                spinePath = assetPath + `/${enemy.id}/${enemy.id.split('_2').join('')}`.split('sbr').join('sabr');
            }
            else {
                throw new Error('Skel file can\'t be found');
            }
            loader.add(enemy.id, spinePath + '.skel');
        } catch (e) {
            console.error(e + (': ') + enemy.id);
        }
    }
}

async function loadLevelWaves() {
    Enemy.levelArray = [];
    Enemy.errorArray = [];
    let precalcTick = 0; // Precalculated global tick for all actions
    let waveBlockTick = 0; // Wave blocker tick

    const createEnemy = async (precalcTick, action) => {
        if (Enemy.errorArray.includes(action.key)) return false;
        try {
            const enemy = await Enemy.create(precalcTick, action.key, action.routeIndex); // Mark an enemy to spawn at current tick
            if (enemy) {
                Enemy.levelArray.push(enemy); // Only add enemy if everything went ok
                const enemyMaxTick = precalcTick + enemy.frameData.length;
                stageMaxTick = enemyMaxTick > stageMaxTick ? enemyMaxTick : stageMaxTick; // Keep track of how long the level takes
                if (!action.dontBlockWave) {
                    waveBlockTick = stageMaxTick; // Only update wave blocker tick if the enemy is blocking
                }
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
    for (const wave of levelData.waves) {
        for (const fragment of wave.fragments) {
            precalcTick += fragment.preDelay * FPS; // Add wave fragment predelay

            for (const action of fragment.actions) {
                precalcTick += action.preDelay * FPS; // Action predelays are relative to the wave fragment predelay and do not stack
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
                if (action.actionType === 0) {
                    await createEnemy(precalcTick, action);
                }
                for (let i = 1; i < action.count; i++) {
                    precalcTick += action.interval * FPS;
                    if (action.actionType === 0) {
                        await createEnemy(precalcTick, action);
                    }
                }
                precalcTick -= action.preDelay * FPS + action.interval * FPS * (action.count - 1); // Revert precalcTick to the wave fragment predelay
            }
            const maxActionDelay = fragment.actions.reduce((prev, curr) => (prev.preDelay > curr.preDelay) ? prev.preDelay : curr.preDelay, 1)
            precalcTick += maxActionDelay * FPS;
        }
        if (precalcTick < waveBlockTick) {
            precalcTick = waveBlockTick;
        }
    }
}

async function loop(delta) {
    if (++skipCount < Math.round(app.ticker.FPS / FPS)) return; // Adjust for high fps displays
    skipCount = 0;

    if (autoplay) {
        if (stageTick >= stageMaxTick) {
            switchPlay();
        }
        stageTick += 1;
        tickSlider.value = stageTick;
        sec++
        if (sec >= 120) {
            const now = Date.now()
            console.log(now - frameTime)
            frameTime = now;
            sec = 0;
        }
    } else {
        stageTick = parseInt(tickSlider.value);
    }
    for (const enemy of Enemy.levelArray) {
        enemy.update(stageTick);
    }
}

function switchPlay() {
    autoplay = !autoplay;
    if (autoplay) {
        playButton.innerText = 'Pause';
        tickSlider.disabled = true;
    } else {
        playButton.innerText = 'Play';
        tickSlider.disabled = false;
    }
}

function changeLevel() {
    levelId = selectMenu.value;
    if (autoplay) {
        switchPlay();
    }

    Enemy.levelArray = null;
    Enemy.errorArray = null;
    app.destroy(true, { children: true, texture: false, baseTexture: false });
    app = null;
    levelData = null;
    levelRoutes = null;
    stageGridTiles = null;
    stageTick = 0;
    stageMaxTick = 0;
    skipCount = 0;
    tickSlider.value = 0;
    main();
}

const BGCOLOR = 0x101010;
const STARTCOLOR = 0xe21818;
const ENDCOLOR = 0x0c8aff;
const VOIDCOLOR = 0x202020;
const ROADCOLOR = 0x484848;
const WALLCOLOR = 0xa8a8a8;
const FLOORCOLOR = 0xc08438;
const TUNNELCOLOR = 0xeb9072;
const FENCECOLOR = 0xe8ba23;
const HOLECOLOR = WALLCOLOR;
const PUSHCOLOR = 0xb85b0a;
const DEFDOWNCOLOR = 0xc03722;
const DEFUPCOLOR = PUSHCOLOR;
const AIRCOLOR = PUSHCOLOR;

const LINEWIDTH = 3;
const OUTWIDTH = 6;
const TRILEN = 5;

function createGridTile(mapTile, i, j) {
    const tileKey = mapTile.tileKey;
    const heightType = mapTile.heightType;

    let tile;
    if (heightType === 0) {
        tile = new PIXI.Graphics().beginFill(ROADCOLOR)
            .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
            .endFill()
    }
    else if (heightType === 1) {
        tile = new PIXI.Graphics().beginFill(WALLCOLOR)
            .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
            .endFill()
    }
    else {
        tile = new PIXI.Graphics().beginFill(VOIDCOLOR)
            .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
            .endFill();
    }

    switch (tileKey) {
        // BASICS
        case 'tile_end': {
            const yAdj = TRILEN / 4;
            const rad30 = 30 * Math.PI / 180
            tile = new PIXI.Graphics().lineStyle(LINEWIDTH, ENDCOLOR)
                .moveTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 - TRILEN / Math.cos(rad30) + yAdj) / 16))
                .lineTo(GRIDSIZE * (j + (24 + TRILEN) / 16), GRIDSIZE * (i + (24 + (TRILEN * Math.tan(rad30)) + yAdj) / 16))
                .lineTo(GRIDSIZE * (j + (24 - TRILEN) / 16), GRIDSIZE * (i + (24 + (TRILEN * Math.tan(rad30)) + yAdj) / 16))
                .lineTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 - TRILEN / Math.cos(rad30) + yAdj) / 16))
                .lineStyle(LINEWIDTH, ENDCOLOR)
                .moveTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 - TRILEN / 3) / 16))
                .lineTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 + TRILEN / 3) / 16))
                .beginFill(ENDCOLOR)
                .drawCircle(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 + TRILEN * 9 / 16) / 16), LINEWIDTH / 4)
                .endFill()
                .lineStyle(OUTWIDTH, ENDCOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            break;
        }
        case 'tile_fence':
        case 'tile_fence_bound': {
            tile = new PIXI.Graphics().beginFill(ROADCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(OUTWIDTH, FENCECOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            break;
        }
        case 'tile_flowerf':
        case 'tile_creepf':
        case 'tile_floor': {
            tile = new PIXI.Graphics().beginFill(ROADCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(OUTWIDTH, FLOORCOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            break;
        }
        case 'tile_flystart': {
            tile = new PIXI.Graphics().beginFill(STARTCOLOR)
                .drawPolygon([
                    GRIDSIZE * (j + 21 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 23 / 16),
                    GRIDSIZE * (j + 27 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 24 / 16),
                    GRIDSIZE * (j + 27 / 16), GRIDSIZE * (i + 27 / 16),
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 25 / 16),
                    GRIDSIZE * (j + 21 / 16), GRIDSIZE * (i + 27 / 16),
                    GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 24 / 16),
                ])
                .endFill()
                .lineStyle(LINEWIDTH, STARTCOLOR)
                .drawCircle(GRIDSIZE * (j + 21 / 16), GRIDSIZE * (i + 21 / 16), GRIDSIZE * 2.5 / 16)
                .drawCircle(GRIDSIZE * (j + 27 / 16), GRIDSIZE * (i + 21 / 16), GRIDSIZE * 2.5 / 16)
                .drawCircle(GRIDSIZE * (j + 27 / 16), GRIDSIZE * (i + 27 / 16), GRIDSIZE * 2.5 / 16)
                .drawCircle(GRIDSIZE * (j + 21 / 16), GRIDSIZE * (i + 27 / 16), GRIDSIZE * 2.5 / 16)
                .lineStyle(OUTWIDTH, STARTCOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            break;
        }
        case 'tile_forbidden': {
            tile = new PIXI.Graphics().beginFill(VOIDCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill();
            break;
        }
        case 'tile_empty':
        case 'tile_hole': {
            tile = new PIXI.Graphics().beginFill(VOIDCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(OUTWIDTH, HOLECOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            break;
        }
        case 'tile_flower':
        case 'tile_creep':
        case 'tile_road': {
            tile = new PIXI.Graphics().beginFill(ROADCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill();
            break;
        }
        case 'tile_start': {
            const yAdj = TRILEN / 4;
            const rad30 = 30 * Math.PI / 180
            tile = new PIXI.Graphics().lineStyle(LINEWIDTH, STARTCOLOR)
                .moveTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 - TRILEN / Math.cos(rad30) + yAdj) / 16))
                .lineTo(GRIDSIZE * (j + (24 + TRILEN) / 16), GRIDSIZE * (i + (24 + (TRILEN * Math.tan(rad30)) + yAdj) / 16))
                .lineTo(GRIDSIZE * (j + (24 - TRILEN) / 16), GRIDSIZE * (i + (24 + (TRILEN * Math.tan(rad30)) + yAdj) / 16))
                .lineTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 - TRILEN / Math.cos(rad30) + yAdj) / 16))
                .lineStyle(LINEWIDTH, STARTCOLOR)
                .moveTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 - TRILEN / 3) / 16))
                .lineTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 + TRILEN / 3) / 16))
                .beginFill(STARTCOLOR)
                .drawCircle(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + (24 + TRILEN * 9 / 16) / 16), LINEWIDTH / 4)
                .endFill()
                .lineStyle(OUTWIDTH, STARTCOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            break;
        }
        case 'tile_telin': {
            tile = new PIXI.Graphics().beginFill(ROADCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .beginFill(TUNNELCOLOR)
                .drawPolygon([
                    GRIDSIZE * (j + 4 / 4), GRIDSIZE * (i + 5 / 4),
                    GRIDSIZE * (j + 5 / 4), GRIDSIZE * (i + 5 / 4),
                    GRIDSIZE * (j + 5 / 4), GRIDSIZE * (i + 6 / 4),
                    GRIDSIZE * (j + 6 / 4), GRIDSIZE * (i + 6 / 4),
                    GRIDSIZE * (j + 6 / 4), GRIDSIZE * (i + 7 / 4),
                    GRIDSIZE * (j + 7 / 4), GRIDSIZE * (i + 7 / 4),
                    GRIDSIZE * (j + 7 / 4), GRIDSIZE * (i + 8 / 4),
                    GRIDSIZE * (j + 4 / 4), GRIDSIZE * (i + 8 / 4),
                ])
                .drawPolygon([
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 19 / 16),
                    GRIDSIZE * (j + 28 / 16), GRIDSIZE * (i + 23 / 16),
                    GRIDSIZE * (j + 29 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 29 / 16), GRIDSIZE * (i + 25 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 25 / 16),
                    GRIDSIZE * (j + 27 / 16), GRIDSIZE * (i + 24 / 16),
                    GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 20 / 16),
                ])
                .endFill();
            break;
        }
        case 'tile_telout': {
            tile = new PIXI.Graphics().beginFill(ROADCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .beginFill(TUNNELCOLOR)
                .drawPolygon([
                    GRIDSIZE * (j + 8 / 4), GRIDSIZE * (i + 5 / 4),
                    GRIDSIZE * (j + 7 / 4), GRIDSIZE * (i + 5 / 4),
                    GRIDSIZE * (j + 7 / 4), GRIDSIZE * (i + 6 / 4),
                    GRIDSIZE * (j + 6 / 4), GRIDSIZE * (i + 6 / 4),
                    GRIDSIZE * (j + 6 / 4), GRIDSIZE * (i + 7 / 4),
                    GRIDSIZE * (j + 5 / 4), GRIDSIZE * (i + 7 / 4),
                    GRIDSIZE * (j + 5 / 4), GRIDSIZE * (i + 8 / 4),
                    GRIDSIZE * (j + 8 / 4), GRIDSIZE * (i + 8 / 4),
                ])
                .drawPolygon([
                    GRIDSIZE * (j + 19 / 16), GRIDSIZE * (i + 24 / 16),
                    GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 20 / 16),
                    GRIDSIZE * (j + 21 / 16), GRIDSIZE * (i + 19 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 19 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 23 / 16),
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 20 / 16), GRIDSIZE * (i + 25 / 16),
                ])
                .endFill();
            break;
        }
        case 'tile_wall': {
            tile = new PIXI.Graphics().beginFill(WALLCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill();
            break;
        }
        // WATER
        case 'tile_deepwater':
        case 'tile_shallowwater':
        case 'tile_deepsea':
        case 'tile_water': {
            tile = new PIXI.Graphics().beginFill(ENDCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill();
            break;
        }
        // SPECIAL
        case 'tile_bigforce': {
            tile.beginFill(PUSHCOLOR)
                .drawRect(GRIDSIZE * (j + 21 / 16), GRIDSIZE * (i + 19 / 16), LINEWIDTH * 2, GRIDSIZE * 10 / 16)
                .endFill()
                .lineStyle(LINEWIDTH, PUSHCOLOR, 1, 0)
                .drawPolygon([
                    GRIDSIZE * (j + 22 / 16), GRIDSIZE * (i + 22 / 16),
                    GRIDSIZE * (j + 26 / 16), GRIDSIZE * (i + 18 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 22 / 16),
                    GRIDSIZE * (j + 28 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 24 / 16),
                    GRIDSIZE * (j + 28 / 16), GRIDSIZE * (i + 27 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 26 / 16),
                    GRIDSIZE * (j + 26 / 16), GRIDSIZE * (i + 30 / 16),
                    GRIDSIZE * (j + 22 / 16), GRIDSIZE * (i + 26 / 16),
                ])
                .lineStyle(OUTWIDTH, PUSHCOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            break;
        }
        case 'tile_corrosion':
        case "tile_defbreak": {
            tile.beginFill(DEFDOWNCOLOR)
                .drawPolygon([
                    GRIDSIZE * (j + 20 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 20 / 16),
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 19 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 20 / 16),
                    GRIDSIZE * (j + 28 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 27 / 16), GRIDSIZE * (i + 26 / 16),
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 29 / 16),
                    GRIDSIZE * (j + 21 / 16), GRIDSIZE * (i + 26 / 16),
                ])
                .drawPolygon([
                    GRIDSIZE * (j + 22 / 16), GRIDSIZE * (i + 23 / 16),
                    GRIDSIZE * (j + 20 / 16), GRIDSIZE * (i + 18 / 16),
                    GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 23 / 16),
                    GRIDSIZE * (j + 26 / 16), GRIDSIZE * (i + 25 / 16),
                    GRIDSIZE * (j + 28 / 16), GRIDSIZE * (i + 30 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 25 / 16),
                ])
                .endFill()
                .beginFill(ROADCOLOR)
                .drawPolygon([
                    GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 23 / 16),
                    GRIDSIZE * (j + 20 / 16), GRIDSIZE * (i + 18 / 16),
                    GRIDSIZE * (j + 22 / 16), GRIDSIZE * (i + 20 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 25 / 16),
                    GRIDSIZE * (j + 28 / 16), GRIDSIZE * (i + 30 / 16),
                    GRIDSIZE * (j + 26 / 16), GRIDSIZE * (i + 28 / 16),
                ])
                .endFill()
                .lineStyle(OUTWIDTH, DEFDOWNCOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            break;
        }
        case 'tile_defup': {
            tile.beginFill(DEFUPCOLOR)
                .drawPolygon([
                    GRIDSIZE * (j + 20 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 20 / 16),
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 19 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 20 / 16),
                    GRIDSIZE * (j + 28 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 27 / 16), GRIDSIZE * (i + 26 / 16),
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 29 / 16),
                    GRIDSIZE * (j + 21 / 16), GRIDSIZE * (i + 26 / 16),
                ])
                .endFill()
                .lineStyle(OUTWIDTH, DEFUPCOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);;
            break;
        }
        case 'tile_gazebo': {
            tile.lineStyle(LINEWIDTH, AIRCOLOR)
                .drawCircle(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + 1.5), GRIDSIZE * 3 / 16)
                .drawCircle(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + 1.5), GRIDSIZE * 4 / 16)
                .moveTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + 19 / 16))
                .lineTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + 23 / 16))
                .moveTo(GRIDSIZE * (j + 29 / 16), GRIDSIZE * (i + 1.5))
                .lineTo(GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 1.5))
                .moveTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + 29 / 16))
                .lineTo(GRIDSIZE * (j + 1.5), GRIDSIZE * (i + 25 / 16))
                .moveTo(GRIDSIZE * (j + 19 / 16), GRIDSIZE * (i + 1.5))
                .lineTo(GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 1.5))
                .lineStyle(OUTWIDTH, AIRCOLOR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
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
        .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
    return tile;
}

function gridToPos({ row, col }, centered) {
    if (centered) {
        const x = GRIDSIZE * (1.5 + col);
        const y = GRIDSIZE * (0.5 + levelData.mapData.height - row);
        return { x, y };
    }
    else {
        const randX = Math.random() / 6;
        const randY = Math.random() / 6;
        const x = GRIDSIZE * (1.5 + col + randX);
        const y = GRIDSIZE * (0.7 + levelData.mapData.height - row + randY);
        return { x, y };
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

window.onload = () => {
    main();
}