const levelDataPath = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/levels';
const spineDataPath = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';

const BGCOLOUR = 0x353540;
const ROADCOLOR = 0x454040;
const WALLCOLOUR = 0x858080;
const VOIDCOLOUR = 0x252020;
const STARTCOLOUR = 0xe21818;
const ENDCOLOUR = 0x0c8aff;
const FLOORCOLOUR = 0xb47e38;
const TUNNELCOLOUR = 0xeb9072;

const GRIDSIZE = 80;
const FPS = 60;
const MOVESPEED = 0.65;
const levelId = 'obt/main/level_main_04-01';

let app;
let appResources;
let appFPS;
let skipUpdate;
let level;
let map;
let routes;
const gridArr = []
const enemyArr = [];
let globalTick = 0;
let skipCount = 0;
let gameSpeed = 1;

function gridToPos({ row, col }) {
    const x = GRIDSIZE * (1.5 + col);
    const y = GRIDSIZE * (0.9 + level.mapData.height - row);
    return { x, y };
}

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
                currPos.x += localSpeed * Math.cos(angle);
                currPos.y += localSpeed * Math.sin(angle);
                this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving' };
                localTick++;
            }
        }

        // Go to start position
        let currPos = gridToPos(startPoint);
        this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving' };

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

        if (localTick === 0) {
            this.state = 'start';
            Enemy.startCount++;
            console.log(`spawn ${this.data.keys[0]} ` + Enemy.startCount + '/' + enemyArr.length);
            app.stage.addChild(this.spine);
        }
        if (localTick === this.frameData.length) {
            this.state = 'end';
            app.stage.removeChild(this.spine);
            Enemy.endCount++;
            if (Enemy.endCount === enemyArr.length) console.log('end done');
        }
        if (localTick < 0 || localTick >= this.frameData.length)
            return;

        const currFrameData = this.frameData[localTick];
        this.spine.x = currFrameData.x;
        this.spine.y = currFrameData.y;

        if (this.state !== currFrameData.state) {
            switch (currFrameData.state) {
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
                case 'disappear':
                    app.stage.removeChild(this.spine);
                    break;
                case 'reappear':
                    app.stage.addChild(this.spine);
                    break;
            }
            this.state = currFrameData.state;
        }
    }
}

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
    console.log(appResources);
    console.log('load enemy waves');
    // Load enemy waves
    let precalcTick = 0, maxTick = 0;
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

                maxTick = precalcTick > maxTick ? precalcTick : maxTick;

                precalcTick -= action.preDelay * FPS + action.interval * FPS * (action.count - 1);
            }
            const maxActionDelay = fragment.actions.reduce((prev, curr) => (prev.preDelay > curr.preDelay) ? prev.preDelay : curr.preDelay, 1)
            precalcTick += maxActionDelay * FPS;
        }
    }
    console.log(maxTick);

    console.log(enemyArr);
    console.log('start');
    app.start();
    app.ticker.add(delta => loop(delta));
    appFPS = app.ticker.FPS;
    skipUpdate = Math.round(appFPS / FPS);

}

function loop(delta) {
    if (++skipCount < skipUpdate / gameSpeed) return;

    for (const enemy of enemyArr) {
        if (enemy.state === 'end') continue;

        enemy.update(globalTick);
    }
    globalTick += 1;
    skipCount = 0;
}

function getTileColour(tileKey) {
    switch (tileKey) {
        case 'tile_forbidden':
            return VOIDCOLOUR;
        case 'tile_road':
            return ROADCOLOR;
        case 'tile_wall':
            return WALLCOLOUR;
        case 'tile_flystart':
        case 'tile_start':
            return STARTCOLOUR;
        case 'tile_end':
            return ENDCOLOUR;
        case 'tile_floor':
            return FLOORCOLOUR;
        case 'tile_telin':
        case 'tile_telout':
            return TUNNELCOLOUR;
    }
}

main();