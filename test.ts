import level from './level_main_00-01.json';

const SLOWADJUST = 1.0;
const SPEED = 0.5 * SLOWADJUST;

const start = Date.now();

let currActions = 0;
let doneActions = 0;
let totalActions = 0;

async function main() {
    for (const fragment of level.waves[0].fragments) {
        currActions = 0;
        doneActions = 0;
        totalActions = fragment.actions.length;

        await sleep(fragment.preDelay);
        for (const action of fragment.actions)
            waitAndPrint(action);
        while (doneActions != totalActions) await sleep(0.01);
    }

    console.log(Date.now() - start);
}

async function main2() {
    const map = [];
    level.mapData.map.forEach(mapRow => {
        const row = mapRow.map(tile => level.mapData.tiles[tile]);
        map.push(row);
    });
    console.log(map);
}

async function waitAndPrint(action) {
    currActions++;
    await sleep(action.preDelay);
    console.log(action.actionType + ' ' + action.key);
    for (let i = 1; i < action.count; i++) {
        await sleep(action.interval);
        console.log(action.actionType + ' ' + action.key);
    }
    currActions--;
    doneActions++;
}

async function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms * 1000 * SPEED);
    });
}

main2();