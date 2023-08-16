const levelDataPath = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/levels';
const spineDataPath = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';

const BGCOLOUR = 0x353540;
const ROADCOLOR = 0x454040;
const WALLCOLOUR = 0x858080;
const VOIDCOLOUR = 0x252020;
const STARTCOLOUR = 0xe21818;
const ENDCOLOUR = 0x0c8aff;
const FLOORCOLOUR = 0xb47e38;

const GRIDSIZE = 80;
const FPS = 60;
const MOVESPEED = 1;
const levelId = 'obt/main/level_main_00-11';

const Spine = PIXI.spine.Spine;

class FrameData {
    x;
    y;
    state;
}

function gridToPos({ row, col }) {
    const x = GRIDSIZE * (1.5 + col);
    const y = GRIDSIZE * (0.9 + level.mapData.height - row);
    return { x, y };
}

class Enemy {
    static enemyDataCache = {};
    static async create(startTick, enemyId, routeIndex) {
        let enemy;
        if (this.enemyDataCache[enemyId]) {
            enemy = this.enemyDataCache[enemyId];
        }
        else {
            const enemyRes = await fetch(`https://hellabotapi.cyclic.app/enemy/${enemyId}`);
            enemy = await enemyRes.json();
            this.enemyDataCache[enemyId] = enemy;
        }
        return new Enemy(startTick, enemy, enemyId, routeIndex);
    }
    constructor(startTick, enemy, enemyId, routeIndex) {
        this.startTick = startTick;
        this.enemy = enemy;
        this.route = routes[routeIndex];
        this.spine = new Spine(appResources[enemyId].spineData);
        this.state = 'start';
        this.generateFrameData();

        this.spine.x = gridToPos({ row: -1, col: -1 }).x;
        this.spine.y = gridToPos({ row: -1, col: -1 }).y;
        this.spine.scale.x = .3;
        this.spine.scale.y = .3;
    }
    generateFrameData() {
        this.frameData = [];
        let localTick = 0;
        const startPoint = this.route.startPosition;
        const endPoint = this.route.endPosition;
        const checkpoints = this.route.checkpoints;

        // Go to start position
        let currPos = gridToPos(startPoint);
        this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving' };

        // Go to each checkpoint
        for (const checkpoint of checkpoints) {
            switch (checkpoint.type) {
                case 0: { // Move
                    const checkPos = gridToPos(checkpoint.position);
                    while (currPos.x !== checkPos.x || currPos.y !== checkPos.y) {
                        // Check for overshoot
                        const distance = Math.sqrt(Math.pow((checkPos.x - currPos.x), 2) + Math.pow((checkPos.y - currPos.y), 2));
                        if (distance <= 1) {
                            currPos.x = checkPos.x;
                            currPos.y = checkPos.y;
                            break;
                        }
                        // Move currPos closer to checkPos
                        const angle = Math.atan2(checkPos.y - currPos.y, checkPos.x - currPos.x);
                        currPos.x += MOVESPEED * Math.cos(angle);
                        currPos.y += MOVESPEED * Math.sin(angle);
                        this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving' };
                        localTick++;
                    }
                    break;
                }
                case 1: { // Stay still
                    const idleTicks = checkpoint.time * 60;
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'idle' };
                    for (let i = 1; i < idleTicks; i++) {
                        this.frameData[localTick + i] = this.frameData[localTick];
                    }
                    localTick += idleTicks;
                    break;
                }
            }
        }

