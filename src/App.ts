class App {
    static PRINTDEBUG = false;
    static PRINTLOOP = false;

    static MAXSTAGEWIDTH = 900;
    static MAXSTAGEHEIGHT = 600;
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
    static selectedTimelineBox: TimelineActionBox;
    static selectedInfoBox: InfoBox;

    static tick = 0;
    static prevTicks = [-2, -1];
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

        this.app?.destroy(true, { children: true, texture: false, baseTexture: false });
        this.app = null;
        this.graphics = [];

        Enemy.reset();
        Predefine.reset();
        MapTile.reset();
        Wave.reset();
        WaveAction.reset();
        WaveFragment.reset();
        TimelineActionBox.reset();
        InfoBox.reset();

        App.getTickBar().value = "0";
        this.updateStageInfo();
        document.getElementById('enemy-info').replaceChildren();
        document.getElementById('timeline').replaceChildren();

        await Load.loadNewLevel(id);
    }
    static getTickBar() {
        return document.getElementById('tick') as HTMLInputElement;
    }
    static async ticker(delta){
        try {
            if (++App.skipCount < Math.round(App.app.ticker.FPS / App.FPS)) return; // Skip frames to maintain desired FPS
            App.skipCount = 0;

            // Increment app tick if autoplay is enabled and the tickbar is not being clicked/dragged
            if (App.autoplay && !App.tempPause) {
                App.tick += App.doubleSpeed ? 2 : 1; // Increment by 2 ticks if double speed is on
                App.getTickBar().value = App.tick.toString();
                if (App.tick >= App.maxTick)
                    UI.togglePlay(true);
            }
            else {
                App.tick = parseInt(App.getTickBar().value);
            }

            // Gross fix for pausing enemy spines when the stage is paused
            // If the stage is paused, no need to update stuff
            // However, enemy spines need to be updated following a pause in order to stop their spine anims
            // Therefore, continue updating for one tick after a pause
            if (App.tick !== App.prevTicks[0]) {
                App.update();
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
    }
    static update(){
        Enemy.array.forEach(e => e.update(App.tick));
        Predefine.array.forEach(e => e.update(App.tick));
        App.prevTicks[0] = App.prevTicks[1]; 
        App.prevTicks[1] = App.tick;
    }
    static updateStageInfo() {
        document.getElementById('enemy-count').innerText = `Enemies: ${Enemy.getCount()}`;
        document.getElementById('stage-timer').innerText = `Time: ${Math.floor(App.tick / App.FPS)}/${Math.floor(App.maxTick / App.FPS)}`;
    }
}
