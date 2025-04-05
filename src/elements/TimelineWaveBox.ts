class TimelineWaveBox {
    static array: TimelineWaveBox[] = [];
    static create(wave: Wave) {
        if (!wave.fragments || wave.fragments.length === 0) return null;

        const inst = new TimelineWaveBox(wave);
        this.array.push(inst);
        return inst;
    }
    static reset() {
        this.array = [];
    }

    element: HTMLElement;
    wave: Wave;
    constructor(wave: Wave) {
        this.element = document.createElement("div");
        this.wave = wave;

        const waveIndex = Wave.array.indexOf(wave);

        this.element.id = `timeline-wave-${waveIndex}`;
        this.element.className = "timeline-wave";

        const top = document.createElement('div');
        top.className = "timeline-wave-top";
        this.element.appendChild(top);

        const index = document.createElement('p');
        index.innerText = `Wave ${waveIndex}`;
        top.appendChild(index);

        const bottom = document.createElement('div');
        bottom.className = "timeline-wave-bottom";
        this.element.appendChild(bottom);

        for (const fragment of wave.fragments) {
            const fragmentBox = TimelineFragmentBox.create(fragment);
            if (!fragmentBox) continue;
            bottom.appendChild(fragmentBox.element);
        }
    }
}
