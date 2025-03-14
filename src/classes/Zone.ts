class Zone {
    static _array: Zone[] = [];
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

    id: string;
    name: string;
    type: string;
    _data: any;
    _levels: Level[];
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
