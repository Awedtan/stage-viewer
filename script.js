const apiPath = 'https://hellabotapi.cyclic.app/enemy';
const assetPath = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';
const region = 'en_US';
const levelPath = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${region}/gamedata/levels`;
const levelTablePath = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${region}/gamedata/excel/stage_table.json`;
const zoneTablePath = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${region}/gamedata/excel/zone_table.json`;
const rogueTablePath = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${region}/gamedata/excel/roguelike_topic_table.json`;

// A* pathfinding algorithm: https://briangrinstead.com/blog/astar-search-algorithm-in-javascript/
function getBestPath(startTile, endTile) {
    const findPath = () => {
        const heuristic = tile => {
            // Manhattan distance
            const x = Math.abs(tile.position.col - endTile.position.col);
            const y = Math.abs(tile.position.row - endTile.position.row);
            return x + y;
        };
        const getNeighbours = tile => {
            let next = [];
            const row = tile.position.row;
            const col = tile.position.col;
            if (grid[row + 1] && grid[row + 1][col]) {
                grid[row + 1][col].diagCost = 1;
                next.push(grid[row + 1][col]);
            }
            // if (grid[row + 1] && grid[row + 1][col - 1]) {
            //     grid[row + 1][col - 1].diagCost = 1.5;
            //     next.push(grid[row + 1][col - 1]);
            // }
            if (grid[row] && grid[row][col - 1]) {
                grid[row][col - 1].diagCost = 1;
                next.push(grid[row][col - 1]);
            }
            // if (grid[row - 1] && grid[row - 1][col - 1]) {
            //     grid[row - 1][col - 1].diagCost = 1.5;
            //     next.push(grid[row - 1][col - 1]);
            // }
            if (grid[row - 1] && grid[row - 1][col]) {
                grid[row - 1][col].diagCost = 1;
                next.push(grid[row - 1][col]);
            }
            // if (grid[row - 1] && grid[row - 1][col + 1]) {
            //     grid[row - 1][col + 1].diagCost = 1.5;
            //     next.push(grid[row - 1][col + 1]);
            // }
            if (grid[row] && grid[row][col + 1]) {
                grid[row][col + 1].diagCost = 1;
                next.push(grid[row][col + 1]);
            }
            // if (grid[row + 1] && grid[row + 1][col + 1]) {
            //     grid[row + 1][col + 1].diagCost = 1.5;
            //     next.push(grid[row + 1][col + 1]);
            // }

            return next;
        }

        const grid = [];
        for (let i = 0; i < levelData.mapData.map.length; i++) {
            const row = [];
            for (let j = 0; j < levelData.mapData.map[i].length; j++) {
                row.push({
                    tile: new MapTile({ row: i, col: j }),
                    cost: 0,
                    heuristic: 0,
                    total: 0,
                    parent: null
                })
            }
            grid.push(row);
        }
        const start = grid[startTile.position.row][startTile.position.col];
        const openList = [start];
        const closedList = [];
        while (openList.length > 0) {
            openList.sort((a, b) => a.total - b.total);
            let curr = openList.shift();
            if (curr.tile.isEqual(endTile)) {
                const path = [curr];
                while (curr.parent) {
                    path.push(curr.parent);
                    curr = curr.parent;
                }
                return path.reverse();
            }
            closedList.push(curr);
            const neighbours = getNeighbours(curr.tile);
            for (const neighbour of neighbours) {
                if (closedList.find(e => e.tile.isEqual(neighbour.tile)) || !curr.tile.canMoveTo(neighbour.tile))
                    continue;

                let bestCost = false;
                const nCost = curr.cost + neighbour.diagCost;
                if (!openList.find(e => e.tile.isEqual(neighbour.tile))) {
                    bestCost = true;
                    neighbour.heuristic = heuristic(neighbour.tile);
                    openList.push(neighbour);
                }
                else if (nCost < neighbour.cost) {
                    bestCost = true;
                }
                if (bestCost) {
                    neighbour.parent = curr;
                    neighbour.cost = nCost;
                    neighbour.total = nCost + neighbour.heuristic;
                }
            }
        }
        return null;
    }

    const path = findPath();
    let farthest = path[0];
    const optimizedPath = [farthest];
    for (let i = 0; i < path.length; i++) {
        if (!farthest.tile.canMoveDirectTo(path[i].tile)) {
            optimizedPath.push(path[i - 1]);
            farthest = path[i - 1];
            i--;
        }
    }
    optimizedPath.push(path[path.length - 1]);
    return optimizedPath;
}

