class Path {
    static api = 'https://hellabotapi.cyclic.app/enemy';
    static assets = 'https://raw.githubusercontent.com/isHarryh/Ark-Models/main/models_enemies';
    static region = 'en_US';
    static levels = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/levels`;
    static levelTable = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/excel/stage_table.json`;
    static zoneTable = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/excel/zone_table.json`;
    static rogueTable = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/excel/roguelike_topic_table.json`;
    static sandboxTable = `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/${Path.region}/gamedata/excel/sandbox_table.json`;
}

class G {
    static type = {};
    static zone = {};
    static level = {};

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
    static variantReg = /_[^_]?[^0-9|_]+$/;
}

class Elem {
    static _arr = [
        [{}, 'play', 'click'],
        [{}, 'tick', 'input'],
        [{}, 'speed', 'click'],
        [{}, 'type', 'change'],
        [{}, 'zone', 'change'],
        [{}, 'level', 'change']
    ]
    static get(id) {
        return this._arr.find(e => e[1] === id)[0];
    }
    static getAll() {
        return this._arr;
    }
    static updateOptions(id) {
        const elem = Elem.get(id);
        while (elem.options.length) elem.remove(0);
        const optionArr = [];
        switch (id) {
            case 'type': {
                for (const type of Type.getAll()) {
                    const skipTypes = ['guide', 'branchline', 'sidestory'];
                    if (skipTypes.indexOf(type.id) !== -1) continue;
                    const option = document.createElement('option');
                    switch (type.id) {
                        case 'mainline':
                            option.text = 'Main Theme';
                            break;
                        case 'weekly':
                            option.text = 'Supplies';
                            break;
                        case 'campaign':
                            option.text = 'Annihalation';
                            break;
                        case 'climb_tower':
                            option.text = 'Stationary Security Service';
                            break;
                        case 'roguelike':
                            option.text = 'Integrated Strategies';
                            break;
                        case 'activity':
                            option.text = 'Events';
                            break;
                        case 'sandbox':
                            option.text = 'Reclamation Algorithm';
                            break;
                    }
                    option.value = type.id;
                    optionArr.push(option);
                }
                break;
            }
            case 'zone': {
                for (const zone of G.type.getZones()) {
                    if (!zone.hasLevels()) continue;
                    const option = document.createElement('option');
                    option.text = zone.name;
                    option.value = zone.id;
                    optionArr.push(option);
                }
                break;
            }
            case 'level': {
                for (const level of G.zone.getLevels()) {
                    // Skip all non-normal difficulty stages, roguelike and sandbox stages are exempted
                    if (level.difficulty && G.type.id !== 'roguelike' && G.type.id !== 'sandbox') continue;
                    const option = document.createElement('option');
                    option.text = `${level.code} ${level.name}`;
                    option.value = level.id;
                    optionArr.push(option);
                }
                break;
            }
        }
        if (G.type.id === 'activity') optionArr.sort((a, b) => a.text.localeCompare(b.text));
        for (const option of optionArr) elem.add(option);
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
                G.type = Type.get(Elem.get('type').value);
                Elem.updateOptions('zone');
            }
            case 'zone': {
                G.zone = Zone.get(Elem.get('zone').value);
                Elem.updateOptions('level');
            }
            case 'level': {
                G.level = Level.get(Elem.get('level').value);
                if (G.autoplay) Elem.event('play');

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
        this.data = Enemy.dataCache[enemyId] ? Enemy.dataCache[enemyId] : Enemy.dataCache[enemyId.split(G.variantReg).join('')];
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
            console.log(this.route)
            G.app.stage.removeChild(Enemy.selectedRoute);
            const yOffset = G.gridSize * 0.2;
            Enemy.selectedRoute = new PIXI.Graphics()
                .lineStyle(4, 0xcc0000)
                .moveTo(this.frameData[0].x, this.frameData[0].y - yOffset);
            for (let i = 1; i < this.frameData.length; i += 2)
                Enemy.selectedRoute.lineTo(this.frameData[i].x, this.frameData[i].y - yOffset);
            G.app.stage.addChild(Enemy.selectedRoute);
        });
        this.generateFrameData();
    }
    generateFrameData() {
        // Enemy pathing contains three main things: a start tile, checkpoint tiles, and an end tile
        // A path going straight through each checkpoint is NOT guaranteed to be a valid path
        // For each checkpoint, check if you can move to the next checkpoint directly, if yes then move in a straight line
        // If not, calculate the best path, which returns a list of intermediate checkpoints
        // Move in a straight line to each intermediate checkpoint until the original checkpoint is reached
        // Repeat until end is reached
        // Flying enemies (motionMode = 1) are exempt

        const moveToCheckpoint = (currPos, destPos) => {
            const currTile = new MapTile(posToGrid(currPos));
            const destTile = new MapTile(posToGrid(destPos));
            const bestPath = currTile.getBestPath(destTile, this.route.motionMode === 1);

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
                    // End path early in case of deliberate pathing into inaccessible tile (eg. a hole)
                    if (this.route.motionMode === 0 && new MapTile(checkpoint.position).access === MapTile.inaccessible) return;
                    break;
                }
                case 1:
                case 3: { // Idle
                    const idleTicks = checkpoint.time * G.fps;
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

class Type {
    static _arr = [];
    static add(id) {
        try {
            const type = new Type(id);
            if (!type) return null;
            this._arr.push(type);
            return type;
        } catch (e) {
            return null;
        }
    }
    static get(id) {
        return this._arr.find(e => e.id === id);
    }
    static getAll() {
        return this._arr;
    }
    constructor(id) {
        this.id = id;
        this._zones = [];
    }
    addZone(id) {
        const zone = Zone.get(id);
        return this._zones.push(zone);
    }
    getZone(id) {
        return this._zones.find(e => e.id === id);
    }
    getZones() {
        return this._zones;
    }
}

class Zone {
    static _arr = [];
    static add(id, name, type, data) {
        try {
            const zone = new Zone(id, name, type, data);
            this._arr.push(zone);
            (Type.get(type) ? Type.get(type) : Type.add(type)).addZone(id);
            return zone;
        } catch (e) {
            return null;
        }
    }
    static get(id) {
        return this._arr.find(e => e.id === id);
    }
    static getAll() {
        return this._arr;
    }
    constructor(id, name, type, data) {
        this.id = id;
        this.name = name;
        this.type = type;
        this._data = data;
        this._levels = [];
    }
    addLevel(id) {
        const level = Level.get(id);
        return this._levels.push(level);
    }
    getLevel(id) {
        return this._levels.find(e => e.id === id);
    }
    getLevels() {
        return this._levels;
    }
    hasLevels() {
        return this._levels && this._levels.length > 0;
    }
}

class Level {
    static _arr = [];
    static add(id, zone, data) {
        try {
            const level = new Level(id, zone, data);
            this._arr.push(level);
            Zone.get(zone).addLevel(id);
            return level
        } catch (e) {
            return null;
        }
    }
    static get(id) {
        return this._arr.find(e => e.id === id);
    }
    static getAll() {
        return this._arr;
    }
    constructor(id, zone, data) {
        this.id = id;
        this.zone = zone;
        this.code = data.code;
        this.name = data.name;
        this.path = data.levelId.toLowerCase();
        this.difficulty = data.difficulty && data.difficulty !== 'NORMAL' || !['NONE', 'ALL', 'NORMAL'].includes(data.diffGroup);
        this._data = data;
    }
}

class MapTile {
    static inaccessible = 9;
    static impassables = ['tile_fence', 'tile_fence_bound', 'tile_forbidden', 'tile_hole'];
    constructor(position) {
        if (position.row < 0 || position.row >= G.levelData.mapData.map.length || position.col < 0 || position.col >= G.levelData.mapData.map[0].length)
            return null;

        this.position = position;
        this.data = G.levelData.mapData.tiles[G.levelData.mapData.map[G.levelData.mapData.map.length - position.row - 1][position.col]];
        this.access = 0; // Tiles are accessible if their access values are within 1 of each other
        if (this.data.heightType === 1 || MapTile.impassables.includes(this.data.tileKey)) this.access = MapTile.inaccessible;
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
    getBestPath(destTile, isFlying) {
        if (this.canMoveDirectTo(destTile) || isFlying)
            return [{ tile: this }, { tile: destTile }];

        // A* pathfinding algorithm: https://briangrinstead.com/blog/astar-search-algorithm-in-javascript/
        const findPath = () => {
            const heuristic = tile => {
                // Manhattan distance
                const x = Math.abs(tile.position.col - destTile.position.col);
                const y = Math.abs(tile.position.row - destTile.position.row);
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
            const start = grid[this.position.row][this.position.col];
            const openList = [start];
            const closedList = [];
            while (openList.length > 0) {
                openList.sort((a, b) => a.total - b.total);
                let curr = openList.shift();
                if (curr.tile.isEqual(destTile)) {
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
                    // Safeguard against inaccessible destTile (eg. a hole), add it to openList anyways in case there is no better path
                    if (neighbour.tile.isEqual(destTile) && neighbour.tile.access === MapTile.inaccessible) {
                        neighbour.parent = curr;
                        neighbour.cost = curr.cost + 99;
                        neighbour.total = curr.cost + 99 + neighbour.heuristic;
                        openList.push(neighbour);
                    }
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
        if (!path)
            console.error(`Failed to create path from ${this.position.row},${this.position.col} to ${destTile.position.row},${destTile.position.col}`)
        let farthest = path[0];
        const optimizedPath = [farthest];
        for (let i = 0; i < path.length; i++) {
            // If destTile is usually inaccessible (eg. a hole), allow it anyways
            if (path[i].tile.isEqual(destTile) && path[i].tile.access === MapTile.inaccessible) {
                optimizedPath.push(path[i - 1]);
                farthest = path[i - 1];
                break;
            }
            else if (!farthest.tile.canMoveDirectTo(path[i].tile)) {
                optimizedPath.push(path[i - 1]);
                farthest = path[i - 1];
                i--;
            }
        }
        optimizedPath.push(path[path.length - 1]);
        return optimizedPath;
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
}