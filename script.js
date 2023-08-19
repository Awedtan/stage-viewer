const levelDataPath = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/levels';
const spineDataPath = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';

const GRIDSIZE = 75;
const FPS = 60;
const MOVESPEED = 0.65;
// const levelId = 'obt/main/level_main_01-07';
// const levelId = 'obt/main/level_main_01-12';
// const levelId = 'obt/main/level_main_04-10';
// const levelId = 'obt/main/level_main_08-17';
// const levelId = 'obt/main/level_main_10-15';
const levelId = 'obt/main/level_main_11-18';

let app;
let appResources;
let appFPS;
let skipUpdate;
let level;
let map;
let routes;
const gridArr = [];
const enemyArr = [];
let globalTick = 0;
let maxTick = 0;
let skipCount = 0;

let playButton;
let tickSlider;
let autoplay = false;

class Enemy {
    static startCount = 0;
    static endCount = 0;
    static enemyDataCache = {};
    static async create(startTick, enemyId, routeIndex) {
        let data;
        if (Enemy.enemyDataCache[enemyId]) {
            data = Enemy.enemyDataCache[enemyId];
        }
        else {
            const enemyRes = await fetch(`https://hellabotapi.cyclic.app/enemy/${enemyId}`);
            data = await enemyRes.json();
            Enemy.enemyDataCache[enemyId] = data;
        }
        return new Enemy(startTick, data, enemyId, routeIndex);
    }
    constructor(startTick, data, enemyId, routeIndex) {
        this.startTick = startTick;
        this.data = data;
        this.route = routes[routeIndex];
        this.spine = new PIXI.spine.Spine(appResources[enemyId].spineData);

        const skin = this.spine.state.data.skeletonData.skins[0];
        this.spine.skeleton.setSkin(skin);
        app.stage.addChild(this.spine);
        // this.spine.state.setAnimation(0, 'Idle', true);

        this.state = 'waiting';
        this.generateFrameData();

        this.spine.x = gridToPos({ row: -1, col: -1 }).x;
        this.spine.y = gridToPos({ row: -1, col: -1 }).y;
        this.spine.scale.x = .25;
        this.spine.scale.y = .25;
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
                case 1: { // Stay still
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
            Enemy.startCount++;
            // console.log(`spawn ${this.data.keys[0]} ` + Enemy.startCount + '/' + enemyArr.length);
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

async function main() {
    window.onload = () => {
        playButton = document.getElementById('autoplay');
        tickSlider = document.getElementById('tick');
    }

    console.log('load level data');
    await loadLevelData();

    console.log('create app stage');
    await createAppStage();

    console.log('load enemy assets')
    for (const enemy of level.enemyDbRefs)
        PIXI.loader.add(enemy.id, `${spineDataPath}/${enemy.id}/${enemy.id}.skel`);

    await PIXI.loader.load(async (loader, resources) => {
        appResources = resources;

        console.log('load enemy waves');
        await loadLevelWaves();

        tickSlider.max = maxTick;

        console.log(enemyArr);
        console.log('start');
        app.start();
        appFPS = app.ticker.FPS;
        skipUpdate = Math.round(appFPS / FPS);

        // Main loop
        app.ticker.add(delta => {
            if (++skipCount < skipUpdate) return;

            for (const enemy of enemyArr) {
                enemy.update(globalTick);
            }

            if (autoplay) {
                globalTick += 1;
                tickSlider.value = globalTick;
            } else {
                globalTick = parseInt(tickSlider.value);
            }
            skipCount = 0;
        });
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
            const gridTile = createGridTile(row[j].tileKey, i, j);
            gridArr.push(gridTile);
        }
    }
}

async function createAppStage() {
    app = new PIXI.Application({ width: (level.mapData.width + 2) * GRIDSIZE, height: (level.mapData.height + 2) * GRIDSIZE });
    document.body.appendChild(app.view);
    app.renderer.backgroundColor = BGCOLOUR;
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
                    enemyArr.push(enemy);
                    const enemyMaxTick = precalcTick + enemy.frameData.length;
                    maxTick = enemyMaxTick > maxTick ? enemyMaxTick : maxTick;
                }
                for (let i = 1; i < action.count; i++) {
                    precalcTick += action.interval * FPS;

                    if (action.actionType === 0) {
                        const enemy = await Enemy.create(precalcTick, action.key, action.routeIndex);
                        enemyArr.push(enemy);
                        const enemyMaxTick = precalcTick + enemy.frameData.length;
                        maxTick = enemyMaxTick > maxTick ? enemyMaxTick : maxTick;
                    }
                }

                precalcTick -= action.preDelay * FPS + action.interval * FPS * (action.count - 1);
            }
            const maxActionDelay = fragment.actions.reduce((prev, curr) => (prev.preDelay > curr.preDelay) ? prev.preDelay : curr.preDelay, 1)
            precalcTick += maxActionDelay * FPS;
        }
    }
    console.log(maxTick);
}

