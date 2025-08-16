class Level {
    static _array: Level[] = [];
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

    id: string;
    zone: string;
    code: string;
    name: string;
    path: string;
    difficulty: boolean;
    hidden: boolean;
    _data: any;
    constructor(id, zone, data) {
        this.id = id;
        this.zone = zone;
        this.code = data.code ? data.code : data.location;
        this.name = data.name;
        this.path = data.levelId.toLowerCase();
        this.difficulty = data.difficulty && data.difficulty !== 'NORMAL' || !['NONE', 'ALL', 'NORMAL'].includes(data.diffGroup);
        this.hidden = this.difficulty && !(['roguelike', 'sandbox', 'storymission', 'rune', 'crisisv2'].includes(Zone.get(zone).type));
        this._data = data;
    }
}
