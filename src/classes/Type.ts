class Type {
    static _array = [];
    static create(id) {
        try {
            const type = new Type(id);
            if (!type) return null;
            this._array.push(type);
            return type;
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
    _zones: Zone[];
    constructor(id) {
        this.id = id;
        this._zones = [];
    }
    addZone(id) {
        const zone = Zone.get(id);
        return this._zones.push(zone);
    }
    getZone(id) {
        return this._zones.find(e => e.id === id);
    }
    getZones() {
        return this._zones;
    }
}
