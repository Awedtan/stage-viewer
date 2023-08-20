const levelDataPath = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/levels';
const spineDataPath = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';

const GRIDSIZE = 71;
const FPS = 60;
const MOVESPEED = 0.65;

let levelId;
let loader = new PIXI.loaders.Loader();
let app;
let appResources;
let appFPS;
let skipUpdate;
let level;
let map;
let routes;
let gridArr = [];
let globalTick = 0;
let maxTick = 0;
let skipCount = 0;

let playButton;
let tickSlider;
let selectMenu;
let autoplay = false;

class Enemy {
    static array = [];
    static dataCache = {};
    static routeLine;
    static async create(startTick, enemyId, routeIndex) {
        let data;
        if (Enemy.dataCache[enemyId]) {
            data = Enemy.dataCache[enemyId];
        }
        else {
            const enemyRes = await fetch(`https://hellabotapi.cyclic.app/enemy/${enemyId}`);
            data = await enemyRes.json();
            Enemy.dataCache[enemyId] = data;
        }
        try {
            return new Enemy(startTick, data, enemyId, routeIndex);
        } catch (e) {
            console.log(e);
            return null;
        }
    }
    constructor(startTick, data, enemyId, routeIndex) {
        this.startTick = startTick;
        this.data = data;
        this.route = routes[routeIndex];
        this.spine = new PIXI.spine.Spine(appResources[enemyId].spineData);

        const skin = this.spine.state.data.skeletonData.skins[0];
        this.spine.skeleton.setSkin(skin);
        // this.spine.state.setAnimation(0, 'Idle', true);
        this.state = 'waiting';
        this.generateFrameData();
        this.spine.x = gridToPos({ row: -1, col: -1 }).x;
        this.spine.y = gridToPos({ row: -1, col: -1 }).y;
        this.spine.scale.x = .25;
        this.spine.scale.y = .25;

        this.spine.interactive = true;
        this.spine.on('click', event => {
            app.stage.removeChild(Enemy.routeLine);
            const startPos = gridToPos(this.route.startPosition, true);
            const endPos = gridToPos(this.route.endPosition, true);
            Enemy.routeLine = new PIXI.Graphics()
                .lineStyle(6, 0xff0000)
                .moveTo(startPos.x, startPos.y);
            for (const checkpoint of this.route.checkpoints)
                switch (checkpoint.type) {
                    case 0: {
                        const checkPos = gridToPos(checkpoint.position, true);
                        Enemy.routeLine.lineTo(checkPos.x, checkPos.y);
                        break;
                    }
                    case 6: {
                        const checkPos = gridToPos(checkpoint.position, true);
                        Enemy.routeLine.lineStyle(1, 0xff0000)
                            .lineTo(checkPos.x, checkPos.y)
                            .lineStyle(6, 0xff0000);
                        break;
                    }
                }

            Enemy.routeLine.lineTo(endPos.x, endPos.y);
            app.stage.addChild(Enemy.routeLine);
        });

        app.stage.addChild(this.spine);
    }
    generateFrameData() {
        this.frameData = [];
        let localTick = 0;
        const startPoint = this.route.startPosition;
        const endPoint = this.route.endPosition;
        const checkpoints = this.route.checkpoints;
        const dataSpeed = this.data.value.levels.Value[0].enemyData.attributes.moveSpeed.m_defined ? this.data.value.levels.Value[0].enemyData.attributes.moveSpeed.m_value : 1;
        const localSpeed = MOVESPEED * dataSpeed;

        const moveCloser = (currPos, movePos) => {
            while (currPos.x !== movePos.x || currPos.y !== movePos.y) {
                // Check for overshoot
                const distance = Math.sqrt(Math.pow((movePos.x - currPos.x), 2) + Math.pow((movePos.y - currPos.y), 2));
                if (distance <= 1) {
                    currPos.x = movePos.x;
                    currPos.y = movePos.y;
                    break;
                }
                // Move currPos closer to movePos
                const angle = Math.atan2(movePos.y - currPos.y, movePos.x - currPos.x);
                const deltaX = localSpeed * Math.cos(angle);
                const deltaY = localSpeed * Math.sin(angle);
                currPos.x += deltaX;
                currPos.y += deltaY;

                let direction = false;
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

        // Go to start position
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
                case 3: { // Stay still
                    const idleTicks = checkpoint.time * FPS;
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'idle' };
                    for (let i = 1; i < idleTicks; i++) {
                        this.frameData[localTick + i] = this.frameData[localTick];
                    }
                    localTick += idleTicks;
                    break;
                }
                case 5: { // Disappear (into tunnel)
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'disappear' };
                    localTick++;
                    break;
                }
                case 6: { // Reappear (out of tunnel)
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
        }
        if (localTick === 0) {
            this.state = 'start';
            app.stage.addChild(this.spine);
        }
        if (localTick >= this.frameData.length) {
            this.state = 'end';
            app.stage.removeChild(this.spine);
        }
        if (localTick < 0 || localTick >= this.frameData.length)
            return;

        const currFrameData = this.frameData[localTick];
        this.spine.x = currFrameData.x;
        this.spine.y = currFrameData.y;

        const skeletonData = this.spine.state.data.skeletonData;

        if (this.state !== currFrameData.state) {
            const animArr = skeletonData.animations.map(anim => anim.name.toLowerCase());
            const getBestMatch = (...stringArr) => {
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
    playButton.innerText = 'Play';
    tickSlider.disabled = false;
    autoplay = false;

    PIXI.utils.destroyTextureCache();
    loader = new PIXI.loaders.Loader();
    app.destroy(true, true);
    appResources = null;
    appFPS = null;
    skipUpdate = null;
    level = null;
    map = null;
    routes = null;
    gridArr = [];
    Enemy.array = [];
    globalTick = 0;
    maxTick = 0;
    skipCount = 0;
    tickSlider.value = 0;
    main();
}

async function main() {
    playButton = document.getElementById('autoplay');
    playButton.addEventListener('click', switchPlay);
    tickSlider = document.getElementById('tick');
    selectMenu = document.getElementById('select');
    selectMenu.addEventListener('change', changeLevel);

    playButton.disabled = true;
    tickSlider.disabled = true;
    selectMenu.disabled = true;

    levelId = selectMenu.value;

    console.log('load level data');
    await loadLevelData();

    console.log('create app stage');
    await createAppStage();

    console.log('load enemy assets')
    for (const enemy of level.enemyDbRefs) {
        let spineId = enemy.id === 'enemy_1027_mob_2' ? 'enemy_1027_mob' : enemy.id;
        try {
            loader.add(enemy.id, `${spineDataPath}/${enemy.id}/${spineId}.skel`);
        } catch (e) {
            console.error(e);
        }
    }

    await loader.load(async (loader, resources) => {
        appResources = resources;

        console.log('load enemy waves');
        await loadLevelWaves();

        tickSlider.max = maxTick;
        console.log(tickSlider.max);
        console.log(Enemy.array);
        console.log('start');
        app.start();
        appFPS = app.ticker.FPS;
        skipUpdate = Math.round(appFPS / FPS);

        // Main loop
        app.ticker.add(loop);

        playButton.disabled = false;
        tickSlider.disabled = false;
        selectMenu.disabled = false;
    });
}

async function loadLevelData() {
    const levelPath = `${levelDataPath}/${levelId}.json`;
    const levelRes = await fetch(levelPath);
    level = await levelRes.json();
    map = [];
    level.mapData.map.forEach(mapRow => {
        const row = mapRow.map(tile => level.mapData.tiles[tile]);
        map.push(row);
    });
    routes = level.routes;
    for (let i = 0; i < map.length; i++) {
        const row = map[i];
        for (let j = 0; j < row.length; j++) {
            const gridTile = createGridTile(row[j], i, j);
            gridArr.push(gridTile);
        }
    }
}

async function createAppStage() {
    app = new PIXI.Application({ width: (level.mapData.width + 2) * GRIDSIZE, height: (level.mapData.height + 2) * GRIDSIZE });
    document.body.appendChild(app.view);
    app.renderer.backgroundColor = BGCOLOR;
    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.left = '50%';
    app.renderer.view.style.top = '50%';
    app.renderer.view.style.transform = 'translate3d( -50%, -50%, 0 )';
    for (const gridSquare of gridArr) {
        app.stage.addChild(gridSquare);
    }
}

async function loadLevelWaves() {
    let precalcTick = 0;
    for (const wave of level.waves) {
        for (const fragment of wave.fragments) {
            precalcTick += fragment.preDelay * FPS;

            for (const action of fragment.actions) {
                precalcTick += action.preDelay * FPS;

                if (action.actionType === 0) {
                    const enemy = await Enemy.create(precalcTick, action.key, action.routeIndex);
                    if (enemy) {
                        Enemy.array.push(enemy);
                        const enemyMaxTick = precalcTick + enemy.frameData.length;
                        maxTick = enemyMaxTick > maxTick ? enemyMaxTick : maxTick;
                    }
                }
                for (let i = 1; i < action.count; i++) {
                    precalcTick += action.interval * FPS;

                    if (action.actionType === 0) {
                        const enemy = await Enemy.create(precalcTick, action.key, action.routeIndex);
                        if (enemy) {
                            Enemy.array.push(enemy);
                            const enemyMaxTick = precalcTick + enemy.frameData.length;
                            maxTick = enemyMaxTick > maxTick ? enemyMaxTick : maxTick;
                        }
                    }
                }

                precalcTick -= action.preDelay * FPS + action.interval * FPS * (action.count - 1);
            }
            const maxActionDelay = fragment.actions.reduce((prev, curr) => (prev.preDelay > curr.preDelay) ? prev.preDelay : curr.preDelay, 1)
            precalcTick += maxActionDelay * FPS;
        }
    }
}

let frameTime = Date.now(), sec = 0;

async function loop(delta) {
    appFPS = app.ticker.FPS;
    skipUpdate = Math.round(appFPS / FPS);

    if (++skipCount < skipUpdate) return;

    for (const enemy of Enemy.array) {
        enemy.update(globalTick);
    }

    if (autoplay) {
        globalTick += 1;
        tickSlider.value = globalTick;

        sec++
        if (sec >= 120) {
            const now = Date.now()
            console.log(now - frameTime)
            frameTime = now;
            sec = 0;
        }
    } else {
        globalTick = parseInt(tickSlider.value);
    }
    skipCount = 0;
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
        const y = GRIDSIZE * (0.5 + level.mapData.height - row);
        return { x, y };
    }
    else {
        const randX = Math.random() / 6;
        const randY = Math.random() / 6;
        const x = GRIDSIZE * (1.5 + col + randX);
        const y = GRIDSIZE * (0.7 + level.mapData.height - row + randY);
        return { x, y };
    }
}

window.onload = () => {
    main();
}