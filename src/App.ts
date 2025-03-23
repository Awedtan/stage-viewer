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
        Predefine.reset();
        MapTile.reset();
        SpawnAction.reset();
        TimelineBox.reset();
        InfoBox.reset();

        App.getTickBar().value = "0";
        this.updateStageInfo();
        document.getElementById('enemy-info').replaceChildren();
        document.getElementById('enemy-timeline').replaceChildren();

        await Load.loadNewLevel(id);
    }
    static getTickBar() {
        return document.getElementById('tick') as HTMLInputElement;
    }
    static updateStageInfo() {
        document.getElementById('enemy-count').innerText = `Enemies: ${Enemy.getCount()}`;
        document.getElementById('stage-timer').innerText = `Time: ${Math.floor(App.tick / App.FPS)}/${Math.floor(App.maxTick / App.FPS)}`;
    }
}
