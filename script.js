const levelDataPath = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/levels';
const spineDataPath = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';
const BGCOLOUR = 0x353540;
const ROADCOLOR = 0x454040;
const WALLCOLOUR = 0x858080;
const VOIDCOLOUR = 0x252020;
const STARTCOLOUR = 0xe21818;
const ENDCOLOUR = 0x0c8aff;
const GRIDSIZE = 80;
const FPS = 60;
const MOVESPEED = 4;

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
    static async create(startTick, enemyId, routeIndex) {
        const enemyRes = await fetch(`https://hellabotapi.cyclic.app/enemy/${enemyId}`)
        const enemy = await enemyRes.json();

        return new Enemy(startTick, enemy, enemyId, routeIndex);
    }
    constructor(startTick, enemy, enemyId, routeIndex) {
        this.startTick = startTick;
        this.enemy = enemy;
        this.route = routes[routeIndex];
        this.spine = new Spine(appResources[enemyId].spineData);
        this.generateFrameData();

        this.spine.state.setAnimation(0, 'Move_Loop', true);
        this.spine.x = gridToPos({ row: 2, col: 8 }).x;
        this.spine.y = gridToPos({ row: 2, col: 8 }).y;
        this.spine.scale.x = .3;
        this.spine.scale.y = .3;
    }
    generateFrameData() {
        this.frameData = [];
        let localTick = 0;

        const checkpointArr = [];
        checkpointArr.push(this.route.startPosition);
        for (const checkpoint of this.route.checkpoints)
            checkpointArr.push(checkpoint.position);
        checkpointArr.push(this.route.endPosition);

        let currPos = gridToPos(checkpointArr[0]);
        this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving' };

        for (const checkpoint of checkpointArr) {
            console.log('checkpiont!')
            const checkPos = gridToPos(checkpoint)
            while (currPos.x !== checkPos.x && currPos.y !== checkPos.y) {
                // Check for overshoot
                const distance = Math.sqrt(Math.pow((checkPos.x - currPos.x), 2) + Math.pow((checkPos.y - currPos.y),2));
                if (distance <= MOVESPEED) {
                    currPos.x = checkPos.x;
                    currPos.y = checkPos.y;
                    break;
                }
                // Move currPos closer to checkPos
                const angle = Math.atan2((checkPos.y - currPos.y), (checkPos.x - currPos.x));
                const move = { x: MOVESPEED * Math.cos(angle), y: MOVESPEED * Math.sin(angle) };
                currPos.x += move.x;
                currPos.y += move.y;
                this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving' };
                localTick++;

                console.log(checkPos);
                console.log(currPos);
                console.log(move);
                console.log(angle);
                console.log(distance);
                if (localTick >= 200) return;
            }
        }
    }
    update(currTick) {
        const currFrameData = this.frameData[currTick];
        this.spine.x = currFrameData.x;
        this.spine.y = currFrameData.y;

        switch (currFrameData.state) {
            case 'moving':
                this.spine.state.setAnimation(0, 'Move_Loop', true);
                break;
            case 'idle':
                this.spine.state.setAnimation(0, 'Idle', true);
                break;
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
    // Load level data
    const levelId = 'obt/main/level_main_00-01';
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
    for (const enemy of level.enemyDbRefs) {
        PIXI.loader.add(enemy.id, `${spineDataPath}/${enemy.id}/${enemy.id}.skel`);
    }

    await PIXI.loader.load(doStuff);
}

async function doStuff(loader, resources) {
    appResources = resources;

    // Load enemy waves
    let precalcTick = 0;
    for (const fragment of level.waves[0].fragments) {
        precalcTick += fragment.preDelay * FPS;

        for (const action of fragment.actions) {
            precalcTick += action.preDelay * FPS;
            if (action.actionType === 0) {
                const enemy = await Enemy.create(precalcTick, action.key, action.routeIndex);
                return;
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

    for (const enemy of enemyArr) {
        app.stage.addChild(enemy.spine);
    }

    console.log(enemyArr);
    app.start();
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
    }
}

main();