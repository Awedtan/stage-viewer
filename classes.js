class G {
    static type;
    static zone;
    static activity;
    static level;

    static loader = new PIXI.loaders.Loader();
    static app;
    static typeId;
    static zoneId;
    static levelId;
    static levelData;
    static stageGraphics;

    static stageTick = 0;
    static stageMaxTick = 0;
    static skipCount = 0;
    static autoplay = false;
    static doubleSpeed = false;
    static tempPause = false;
    static inc = 0;

    static maxStageWidth = 1000;
    static maxStageHeight = 725;
    static defaultEnemyScale = 0.21;
    static defaultGridSize = 75;
    static enemyScale;
    static gridSize;
    static fps = 60;
    static baseSpeed = 0.65; // Arbitrary number
    static variantReg = /_[^_]?[^0-9|_]+$/;

    static disableUI(bool) {
        ['play', 'tick', 'speed', 'popup-open'].forEach(id => {
            document.getElementById(id).disabled = bool;
        });
    }
    static restartApp() {
        G.app.destroy(true, { children: true, texture: false, baseTexture: false });
        G.app = null;
        G.levelData = null;
        G.stageGraphics = null;
        G.stageTick = 0;
        G.stageMaxTick = 0;
        G.skipCount = 0;
        G.autoplay = false;
        G.inc = 0;
        Enemy._array = [];
        Enemy.assetsLoaded = false;
        document.getElementById('tick').value = 0;
        G.updateEnemyCount();
        MapPredefine._array = [];
        MapTile._array = [];
        document.getElementById('enemy-container').replaceChildren();
        startApp()
    }
    static updateEnemyCount() {
        document.getElementById('enemy-count').innerText = `Enemies: ${Enemy.getCount()}/${Enemy._array.length}`;
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
    static hole = this.wall;
    static push = 0xb85b0a;
    static defdown = 0xc03722;
    static defup = this.push;
    static air = this.push;
    static wood = 0x7f4f1a;
    static stone = 0x6b6b6b;
    static iron = this.wall;

    static unknown = 0xffff00;

    static lineWidth = 3;
    static outlineWidth = 4;
    static triLength = 5;
}

class Path {
    static api = 'https://hellabotapi.cyclic.app';
    static constants = 'https://raw.githubusercontent.com/Awedtan/HellaBot/main/src/constants.json';
    static assets = 'https://raw.githubusercontent.com/isHarryh/Ark-Models/main/models_enemies';
    static enemyIcons = 'https://raw.githubusercontent.com/Aceship/Arknight-Images/main/enemy';
    static gamedata = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData_YoStar/master';
    static region = 'en_US';
    static levels = `${Path.gamedata}/${Path.region}/gamedata/levels`;
    static activityTable = `${Path.gamedata}/${Path.region}/gamedata/excel/activity_table.json`;
    static levelTable = `${Path.gamedata}/${Path.region}/gamedata/excel/stage_table.json`;
    static zoneTable = `${Path.gamedata}/${Path.region}/gamedata/excel/zone_table.json`;
    static rogueTable = `${Path.gamedata}/${Path.region}/gamedata/excel/roguelike_topic_table.json`;
    static sandboxTable = `${Path.gamedata}/${Path.region}/gamedata/excel/sandbox_table.json`;
    static paradoxTable = `${Path.gamedata}/${Path.region}/gamedata/excel/handbook_info_table.json`;
    static backupLevels = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/levels';
}

class Print {
    static _debug = false;
    static _info = false;
    static clear() {
        if (this._info || this._debug) console.clear();
    }
    static debug(msg) {
        if (this._debug) console.debug(msg);
    }
    static error(msg) {
        if (this._debug) console.trace(msg);
        else console.error(msg);
    }
    static info(msg) {
        if (this._info) console.info(msg);
    }
    static group() {
        console.group();
    }
    static groupEnd() {
        console.groupEnd();
    }
    static table(data, columns) {
        if (this._debug) console.table(data, columns);
    }
    static time(label) {
        if (this._info) console.time(label);
    }
    static timeLog(label) {
        if (this._info) console.timeLog(label);
    }
    static timeEnd(label) {
        if (this._info) console.timeEnd(label);
    }
    static warn(msg) {
        if (this._debug) console.trace(msg);
        else console.warn(msg);
    }
}

class Enemy {
    static _idOverride = {
        '1037_lunsbr': '1037_lunsabr',
        '1043_zomsbr': '1043_zomsabr',
        '1043_zomsbr_2': '1043_zomsabr_2'
    };
    static _array = [];
    static _errorArray = [];
    static _dataCache;
    static _assetCache;
    static assetsLoaded = false;
    static selectedRoute;
    static create(precalcTick, action) {
        try {
            const enemy = new Enemy(precalcTick, action.key, action.routeIndex);
            if (!enemy) return null;
            this._array.push(enemy);
            return enemy;
        } catch (e) {
            Print.error(e + ': ' + action.key);
            this._errorArray.push(action.key);
            return null;
        }
    }
    static getCount() {
        const a = this._array.filter(e => e.state === 'end').length;
        return a;
    }
    static getUnique() {
        const unique = [];
        this._array.forEach(e => {
            if (!unique.find(f => f.enemyId === e.enemyId))
                unique.push(e);
        });
        return unique;
    }
    static async loadAll(recache) {
        // Enemy data are loaded all at once to reduce api calls
        // Enemy assets can only be loaded individually
        if (!this._dataCache || recache) {
            this._dataCache = {};
            const enemyRes = await fetch(`${Path.api}/enemy`);
            const data = await enemyRes.json();
            data.forEach(e => this._dataCache[e.keys[0]] = e);
        }
        const urlExists = async url => (await fetch(url)).status === 200;
        if (!this._assetCache || recache) this._assetCache = {};
        for (const enemyRef of G.levelData.enemyDbRefs) {
            if (this._assetCache[enemyRef.id]) continue; // Skip enemy if assets are already loaded
            try {
                const enemyId = enemyRef.id.split('enemy_').join('');
                let spinePath = Path.assets + `/${enemyId}/${enemyRef.id}.skel`;
                if (this._idOverride[enemyId])
                    spinePath = spinePath.split(enemyId).join(this._idOverride[enemyId]);
                if (!await urlExists(spinePath))
                    spinePath = spinePath.split(/_[^_]+$/).join(''); // Get rid of trailing '_2' or '_3a' etc
                if (!await urlExists(spinePath))
                    throw new Error('Skel file couldn\'t be found');

                G.loader.add(enemyRef.id, spinePath);
            } catch (e) {
                Print.error(e + (': ') + enemyRef.id);
            }
        }
        await G.loader.load(async (loader, resources) => {
            await sleep(1000);
            Object.keys(resources).forEach(e => this._assetCache[e] = resources[e]);
            this.assetsLoaded = true;
        });
    }
    static async loadPaths() {
        let precalcTick = 0; // Precalculated global tick for all actions
        let waveBlockTick = 0; // Wave blocker tick
        for (const wave of G.levelData.waves) {
            for (const fragment of wave.fragments) {
                precalcTick += fragment.preDelay * G.fps; // Add wave fragment predelay
                for (const action of fragment.actions) {
                    if (action.actionType !== 0 || action.key === '' || Enemy._errorArray.includes(action.key)) continue;
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

                    precalcTick += action.preDelay * G.fps; // Action predelays are relative to the wave fragment predelay and do not stack
                    for (let i = 0; i < action.count; i++) {
                        precalcTick += action.interval * G.fps * i;
                        const enemy = Enemy.create(precalcTick, action); // Mark an enemy to spawn at current tick
                        if (!enemy) continue;
                        const enemyMaxTick = precalcTick + enemy.frameData.length;
                        G.stageMaxTick = Math.max(G.stageMaxTick, enemyMaxTick); // Keep track of how long the level takes with stageMaxTick
                        if (!action.dontBlockWave)
                            waveBlockTick = Math.max(waveBlockTick, enemyMaxTick); // Only update waveBlockTick if the enemy is blocking
                        precalcTick -= action.interval * G.fps * i;
                    }
                    precalcTick -= action.preDelay * G.fps;
                }
                const maxActionDelay = fragment.actions.reduce((prev, curr) => (prev.preDelay > curr.preDelay) ? prev.preDelay : curr.preDelay, 1)
                precalcTick += maxActionDelay * G.fps;
            }
            precalcTick = Math.max(precalcTick, waveBlockTick);
        }

        const enems = Enemy.getUnique().sort((a, b) => a._data.value.excel.enemyIndex.localeCompare(b._data.value.excel.enemyIndex));
        for (const enem of enems)
            document.getElementById('enemy-container').appendChild(enem.createBoxElement());
    }
    static updateAll(tick) {
        this._array.forEach(e => e.update(tick));
    }
    constructor(startTick, enemyId, routeIndex) {
        this.startTick = startTick;
        this.enemyId = enemyId;
        this._data = Enemy._dataCache[enemyId] ? Enemy._dataCache[enemyId] : Enemy._dataCache[enemyId.split(G.variantReg).join('')];
        this.routeIndex = routeIndex;
        this.route = G.levelData.routes[routeIndex];
        this.spine = new PIXI.spine.Spine(Enemy._assetCache[enemyId].spineData);
        this.state = 'waiting';
        this.checkpoints = [];
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
            const startPos = gridToPos(this.checkpoints[0].tile.position, true);
            Enemy.selectedRoute = new PIXI.Graphics().moveTo(startPos.x, startPos.y);
            for (let i = 1; i < this.checkpoints.length; i++) {
                const checkPos = gridToPos(this.checkpoints[i].tile.position, true);
                switch (this.checkpoints[i].type) {
                    case 0: {
                        Enemy.selectedRoute.lineStyle(4, 0xcc0000)
                            .lineTo(checkPos.x, checkPos.y)
                        break;
                    }
                    case 6: {
                        Enemy.selectedRoute.lineStyle(1, 0xcc0000)
                            .lineTo(checkPos.x, checkPos.y)
                        break;
                    }
                }
            }
            G.app.stage.addChild(Enemy.selectedRoute);
        });
        this.generateFrameData();
    }
    createBoxElement() {
        const enemyBox = document.createElement('div');
        enemyBox.className = 'enemy-box';

        const enemyBoxContent = document.createElement('div');
        enemyBoxContent.className = 'enemy-box-content';

        const leftCol = document.createElement('div');
        leftCol.className = 'enemy-left';

        const code = document.createElement('p');
        const image = document.createElement('img');
        const name = document.createElement('p');
        code.innerText = this._data.value.excel.enemyIndex;
        image.src = `${Path.enemyIcons}/${this.enemyId}.png`
        name.innerText = this._data.value.excel.name;

        leftCol.appendChild(code);
        leftCol.appendChild(image);
        leftCol.appendChild(name);
        enemyBoxContent.appendChild(leftCol);

        const rightCol = document.createElement('div');
        rightCol.className = 'enemy-right';

        const table = document.createElement('table');
        const rows = [], cells = [];
        const wordArr = ['HP', 'ATK Interval', 'Silence', 'ATK', 'ATK Type', 'Stun', 'DEF', 'Range', 'Sleep', 'RES', 'Weight', 'Freeze', 'Block', 'Life Points', 'Levitate'];
        const idArr = ['hp', 'interval', 'silence', 'atk', 'type', 'stun', 'def', 'range', 'sleep', 'res', 'weight', 'freeze', 'block', 'life', 'levitate'];
        for (let i = 0; i < 30; i++) {
            cells.push(document.createElement('td'));
            if (i % 2 === 0) {
                cells[i].className = 'enemy-stat type';
                cells[i].innerText = wordArr[i / 2];
            }
            else {
                cells[i].id = idArr[Math.ceil(i / 2) - 1] + '-value';
                cells[i].className = 'enemy-stat value';
                const enemyData = this._data.value.levels.Value[0].enemyData;
                const attributes = enemyData.attributes;
                const getValue = (attr, def) => attr.m_defined ? attr.m_value : def ? def : 0;
                switch (idArr[Math.ceil(i / 2) - 1]) {
                    case "hp":
                        cells[i].innerText = getValue(attributes.maxHp);
                        break;
                    case "type":
                        cells[i].innerText = this._data.value.excel.attackType.split('  ').join('\n');
                        cells[i].style = "white-space: pre-wrap";
                        break;
                    case "silence":
                        cells[i].innerText = getValue(attributes.silenceImmune, '✔️');
                        break;
                    case "atk":
                        cells[i].innerText = getValue(attributes.atk);
                        break;
                    case "range":
                        cells[i].innerText = getValue(enemyData.rangeRadius);
                        break;
                    case "stun":
                        cells[i].innerText = getValue(attributes.stunImmune, '✔️');
                        break;
                    case "def":
                        cells[i].innerText = getValue(attributes.def);
                        break;
                    case "interval":
                        cells[i].innerText = getValue(attributes.baseAttackTime);
                        break;
                    case "sleep":
                        cells[i].innerText = getValue(attributes.sleepImmune, '✔️');
                        break;
                    case "res":
                        cells[i].innerText = getValue(attributes.magicResistance);
                        break;
                    case "weight":
                        cells[i].innerText = getValue(attributes.massLevel);
                        break;
                    case "freeze":
                        cells[i].innerText = getValue(attributes.frozenImmune, '✔️');
                        break;
                    case "block":
                        cells[i].innerText = getValue(attributes.blockCnt, 1);
                        break;
                    case "life":
                        cells[i].innerText = getValue(enemyData.lifePointReduce, 1);
                        break;
                    case "levitate":
                        cells[i].innerText = getValue(attributes.levitateImmune, '✔️');
                        break;
                }
                if (cells[i].innerText === 'true') cells[i].innerText = '❌';
                else if (cells[i].innerText === 'false') cells[i].innerText = '✔️';
            }
        };
        for (let i = 0; i < 5; i++) {
            rows.push(document.createElement('tr'));
            for (let j = i * 6; j < (i + 1) * 6; j++) {
                rows[i].appendChild(cells[j]);
            }
            table.appendChild(rows[i]);
        }

        rightCol.appendChild(table);
        enemyBoxContent.appendChild(rightCol);

        enemyBox.appendChild(enemyBoxContent);

        return enemyBox;
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
            const currTile = MapTile.get(posToGrid(currPos));
            const destTile = MapTile.get(posToGrid(destPos));
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

        const dataSpeed = this._data.value.levels.Value[0].enemyData.attributes.moveSpeed.m_defined ? this._data.value.levels.Value[0].enemyData.attributes.moveSpeed.m_value : 1;
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
                    const bestPath = MapTile.get(posToGrid(currPos)).getBestPath(MapTile.get(posToGrid(checkPos)), this.route.motionMode === 1);
                    bestPath.forEach(e => this.checkpoints.push({ tile: e.tile, type: checkpoint.type }));
                    moveToCheckpoint(currPos, checkPos);
                    // End path early in case of deliberate pathing into inaccessible tile (eg. a hole)
                    if (this.route.motionMode === 0 && !MapTile.get(checkpoint.position).isAccessible()) return;
                    break;
                }
                case 1:
                case 3: { // Idle
                    const state = prevCheckpoint && prevCheckpoint.type === 5 ? 'disappear' : 'idle';
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: state };
                    const idleTicks = checkpoint.time * G.fps;
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
                    this.checkpoints.push({ tile: MapTile.get(checkpoint.position), type: checkpoint.type });
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
        const bestPath = MapTile.get(posToGrid(currPos)).getBestPath(MapTile.get(posToGrid(endPos)), this.route.motionMode === 1);
        bestPath.forEach(e => this.checkpoints.push({ tile: e.tile, type: 0 }));
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

