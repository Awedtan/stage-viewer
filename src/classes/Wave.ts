class Wave {
    static array: Wave[] = [];
    static create(tick: number, fragments: WaveFragment[]) {
        const inst = new Wave(tick, fragments);
        this.array.push(inst);
        return inst;
    }
    static reset() {
        this.array = [];
    }

    tick: number;
    fragments: WaveFragment[];
    constructor(tick: number, fragments: WaveFragment[]) {
        this.tick = tick;
        this.fragments = fragments;
    }
}
