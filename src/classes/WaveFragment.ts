class WaveFragment {
    static array: WaveFragment[] = [];
    static create(tick: number, actions: WaveAction[]) {
        const inst = new WaveFragment(tick, actions);
        this.array.push(inst);
        return inst;
    }
    static reset() {
        this.array = [];
    }

    tick: number;
    actions: WaveAction[];
    constructor(tick: number, actions: WaveAction[]) {
        this.tick = tick;
        this.actions = actions;
    }
}
