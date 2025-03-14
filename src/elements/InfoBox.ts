class InfoBox {
    static array: InfoBox[] = [];
    static create(enemy: Enemy) {
        const inst = new InfoBox(enemy);
        this.array.push(inst);
        return inst;
    }
    static reset() {
        this.array = [];
    }

    element: HTMLElement;
    enemy: Enemy;
    constructor(enemy: Enemy) {
        this.element = document.createElement('div');
        this.enemy = enemy;

        this.element.id = enemy.enemyId;
        this.element.className = 'enemy-info-box';

        const leftCol = document.createElement('div');
        leftCol.className = 'enemy-info-left';
        this.element.appendChild(leftCol);

        const code = document.createElement('p');
        code.innerText = enemy.data.value.excel.enemyIndex;
        leftCol.appendChild(code);

        const image = document.createElement('img');
        image.src = `${Path.enemyIcons}/${enemy.enemyId}.png`
        leftCol.appendChild(image);

        const name = document.createElement('p');
        name.innerText = enemy.data.value.excel.name;
        leftCol.appendChild(name);

        const rightCol = document.createElement('div');
        rightCol.className = 'enemy-info-right';
        this.element.appendChild(rightCol);

        const cells = [];
        const wordArr = ['HP', 'ATK Interval', 'Silence', 'ATK', 'ATK Type', 'Stun', 'DEF', 'Range', 'Sleep', 'RES', 'Weight', 'Freeze', 'Block', 'Life Points', 'Levitate'];
        const idArr = ['hp', 'interval', 'silence', 'atk', 'type', 'stun', 'def', 'range', 'sleep', 'res', 'weight', 'freeze', 'block', 'life', 'levitate'];
        for (let i = 0; i < 30; i++) {
            cells.push(document.createElement('td'));
            if (i % 2 === 0) {
                cells[i].className = 'enemy-stat type';
                cells[i].innerText = wordArr[i / 2];
            }
            else {
                cells[i].id = idArr[Math.ceil(i / 2) - 1] + '-value';
                cells[i].className = 'enemy-stat value';
                const enemyData = enemy.data.value.levels.Value[0].enemyData;
                const attributes = enemyData.attributes;
                const getValue = (attr: any, def: number | string = null) => attr.m_defined ? attr.m_value : def ? def : 0;
                switch (idArr[Math.ceil(i / 2) - 1]) {
                    case "hp":
                        cells[i].innerText = getValue(attributes.maxHp);
                        break;
                    case "type":
                        cells[i].innerText = enemyData.rangeRadius.m_defined ? enemyData.rangeRadius.mvalue !== 0 ? 'Ranged' : 'Melee' : 'Melee';
                        cells[i].style = "white-space: pre-wrap";
                        break;
                    case "silence":
                        cells[i].innerText = getValue(attributes.silenceImmune, '✔️');
                        break;
                    case "atk":
                        cells[i].innerText = getValue(attributes.atk);
                        break;
                    case "range":
                        cells[i].innerText = getValue(enemyData.rangeRadius);
                        break;
                    case "stun":
                        cells[i].innerText = getValue(attributes.stunImmune, '✔️');
                        break;
                    case "def":
                        cells[i].innerText = getValue(attributes.def);
                        break;
                    case "interval":
                        cells[i].innerText = getValue(attributes.baseAttackTime);
                        break;
                    case "sleep":
                        cells[i].innerText = getValue(attributes.sleepImmune, '✔️');
                        break;
                    case "res":
                        cells[i].innerText = getValue(attributes.magicResistance);
                        break;
                    case "weight":
                        cells[i].innerText = getValue(attributes.massLevel);
                        break;
                    case "freeze":
                        cells[i].innerText = getValue(attributes.frozenImmune, '✔️');
                        break;
                    case "block":
                        cells[i].innerText = getValue(attributes.blockCnt, 1);
                        break;
                    case "life":
                        cells[i].innerText = getValue(enemyData.lifePointReduce, 1);
                        break;
                    case "levitate":
                        cells[i].innerText = getValue(attributes.levitateImmune, '✔️');
                        break;
                }
                if (cells[i].innerText === 'true') cells[i].innerText = '❌';
                else if (cells[i].innerText === 'false') cells[i].innerText = '✔️';
            }
        };

        const table = document.createElement('table');
        rightCol.appendChild(table);

        const rows = [];
        for (let i = 0; i < 5; i++) {
            rows.push(document.createElement('tr'));
            for (let j = i * 6; j < (i + 1) * 6; j++) {
                rows[i].appendChild(cells[j]);
            }
            table.appendChild(rows[i]);
        }

        this.element.onclick = this.onClick.bind(this);
    }
    onClick(clicked = true) {
        if (clicked) return;

        App.selectedInfoBox = this;
        this.element.classList.add('selected');

        const container = document.getElementById('enemy-info');
        const scrollTarget = this.element.offsetTop - container.offsetTop + (this.element.clientHeight - container.clientHeight / 2);
        container.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
}
