class TimelineBox {
    static array: TimelineBox[] = [];
    static create(action: SpawnAction) {
        const inst = new TimelineBox(action);
        this.array.push(inst);
        return inst;
    }
    static reset() {
        this.array = [];
    }

    element: HTMLElement;
    action: SpawnAction;
    constructor(action: SpawnAction) {
        this.element = document.createElement('div');
        this.action = action;

        const actionIndex = SpawnAction.array.findIndex(a => a === action);
        const enemy = Enemy.dataCache[action.action.key];

        this.element.id = `enemy-timeline-box-${actionIndex}`;
        this.element.className = 'enemy-timeline-box';

        const leftCol = document.createElement('div');
        leftCol.className = 'enemy-timeline-left';
        this.element.appendChild(leftCol);

        const code = document.createElement('p');
        code.innerText = enemy.value.excel.enemyIndex;
        leftCol.appendChild(code);

        const image = document.createElement('img');
        image.src = `${Path.enemyIcons}/${enemy.value.excel.enemyId}.png`
        image.width = 50;
        leftCol.appendChild(image);

        const count = document.createElement('p');
        count.innerText = `x${action.action.count}`;
        leftCol.appendChild(count);

        const start = document.createElement('p');
        start.innerText = `${Math.round(action.tick / App.FPS)}s`;
        leftCol.appendChild(start);

        this.element.onclick = this.onClick.bind(this);
    }
    onClick(clicked = true) {
        if (clicked) {
            UI.clearSelected();

            App.tick = this.action.tick;
            App.getTickBar().value = App.tick.toString();
            this.action.enemies[0].onClick(false);
            this.action.enemies.forEach(e => {
                e.enableHighlight();
                App.selectedEnemies.push(e);
            });
            const infoBox = InfoBox.array.find(e => e.enemy.enemyId === this.action.enemies[0].enemyId);
            infoBox.onClick.bind(infoBox)(false);
        }

        App.selectedTimelineBox = this;
        this.element.classList.add('selected');

        const rightCol = document.createElement('div');
        rightCol.className = 'enemy-timeline-right';
        this.element.appendChild(rightCol);

        const interval = document.createElement('p');
        interval.innerText = `Interval: ${this.action.action.interval ?? 0}s`;
        rightCol.appendChild(interval);

        const postDelay = document.createElement('p');
        postDelay.innerText = `Post-delay: ${this.action.action.postDelay ?? 0}s`;
        rightCol.appendChild(postDelay);

        const fragBlock = document.createElement('p');
        fragBlock.innerText = `Block fragment: ${this.action.action.blockFragment ? '✔️' : '❌'}`;
        rightCol.appendChild(fragBlock);

        const waveBlock = document.createElement('p');
        waveBlock.innerText = `Block wave: ${this.action.action.dontBlockWave ? '❌' : '✔️'}`;
        rightCol.appendChild(waveBlock);

        this.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}
