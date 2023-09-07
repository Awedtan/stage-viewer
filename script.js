class Path {
    static api = 'https://hellabotapi.cyclic.app/enemy';
    // static assets = 'https://raw.githubusercontent.com/Awedtan/HellaBot-Assets/main/spine/enemy';
    static assets = 'https://raw.githubusercontent.com/isHarryh/Ark-Models/main/models_enemies';
    static region = 'en_US';
    static levels = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/levels`;
    static levelTable = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/excel/stage_table.json`;
    static zoneTable = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/excel/zone_table.json`;
    static rogueTable = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/excel/roguelike_topic_table.json`;
}

class G {
    static typeDict = {};
    static zoneDict = {};
    static levelDict = {};

    static loader = new PIXI.loaders.Loader();
    static app;
    static typeId;
    static zoneId;
    static levelId;
    static levelData;
    static levelRoutes;
    static stageDrawTiles;

    static stageTick = 0;
    static stageMaxTick = 0;
    static skipCount = 0;
    static autoplay = false;
    static doubleSpeed = false;
    static frameTime = Date.now()
    static sec = 0;

    static enemyScale = 0.2;
    static gridSize = 71;
    static fps = 60;
    static baseSpeed = 0.65; // Arbitrary number
    static variantReg = /_[^0-9]$/;
}