        // Go to end position
        const endPos = gridToPos(endPoint);
        while (currPos.x !== endPos.x || currPos.y !== endPos.y) {
            // Check for overshoot
            const distance = Math.sqrt(Math.pow((endPos.x - currPos.x), 2) + Math.pow((endPos.y - currPos.y), 2));
            if (distance <= 1) {
                currPos.x = endPos.x;
                currPos.y = endPos.y;
                break;
            }
            // Move currPos closer to endPos
            const angle = Math.atan2(endPos.y - currPos.y, endPos.x - currPos.x);
            currPos.x += MOVESPEED * Math.cos(angle);
            currPos.y += MOVESPEED * Math.sin(angle);
            this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving' };
            localTick++;
        }
    }
    update(currTick) {
        const localTick = currTick - this.startTick;

        if (localTick < 0)
            this.state = 'start';
        if (localTick >= this.frameData.length)
            this.state = 'end';

        if (localTick < 0 || localTick >= this.frameData.length)
            return;

        const currFrameData = this.frameData[localTick];
        this.spine.x = currFrameData.x;
        this.spine.y = currFrameData.y;

        if (this.state !== currFrameData.state) {
            this.state = currFrameData.state;
            switch (this.state) {
                case 'moving':
                    if (this.spine.state.data.skeletonData.findAnimation('Run_Loop'))
                        this.spine.state.setAnimation(0, 'Run_Loop', true);
                    else if (this.spine.state.data.skeletonData.findAnimation('Run'))
                        this.spine.state.setAnimation(0, 'Run', true);
                    else if (this.spine.state.data.skeletonData.findAnimation('Move_Loop'))
                        this.spine.state.setAnimation(0, 'Move_Loop', true);
                    else if (this.spine.state.data.skeletonData.findAnimation('Move'))
                        this.spine.state.setAnimation(0, 'Move', true);
                    break;
                case 'idle':
                    if (this.spine.state.data.skeletonData.findAnimation('Idle'))
                        this.spine.state.setAnimation(0, 'Idle', true);
                    break;
            }
        }
    }
}

let app;
let appResources;
let level;
let map;
let routes;
const gridArr = []
const enemyArr = [];

async function main() {
    console.log('load level data');
    // Load level data
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
            const gridSquare = new PIXI.Graphics()
                .beginFill(getTileColour(row[j].tileKey))
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            gridArr.push(gridSquare);
        }
    }

    // Create pixi app
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
    console.log('load enemy assets')
    for (const enemy of level.enemyDbRefs) {
        PIXI.loader.add(enemy.id, `${spineDataPath}/${enemy.id}/${enemy.id}.skel`);
    }

    await PIXI.loader.load(doStuff);
}

async function doStuff(loader, resources) {
    appResources = resources;
    console.log('load enemy waves');
    // Load enemy waves
    let precalcTick = 0;
    for (const wave of level.waves) {
        for (const fragment of wave.fragments) {
            precalcTick += fragment.preDelay * FPS;

            for (const action of fragment.actions) {
                precalcTick += action.preDelay * FPS;
                if (action.actionType === 0) {
                    const enemy = await Enemy.create(precalcTick, action.key, action.routeIndex);
                    enemyArr.push(enemy);
                }
                for (let i = 1; i < action.count; i++) {
                    precalcTick += action.interval * FPS;
                    if (action.actionType === 0) {
                        const enemy = await Enemy.create(precalcTick, action.key, action.routeIndex);
                        enemyArr.push(enemy);
                    }
                }
            }
        }
    }

    for (const enemy of enemyArr) {
        app.stage.addChild(enemy.spine);
    }

    console.log(enemyArr);
    console.log('start');
    app.start();
    app.ticker.add(delta => loop(delta));
}

let globalTick = 0;
function loop(delta) {
    for (const enemy of enemyArr) {
        enemy.update(globalTick);
    }
    globalTick += 2;
}

function getTileColour(tileKey) {
    switch (tileKey) {
        case 'tile_forbidden': {
            return VOIDCOLOUR;
        }
        case 'tile_road': {
            return ROADCOLOR;
        }
        case 'tile_wall': {
            return WALLCOLOUR;
        }
        case 'tile_flystart':
        case 'tile_start': {
            return STARTCOLOUR;
        }
        case 'tile_end': {
            return ENDCOLOUR;
        }
        case 'tile_floor': {
            return FLOORCOLOUR;
        }
    }
}

main();