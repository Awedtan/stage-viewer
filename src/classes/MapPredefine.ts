class MapPredefine {
    static array: MapPredefine[] = [];
    static create(inst) {
        try {
            const predefine = new MapPredefine(inst);
            this.array.push(predefine);
            return predefine;
        }
        catch (e) {
            return null;
        }
    }
    static reset() {
        this.array = [];
    }

    position: { row: number, col: number };
    key: string;
    _data: any;
    _graphics: PIXI.Graphics;
    constructor(inst) {
        this.position = inst.position;
        this.key = inst.inst.characterKey;
        this._data = inst;
        this._graphics = null;
    }
    createGraphics() {
        const i = App.levelData.mapData.map.length - 1 - this.position.row;
        const j = this.position.col;
        this._graphics = new PIXI.Graphics();
        switch (this.key) {
            case 'trap_409_xbwood': {
                this._graphics.beginFill(Color.wood)
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
                this._graphics.beginFill(Color.stone)
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
                this._graphics.beginFill(Color.wall)
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
                this._graphics.beginFill(Color.wall)
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
                this._graphics.beginFill(Color.unknown)
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
        return this._graphics;
    }
}