class Elem {
    static arr = [
        [{}, 'play', 'click'],
        [{}, 'tick', 'input'],
        [{}, 'speed', 'click'],
        [{}, 'type', 'change'],
        [{}, 'zone', 'change'],
        [{}, 'level', 'change']
    ]
    static get(id) {
        return Elem.arr.find(e => e[1] === id)[0];
    }
    static addOptions(id, options) {
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
                if (G.typeId === 'ROGUELIKE') {
                    for (const zone of Object.values(G.typeDict[G.typeId])) {
                        if (!zone.levels) continue;
                        const option = document.createElement('option');
                        option.text = zone.name;
                        if (!option.text || option.text === 'null') option.text = zone.id;
                        option.value = zone.id;
                        optionArr.push(option);
                    }
                }
                else {
                    if (G.typeId === 'ACTIVITY') sort = true;
                    for (const zone of Object.values(G.typeDict[G.typeId])) {
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
                    // Skip all non-normal difficulty stages, roguelike stages are exempted
                    if (!stage.levelId || stage.difficulty !== 'NORMAL' || !['NONE', 'ALL', 'NORMAL'].includes(stage.diffGroup))
                        if (G.typeId !== 'ROGUELIKE') continue;
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
            Elem.get(id).add(option);
    }
    static removeOptions(id) {
        const elem = Elem.get(id);
        while (elem.options.length)
            elem.remove(0);
    }
    static event(id) {
        switch (id) {
            case 'play': {
                G.autoplay = !G.autoplay;
                if (G.autoplay)
                    Elem.get('play').innerText = 'Pause';
                else
                    Elem.get('play').innerText = 'Play';
                break;
            }
            case 'tick': {
                G.stageTick = parseInt(Elem.get('tick').value);
                break;
            }
            case 'speed': {
                G.doubleSpeed = !G.doubleSpeed;
                if (G.doubleSpeed)
                    Elem.get('speed').innerText = '2x Speed!';
                else
                    Elem.get('speed').innerText = '1x Speed';
                break;
            }
            case 'type': {
                G.typeId = Elem.get('type').value;
                Elem.removeOptions('zone');
                Elem.addOptions('zone', Object.values(G.typeDict[G.typeId]));
            }
            case 'zone': {
                G.zoneId = Elem.get('zone').value;
                Elem.removeOptions('level');
                Elem.addOptions('level', G.zoneDict[G.zoneId].levels);
            }
            case 'level': {
                G.levelId = Elem.get('level').value;
                if (G.autoplay) Elem.event('play');

                console.log(G.typeId);
                console.log(G.levelId);
                console.log(G.zoneId);

                Enemy.levelArray = null;
                Enemy.errorArray = null;
                G.app.destroy(true, { children: true, texture: false, baseTexture: false });
                G.app = null;
                G.levelData = null;
                G.levelRoutes = null;
                G.stageDrawTiles = null;
                G.stageTick = 0;
                G.stageMaxTick = 0;
                G.skipCount = 0;
                Elem.get('tick').value = 0;
                main();
                break;
            }
        }
    }
}

class Enemy {
    static levelArray;
    static errorArray;
    static dataCache;
    static assetCache;
    static selectedRoute;
    static async loadData(recache) {
        if (!Enemy.dataCache || recache) {
            Enemy.dataCache = {};
            const enemyRes = await fetch(Path.api);
            const data = await enemyRes.json();
            for (const obj of data) {
                Enemy.dataCache[obj.keys[0]] = obj;
            }
        }
    }
    static async loadAssets(recache) {
        if (!Enemy.assetCache || recache)
            Enemy.assetCache = {};
        const urlExists = async url => (await fetch(url)).status === 200;
        for (const enemyRef of G.levelData.enemyDbRefs) {
            if (Enemy.assetCache[enemyRef.id]) continue; // Skip enemy if assets already loaded
            try {
                const folderName = enemyRef.id.split('enemy_').join('');
                let spinePath = Path.assets + `/${folderName}/${enemyRef.id}`;
                if (await urlExists(Path.assets + `/${folderName}/${enemyRef.id}` + '.skel')) { } // Keep original path
                else if (await urlExists(Path.assets + `/${folderName}/${enemyRef.id.split('_2').join('')}` + '.skel')) // Check for inconsistent filenames
                    spinePath = Path.assets + `/${folderName}/${enemyRef.id.split('_2').join('')}`;
                else if (await urlExists(Path.assets + `/${folderName}/${enemyRef.id}`.split('sbr').join('sabr') + '.skel'))
                    spinePath = Path.assets + `/${folderName}/${enemyRef.id}`.split('sbr').join('sabr');
                else if (await urlExists(Path.assets + `/${folderName}/${enemyRef.id.split('_2').join('')}`.split('sbr').join('sabr') + '.skel'))
                    spinePath = Path.assets + `/${folderName}/${enemyRef.id.split('_2').join('')}`.split('sbr').join('sabr');
                else if (await urlExists(Path.assets + `/${folderName.split(G.variantReg).join('')}/${enemyRef.id.split(G.variantReg).join('')}` + '.skel'))
                    spinePath = Path.assets + `/${folderName.split(G.variantReg).join('')}/${enemyRef.id.split(G.variantReg).join('')}`;
                else
                    throw new Error('Skel file couldn\'t be found');

                G.loader.add(enemyRef.id, spinePath + '.skel');
            } catch (e) {
                console.error(e + (': ') + enemyRef.id);
            }
        }
    }
    constructor(startTick, enemyId, routeIndex) {
        this.startTick = startTick;
        this.enemyId = enemyId;
        this.data = Enemy.dataCache[enemyId];
        if (!this.data)
            this.data = Enemy.dataCache[enemyId.split(G.variantReg).join('')];
        this.routeIndex = routeIndex;
        this.route = G.levelRoutes[routeIndex];
        this.spine = new PIXI.spine.Spine(Enemy.assetCache[enemyId].spineData);
        this.state = 'waiting';
        this.frameData = [];
        // x: number, 
        // y: number, 
        // state: ['waiting', 'start', 'idle', 'moving', 'disappear', 'reappear', 'end'], 
        // direction: ['left', 'right'] | false

        G.app.stage.addChild(this.spine);
        this.spine.skeleton.setSkin(this.spine.state.data.skeletonData.skins[0]);
        this.spine.x = gridToPos({ row: -1, col: -1 }).x;
        this.spine.y = gridToPos({ row: -1, col: -1 }).y;
        this.spine.scale.x = G.enemyScale;
        this.spine.scale.y = G.enemyScale;
        this.spine.interactive = true;
        this.spine.on('click', event => { // Draw route lines on click
            G.app.stage.removeChild(Enemy.selectedRoute);
            const yOffset = G.gridSize * 0.2;
            Enemy.selectedRoute = new PIXI.Graphics()
                .lineStyle(4, 0xcc0000)
                .moveTo(this.frameData[0].x, this.frameData[0].y - yOffset);
            for (let i = 1; i < this.frameData.length; i += 2) {
                if (this.frameData[i].state === 'reappear')
                    Enemy.selectedRoute.moveTo(this.frameData[i].x, this.frameData[i].y - yOffset);
                else
                    Enemy.selectedRoute.lineTo(this.frameData[i].x, this.frameData[i].y - yOffset);
            }
            G.app.stage.addChild(Enemy.selectedRoute);
        });
        this.generateFrameData();
    }
    generateFrameData() {
        const moveToCheckpoint = (currPos, movePos) => {
            const currTile = new MapTile(posToGrid(currPos));
            const moveTile = new MapTile(posToGrid(movePos));
            const bestPath = getBestPath(currTile, moveTile);

            for (let i = 1; i < bestPath.length; i++) {
                const next = bestPath[i];
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
        const localSpeed = dataSpeed * G.baseSpeed;
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
                    const idleTicks = checkpoint.time * G.fps;
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
            G.app.stage.removeChild(this.spine);
            return;
        }
        if (localTick === 0) {
            this.state = 'start';
            G.app.stage.addChild(this.spine);
        }
        if (localTick >= this.frameData.length) {
            this.state = 'end';
            G.app.stage.removeChild(this.spine);
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
                    G.app.stage.addChild(this.spine);
                    const bestMatch = getBestMatch('run_loop', 'run', 'move_loop', 'move');
                    const bestAnim = skeletonData.animations[bestMatch.bestMatchIndex];
                    this.spine.state.setAnimation(0, bestAnim.name, true);
                    break;
                }
                case 'idle': {
                    G.app.stage.addChild(this.spine);
                    const bestMatch = getBestMatch('idle_loop', 'idle');
                    const bestAnim = skeletonData.animations[bestMatch.bestMatchIndex];
                    this.spine.state.setAnimation(0, bestAnim.name, true);
                    break;
                }
                case 'disappear': {
                    G.app.stage.removeChild(this.spine);
                    break;
                }
                case 'reappear': {
                    G.app.stage.addChild(this.spine);
                    break;
                }
            }
            this.state = currFrameData.state;
        }
        if (currFrameData.direction) {
            if (currFrameData.direction === 'right') {
                this.spine.scale.x = G.enemyScale;
            }
            else if (currFrameData.direction === 'left') {
                this.spine.scale.x = -G.enemyScale;
            }
        }
    }
}

class MapTile {
    static impassables = ['tile_fence', 'tile_fence_bound', 'tile_forbidden', 'tile_hole'];
    constructor(position) {
        if (position.row < 0 || position.row >= G.levelData.mapData.map.length || position.col < 0 || position.col >= G.levelData.mapData.map[0].length)
            return null;

        this.position = position;
        this.data = G.levelData.mapData.tiles[G.levelData.mapData.map[G.levelData.mapData.map.length - position.row - 1][position.col]];
        this.access = 0; // Tiles are accessible if their access values are within 1 of each other
        if (this.data.heightType === 1 || MapTile.impassables.includes(this.data.tileKey)) this.access = 9;
        else if (this.data.tileKey === 'tile_stairs') this.access = 1;
        else if (this.data.tileKey === 'tile_passable_wall' || this.data.tileKey === 'tile_passable_wall_forbidden') this.access = 2;
    }
    canAccess(destTile) {
        return Math.abs(this.access - destTile.access) <= 1;
    }
    canMoveDirectTo(destTile) {
        if (this.isEqual(destTile))
            return true;
        const line = this.getLineIntersectionTo(destTile);
        for (let i = 0; i < line.length; i++) {
            const point = line[i];
            if (!this.canAccess(new MapTile(point))) {
                return false;
            }
            for (let j = i; j >= 0; j--) {
                if (!new MapTile(line[j]).canAccess(new MapTile(line[i])))
                    return false;
            }
        }
        return true;
    }
    getLineIntersectionTo(destTile) {
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
    isEqual(tile) {
        return this.position.col === tile.position.col && this.position.row === tile.position.row;
    }
    toPos() {
        return gridToPos(this.position);
    }
}

function getBestPath(startTile, endTile) {
    if (startTile.canMoveDirectTo(endTile))
        return [{ tile: startTile }, { tile: endTile }];

    // A* pathfinding algorithm: https://briangrinstead.com/blog/astar-search-algorithm-in-javascript/
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
        for (let i = 0; i < G.levelData.mapData.map.length; i++) {
            const row = [];
            for (let j = 0; j < G.levelData.mapData.map[i].length; j++) {
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
                if (closedList.find(e => e.tile.isEqual(neighbour.tile)) || !curr.tile.canAccess(neighbour.tile))
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

async function loadLevels() {
    const zoneRes = await fetch(Path.zoneTable);
    const zoneTable = await zoneRes.json();
    for (const zone of Object.values(zoneTable.zones)) {
        if (!G.typeDict[zone.type]) G.typeDict[zone.type] = [];
        G.typeDict[zone.type].push(zone);
        G.zoneDict[zone.zoneID] = zone;
    }
    const levelRes = await fetch(Path.levelTable);
    const levelTable = await levelRes.json();
    for (const level of Object.values(levelTable.stages)) {
        G.levelDict[level.stageId] = level;
        if (!G.zoneDict[level.zoneId].levels) G.zoneDict[level.zoneId].levels = [];
        G.zoneDict[level.zoneId].levels.push(level);
    }
    const rogueRes = await fetch(Path.rogueTable);
    const rogueTable = await rogueRes.json();
    for (const rogue of Object.values(rogueTable.topics)) {
        G.typeDict['ROGUELIKE'].push(rogue);
        G.zoneDict[rogue.id] = rogue;
        G.zoneDict[rogue.id].levels = [];
    }
    const rogueDetails = Object.values(rogueTable.details);
    for (let i = 0; i < rogueDetails.length; i++) {
        const rogueId = `rogue_${i + 1}`;
        for (const level of Object.values(rogueDetails[i].stages)) {
            G.levelDict[level.id] = level;
            G.zoneDict[rogueId].levels.push(level);
        }
    }
}

async function loadUI() {
    for (let i = 0; i < Elem.arr.length; i++) {
        Elem.arr[i][0] = document.getElementById(Elem.arr[i][1]);
        if (Elem.arr[i][2])
            Elem.arr[i][0].addEventListener(Elem.arr[i][2], () => Elem.event(Elem.arr[i][1]));
    }
    Elem.addOptions('type', Object.keys(G.typeDict));
    G.typeId = Elem.get('type').value;
    Elem.addOptions('zone', Object.values(G.typeDict[G.typeId]));
    G.zoneId = Elem.get('zone').value;
    Elem.addOptions('level', G.zoneDict[G.zoneId].levels);
    G.levelId = Elem.get('level').value;
}

async function main() {
    for (let i = 0; i < Elem.arr.length; i++)
        Elem.arr[i][0].disabled = true;

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
        for (let i = 0; i < Elem.arr.length; i++)
            Elem.arr[i][0].disabled = false;
        Elem.get('tick').max = G.stageMaxTick;
    });
}

async function loadLevelData() {
    G.stageDrawTiles = [];
    const levelRes = await fetch(`${Path.levels}/${G.levelId}.json`);
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
    G.app.renderer.view.style.position = 'absolute';
    G.app.renderer.view.style.left = '50%';
    G.app.renderer.view.style.top = '50%';
    G.app.renderer.view.style.transform = 'translate3d( -50%, -50%, 0 )';
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