class MapPredefine {
    static _array = [];
    static create(inst) {
        try {
            const predefine = new MapPredefine(inst);
            this._array.push(predefine);
            return predefine;
        }
        catch (e) {
            return null;
        }
    }
    constructor(inst) {
        this.position = inst.position;
        this.key = inst.inst.characterKey;
        this._data = inst;
        this._graphics = null;
    }
    createGraphics() {
        const i = G.levelData.mapData.map.length - 1 - this.position.row;
        const j = this.position.col;
        this._graphics = new PIXI.Graphics();
        switch (this.key) {
            case 'trap_409_xbwood': {
                this._graphics.beginFill(Color.wood)
                    .drawPolygon([
                        G.gridSize * (j + 20 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 21 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 19 / 16),
                        G.gridSize * (j + 28 / 16), G.gridSize * (i + 19 / 16),
                        G.gridSize * (j + 28 / 16), G.gridSize * (i + 29 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 29 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 24 / 16),
                        G.gridSize * (j + 19 / 16), G.gridSize * (i + 22 / 16),
                    ])
                    .endFill();
                break;
            }
            case 'trap_410_xbstone': {
                this._graphics.beginFill(Color.stone)
                    .drawPolygon([
                        G.gridSize * (j + 19 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 26 / 16),
                        G.gridSize * (j + 27 / 16), G.gridSize * (i + 23 / 16),
                        G.gridSize * (j + 29 / 16), G.gridSize * (i + 23 / 16),
                        G.gridSize * (j + 29 / 16), G.gridSize * (i + 28 / 16),
                        G.gridSize * (j + 19 / 16), G.gridSize * (i + 28 / 16),
                    ])
                    .endFill();
                break;
            }
            case 'trap_411_xbiron': {
                this._graphics.beginFill(Color.wall)
                    .drawPolygon([
                        G.gridSize * (j + 20 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 21 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 21 / 16), G.gridSize * (i + 21 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 21 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 23 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 23 / 16), G.gridSize * (i + 29 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 29 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 28 / 16),
                        G.gridSize * (j + 21 / 16), G.gridSize * (i + 28 / 16),
                        G.gridSize * (j + 21 / 16), G.gridSize * (i + 29 / 16),
                        G.gridSize * (j + 20 / 16), G.gridSize * (i + 29 / 16),
                    ])
                    .drawPolygon([
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 19 / 16),
                        G.gridSize * (j + 26 / 16), G.gridSize * (i + 19 / 16),
                        G.gridSize * (j + 26 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 27 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 27 / 16), G.gridSize * (i + 19 / 16),
                        G.gridSize * (j + 28 / 16), G.gridSize * (i + 19 / 16),
                        G.gridSize * (j + 28 / 16), G.gridSize * (i + 28 / 16),
                        G.gridSize * (j + 27 / 16), G.gridSize * (i + 28 / 16),
                        G.gridSize * (j + 27 / 16), G.gridSize * (i + 27 / 16),
                        G.gridSize * (j + 26 / 16), G.gridSize * (i + 27 / 16),
                        G.gridSize * (j + 26 / 16), G.gridSize * (i + 28 / 16),
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 28 / 16),
                    ])
                    .endFill();
                break;
            }
            case 'trap_413_hiddenstone': {
                this._graphics.beginFill(Color.wall)
                    .drawPolygon([
                        G.gridSize * (j + 18 / 16), G.gridSize * (i + 18 / 16),
                        G.gridSize * (j + 18 / 16), G.gridSize * (i + 30 / 16),
                        G.gridSize * (j + 30 / 16), G.gridSize * (i + 30 / 16),
                        G.gridSize * (j + 30 / 16), G.gridSize * (i + 18 / 16),
                    ])
                    .beginFill(Color.road)
                    .drawPolygon([
                        G.gridSize * (j + 23 / 16), G.gridSize * (i + 18 / 16),
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 18 / 16),
                        G.gridSize * (j + 26 / 16), G.gridSize * (i + 25 / 16),
                    ])
                    .drawPolygon([
                        G.gridSize * (j + 24 / 16), G.gridSize * (i + 18 / 16),
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 20 / 16),
                        G.gridSize * (j + 23 / 16), G.gridSize * (i + 23 / 16),
                    ])
                    .endFill();
                break;
            }
            default: {
                this._graphics.beginFill(Color.unknown)
                    .drawPolygon([
                        G.gridSize * (j + 20 / 16), G.gridSize * (i + 19 / 16),
                        G.gridSize * (j + 28 / 16), G.gridSize * (i + 19 / 16),
                        G.gridSize * (j + 28 / 16), G.gridSize * (i + 26 / 16),
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 26 / 16),
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 27 / 16),
                        G.gridSize * (j + 23 / 16), G.gridSize * (i + 27 / 16),
                        G.gridSize * (j + 23 / 16), G.gridSize * (i + 24 / 16),
                        G.gridSize * (j + 26 / 16), G.gridSize * (i + 24 / 16),
                        G.gridSize * (j + 26 / 16), G.gridSize * (i + 21 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 21 / 16),
                        G.gridSize * (j + 22 / 16), G.gridSize * (i + 23 / 16),
                        G.gridSize * (j + 20 / 16), G.gridSize * (i + 23 / 16),
                    ])
                    .drawPolygon([
                        G.gridSize * (j + 23 / 16), G.gridSize * (i + 28 / 16),
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 28 / 16),
                        G.gridSize * (j + 25 / 16), G.gridSize * (i + 30 / 16),
                        G.gridSize * (j + 23 / 16), G.gridSize * (i + 30 / 16),
                    ])
                    .endFill();
                break;
            }
        }
        return this._graphics;
    }
}

