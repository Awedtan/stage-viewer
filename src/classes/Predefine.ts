class Predefine {
    static assetCache;
    static dataCache;
    static array: Predefine[] = [];
    static assetsLoaded = false;
    static create(inst) {
        try {
            const predefine = new Predefine(inst);
            this.array.push(predefine);
            return predefine;
        }
        catch (e) {
            return null;
        }
    }
    static reset() {
        this.array = [];
        this.assetsLoaded = false;
    }

    position: { row: number, col: number };
    key: string;
    _data: any;
    graphics: PIXI.Graphics | PIXI.spine.Spine;
    hasSpine: boolean = false;
    constructor(inst) {
        this.position = inst.position;
        this.key = inst.inst.characterKey;
        this._data = inst;
        this.createGraphics();
    }
    private async createGraphics() {
        if (Predefine.assetCache[this.key]) {
            this.hasSpine = true;
            const i = this.position.row;
            const j = this.position.col;

            this.graphics = new PIXI.spine.Spine(Predefine.assetCache[this.key].spineData);
            this.graphics.skeleton.setSkin(this.graphics.state.data.skeletonData.skins[0])
            const bestMatch = getBestAnimMatch(this.graphics.spineData, ['idle']);
            this.graphics.state.setAnimation(0, bestMatch.name, true)
            this.graphics.x = gridToPos({ row: i, col: j }).x;
            this.graphics.y = gridToPos({ row: i, col: j }).y;
            this.graphics.scale.x = App.enemyScale;
            this.graphics.scale.y = App.enemyScale;
        }
        else {
            this.hasSpine = false;
            const i = App.levelData.mapData.map.length - 1 - this.position.row;
            const j = this.position.col;

            this.graphics = new PIXI.Graphics();
            switch (this.key) {
                case 'trap_409_xbwood': {
                    this.graphics.beginFill(Color.wood)
                        .drawPolygon([
                            App.gridSize * (j + 20 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 21 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 19 / 16),
                            App.gridSize * (j + 28 / 16), App.gridSize * (i + 19 / 16),
                            App.gridSize * (j + 28 / 16), App.gridSize * (i + 29 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 29 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 24 / 16),
                            App.gridSize * (j + 19 / 16), App.gridSize * (i + 22 / 16),
                        ])
                        .endFill();
                    break;
                }
                case 'trap_410_xbstone': {
                    this.graphics.beginFill(Color.stone)
                        .drawPolygon([
                            App.gridSize * (j + 19 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 26 / 16),
                            App.gridSize * (j + 27 / 16), App.gridSize * (i + 23 / 16),
                            App.gridSize * (j + 29 / 16), App.gridSize * (i + 23 / 16),
                            App.gridSize * (j + 29 / 16), App.gridSize * (i + 28 / 16),
                            App.gridSize * (j + 19 / 16), App.gridSize * (i + 28 / 16),
                        ])
                        .endFill();
                    break;
                }
                case 'trap_411_xbiron': {
                    this.graphics.beginFill(Color.wall)
                        .drawPolygon([
                            App.gridSize * (j + 20 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 21 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 21 / 16), App.gridSize * (i + 21 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 21 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 29 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 29 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 28 / 16),
                            App.gridSize * (j + 21 / 16), App.gridSize * (i + 28 / 16),
                            App.gridSize * (j + 21 / 16), App.gridSize * (i + 29 / 16),
                            App.gridSize * (j + 20 / 16), App.gridSize * (i + 29 / 16),
                        ])
                        .drawPolygon([
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 19 / 16),
                            App.gridSize * (j + 26 / 16), App.gridSize * (i + 19 / 16),
                            App.gridSize * (j + 26 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 27 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 27 / 16), App.gridSize * (i + 19 / 16),
                            App.gridSize * (j + 28 / 16), App.gridSize * (i + 19 / 16),
                            App.gridSize * (j + 28 / 16), App.gridSize * (i + 28 / 16),
                            App.gridSize * (j + 27 / 16), App.gridSize * (i + 28 / 16),
                            App.gridSize * (j + 27 / 16), App.gridSize * (i + 27 / 16),
                            App.gridSize * (j + 26 / 16), App.gridSize * (i + 27 / 16),
                            App.gridSize * (j + 26 / 16), App.gridSize * (i + 28 / 16),
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 28 / 16),
                        ])
                        .endFill();
                    break;
                }
                case 'trap_413_hiddenstone': {
                    this.graphics.beginFill(Color.wall)
                        .drawPolygon([
                            App.gridSize * (j + 18 / 16), App.gridSize * (i + 18 / 16),
                            App.gridSize * (j + 18 / 16), App.gridSize * (i + 30 / 16),
                            App.gridSize * (j + 30 / 16), App.gridSize * (i + 30 / 16),
                            App.gridSize * (j + 30 / 16), App.gridSize * (i + 18 / 16),
                        ])
                        .beginFill(Color.road)
                        .drawPolygon([
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 18 / 16),
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 18 / 16),
                            App.gridSize * (j + 26 / 16), App.gridSize * (i + 25 / 16),
                        ])
                        .drawPolygon([
                            App.gridSize * (j + 24 / 16), App.gridSize * (i + 18 / 16),
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 20 / 16),
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 23 / 16),
                        ])
                        .endFill();
                    break;
                }
                default: {
                    this.graphics.beginFill(Color.unknown)
                        .drawPolygon([
                            App.gridSize * (j + 20 / 16), App.gridSize * (i + 19 / 16),
                            App.gridSize * (j + 28 / 16), App.gridSize * (i + 19 / 16),
                            App.gridSize * (j + 28 / 16), App.gridSize * (i + 26 / 16),
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 26 / 16),
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 27 / 16),
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 27 / 16),
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 24 / 16),
                            App.gridSize * (j + 26 / 16), App.gridSize * (i + 24 / 16),
                            App.gridSize * (j + 26 / 16), App.gridSize * (i + 21 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 21 / 16),
                            App.gridSize * (j + 22 / 16), App.gridSize * (i + 23 / 16),
                            App.gridSize * (j + 20 / 16), App.gridSize * (i + 23 / 16),
                        ])
                        .drawPolygon([
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 28 / 16),
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 28 / 16),
                            App.gridSize * (j + 25 / 16), App.gridSize * (i + 30 / 16),
                            App.gridSize * (j + 23 / 16), App.gridSize * (i + 30 / 16),
                        ])
                        .endFill();
                    break;
                }
            }
        }
    }
    public update(currTick) {
        if (!this.hasSpine) return;

        const graphics = this.graphics as PIXI.spine.Spine;

        if (!App.autoplay || App.tempPause) graphics.state.timeScale = 0;
        else if (App.doubleSpeed) graphics.state.timeScale = 2;
        else graphics.state.timeScale = 1;
    }
}