const BGCOLOUR = 0x101010;
const STARTCOLOUR = 0xe21818;
const ENDCOLOUR = 0x0c8aff;
const VOIDCOLOUR = 0x202020;
const ROADCOLOR = 0x484848;
const WALLCOLOUR = 0xa8a8a8;
const FLOORCOLOUR = 0xc08438;
const TUNNELCOLOUR = 0xeb9072;

function createGridTile(tileKey, i, j) {
    switch (tileKey) {
        default:
        case 'tile_forbidden': {
            const tile = new PIXI.Graphics().beginFill(VOIDCOLOUR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(1, 0x000000, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            return tile;
        }
        case 'tile_road': {
            const tile = new PIXI.Graphics().beginFill(ROADCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(1, 0x000000, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            return tile;
        }
        case 'tile_wall': {
            const tile = new PIXI.Graphics().beginFill(WALLCOLOUR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(1, 0x000000, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            return tile;
        }
        case 'tile_flystart':
        case 'tile_start': {
            const tile = new PIXI.Graphics().beginFill(STARTCOLOUR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(1, 0x000000, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            return tile;
        }
        case 'tile_end': {
            const tile = new PIXI.Graphics().beginFill(ENDCOLOUR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(1, 0x000000, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            return tile;
        }
        case 'tile_floor': {
            const tile = new PIXI.Graphics().beginFill(ROADCOLOR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .lineStyle(8, FLOORCOLOUR, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .lineStyle(1, 0x000000, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            return tile;
        }
        case 'tile_telin': {
            const tile = new PIXI.Graphics().beginFill(VOIDCOLOUR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .beginFill(TUNNELCOLOUR)
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
                    GRIDSIZE * (j + 29 / 16), GRIDSIZE * (i + 22 / 16),
                    GRIDSIZE * (j + 29 / 16), GRIDSIZE * (i + 25 / 16),
                    GRIDSIZE * (j + 26 / 16), GRIDSIZE * (i + 25 / 16),
                    GRIDSIZE * (j + 27 / 16), GRIDSIZE * (i + 24 / 16),
                    GRIDSIZE * (j + 23 / 16), GRIDSIZE * (i + 20 / 16),
                ])
                .endFill()
                .lineStyle(1, 0x000000, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            return tile;
        }
        case 'tile_telout': {
            const tile = new PIXI.Graphics().beginFill(VOIDCOLOUR)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
                .endFill()
                .beginFill(TUNNELCOLOUR)
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
                    GRIDSIZE * (j + 22 / 16), GRIDSIZE * (i + 19 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 19 / 16),
                    GRIDSIZE * (j + 25 / 16), GRIDSIZE * (i + 22 / 16),
                    GRIDSIZE * (j + 24 / 16), GRIDSIZE * (i + 21 / 16),
                    GRIDSIZE * (j + 20 / 16), GRIDSIZE * (i + 25 / 16),
                ])
                .endFill()
                .lineStyle(1, 0x000000, 1, 0)
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            return tile;
        }
    }
}

function gridToPos({ row, col }) {
    const x = GRIDSIZE * (1.5 + col);
    const y = GRIDSIZE * (0.9 + level.mapData.height - row);
    return { x, y };
}

main();