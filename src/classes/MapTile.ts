class MapTile {
    static _inaccessible = 9;
    static _impassables = ['tile_fence', 'tile_fence_bound', 'tile_forbidden', 'tile_hole'];
    static _heightType = {
        0: 0,
        1: 1,
        'LOWLAND': 0,
        'HIGHLAND': 1,
    };
    static array: MapTile[][] = [];
    static get({ row, col }) {
        if (!this.array[row])
            this.array[row] = [];
        if (!this.array[row][col])
            this.array[row][col] = new MapTile({ row, col });
        return this.array[row][col];
    }
    static reset() {
        this.array = [];
    }

    _data: any;
    access: number;
    _graphics: PIXI.Graphics;
    position: { row: number, col: number };
    constructor({ row, col }) {
        if (row < 0 || row >= App.levelData.mapData.map.length || col < 0 || col >= App.levelData.mapData.map[0].length)
            return null;

        this.position = { row, col };

        if (App.levelData.predefines) {
            if (App.levelData.predefines.characterInsts)
                App.levelData.predefines.characterInsts
                    .filter(e => e.position.row === this.position.row && e.position.col === this.position.col)
                    .forEach(e => MapPredefine.create(e));
            if (App.levelData.predefines.tokenInsts)
                App.levelData.predefines.tokenInsts
                    .filter(e => e.position.row === this.position.row && e.position.col === this.position.col)
                    .forEach(e => MapPredefine.create(e));
        }

        this._data = App.levelData.mapData.tiles[App.levelData.mapData.map[App.levelData.mapData.map.length - row - 1][col]];
        this.access = 0; // Tiles are accessible if their access values are within 1 of each other
        if (MapTile._heightType[this._data.heightType] || MapTile._impassables.includes(this._data.tileKey)) this.access = MapTile._inaccessible;
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
        const i = App.levelData.mapData.map.length - 1 - this.position.row;
        const j = this.position.col;
        const defaultColor = MapTile._heightType[this._data.heightType] ? Color.wall : Color.road;
        this._graphics = new PIXI.Graphics().beginFill(defaultColor)
            .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
            .endFill();
        switch (this._data.tileKey) {
            // BASICS
            case 'tile_end': {
                const yAdj = Color.triLength / 4;
                const rad30 = 30 * Math.PI / 180
                this._graphics = new PIXI.Graphics().lineStyle(Color.lineWidth, Color.end)
                    .moveTo(App.gridSize * (j + 1.5), App.gridSize * (i + (24 - Color.triLength / Math.cos(rad30) + yAdj) / 16))
                    .lineTo(App.gridSize * (j + (24 + Color.triLength) / 16), App.gridSize * (i + (24 + (Color.triLength * Math.tan(rad30)) + yAdj) / 16))
                    .lineTo(App.gridSize * (j + (24 - Color.triLength) / 16), App.gridSize * (i + (24 + (Color.triLength * Math.tan(rad30)) + yAdj) / 16))
                    .lineTo(App.gridSize * (j + 1.5), App.gridSize * (i + (24 - Color.triLength / Math.cos(rad30) + yAdj) / 16))
                    .lineStyle(Color.lineWidth, Color.end)
                    .moveTo(App.gridSize * (j + 1.5), App.gridSize * (i + (24 - Color.triLength / 3) / 16))
                    .lineTo(App.gridSize * (j + 1.5), App.gridSize * (i + (24 + Color.triLength / 3) / 16))
                    .beginFill(Color.end)
                    .drawCircle(App.gridSize * (j + 1.5), App.gridSize * (i + (24 + Color.triLength * 9 / 16) / 16), Color.lineWidth / 4)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.end, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
            case 'tile_fence':
            case 'tile_fence_bound': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.fence, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
            case 'tile_flowerf':
            case 'tile_creepf':
            case 'tile_floor': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.floor, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
            case 'tile_flystart': {
                this._graphics = new PIXI.Graphics().beginFill(Color.start)
                    .drawPolygon([
                        App.gridSize * (j + 21 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 24 / 16), App.gridSize * (i + 23 / 16),
                        App.gridSize * (j + 27 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 24 / 16),
                        App.gridSize * (j + 27 / 16), App.gridSize * (i + 27 / 16),
                        App.gridSize * (j + 24 / 16), App.gridSize * (i + 25 / 16),
                        App.gridSize * (j + 21 / 16), App.gridSize * (i + 27 / 16),
                        App.gridSize * (j + 23 / 16), App.gridSize * (i + 24 / 16),
                    ])
                    .endFill()
                    .lineStyle(Color.lineWidth, Color.start)
                    .drawCircle(App.gridSize * (j + 21 / 16), App.gridSize * (i + 21 / 16), App.gridSize * 2.5 / 16)
                    .drawCircle(App.gridSize * (j + 27 / 16), App.gridSize * (i + 21 / 16), App.gridSize * 2.5 / 16)
                    .drawCircle(App.gridSize * (j + 27 / 16), App.gridSize * (i + 27 / 16), App.gridSize * 2.5 / 16)
                    .drawCircle(App.gridSize * (j + 21 / 16), App.gridSize * (i + 27 / 16), App.gridSize * 2.5 / 16)
                    .lineStyle(Color.outlineWidth, Color.start, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
            case 'tile_forbidden': {
                this._graphics = new PIXI.Graphics().beginFill(Color.void)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill();
                break;
            }
            case 'tile_empty':
            case 'tile_hole': {
                this._graphics = new PIXI.Graphics().beginFill(Color.void)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.hole, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
            case 'tile_flower':
            case 'tile_creep':
            case 'tile_road': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill();
                break;
            }
            case 'tile_start': {
                const yAdj = Color.triLength / 4;
                const rad30 = 30 * Math.PI / 180
                this._graphics = new PIXI.Graphics().lineStyle(Color.lineWidth, Color.start)
                    .moveTo(App.gridSize * (j + 1.5), App.gridSize * (i + (24 - Color.triLength / Math.cos(rad30) + yAdj) / 16))
                    .lineTo(App.gridSize * (j + (24 + Color.triLength) / 16), App.gridSize * (i + (24 + (Color.triLength * Math.tan(rad30)) + yAdj) / 16))
                    .lineTo(App.gridSize * (j + (24 - Color.triLength) / 16), App.gridSize * (i + (24 + (Color.triLength * Math.tan(rad30)) + yAdj) / 16))
                    .lineTo(App.gridSize * (j + 1.5), App.gridSize * (i + (24 - Color.triLength / Math.cos(rad30) + yAdj) / 16))
                    .lineStyle(Color.lineWidth, Color.start)
                    .moveTo(App.gridSize * (j + 1.5), App.gridSize * (i + (24 - Color.triLength / 3) / 16))
                    .lineTo(App.gridSize * (j + 1.5), App.gridSize * (i + (24 + Color.triLength / 3) / 16))
                    .beginFill(Color.start)
                    .drawCircle(App.gridSize * (j + 1.5), App.gridSize * (i + (24 + Color.triLength * 9 / 16) / 16), Color.lineWidth / 4)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.start, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
            case 'tile_telin': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill()
                    .beginFill(Color.tunnel)
                    .drawPolygon([
                        App.gridSize * (j + 4 / 4), App.gridSize * (i + 5 / 4),
                        App.gridSize * (j + 5 / 4), App.gridSize * (i + 5 / 4),
                        App.gridSize * (j + 5 / 4), App.gridSize * (i + 6 / 4),
                        App.gridSize * (j + 6 / 4), App.gridSize * (i + 6 / 4),
                        App.gridSize * (j + 6 / 4), App.gridSize * (i + 7 / 4),
                        App.gridSize * (j + 7 / 4), App.gridSize * (i + 7 / 4),
                        App.gridSize * (j + 7 / 4), App.gridSize * (i + 8 / 4),
                        App.gridSize * (j + 4 / 4), App.gridSize * (i + 8 / 4),
                    ])
                    .drawPolygon([
                        App.gridSize * (j + 24 / 16), App.gridSize * (i + 19 / 16),
                        App.gridSize * (j + 28 / 16), App.gridSize * (i + 23 / 16),
                        App.gridSize * (j + 29 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 29 / 16), App.gridSize * (i + 25 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 25 / 16),
                        App.gridSize * (j + 27 / 16), App.gridSize * (i + 24 / 16),
                        App.gridSize * (j + 23 / 16), App.gridSize * (i + 20 / 16),
                    ])
                    .endFill();
                break;
            }
            case 'tile_telout': {
                this._graphics = new PIXI.Graphics().beginFill(Color.road)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill()
                    .beginFill(Color.tunnel)
                    .drawPolygon([
                        App.gridSize * (j + 8 / 4), App.gridSize * (i + 5 / 4),
                        App.gridSize * (j + 7 / 4), App.gridSize * (i + 5 / 4),
                        App.gridSize * (j + 7 / 4), App.gridSize * (i + 6 / 4),
                        App.gridSize * (j + 6 / 4), App.gridSize * (i + 6 / 4),
                        App.gridSize * (j + 6 / 4), App.gridSize * (i + 7 / 4),
                        App.gridSize * (j + 5 / 4), App.gridSize * (i + 7 / 4),
                        App.gridSize * (j + 5 / 4), App.gridSize * (i + 8 / 4),
                        App.gridSize * (j + 8 / 4), App.gridSize * (i + 8 / 4),
                    ])
                    .drawPolygon([
                        App.gridSize * (j + 19 / 16), App.gridSize * (i + 24 / 16),
                        App.gridSize * (j + 23 / 16), App.gridSize * (i + 20 / 16),
                        App.gridSize * (j + 21 / 16), App.gridSize * (i + 19 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 19 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 23 / 16),
                        App.gridSize * (j + 24 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 20 / 16), App.gridSize * (i + 25 / 16),
                    ])
                    .endFill();
                break;
            }
            case 'tile_passable_wall':
            case 'tile_passable_wall_forbidden':
            case 'tile_wall': {
                this._graphics = new PIXI.Graphics().beginFill(Color.wall)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill();
                break;
            }
            // WATER
            case 'tile_deepwater':
            case 'tile_shallowwater':
            case 'tile_deepsea':
            case 'tile_water':
            case "tile_xbdpsea":
            case 'tile_puddle': {
                this._graphics = new PIXI.Graphics().beginFill(Color.end)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill();
                break;
            }
            // SPECIAL
            case 'tile_bigforce': {
                this._graphics.beginFill(Color.push)
                    .drawRect(App.gridSize * (j + 21 / 16), App.gridSize * (i + 19 / 16), Color.lineWidth * 2, App.gridSize * 10 / 16)
                    .endFill()
                    .lineStyle(Color.lineWidth, Color.push, 1, 0)
                    .drawPolygon([
                        App.gridSize * (j + 22 / 16), App.gridSize * (i + 22 / 16),
                        App.gridSize * (j + 26 / 16), App.gridSize * (i + 18 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 22 / 16),
                        App.gridSize * (j + 28 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 24 / 16),
                        App.gridSize * (j + 28 / 16), App.gridSize * (i + 27 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 26 / 16),
                        App.gridSize * (j + 26 / 16), App.gridSize * (i + 30 / 16),
                        App.gridSize * (j + 22 / 16), App.gridSize * (i + 26 / 16),
                    ])
                    .lineStyle(Color.outlineWidth, Color.push, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
            case 'tile_corrosion':
            case 'tile_defbreak': {
                this._graphics.beginFill(Color.defdown)
                    .drawPolygon([
                        App.gridSize * (j + 20 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 23 / 16), App.gridSize * (i + 20 / 16),
                        App.gridSize * (j + 24 / 16), App.gridSize * (i + 19 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 20 / 16),
                        App.gridSize * (j + 28 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 27 / 16), App.gridSize * (i + 26 / 16),
                        App.gridSize * (j + 24 / 16), App.gridSize * (i + 29 / 16),
                        App.gridSize * (j + 21 / 16), App.gridSize * (i + 26 / 16),
                    ])
                    .drawPolygon([
                        App.gridSize * (j + 22 / 16), App.gridSize * (i + 23 / 16),
                        App.gridSize * (j + 20 / 16), App.gridSize * (i + 18 / 16),
                        App.gridSize * (j + 23 / 16), App.gridSize * (i + 23 / 16),
                        App.gridSize * (j + 26 / 16), App.gridSize * (i + 25 / 16),
                        App.gridSize * (j + 28 / 16), App.gridSize * (i + 30 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 25 / 16),
                    ])
                    .endFill()
                    .beginFill(defaultColor)
                    .drawPolygon([
                        App.gridSize * (j + 23 / 16), App.gridSize * (i + 23 / 16),
                        App.gridSize * (j + 20 / 16), App.gridSize * (i + 18 / 16),
                        App.gridSize * (j + 22 / 16), App.gridSize * (i + 20 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 25 / 16),
                        App.gridSize * (j + 28 / 16), App.gridSize * (i + 30 / 16),
                        App.gridSize * (j + 26 / 16), App.gridSize * (i + 28 / 16),
                    ])
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.defdown, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
            case 'tile_defup': {
                this._graphics.beginFill(Color.defup)
                    .drawPolygon([
                        App.gridSize * (j + 20 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 23 / 16), App.gridSize * (i + 20 / 16),
                        App.gridSize * (j + 24 / 16), App.gridSize * (i + 19 / 16),
                        App.gridSize * (j + 25 / 16), App.gridSize * (i + 20 / 16),
                        App.gridSize * (j + 28 / 16), App.gridSize * (i + 21 / 16),
                        App.gridSize * (j + 27 / 16), App.gridSize * (i + 26 / 16),
                        App.gridSize * (j + 24 / 16), App.gridSize * (i + 29 / 16),
                        App.gridSize * (j + 21 / 16), App.gridSize * (i + 26 / 16),
                    ])
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.defup, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);;
                break;
            }
            case 'tile_gazebo': {
                this._graphics.lineStyle(Color.lineWidth, Color.air)
                    .drawCircle(App.gridSize * (j + 1.5), App.gridSize * (i + 1.5), App.gridSize * 3 / 16)
                    .drawCircle(App.gridSize * (j + 1.5), App.gridSize * (i + 1.5), App.gridSize * 4 / 16)
                    .moveTo(App.gridSize * (j + 1.5), App.gridSize * (i + 19 / 16))
                    .lineTo(App.gridSize * (j + 1.5), App.gridSize * (i + 23 / 16))
                    .moveTo(App.gridSize * (j + 29 / 16), App.gridSize * (i + 1.5))
                    .lineTo(App.gridSize * (j + 25 / 16), App.gridSize * (i + 1.5))
                    .moveTo(App.gridSize * (j + 1.5), App.gridSize * (i + 29 / 16))
                    .lineTo(App.gridSize * (j + 1.5), App.gridSize * (i + 25 / 16))
                    .moveTo(App.gridSize * (j + 19 / 16), App.gridSize * (i + 1.5))
                    .lineTo(App.gridSize * (j + 23 / 16), App.gridSize * (i + 1.5))
                    .lineStyle(Color.outlineWidth, Color.air, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
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
                this._graphics = new PIXI.Graphics().beginFill(Color.void)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize)
                    .endFill()
                    .lineStyle(Color.outlineWidth, Color.hole, 1, 0)
                    .drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
                break;
            }
        }
        this._graphics.lineStyle().endFill();
        this._graphics.lineStyle(1, 0x000000, 1, 0).drawRect(App.gridSize * (j + 1), App.gridSize * (i + 1), App.gridSize, App.gridSize);
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
            for (let i = 0; i < App.levelData.mapData.map.length; i++) {
                const row = [];
                for (let j = 0; j < App.levelData.mapData.map[i].length; j++) {
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
            Print.error(`Failed to create path from ${this.position.row},${this.position.col} to ${destTile.position.row},${destTile.position.col}`);
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