class MapTile {
    static _array = [];
    static _inaccessible = 9;
    static _impassables = ['tile_fence', 'tile_fence_bound', 'tile_forbidden', 'tile_hole'];
    static get({ row, col }) {
        if (!this._array[row])
            this._array[row] = [];
        if (!this._array[row][col])
            this._array[row][col] = new MapTile({ row, col });
        return this._array[row][col];
    }
    constructor({ row, col }) {
        if (row < 0 || row >= G.levelData.mapData.map.length || col < 0 || col >= G.levelData.mapData.map[0].length)
            return null;

        this.position = { row, col };

        if (G.levelData.predefines) {
            if (G.levelData.predefines.characterInsts)
                G.levelData.predefines.characterInsts
                    .filter(e => e.position.row === this.position.row && e.position.col === this.position.col)
                    .forEach(e => MapPredefine.create(e));
            if (G.levelData.predefines.tokenInsts)
                G.levelData.predefines.tokenInsts
                    .filter(e => e.position.row === this.position.row && e.position.col === this.position.col)
                    .forEach(e => MapPredefine.create(e));
        }

        this._data = G.levelData.mapData.tiles[G.levelData.mapData.map[G.levelData.mapData.map.length - row - 1][col]];
        this.access = 0; // Tiles are accessible if their access values are within 1 of each other
        if (this._data.heightType === 1 || MapTile._impassables.includes(this._data.tileKey)) this.access = MapTile._inaccessible;
        else if (this._data.tileKey === 'tile_stairs') this.access = 1;
        else if (['tile_passable_wall', 'tile_passable_wall_forbidden'].includes(this._data.tileKey)) this.access = 2;
        this._graphics = null;
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
            if (!this.canAccess(MapTile.get(point))) {
                return false;
            }
            for (let j = i; j >= 0; j--) {
                if (!MapTile.get(line[j]).canAccess(MapTile.get(line[i])))
                    return false;
            }
        }
        return true;
    }
    createGraphics() {
        const i = G.levelData.mapData.map.length - 1 - this.position.row;
        const j = this.position.col;
        const heightType = this._data.heightType;
        let defaultColor = Color.void;
        if (heightType === 0) defaultColor = Color.road;
        else if (heightType === 1) defaultColor = Color.wall;
        this._graphics = new PIXI.Graphics().beginFill(defaultColor)
            .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
            .endFill();
        switch (this._data.tileKey) {
            // BASICS
            case 'tile_end': {
                const yAdj = Color.triLength / 4;
                const rad30 = 30 * Math.PI / 180
                this._graphics = new PIXI.Graphics().lineStyle(Color.lineWidth, Color.end)
                    .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - Color.triLength / Math.cos(rad30) + yAdj) / 16))
                    .lineTo(G.gridSize * (j + (24 + Color.triLength) / 16), G.gridSize * (i + (24 + (Color.triLength * Math.tan(rad30)) + yAdj) / 16))
                    .lineTo(G.gridSize * (j + (24 - Color.triLength) / 16), G.gridSize * (i + (24 + (Color.triLength * Math.tan(rad30)) + yAdj) / 16))
                    .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - Color.triLength / Math.cos(rad30) + yAdj) / 16))
                    .lineStyle(Color.lineWidth, Color.end)
                    .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - Color.triLength / 3) / 16))
                    .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 + Color.triLength / 3) / 16))
                    .beginFill(Color.end)
                    .drawCircle(G.gridSize * (j + 1.5), G.gridSize * (i + (24 + Color.triLength * 9 / 16) / 16), Color.lineWidth / 4)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.end, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
                break;
            }
            case 'tile_fence':
            case 'tile_fence_bound': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.fence, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
                break;
            }
            case 'tile_flowerf':
            case 'tile_creepf':
            case 'tile_floor': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.floor, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
                break;
            }
            case 'tile_flystart': {
                this._graphics = new PIXI.Graphics().beginFill(Color.start)
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
                    .lineStyle(Color.lineWidth, Color.start)
                    .drawCircle(G.gridSize * (j + 21 / 16), G.gridSize * (i + 21 / 16), G.gridSize * 2.5 / 16)
                    .drawCircle(G.gridSize * (j + 27 / 16), G.gridSize * (i + 21 / 16), G.gridSize * 2.5 / 16)
                    .drawCircle(G.gridSize * (j + 27 / 16), G.gridSize * (i + 27 / 16), G.gridSize * 2.5 / 16)
                    .drawCircle(G.gridSize * (j + 21 / 16), G.gridSize * (i + 27 / 16), G.gridSize * 2.5 / 16)
                    .lineStyle(Color.outlineWidth, Color.start, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
                break;
            }
            case 'tile_forbidden': {
                this._graphics = new PIXI.Graphics().beginFill(Color.void)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                    .endFill();
                break;
            }
            case 'tile_empty':
            case 'tile_hole': {
                this._graphics = new PIXI.Graphics().beginFill(Color.void)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.hole, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
                break;
            }
            case 'tile_flower':
            case 'tile_creep':
            case 'tile_road': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                    .endFill();
                break;
            }
            case 'tile_start': {
                const yAdj = Color.triLength / 4;
                const rad30 = 30 * Math.PI / 180
                this._graphics = new PIXI.Graphics().lineStyle(Color.lineWidth, Color.start)
                    .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - Color.triLength / Math.cos(rad30) + yAdj) / 16))
                    .lineTo(G.gridSize * (j + (24 + Color.triLength) / 16), G.gridSize * (i + (24 + (Color.triLength * Math.tan(rad30)) + yAdj) / 16))
                    .lineTo(G.gridSize * (j + (24 - Color.triLength) / 16), G.gridSize * (i + (24 + (Color.triLength * Math.tan(rad30)) + yAdj) / 16))
                    .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - Color.triLength / Math.cos(rad30) + yAdj) / 16))
                    .lineStyle(Color.lineWidth, Color.start)
                    .moveTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 - Color.triLength / 3) / 16))
                    .lineTo(G.gridSize * (j + 1.5), G.gridSize * (i + (24 + Color.triLength / 3) / 16))
                    .beginFill(Color.start)
                    .drawCircle(G.gridSize * (j + 1.5), G.gridSize * (i + (24 + Color.triLength * 9 / 16) / 16), Color.lineWidth / 4)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.start, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
                break;
            }
            case 'tile_telin': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
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
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
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
                this._graphics = new PIXI.Graphics().beginFill(Color.wall)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                    .endFill();
                break;
            }
            // WATER
            case 'tile_deepwater':
            case 'tile_shallowwater':
            case 'tile_deepsea':
            case 'tile_water': {
                this._graphics = new PIXI.Graphics().beginFill(Color.end)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize)
                    .endFill();
                break;
            }
            // SPECIAL
            case 'tile_bigforce': {
                this._graphics.beginFill(Color.push)
                    .drawRect(G.gridSize * (j + 21 / 16), G.gridSize * (i + 19 / 16), Color.lineWidth * 2, G.gridSize * 10 / 16)
                    .endFill()
                    .lineStyle(Color.lineWidth, Color.push, 1, 0)
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
                    .lineStyle(Color.outlineWidth, Color.push, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
                break;
            }
            case 'tile_corrosion':
            case 'tile_defbreak': {
                this._graphics.beginFill(Color.defdown)
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
                    .lineStyle(Color.outlineWidth, Color.defdown, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
                break;
            }
            case 'tile_defup': {
                this._graphics.beginFill(Color.defup)
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
                    .lineStyle(Color.outlineWidth, Color.defup, 1, 0)
                    .drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);;
                break;
            }
            case 'tile_gazebo': {
                this._graphics.lineStyle(Color.lineWidth, Color.air)
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
                    .lineStyle(Color.outlineWidth, Color.air, 1, 0)
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
        this._graphics.lineStyle().endFill();
        this._graphics.lineStyle(1, 0x000000, 1, 0).drawRect(G.gridSize * (j + 1), G.gridSize * (i + 1), G.gridSize, G.gridSize);
        return this._graphics;
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
                        tile: MapTile.get({ row: i, col: j }),
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
                    if (neighbour.tile.isEqual(destTile) && neighbour.tile.access === MapTile._inaccessible) {
                        neighbour.parent = curr;
                        neighbour.cost = curr.cost + 1;
                        neighbour.total = neighbour.cost + neighbour.heuristic;
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
            Print.error(`Failed to create path from ${this.position.row},${this.position.col} to ${destTile.position.row},${destTile.position.col}`)
        let farthest = path[0];
        const optimizedPath = [farthest];
        for (let i = 0; i < path.length; i++) {
            // If destTile is usually inaccessible (eg. a hole), allow it anyways
            if (path[i].tile.isEqual(destTile) && path[i].tile.access === MapTile._inaccessible) {
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
                    else if (e2 < dx) { // 'Thick line': https://stackoverflow.com/questions/4381269/line-rasterisation-cover-all-pixels-regardless-of-line-gradient
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
    isAccessible() {
        return this.access !== MapTile._inaccessible;
    }
    isEqual(tile) {
        return this.position.col === tile.position.col && this.position.row === tile.position.row;
    }
}

class Type {
    static _array = [];
    static create(id) {
        try {
            const type = new Type(id);
            if (!type) return null;
            this._array.push(type);
            return type;
        } catch (e) {
            return null;
        }
    }
    static get(id) {
        return this._array.find(e => e.id === id);
    }
    static getAll() {
        return this._array;
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

class Activity {
    static _array = [];
    static create(id, name, data) {
        try {
            const activity = new Activity(id, name, data);
            if (!activity) return null;
            this._array.push(activity);
            return activity;
        } catch (e) {
            return null;
        }
    }
    static get(id) {
        return this._array.find(e => e.id === id);
    }
    static getAll() {
        return this._array;
    }
    constructor(id, name, data) {
        this.id = id;
        this.name = name.split(' - Rerun')[0];
        this._data = data;
        this._zones = [];
    }
    addZone(id) {
        const zone = Zone.get(id);
        return this._zones.push(zone);
    }
    getZones() {
        return this._zones;
    }
    hasLevels() {
        let bool = false
        this._zones.forEach(zone => {
            if (zone.hasLevels()) return bool = true;
        });
        return bool;
    }
}

class Zone {
    static _array = [];
    static create(id, name, type, data) {
        try {
            const zone = new Zone(id, name, type, data);
            this._array.push(zone);
            Type.get(type).addZone(id);
            const activityId = id.split('_')[0];
            Activity.get(activityId).addZone(id);
            return zone;
        } catch (e) {
            return null;
        }
    }
    static get(id) {
        return this._array.find(e => e.id === id);
    }
    static getAll() {
        return this._array;
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
    static _array = [];
    static create(id, zone, data) {
        try {
            const level = new Level(id, zone, data);
            this._array.push(level);
            Zone.get(zone).addLevel(id);
            return level;
        } catch (e) {
            return null;
        }
    }
    static get(id) {
        return this._array.find(e => e.id === id);
    }
    static getAll() {
        return this._array;
    }
    constructor(id, zone, data) {
        this.id = id;
        this.zone = zone;
        this.code = data.code ? data.code : data.location;
        this.name = data.name;
        this.path = data.levelId.toLowerCase();
        this.difficulty = data.difficulty && data.difficulty !== 'NORMAL' || !['NONE', 'ALL', 'NORMAL'].includes(data.diffGroup);
        this.hidden = this.difficulty && !(['roguelike', 'sandbox', 'storymission', 'rune'].includes(Zone.get(zone).type));
        this._data = data;
    }
}