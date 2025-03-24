class Load {
    private static async _loadUI() {
        history.pushState(null, null, `${window.location.pathname}?level=${App.level.id}`);
        document.getElementById('zone-name').innerText = App.activity ? App.activity.name : App.zone.name;
        const levelList = document.getElementById('zone-level');
        levelList.replaceChildren();
        const addLevelListItem = level => {
            if (level.hidden) return;
            levelList.appendChild(new LevelSelectButton(level).element);
        }
        const activity = Activity.get(App.zone.id.split('_')[0]);
        if (activity && activity.hasLevels()) {
            // Activities can have multiple zones (events usually have separate zones for normal, EX, and other special stages)
            // We need to get all levels from all zones in the activity
            activity.getZones().forEach(zone => {
                zone.getLevels().forEach(addLevelListItem);
            })
        }
        else {
            App.zone.getLevels().forEach(addLevelListItem);
        }
    }
    private static async _fetchLevelData() {
        try {
            const levelRes = await fetch(`${Path.levels}/${App.level.path}.json`);
            App.levelData = await levelRes.json();
            App.gridSize = Math.min(App.DEFAULTGRIDSIZE, App.MAXSTAGEWIDTH / (App.levelData.mapData.map[0].length + 2), App.MAXSTAGEHEIGHT / (App.levelData.mapData.map.length + 2));
            App.enemyScale = App.DEFAULTENEMYSCALE * (App.gridSize / App.DEFAULTGRIDSIZE);
        }
        catch (e) {
            const levelRes = await fetch(`${Path.backupLevels}/${App.level.path}.json`);
            App.levelData = await levelRes.json();
            App.gridSize = Math.min(App.DEFAULTGRIDSIZE, App.MAXSTAGEWIDTH / (App.levelData.mapData.map[0].length + 2), App.MAXSTAGEHEIGHT / (App.levelData.mapData.map.length + 2));
            App.enemyScale = App.DEFAULTENEMYSCALE * (App.gridSize / App.DEFAULTGRIDSIZE);
        }
    }
    private static async _fetchPredefineData() {
        if (!Predefine.dataCache) {
            Predefine.dataCache = {};
            const deployRes = await (fetch(`${Path.api}/deployable`));
            const data = await deployRes.json();
            data.forEach(e => Predefine.dataCache[e.canon] = e);
        }
        if (!Predefine.assetCache) {
            Predefine.assetCache = {};
        }
        const addedToLoader = {};
        for (const tokenInst of App.levelData.predefines.tokenInsts) {
            const deployId = tokenInst.inst.characterKey;
            if (Predefine.assetCache[deployId] || Predefine.assetCache[deployId] === 0 || addedToLoader[deployId]) continue;
            try {
                let spinePath = `${Path.deployAssets}/battle/${deployId}/front/${deployId}.skel`;
                if (await urlExists(spinePath)) {
                    App.loader.add(deployId, spinePath);
                    addedToLoader[deployId] = true;
                }
                else {
                    Predefine.assetCache[deployId] = 0;
                    throw new Error('Skel file couldn\'t be found');
                }
            } catch (e) {
                Print.error(e + (': ') + deployId);
            }
        }
        App.loader.load(async (loader, resources) => {
            await sleep(1000);
            Object.keys(resources).forEach(e => Predefine.assetCache[e] = resources[e]);
            Predefine.assetsLoaded = true;
        });
    }
    private static async _createMapTiles() {
        for (let i = 0; i < App.levelData.mapData.map.length; i++) {
            for (let j = 0; j < App.levelData.mapData.map[i].length; j++) {
                MapTile.create({ row: i, col: j });
            }
        }
    }
    private static async _fetchEnemyData() {
        if (!Enemy.dataCache) {
            Enemy.dataCache = {};
            const enemyRes = await fetch(`${Path.api}/enemy`);
            const data = await enemyRes.json();
            data.forEach(e => Enemy.dataCache[e.canon] = e);
        }
        if (!Enemy.assetCache) {
            Enemy.assetCache = {};
        }
        for (const enemyRef of App.levelData.enemyDbRefs) {
            if (Enemy.assetCache[enemyRef.id] || Enemy.assetCache[enemyRef.id] === 0) continue;
            try {
                let spinePath = Path.enemyAssets + `/${enemyRef.id}/${enemyRef.id}.skel`;
                if (Enemy._idOverride[enemyRef.id])
                    spinePath = spinePath.split(enemyRef.id).join(Enemy._idOverride[enemyRef.id]);
                if (!Enemy.dataCache[enemyRef.id] || !await urlExists(spinePath))
                    spinePath = Path.enemyAssets + `/${enemyRef.id.split(/_[^_]+$/).join('')}/${enemyRef.id.split(/_[^_]+$/).join('')}.skel`;
                if (await urlExists(spinePath)) {
                    App.loader.add(enemyRef.id, spinePath);
                }
                else {
                    Enemy.assetCache[enemyRef.id] = 0;
                    throw new Error('Skel file couldn\'t be found');
                }
            } catch (e) {
                Print.error(e + (': ') + enemyRef.id);
            }
        }
        App.loader.load(async (loader, resources) => {
            await sleep(1000);
            Object.keys(resources).forEach(e => Enemy.assetCache[e] = resources[e]);
            Enemy.assetsLoaded = true;
        });
    }
    private static async _createEnemies() {
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
            .sort((a, b) => a.data.value.excel.sortId - b.data.value.excel.sortId)                        // sort by internal sortId
            .filter((e, index, self) => index === self.findIndex(f => f.enemyId === e.enemyId))           // get one instance of each enemy
            .forEach(e => document.getElementById('enemy-info').appendChild(InfoBox.create(e).element));  // create info box and append to element

        SpawnAction.array
            .sort((a, b) => a.tick - b.tick)                                                                      // sort by increasing time
            .forEach(e => document.getElementById('enemy-timeline').appendChild(TimelineBox.create(e).element));  // create timeline box and append to element
    }
    private static async _loadStageGraphics() {
        const appWidth = Math.round((App.levelData.mapData.map[0].length + 2) * App.gridSize);
        const appHeight = Math.round((App.levelData.mapData.map.length + 2) * App.gridSize);
        Print.info(`App size: ${appWidth}x${appHeight}`);
        Print.info(`Grid size: ${App.gridSize}`);

        App.getTickBar().setAttribute('style', `width:${appWidth}px`); // Scale slider with app size
        document.getElementById('title-header').setAttribute('style', `width:${appWidth}px`);

        App.app = new PIXI.Application({ width: appWidth, height: appHeight });
        document.getElementById('app-stage').appendChild(App.app.view);
        App.app.renderer.backgroundColor = Color.bg;

        App.graphics = [];

        App.graphics.push(...MapTile.array.flat().map(e => e.graphics));
        App.graphics.push(...Predefine.array.map(e => e.graphics));
        App.graphics.push(...Enemy.array.map(e => e.spine));

        App.app.stage.addChild(...App.graphics);
    }
    static async loadNewLevel(id: string) {
        App.level = Level.get(id);
        App.zone = Zone.get(App.level.zone);
        App.activity = Activity.get(App.zone.id.split('_')[0]);
        App.type = Type.get(App.zone.type);
        Print.info(App.type);
        Print.info(App.zone);
        Print.info(App.activity);
        Print.info(App.level);

        document.getElementById('stage-name').innerText = 'Loading UI...';
        Print.time('Load UI');
        await Load._loadUI();
        Print.timeEnd('Load UI');

        document.getElementById('stage-name').innerText = 'Loading level data...';
        Print.time('Load level data');
        await Load._fetchLevelData();
        Print.timeEnd('Load level data');

        document.getElementById('stage-name').innerText = 'Loading predefines...';
        Print.time('Load predefines');
        await Load._fetchPredefineData();
        Print.timeEnd('Load predefines');
        while (!Predefine.assetsLoaded) await sleep(250);

        document.getElementById('stage-name').innerText = 'Loading map tiles...';
        Print.time('Load map tiles');
        await Load._createMapTiles();
        Print.timeEnd('Load map tiles');

        document.getElementById('stage-name').innerText = 'Loading enemies...';
        Print.time('Load enemies');
        await Load._fetchEnemyData();
        Print.timeEnd('Load enemies');
        while (!Enemy.assetsLoaded) await sleep(250);

        document.getElementById('stage-name').innerText = 'Loading enemy paths...';
        Print.time('Load paths');
        await Load._createEnemies();
        Print.timeEnd('Load paths');
        Print.table(Enemy.array);
        Print.table(SpawnAction.array);

        document.getElementById('stage-name').innerText = 'Loading graphics...';
        Print.time('Load graphics');
        await Load._loadStageGraphics();
        Print.timeEnd('Load graphics');

        App.getTickBar().max = App.maxTick.toString();
        document.getElementById('stage-name').innerText = App.level.code + ' - ' + App.level.name;
        App.app.ticker.add(async (delta) => {
            try {
                if (++App.skipCount < Math.round(App.app.ticker.FPS / App.FPS)) return; // Adjust for high fps displays
                App.skipCount = 0;

                if (App.autoplay && !App.tempPause) {
                    App.tick += App.doubleSpeed ? 2 : 1; // Increment by 2 ticks if double speed is on
                    App.getTickBar().value = App.tick.toString();
                    if (App.tick >= App.maxTick)
                        UI.togglePlay(true);
                }
                else {
                    App.tick = parseInt(App.getTickBar().value);
                }

                if (App.tick !== App.prevTicks[0]) {
                    Enemy.array.forEach(e => e.update(App.tick));
                    App.prevTicks[0] = App.prevTicks[1]; // gross fix for pausing enemy spines when the stage is paused
                    App.prevTicks[1] = App.tick;
                }

                App.inc++;
                if (App.inc % 6 === 0) {
                    App.updateStageInfo(); // Update enemy count every 6 frames
                }
                if (App.inc % 60 === 0 && App.PRINTLOOP) {
                    Print.timeEnd('Loop');
                    Print.time('Loop');
                }
            } catch (e) {
                Print.error(e);
                App.app.stop();
            }
        });
        App.app.start();
    }
}
