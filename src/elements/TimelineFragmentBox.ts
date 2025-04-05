class TimelineFragmentBox {
    static array: TimelineFragmentBox[] = [];
    static create(fragment: WaveFragment) {
        if(!fragment.actions || fragment.actions.length === 0) return null;

        const inst = new TimelineFragmentBox(fragment);
        this.array.push(inst);
        return inst;
    }
    static reset() {
        this.array = [];
    }

    element: HTMLElement;
    fragment: WaveFragment;
    constructor(fragment: WaveFragment) {

        this.element = document.createElement("div");
        this.fragment = fragment;

        const fragmentIndex = WaveFragment.array.indexOf(fragment);

        this.element.id = `timeline-fragment-${fragmentIndex}`;
        this.element.className = "timeline-fragment";

        const top = document.createElement('div');
        top.className = "timeline-fragment-top";
        this.element.appendChild(top);

        const index = document.createElement('p');
        index.innerText = `Fragment ${fragmentIndex}`;
        top.appendChild(index);

        const bottom = document.createElement('div');
        bottom.className = "timeline-fragment-bottom";
        this.element.appendChild(bottom);

        for(const action of fragment.actions) {
            const actionBox = TimelineActionBox.create(action);
            if(!actionBox) continue;
            bottom.appendChild(actionBox.element);
        }
    }
}
