class WaveAction {
    static array: WaveAction[] = [];
    static create(tick: number, action: any, enemies: Enemy[]) {
        const inst = new WaveAction(tick, action, enemies);
        this.array.push(inst);
        return inst;
    }
    static reset() {
        this.array = [];
    }

    tick: number;
    action: any;
    enemies: Enemy[];
    constructor(tick: number, action: any, enemies: Enemy[]) {
        this.tick = tick;
        this.action = action;
        this.enemies = enemies;
    }
}