class MapTile {
    static impassables = ['tile_fence', 'tile_fence_bound', 'tile_forbidden', 'tile_hole'];
    constructor(position) {
        if (position.row < 0 || position.row >= levelData.mapData.map.length || position.col < 0 || position.col >= levelData.mapData.map[0].length)
            return null;

        this.position = position;
        this.data = levelData.mapData.tiles[levelData.mapData.map[levelData.mapData.map.length - position.row - 1][position.col]];
        this.access = 0;
        if (this.data.heightType === 1 || MapTile.impassables.includes(this.data.tileKey)) this.access = 9;
        else if (this.data.tileKey === 'tile_stairs') this.access = 1;
        else if (this.data.tileKey === 'tile_passable_wall' || this.data.tileKey === 'tile_passable_wall_forbidden') this.access = 2;
    }
    canMoveDirectTo(destTile) {
        if (this.isEqual(destTile))
            return true;
        const line = this.getIntersectedGridSquares(destTile);
        for (const point of line)
            if (!this.canMoveTo(new MapTile(point)))
                return false;
        return true;
    }
    getIntersectedGridSquares(destTile) {
        const lineAlgorithm = bool => {
            // Bresenham's line algorithm: https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
            const result = [];
            let x0 = this.position.row;
            let y0 = this.position.col;
            let x1 = destTile.position.row;
            let y1 = destTile.position.col;
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = (x0 < x1) ? 1 : -1;
            const sy = (y0 < y1) ? 1 : -1;
            let err = dx - dy;
            while (true) {
                result.push({ row: x0, col: y0 });
                if (x0 === x1 && y0 === y1)
                    break;
                const e2 = 2 * err;
                if (bool) {
                    if (e2 > -dy) {
                        err -= dy;
                        x0 += sx;
                    }
                    else if (e2 < dx) { // "Thick line": https://stackoverflow.com/questions/4381269/line-rasterisation-cover-all-pixels-regardless-of-line-gradient
                        err += dx;
                        y0 += sy;
                    }
                }
                else {
                    if (e2 < dx) {
                        err += dx;
                        y0 += sy;
                    }
                    else if (e2 > -dy) {
                        err -= dy;
                        x0 += sx;
                    }
                }
            }
            return result;
        }

        const a = lineAlgorithm(true); // Gotta do bresenham's twice to avoid cutting corners
        const b = lineAlgorithm(false);
        const c = [... new Set(a.concat(b))];
        return c;
    }
    canMoveTo(destTile) {
        return Math.abs(this.access - destTile.access) <= 1;
    }
    isEqual(tile) {
        return this.position.col === tile.position.col && this.position.row === tile.position.row;
    }
}

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

        this.generateFrameData();
    }
    generateFrameData() {
        const moveToCheckpoint = (currPos, movePos) => {
            const currTile = new MapTile(posToGrid(currPos));
            const moveTile = new MapTile(posToGrid(movePos));
            const bestPath = getBestPath(currTile, moveTile);

            for (const next of bestPath) {
                const nextPos = gridToPos(next.tile.position);
                while (currPos.x !== nextPos.x || currPos.y !== nextPos.y) {
                    // Check for overshoot
                    const distance = Math.sqrt(Math.pow((nextPos.x - currPos.x), 2) + Math.pow((nextPos.y - currPos.y), 2)); // Pythagoras
                    if (distance <= 1) {
                        currPos.x = nextPos.x;
                        currPos.y = nextPos.y;
                        break;
                    }
                    // Move currPos closer to nextPos
                    const angle = Math.atan2(nextPos.y - currPos.y, nextPos.x - currPos.x); // Angle relative to +x axis
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
        let prevCheckpoint;
        for (const checkpoint of checkpoints) {
            switch (checkpoint.type) {
                case 0: { // Move
                    const checkPos = gridToPos(checkpoint.position);
                    moveToCheckpoint(currPos, checkPos);
                    break;
                }
                case 1:
                case 3: { // Idle
                    const idleTicks = checkpoint.time * FPS;
                    const state = prevCheckpoint && prevCheckpoint.type === 5 ? 'disappear' : 'idle';
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: state };
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
            prevCheckpoint = checkpoint;
        }
        // Go to end position
        const endPos = gridToPos(endPoint);
        moveToCheckpoint(currPos, endPos);
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

const DEBUG = false;
const GRIDSIZE = 71;
const FPS = 60;
const BASESPEED = 0.65; // Arbitrary number

const typeDict = {};
const zoneDict = {};
const levelDict = {};

let loader = new PIXI.loaders.Loader();
let app;
let zoneId;
let levelId;
let levelData;
let levelRoutes;
let stageGridTiles;
let stageTick = 0;
let stageMaxTick = 0;
let skipCount = 0;
let autoplay = false;
let doubleSpeed = false;
let frameTime = Date.now(), sec = 0;

const elemArr = [
    [{}, 'play', 'click'],
    [{}, 'tick', 'input'],
    [{}, 'speed', 'click'],
    [{}, 'type', 'change'],
    [{}, 'zone', 'change'],
    [{}, 'level', 'change']
];

window.onload = async () => {
    await loadLevels();
    await loadUI();
    main();
}

async function loadLevels() {
    const zoneRes = await fetch(zoneTablePath);
    const zoneTable = await zoneRes.json();
    for (const zone of Object.values(zoneTable.zones)) {
        if (!typeDict[zone.type]) typeDict[zone.type] = [];
        typeDict[zone.type].push(zone);
        zoneDict[zone.zoneID] = zone;
    }

    const levelRes = await fetch(levelTablePath);
    const levelTable = await levelRes.json();
    for (const level of Object.values(levelTable.stages)) {
        levelDict[level.stageId] = level;
        if (!zoneDict[level.zoneId].levels) zoneDict[level.zoneId].levels = [];
        zoneDict[level.zoneId].levels.push(level);
    }

    const rogueRes = await fetch(rogueTablePath);
    const rogueTable = await rogueRes.json();
    for (const rogue of Object.values(rogueTable.topics)) {
        typeDict['ROGUELIKE'].push(rogue);
        zoneDict[rogue.id] = rogue;
        zoneDict[rogue.id].levels = [];
    }
    const rogueDetails = Object.values(rogueTable.details);
    for (let i = 0; i < rogueDetails.length; i++) {
        const rogueId = `rogue_${i + 1}`;
        for (const level of Object.values(rogueDetails[i].stages)) {
            levelDict[level.id] = level;
            zoneDict[rogueId].levels.push(level);
        }
    }
}

async function loadUI() {
    for (let i = 0; i < elemArr.length; i++) {
        elemArr[i][0] = document.getElementById(elemArr[i][1]);
        if (elemArr[i][2])
            elemArr[i][0].addEventListener(elemArr[i][2], () => elemEvent(elemArr[i][1]));
    }
    addOptions('type', Object.keys(typeDict));
    typeId = getElem('type').value;
    addOptions('zone', Object.values(typeDict[typeId]));
    zoneId = getElem('zone').value;
    addOptions('level', zoneDict[zoneId].levels);
    levelId = getElem('level').value;
}

function getElem(id) {
    return elemArr.find(e => e[1] === id)[0];
}

function addOptions(id, options) {
    let sort = false;
    let optionArr = [];
    switch (id) {
        case 'type': {
            for (const type of options) {
                const skipTypes = ['GUIDE', 'BRANCHLINE', 'SIDESTORY'];
                if (skipTypes.indexOf(type) !== -1) continue;
                const option = document.createElement('option');
                switch (type) {
                    case 'MAINLINE':
                        option.text = 'Main Theme';
                        break;
                    case 'WEEKLY':
                        option.text = 'Supplies';
                        break;
                    case 'CAMPAIGN':
                        option.text = 'Annihalation';
                        break;
                    case 'CLIMB_TOWER':
                        option.text = 'Stationary Security Service';
                        break;
                    case 'ROGUELIKE':
                        option.text = 'Integrated Strategies';
                        break;
                    case 'ACTIVITY':
                        option.text = 'Events';
                        break;
                }
                option.value = type;
                optionArr.push(option);
            }
            break;
        }
        case 'zone': {
            if (typeId === 'ROGUELIKE') {
                for (const zone of Object.values(typeDict[typeId])) {
                    if (!zone.levels) continue;
                    const option = document.createElement('option');
                    option.text = zone.name;
                    if (!option.text || option.text === 'null') option.text = zone.id;
                    option.value = zone.id;
                    optionArr.push(option);
                }
            }
            else {
                if (typeId === 'ACTIVITY') sort = true;
                for (const zone of Object.values(typeDict[typeId])) {
                    if (!zone.levels) continue;
                    const option = document.createElement('option');
                    option.text = zone.zoneNameSecond;
                    if (!option.text || option.text === 'null') option.text = zone.zoneID;
                    option.value = zone.zoneID;
                    optionArr.push(option);
                }
            }
            break;
        }
        case 'level': {
            for (const stage of options) {
                if (typeId !== 'ROGUELIKE' && !stage.levelId || stage.difficulty !== 'NORMAL') continue;
                const option = document.createElement('option');
                option.text = stage.code + ' ' + stage.name;
                if (!option.text || option.text === 'null') option.text = stage.stageId;
                option.value = stage.levelId.toLowerCase();
                optionArr.push(option);
            }
            break;
        }
    }
    if (sort) optionArr.sort((a, b) => a.text.localeCompare(b.text));
    for (const option of optionArr)
        getElem(id).add(option);
}

function removeOptions(id) {
    const elem = getElem(id);
    while (elem.options.length)
        elem.remove(0);
}

function elemEvent(id) {
    switch (id) {
        case 'play': {
            autoplay = !autoplay;
            if (autoplay) {
                getElem('play').innerText = 'Pause';
            } else {
                getElem('play').innerText = 'Play';
            }
            break;
        }
        case 'tick': {
            stageTick = parseInt(getElem('tick').value);
            break;
        }
        case 'speed': {
            doubleSpeed = !doubleSpeed;
            if (doubleSpeed) {
                getElem('speed').innerText = '2x Speed!';
            } else {
                getElem('speed').innerText = '1x Speed';
            }
            break;
        }
        case 'type': {
            typeId = getElem('type').value;
            removeOptions('zone');
            addOptions('zone', Object.values(typeDict[typeId]));
        }
        case 'zone': {
            zoneId = getElem('zone').value;
            removeOptions('level');
            addOptions('level', zoneDict[zoneId].levels);
        }
        case 'level': {
            levelId = getElem('level').value;
            if (autoplay) elemEvent('play');

            console.log(typeId);
            console.log(levelId);
            console.log(zoneId);

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
            getElem('tick').value = 0;
            main();
            break;
        }
    }
}

async function main() {
    for (let i = 0; i < elemArr.length; i++)
        elemArr[i][0].disabled = true;

    if (DEBUG) console.log('load level data');
    await loadLevelData();
    if (DEBUG) console.log('load enemy data');
    await loadEnemyData();
    if (DEBUG) console.log('create app stage');
    await createAppStage();
    if (DEBUG) console.log('load enemy assets')
    await loadEnemyAssets();
    await loader.load(async (loader, resources) => {
        await sleep(1000);
        for (const key of Object.keys(resources)) {
            if (Enemy.assetCache[key]) continue;
            Enemy.assetCache[key] = resources[key];
        }

        if (DEBUG) console.log('load enemy waves');
        await loadLevelWaves();

        if (DEBUG) {
            console.log(levelData);
            console.log(stageGridTiles);
            console.log(stageMaxTick);
            console.log(Enemy.levelArray);
            console.log('start');
        }
        app.start();
        app.ticker.add(loop); // Main loop
        for (let i = 0; i < elemArr.length; i++)
            elemArr[i][0].disabled = false;
        getElem('tick').max = stageMaxTick;
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
                stageMaxTick = enemyMaxTick > stageMaxTick ? enemyMaxTick : stageMaxTick; // Keep track of how long the level takes with stageMaxTick
                if (!action.dontBlockWave) {
                    waveBlockTick = enemyMaxTick > waveBlockTick ? enemyMaxTick : waveBlockTick; // Only update waveBlockTick if the enemy is blocking
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
                if (action.actionType === 0 && action.key !== '') {
                    await createEnemy(precalcTick, action);
                    // return;
                }
                for (let i = 1; i < action.count; i++) {
                    precalcTick += action.interval * FPS;
                    if (action.actionType === 0 && action.key !== '') {
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
    const loop = doubleSpeed ? 2 : 1;
    for (let i = 0; i < loop; i++) {
        if (autoplay) {
            if (stageTick >= stageMaxTick) {
                elemEvent('play');
            }
            stageTick += 1;
            getElem('tick').value = stageTick;
            if (++sec >= 120) {
                const now = Date.now()
                if (DEBUG) console.log(now - frameTime)
                frameTime = now;
                sec = 0;
            }
        } else {
            stageTick = parseInt(getElem('tick').value);
        }
        for (const enemy of Enemy.levelArray) {
            enemy.update(stageTick);
        }
    }
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
    let defaultColor;
    if (heightType === 0) defaultColor = ROADCOLOR;
    else if (heightType === 1) defaultColor = WALLCOLOR;
    else defaultColor = VOIDCOLOR;
    let tile = new PIXI.Graphics().beginFill(defaultColor)
        .drawRect(GRIDSIZE * (j + 1), GRIDSIZE * (i + 1), GRIDSIZE, GRIDSIZE)
        .endFill();

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
        case 'tile_passable_wall':
        case 'tile_passable_wall_forbidden':
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
                .beginFill(defaultColor)
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

function posToGrid({ x, y }) {
    const col = Math.floor(x / GRIDSIZE - 1.5);
    const row = levelData.mapData.height - Math.floor(y / GRIDSIZE - 0.5);
    return { row, col };
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}