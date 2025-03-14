class Enemy {
    static _idOverride = {
        'enemy_1037_lunsbr': 'enemy_1037_lunsabr',
        'enemy_1043_zomsbr': 'enemy_1043_zomsabr',
        'enemy_1043_zomsbr_2': 'enemy_1043_zomsabr_2'
    };
    static assetCache;
    static dataCache;
    static array: Enemy[] = [];
    static errorArray = [];
    static assetsLoaded = false;
    static getCount() {
        return `${this.array.filter(e => e.state === 'end').length}/${this.array.length}`;
    }
    static async loadAll(recache = false) {
        // Enemy data are loaded all at once to reduce api calls
        // Enemy assets can only be loaded individually
        if (!this.dataCache || recache) {
            this.dataCache = {};
            const enemyRes = await fetch(`${Path.api}/enemy`);
            const data = await enemyRes.json();
            data.forEach(e => this.dataCache[e.keys[0]] = e);
        }
        const urlExists = async url => (await fetch(url)).status === 200;
        if (!this.assetCache || recache) this.assetCache = {};
        for (const enemyRef of App.levelData.enemyDbRefs) {
            if (this.assetCache[enemyRef.id]) continue; // Skip enemy if assets are already loaded
            try {
                let spinePath = Path.enemyAssets + `/${enemyRef.id}/${enemyRef.id}.skel`;
                if (this._idOverride[enemyRef.id])
                    spinePath = spinePath.split(enemyRef.id).join(this._idOverride[enemyRef.id]);
                if (!this.dataCache[enemyRef.id] || !await urlExists(spinePath))
                    spinePath = Path.enemyAssets + `/${enemyRef.id.split(/_[^_]+$/).join('')}/${enemyRef.id.split(/_[^_]+$/).join('')}.skel`;
                if (await urlExists(spinePath))
                    App.loader.add(enemyRef.id, spinePath);
                else
                    throw new Error('Skel file couldn\'t be found');
            } catch (e) {
                Print.error(e + (': ') + enemyRef.id);
            }
        }
        await App.loader.load(async (loader, resources) => {
            await sleep(1000);
            Object.keys(resources).forEach(e => this.assetCache[e] = resources[e]);
            this.assetsLoaded = true;
        });
    }
    static updateAll(tick) {
        this.array.forEach(e => e.update(tick));
    }
    static create(precalcTick: number, action: any) {
        try {
            const enemy = new Enemy(precalcTick, action.key, action.routeIndex);
            if (!enemy) return null;
            this.array.push(enemy);
            return enemy;
        } catch (e) {
            Print.error(e + ': ' + action.key);
            this.errorArray.push(action.key);
            return null;
        }
    }
    static reset() {
        this.array = [];
        this.errorArray = [];
        this.assetsLoaded = false;
    }

    startTick: number;
    enemyId: string;
    data: any;
    routeIndex: number;
    route: any;
    spine: PIXI.spine.Spine;
    highlight: PIXI.Graphics;
    state: string;
    highlighted: boolean;
    checkpoints: any[];
    frameData: any[];
    constructor(startTick, enemyId, routeIndex) {
        this.startTick = startTick;
        this.enemyId = enemyId;
        this.data = Enemy.dataCache[enemyId] ? Enemy.dataCache[enemyId] : Enemy.dataCache[enemyId.split(/_[^_]?[^0-9|_]+$/).join('')]; // Check for _a variants
        this.routeIndex = routeIndex;
        this.route = App.levelData.routes[routeIndex];
        this.spine = new PIXI.spine.Spine(Enemy.assetCache[enemyId].spineData);
        this.highlight = new PIXI.Graphics()
            .beginFill(0xFF0000, 0.5)
            .drawEllipse(0, 0, 20, 5)
            .endFill();
        this.state = 'waiting';
        this.highlighted = false;
        this.checkpoints = [];
        this.frameData = [];

        // x: number, 
        // y: number, 
        // state: ['waiting', 'start', 'idle', 'moving', 'disappear', 'reappear', 'end'], 
        // direction: ['left', 'right'] | false

        App.app.stage.addChild(this.spine);
        this.spine.skeleton.setSkin(this.spine.state.data.skeletonData.skins[0]);
        this.spine.x = gridToPos({ row: -1, col: -1 }).x;
        this.spine.y = gridToPos({ row: -1, col: -1 }).y;
        this.spine.scale.x = App.enemyScale;
        this.spine.scale.y = App.enemyScale;
        this.spine.interactive = true;
        this.spine.on('click', this.onClick.bind(this));

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
            const bestPath = currTile.getBestPath(destTile, (this.route.motionMode === 1 || this.route.motionMode === 'FLY'));

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
                    let direction: string = null; // Only change direction if sufficient deltaX
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

        // If the enemy starts on an inaccessible tile, just end it
        if (!MapTile.get(startPoint).isAccessible()) {
            this.frameData[0] = { x: this.spine.x, y: this.spine.y, state: 'start' };
            this.frameData[1] = { x: this.spine.x, y: this.spine.y, state: 'end' };
            return;
        }

        const dataSpeed = this.data.value.levels.Value[0].enemyData.attributes.moveSpeed.m_defined ? this.data.value.levels.Value[0].enemyData.attributes.moveSpeed.m_value : 1;
        const localSpeed = dataSpeed * App.BASESPEED;
        let localTick = 0;
        // Jump to start position
        let currPos = gridToPos(startPoint);
        this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'moving', direction: 'right' };
        // Go to each checkpoint
        let prevCheckpoint;
        for (const checkpoint of checkpoints) {
            switch (checkpoint.type) {
                case 0:  // Move
                case 'MOVE': {
                    const checkPos = gridToPos(checkpoint.position);
                    const bestPath = MapTile.get(posToGrid(currPos)).getBestPath(MapTile.get(posToGrid(checkPos)), (this.route.motionMode === 1 || this.route.motionMode === 'FLY'));
                    bestPath.forEach(e => this.checkpoints.push({ tile: e.tile, type: checkpoint.type }));
                    moveToCheckpoint(currPos, checkPos);
                    // End path early in case of deliberate pathing into inaccessible tile (eg. a hole)
                    if (this.route.motionMode === 0 && !MapTile.get(checkpoint.position).isAccessible()) return;
                    break;
                }
                case 1:
                case 'WAIT_FOR_SECONDS': // Idle
                case 3:
                case 'WAIT_CURRENT_FRAGMENT_TIME': { // Idle but different?
                    const state = prevCheckpoint && (prevCheckpoint.type === 5 || prevCheckpoint.type === 'DISAPPEAR') ? 'disappear' : 'idle';
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: state };
                    const idleTicks = checkpoint.time * App.FPS;
                    for (let i = 1; i < idleTicks; i++) {
                        this.frameData[localTick + i] = this.frameData[localTick];
                    }
                    localTick += idleTicks;
                    break;
                }
                case 5:
                case 'DISAPPEAR': { // Disappear
                    this.frameData[localTick] = { x: currPos.x, y: currPos.y, state: 'disappear' };
                    localTick++;
                    break;
                }
                case 6:
                case 'APPEAR_AT_POS': { // Reappear
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
        const bestPath = MapTile.get(posToGrid(currPos)).getBestPath(MapTile.get(posToGrid(endPos)), (this.route.motionMode === 1 || this.route.motionMode === 'FLY'));
        bestPath.forEach(e => this.checkpoints.push({ tile: e.tile, type: 0 }));
        moveToCheckpoint(currPos, endPos);
    }
    onClick(clicked = true) {
        if (clicked) {
            UI.clearSelected();

            const timelineBox = TimelineBox.array.find(e => e.action.enemies.includes(this));
            timelineBox.onClick.bind(timelineBox)(false);
            const infoBox = InfoBox.array.find(e => e.enemy.enemyId === this.enemyId);
            infoBox.onClick.bind(infoBox)(false);
        }

        const startPos = gridToPos(this.checkpoints[0].tile.position, true);
        const pathGraphics = [];
        const path = new PIXI.Graphics().moveTo(startPos.x, startPos.y);
        for (const checkpoint of this.checkpoints) {
            const checkPos = gridToPos(checkpoint.tile.position, true);
            switch (checkpoint.type) {
                case 0:
                case 'MOVE': {
                    path.lineStyle(4, 0x770000)
                        .lineTo(checkPos.x, checkPos.y);
                    break;
                }
                case 6:
                case 'APPEAR_AT_POS': {
                    path.lineStyle(1, 0x770000)
                        .lineTo(checkPos.x, checkPos.y);
                    break;
                }
            }
        }
        // Display a flag for hard checkpoints
        for (const checkpoint of this.route.checkpoints) {
            const i = App.levelData.mapData.map.length - 1 - checkpoint.position.row;
            const j = checkpoint.position.col;
            switch (checkpoint.type) {
                case 0:
                case 'MOVE':
                case 6:
                case 'APPEAR_AT_POS': {
                    const graphics = new PIXI.Graphics();
                    graphics.beginFill(0xcc0000)
                        .drawPolygon([
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 28 / 16), App.gridSize * (i + 23 / 16),
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 25 / 16),
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 29 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 29 / 16),
                        ])
                        .endFill();
                    pathGraphics.push(graphics);
                }
            }
        }

        this.enableHighlight();
        pathGraphics.push(path);
        pathGraphics.forEach(g => {
            App.app.stage.addChild(g);
        });

        App.selectedEnemies.push(this);
        App.selectedPath = pathGraphics;
    }
    addGraphics() {
        App.app.stage.addChild(this.spine);
        if (this.highlighted) {
            App.app.stage.addChild(this.highlight);
        }
    }
    removeGraphics() {
        App.app.stage.removeChild(this.spine);
        if (this.highlighted) {
            App.app.stage.removeChild(this.highlight);
        }
    }
    enableHighlight() {
        this.highlighted = true;
        App.app.stage.addChild(this.highlight);
    }
    disableHighlight() {
        this.highlighted = false;
        App.app.stage.removeChild(this.highlight);
    }
    update(currTick) {
        const localTick = currTick - this.startTick;
        if (localTick < 0) {
            this.state = 'waiting';
            this.removeGraphics();
            return;
        }
        if (localTick === 0) {
            this.state = 'start';
            this.addGraphics();
        }
        if (localTick >= this.frameData.length) {
            this.state = 'end';
            this.removeGraphics();
            return;
        }

        const currFrameData = this.frameData[localTick];
        this.spine.x = currFrameData.x;
        this.spine.y = currFrameData.y;
        this.highlight.x = currFrameData.x;
        this.highlight.y = currFrameData.y;
        const skeletonData = this.spine.state.data.skeletonData;

        if (this.state !== currFrameData.state) {
            const animArr = skeletonData.animations.map(anim => anim.name.toLowerCase());
            const getBestMatch = (...stringArr) => { // Get animation name closest to an entry in stringArr, lower index preferred
                const matchArr = stringArr.map(str => findBestMatch(str, animArr));
                const bestMatch = matchArr.reduce((prev, curr) => prev.bestMatch.rating >= curr.bestMatch.rating ? prev : curr);
                return bestMatch;
            }
            switch (currFrameData.state) {
                case 'moving': {
                    this.addGraphics();
                    const bestMatch = getBestMatch('run_loop', 'run', 'move_loop', 'move');
                    const bestAnim = skeletonData.animations[bestMatch.bestMatchIndex];
                    this.spine.state.setAnimation(0, bestAnim.name, true);
                    break;
                }
                case 'idle': {
                    this.addGraphics();
                    const bestMatch = getBestMatch('idle_loop', 'idle');
                    const bestAnim = skeletonData.animations[bestMatch.bestMatchIndex];
                    this.spine.state.setAnimation(0, bestAnim.name, true);
                    break;
                }
                case 'disappear': {
                    this.removeGraphics();
                    break;
                }
                case 'reappear': {
                    this.addGraphics();
                    break;
                }
            }
            this.state = currFrameData.state;
        }
        if (currFrameData.direction) {
            if (currFrameData.direction === 'right') {
                this.spine.scale.x = App.enemyScale;
            }
            else if (currFrameData.direction === 'left') {
                this.spine.scale.x = -App.enemyScale;
            }
        }
        if (!App.autoplay || App.tempPause) this.spine.state.timeScale = 0;
        else if (App.doubleSpeed) this.spine.state.timeScale = 2;
        else this.spine.state.timeScale = 1;
    }
}
