class App {
    static PRINTDEBUG = false;
    static PRINTLOOP = false;

    static MAXSTAGEWIDTH = 900;
    static MAXSTAGEHEIGHT = 700;
    static DEFAULTENEMYSCALE = 0.21;
    static DEFAULTGRIDSIZE = 70;
    static enemyScale;
    static gridSize;
    static FPS = 60;
    static BASESPEED = 0.65; // Arbitrary number

    static loader = new PIXI.loaders.Loader();
    static app;
    static graphics = [];

    static type: Type;
    static zone: Zone;
    static activity: Activity;
    static level: Level;

    static levelData: any;
    static selectedEnemies: Enemy[] = [];
    static selectedPath = [];
    static selectedTimelineBox: TimelineBox;
    static selectedInfoBox: InfoBox;

    static tick = 0;
    static maxTick = 0;
    static skipCount = 0;
    static autoplay = false;
    static doubleSpeed = false;
    static tempPause = false;
    static inc = 0;

    static async changeLevel(id: string) {
        this.levelData = null;
        this.selectedEnemies = [];
        this.selectedPath = [];
        this.selectedTimelineBox = null;
        this.tick = 0;
        this.maxTick = 0;
        this.skipCount = 0;
        this.autoplay = false;
        this.tempPause = false;
        this.inc = 0;

        this.app.destroy(true, { children: true, texture: false, baseTexture: false });
        this.app = null;
        this.graphics = [];

        Enemy.reset();
        MapPredefine.reset();
        MapTile.reset();
        SpawnAction.reset();
        TimelineBox.reset();
        InfoBox.reset();

        App.getTickBar().value = "0";
        this.updateStageInfo();
        document.getElementById('enemy-info').replaceChildren();
        document.getElementById('enemy-timeline').replaceChildren();

        await this.loadLevel(id);
    }
    static async loadLevel(id: string) {
        this.level = Level.get(id);
        this.zone = Zone.get(this.level.zone);
        this.activity = Activity.get(this.zone.id.split('_')[0]);
        this.type = Type.get(this.zone.type);
        Print.info(this.type);
        Print.info(this.zone);
        Print.info(this.activity);
        Print.info(this.level);

        Print.time('Load UI');
        history.pushState(null, null, `${window.location.pathname}?level=${this.level.id}`);
        document.getElementById('stage-name').innerText = 'Loading...';
        document.getElementById('zone-name').innerText = this.activity ? this.activity.name : this.zone.name;
        const levelList = document.getElementById('zone-level');
        levelList.replaceChildren();
        const addLevelListItem = level => {
            if (level.hidden) return;
            levelList.appendChild(new LevelSelectButton(level).element);
        }
        const activity = Activity.get(this.zone.id.split('_')[0]);
        if (activity && activity.hasLevels()) {
            // Activities can have multiple zones (events usually have separate zones for normal, EX, and other special stages)
            // We need to get all levels from all zones in the activity
            activity.getZones().forEach(zone => {
                zone.getLevels().forEach(addLevelListItem);
            })
        }
        else {
            this.zone.getLevels().forEach(addLevelListItem);
        }
        Print.timeEnd('Load UI');
        document.getElementById('stage-name').innerText = 'Loading stage...';
        Print.time('Load level');
        try {
            // Calculate app sizes, create tile and predefine graphics
            this.graphics = [];
            const levelRes = await fetch(`${Path.levels}/${this.level.path}.json`);
            this.levelData = await levelRes.json();
            const map = this.levelData.mapData.map;
            this.gridSize = this.MAXSTAGEWIDTH / (map[0].length + 2);
            if ((map.length + 2) * this.gridSize > this.MAXSTAGEHEIGHT)
                this.gridSize = this.MAXSTAGEHEIGHT / (map.length + 2);
            if (this.gridSize > this.DEFAULTGRIDSIZE)
                this.gridSize = this.DEFAULTGRIDSIZE;
            this.enemyScale = this.DEFAULTENEMYSCALE * (this.gridSize / this.DEFAULTGRIDSIZE);
            for (let i = 0; i < map.length; i++) for (let j = 0; j < map[i].length; j++)
                this.graphics.push(MapTile.get({ row: i, col: j }).createGraphics());
            MapPredefine.array.forEach(e => this.graphics.push(e.createGraphics()));
        }
        catch (e) {
            // Calculate app sizes, create tile and predefine graphics
            this.graphics = [];
            const levelRes = await fetch(`${Path.backupLevels}/${this.level.path}.json`);
            this.levelData = await levelRes.json();
            const map = this.levelData.mapData.map;
            this.gridSize = this.MAXSTAGEWIDTH / (map[0].length + 2);
            if ((map.length + 2) * this.gridSize > this.MAXSTAGEHEIGHT)
                this.gridSize = this.MAXSTAGEHEIGHT / (map + 2);
            if (this.gridSize > this.DEFAULTGRIDSIZE)
                this.gridSize = this.DEFAULTGRIDSIZE;
            this.enemyScale = this.DEFAULTENEMYSCALE * (this.gridSize / this.DEFAULTGRIDSIZE);
            for (let i = 0; i < map.length; i++) for (let j = 0; j < map[i].length; j++)
                this.graphics.push(MapTile.get({ row: i, col: j }).createGraphics());
            MapPredefine.array.forEach(e => this.graphics.push(e.createGraphics()));
        }

        // Create PIXI app and add stage graphics
        const appWidth = Math.round((this.levelData.mapData.map[0].length + 2) * this.gridSize);
        const appHeight = Math.round((this.levelData.mapData.map.length + 2) * this.gridSize);
        Print.info(`App size: ${appWidth}x${appHeight}`);
        Print.info(`Grid size: ${this.gridSize}`);
        this.app = new PIXI.Application({ width: appWidth, height: appHeight });
        App.getTickBar().setAttribute('style', `width:${appWidth}px`); // Scale slider with app size
        document.getElementById('title-header').setAttribute('style', `width:${appWidth}px`);
        document.getElementById('app-stage').appendChild(this.app.view);
        this.app.renderer.backgroundColor = Color.bg;
        this.graphics.forEach(e => this.app.stage.addChild(e));
        Print.timeEnd('Load level');
        document.getElementById('stage-name').innerText = 'Loading enemies...';
        Print.time('Load enemies');
        await Enemy.loadAll();
        Print.timeEnd('Load enemies');
        while (!Enemy.assetsLoaded) await sleep(250); // Ensure enemy assets are loaded before creating enemy spines

        document.getElementById('stage-name').innerText = 'Creating enemy paths...';
        Print.time('Load paths');

        /*
        Important notes on how enemy paths are calculated
        Enemy paths must be precalculated to allow for scrubbing and skipping
        Stages contains waves, waves contain fragments, fragments contain actions
        Actions control enemy spawns as well as other stage events

        Delays are stored in seconds, need to convert them into discrete ticks
        Waves have pre-delays, post-delays, and a max wait time (TODO)
        Fragments have pre-delays
        Actions have the following properties:
            key: ID of enemy to spawn
            count: # of enemies to spawn
            preDelay: delay before first enemy spawns
            interval: delay between each enemy spawn
            routeIndex: which route to use for all enemies spawned by this action
            blockFragment: TODO (00_06 sets this to true)
            dontBlockWave: whether to prevent the next wave from starting until all enemies spawned by this action are dead/reached the end
        */

        let precalcTick = 0; // Precalculated global tick for all actions
        let fragBlockTick = 0; // Fragment blocker tick (TODO)
        let waveBlockTick = 0; // Wave blocker tick

        for (const wave of App.levelData.waves) {
            precalcTick += wave.preDelay * App.FPS;

            for (const fragment of wave.fragments) {
                precalcTick += fragment.preDelay * App.FPS;

                for (const action of fragment.actions) {
                    const actionType = {
                        0: 1, // spawn
                        1: 0, // skip??
                        2: 0, // tutorial/story popup
                        3: 0, // not used
                        4: 0, // change bgm
                        5: 0, // enemy intro popup
                        6: 0, // spawn npc/trap
                        7: 0, // stage effect (rumble)
                        8: 0, // environmental effect (blizzards)
                        9: 0, // some sss tutorial thing idk
                        'SPAWN': 1
                    }
                    if (!actionType[action.actionType] || action.key === '' || Enemy.errorArray.includes(action.key)) continue;

                    // Action predelays are relative to the fragment start and do not stack
                    precalcTick += action.preDelay * App.FPS;

                    const actionEnemies = [];

                    for (let i = 0; i < action.count; i++) {
                        // Create an enemy at the current tick
                        const enemy = Enemy.create(precalcTick, action);

                        if (!enemy) continue;

                        actionEnemies.push(enemy);
                        const enemyMaxTick = precalcTick + enemy.frameData.length;

                        // Update how many ticks the stage lasts
                        App.maxTick = Math.max(App.maxTick, enemyMaxTick);
                        if (!action.dontBlockWave) {
                            // Update which tick all enemies in the current wave finish
                            waveBlockTick = Math.max(waveBlockTick, enemyMaxTick);
                        }

                        precalcTick += action.interval * App.FPS;
                    }

                    // Reset precalcTick to the start of the fragment, since action predelays don't stack
                    precalcTick -= (action.interval * action.count + action.preDelay) * App.FPS;

                    SpawnAction.create(precalcTick + action.preDelay * App.FPS, action, actionEnemies);
                }

                // Since precalcTick was reset, add back the largest action predelay to precalcTick
                const maxActionDelay = fragment.actions.reduce((prev, curr) => (prev.preDelay > curr.preDelay) ? prev.preDelay : curr.preDelay, 1)
                precalcTick += maxActionDelay * App.FPS;
            }

            precalcTick = Math.max(precalcTick, waveBlockTick);
            precalcTick += wave.postDelay * App.FPS;
        }

        Enemy.array
            .filter((e, index, self) => index === self.findIndex(f => f.enemyId === e.enemyId))   // get one instance of each enemy
            .sort((a, b) => a.data.value.excel.sortId - b.data.value.excel.sortId)                // sort by internal sortId
            .forEach(e => document.getElementById('enemy-info').appendChild(InfoBox.create(e).element));  // create info box and append to element

        SpawnAction.array
            .sort((a, b) => a.tick - b.tick)                                                              // sort by increasing time
            .forEach(e => document.getElementById('enemy-timeline').appendChild(TimelineBox.create(e).element));  // create timeline box and append to element

        Print.timeEnd('Load paths');
        Print.table(Enemy.array);
        Print.table(SpawnAction.array);

        App.getTickBar().max = this.maxTick.toString();
        document.getElementById('stage-name').innerText = this.level.code + ' - ' + this.level.name;
        this.app.ticker.add(async (delta) => {
            try {
                if (++this.skipCount < Math.round(this.app.ticker.FPS / this.FPS)) return; // Adjust for high fps displays
                this.skipCount = 0;

                if (this.autoplay && !this.tempPause) {
                    this.tick += this.doubleSpeed ? 2 : 1; // Increment by 2 ticks if double speed is on
                    App.getTickBar().value = this.tick.toString();
                    if (this.tick >= this.maxTick)
                        UI.togglePlay(true);
                }
                else {
                    this.tick = parseInt(App.getTickBar().value);
                }
                Enemy.updateAll(this.tick);

                this.inc++;
                if (this.inc % 6 === 0) {
                    this.updateStageInfo(); // Update enemy count every 6 frames
                }
                if (this.inc % 60 === 0 && App.PRINTLOOP) {
                    Print.timeEnd('Loop');
                    Print.time('Loop');
                }
            } catch (e) {
                Print.error(e);
                this.app.stop();
            }
        });
        this.app.start();
    }
    static getTickBar() {
        return document.getElementById('tick') as HTMLInputElement;
    }
    static updateStageInfo() {
        document.getElementById('enemy-count').innerText = `Enemies: ${Enemy.getCount()}`;
        document.getElementById('stage-timer').innerText = `Time: ${Math.floor(App.tick / App.FPS)}/${Math.floor(App.maxTick / App.FPS)}`;
    }
}
