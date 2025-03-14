class Color {
    static bg = 0x101010;
    static start = 0xe21818;
    static end = 0x0c8aff;
    static void = 0x202020;
    static road = 0x484848;
    static wall = 0xa8a8a8;
    static floor = 0xc08438;
    static tunnel = 0xeb9072;
    static fence = 0xe8ba23;
    static hole = this.wall;
    static push = 0xb85b0a;
    static defdown = 0xc03722;
    static defup = this.push;
    static air = this.push;
    static wood = 0x7f4f1a;
    static stone = 0x6b6b6b;
    static iron = this.wall;

    static unknown = 0xffff00;

    static lineWidth = 3;
    static outlineWidth = 4;
    static triLength = 5;
}

class Path {
    static api = 'https://awedtan.ca/api';
    static constants = 'https://raw.githubusercontent.com/Awedtan/HellaBot/main/src/constants.json';
    static enemyAssets = 'https://raw.githubusercontent.com/Awedtan/HellaAssets/main/spine/enemy';
    static enemyIcons = 'https://raw.githubusercontent.com/Awedtan/HellaAssets/main/enemy';
    static gamedata = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData_YoStar/main/en_US/gamedata';
    static levels = `${this.gamedata}/levels`;
    static activityTable = `${this.gamedata}/excel/activity_table.json`;
    static campaignTable = `${this.gamedata}/excel/campaign_table.json`;
    static climbTable = `${this.gamedata}/excel/climb_tower_table.json`;
    static paradoxTable = `${this.gamedata}/excel/handbook_info_table.json`;
    static rogueTable = `${this.gamedata}/excel/roguelike_topic_table.json`;
    static sandboxTable = `${this.gamedata}/excel/sandbox_table.json`;
    static sandboxPermTable = `${this.gamedata}/excel/sandbox_perm_table.json`;
    static levelTable = `${this.gamedata}/excel/stage_table.json`;
    static zoneTable = `${this.gamedata}/excel/zone_table.json`;
    static backupData = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/5ba509ad5a07f17b7e220a25f1ff66794dd79af1/en_US/gamedata';
    static backupLevels = `${this.backupData}/levels`;
}

class Print {
    static clear() {
        if (App.PRINTDEBUG) console.clear();
    }
    static debug(msg) {
        if (App.PRINTDEBUG) console.debug(msg);
    }
    static error(msg) {
        if (App.PRINTDEBUG) console.trace(msg);
        else console.error(msg);
    }
    static info(msg) {
        if (App.PRINTDEBUG) console.info(msg);
    }
    static group() {
        console.group();
    }
    static groupEnd() {
        console.groupEnd();
    }
    static table(data: any, columns: any = null) {
        if (App.PRINTDEBUG) console.table(data, columns);
    }
    static time(label) {
        if (App.PRINTDEBUG) console.time(label);
    }
    static timeLog(label) {
        if (App.PRINTDEBUG) console.timeLog(label);
    }
    static timeEnd(label) {
        if (App.PRINTDEBUG) console.timeEnd(label);
    }
    static warn(msg) {
        if (App.PRINTDEBUG) console.trace(msg);
        else console.warn(msg);
    }
}

function gridToPos({ row, col }, centered = false) {
    if (centered) {
        const x = App.gridSize * (1.5 + col);
        const y = App.gridSize * (0.5 + App.levelData.mapData.map.length - row);
        return { x, y };
    }
    else {
        const randX = Math.random() / 6;
        const randY = Math.random() / 6;
        const x = App.gridSize * (1.5 + col + randX);
        const y = App.gridSize * (0.7 + App.levelData.mapData.map.length - row + randY);
        return { x, y };
    }
}

function posToGrid({ x, y }) {
    const col = Math.floor(x / App.gridSize - 1.5);
    const row = App.levelData.mapData.map.length - Math.floor(y / App.gridSize - 0.5);
    return { row, col };
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function urlExists(url) {
    return fetch(url).then(r => r.status === 200);
}
