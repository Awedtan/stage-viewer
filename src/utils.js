function gridToPos({ row, col }, centered) {
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
