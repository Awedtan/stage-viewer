class Activity {
    static _array: Activity[] = [];
    static create(id, name, data) {
        try {
            const activity = new Activity(id, name, data);
            if (!activity) return null;
            this._array.push(activity);
            return activity;
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
    _data: any;
    _zones: Zone[];
    constructor(id, name, data) {
        this.id = id;
        this.name = name.split(' - Rerun')[0];
        this._data = data;
        this._zones = [];
    }
    addZone(id) {
        const zone = Zone.get(id);
        return this._zones.push(zone);
    }
    getZones() {
        return this._zones;
    }
    hasLevels() {
        let bool = false
        this._zones.forEach(zone => {
            if (zone.hasLevels()) return bool = true;
        });
        return bool;
    }
}
