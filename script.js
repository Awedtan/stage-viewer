const levelDataPath = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/levels';
const spineDataPath = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';
const BGCOLOUR = 0x353540;
const ROADCOLOR = 0x454040;
const WALLCOLOUR = 0x858080;
const VOIDCOLOUR = 0x252020;
const STARTCOLOUR = 0xe21818;
const ENDCOLOUR = 0x0c8aff;
const GRIDSIZE = 80;

const Spine = PIXI.spine.Spine;

class Enemy {
    static async create(enemyId, routeIndex) {
        const enemyRes = await fetch(`https://hellabotapi.cyclic.app/enemy/${enemyId}`)
        const enemy = await enemyRes.json();

        return new Enemy(enemy, enemyId, routeIndex);
    }
    constructor(enemy, enemyId, routeIndex) {
        this.enemy = enemy;
        this.route = routes[routeIndex];
        this.spine = new Spine(appResources[enemyId].spineData);
    }
}

let app;
let appResources;

let level;
let map;
let routes;

async function main() {
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

    app = new PIXI.Application({ width: (level.mapData.width + 2) * GRIDSIZE, height: (level.mapData.height + 2) * GRIDSIZE });
    document.body.appendChild(app.view);
    app.renderer.backgroundColor = BGCOLOUR;
    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.left = '50%';
    app.renderer.view.style.top = '50%';
    app.renderer.view.style.transform = 'translate3d( -50%, -50%, 0 )';

    for (let i = 0; i < map.length; i++) {
        const row = map[i];
        for (let j = 0; j < row.length; j++) {
            const gridSquare = new PIXI.Graphics()
                .beginFill(getTileColour(row[j].tileKey))
                .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE);
            app.stage.addChild(gridSquare);
        }
    }

    for (const enemy of level.enemyDbRefs) {
        PIXI.loader.add(enemy.id, `${spineDataPath}/${enemy.id}/${enemy.id}.skel`);
    }

    PIXI.loader.load(doStuff);
}

async function spawnEnemy(enemyId, routeIndex) {
    const enemy = await Enemy.create(enemyId, routeIndex);
    app.stage.addChild(enemy.spine);
    enemy.spine.state.setAnimation(0, 'Move_Loop', true);
    enemy.spine.x = Math.random() * 500;
    enemy.spine.y = Math.random() * 500;
    enemy.spine.scale.x = .3;
    enemy.spine.scale.y = .3;
}

async function doStuff(loader, resources) {
    app.start();
    appResources = resources;

    let currActions = 0;
    let doneActions = 0;
    let totalActions = 0;
    for (const fragment of level.waves[0].fragments) {
        currActions = 0;
        doneActions = 0;
        totalActions = fragment.actions.length;
        await sleep(fragment.preDelay);

        for (const action of fragment.actions) {
            currActions++;
            await sleep(action.preDelay);

            if (action.actionType === 0) {
                console.log(action.key);
                await spawnEnemy(action.key, action.routeIndex);

                for (let i = 1; i < action.count; i++) {
                    await sleep(action.interval);
                    console.log(action.key);
                    const spine = new Spine(resources[action.key].spineData);
                    spine.state.setAnimation(0, 'Move_Loop', true);
                    app.stage.addChild(spine);
                    app.start();
                    spine.x = Math.random() * 500;
                    spine.y = Math.random() * 500;
                    spine.scale.x = .3;
                    spine.scale.y = .3;
                }
            }

            currActions--;
            doneActions++;
        }
        while (doneActions != totalActions) await sleep(0.01);
    }
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

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms * 1000 * 0.5);
    });
}

main();