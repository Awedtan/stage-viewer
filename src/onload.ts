window.onload = async () => {
    // Load data from all ArknightsGameData table files
    ['mainline', 'weekly', 'campaign', 'climb_tower', 'activity', 'roguelike', 'storymission', 'rune', 'sandbox']
        .forEach(id => Type.create(id));
    Print.time('Load activities');
    const activityTable: { [key: string]: { [key: string]: any } } = await (await fetch(Path.activityTable)).json();
    for (const activityData of Object.values(activityTable.basicInfo)) {
        const id = activityData.id;
        const name = activityData.name;
        Activity.create(id, name, activityData);
    }
    Print.timeEnd('Load activities');
    Print.time('Load zones');
    const zoneTable: { [key: string]: { [key: string]: any } } = await (await fetch(Path.zoneTable)).json();
    const campaignTable: { [key: string]: { [key: string]: any } } = await (await fetch(Path.campaignTable)).json();
    const climbTable: { [key: string]: { [key: string]: any } } = await (await fetch(Path.climbTable)).json();
    for (const zoneData of Object.values(zoneTable.zones)) {
        const id = zoneData.zoneID.toLowerCase();
        let name = ((zoneData.zoneNameFirst ? zoneData.zoneNameFirst : '') + ' ' + (zoneData.zoneNameSecond ? zoneData.zoneNameSecond : '')).trim();
        if (name === '') name = zoneData.zoneID;
        const type = zoneData.type.toLowerCase();
        try {
            if (type === 'roguelike') continue;
            else if (type === 'campaign') name = Object.values(campaignTable.campaignZones).find(e => e.id === zoneData.zoneID).name;
            else if (type === 'climb_tower') name = Object.values(climbTable.towers).find(e => e.id === zoneData.zoneID).name;
        } catch (e) { }
        Zone.create(id, name, type, zoneData); // Types are automatically created inside the zone constructor
    }
    Print.timeEnd('Load zones');
    Print.time('Load levels');
    const levelTable: { [key: string]: { [key: string]: any } } = await (await fetch(Path.levelTable)).json();
    for (const levelData of Object.values(levelTable.stages)) {
        const id = levelData.stageId.toLowerCase();
        const zone = levelData.zoneId.toLowerCase();
        Level.create(id, zone, levelData);
    }
    Print.timeEnd('Load levels');
    Print.time('Load rogue zones');
    const rogueTable: { [key: string]: { [key: string]: any } } = await (await fetch(Path.rogueTable)).json();
    for (const rogueData of Object.values(rogueTable.topics)) {
        const id = rogueData.id.toLowerCase();
        const name = rogueData.name;
        const type = 'roguelike';
        Zone.create(id, name, type, rogueData);
    }
    Print.timeEnd('Load rogue zones');
    Print.time('Load rogue levels');
    for (let i = 0; i < Object.values(rogueTable.details).length; i++) {
        const rogueStages: { [key: string]: any } = Object.values(rogueTable.details)[i].stages;
        for (const levelData of Object.values(rogueStages)) {
            const levelId = levelData.id.toLowerCase();
            const zone = `rogue_${i + 1}`;
            Level.create(levelId, zone, levelData);
        }
    }
    Print.timeEnd('Load rogue levels');
    Print.time('Load paradox simulations');
    const charNames = await (await fetch(`${Path.api}/operator?include=data.name`)).json();
    const paradoxTable: { [key: string]: { [key: string]: any } } = await (await fetch(Path.paradoxTable)).json();
    for (const levelData of Object.values(paradoxTable.handbookStageData)) {
        const id = levelData.stageId.toLowerCase();
        const charId = levelData.charId.toLowerCase();
        const charName = charNames.find(e => e.keys[0] === charId).value.data.name;
        const type = 'storymission';
        Zone.create(charId, charName, type, null);
        Level.create(id, charId, levelData);
    }
    Print.timeEnd('Load paradox simulations');
    Print.time('Load rune levels');
    const constants = await (await fetch(Path.constants)).json();
    const ccSeasons = constants.gameConsts.ccSeasons;
    const ccStages = constants.gameConsts.ccStages;
    for (const season of Object.keys(ccSeasons)) {
        const zoneId = season.toLowerCase();
        const zoneName = `CC ${season}`;
        const type = 'rune';
        const ccData = ccSeasons[season];
        Zone.create(zoneId, zoneName, type, ccData);
        for (const levelName of ccData) {
            const levelData = ccStages.find(e => e.name === levelName);
            const levelId = levelData.levelId;
            Level.create(levelId, zoneId, levelData);
        }
    }
    Print.timeEnd('Load rune levels');
    Print.time('Load sandbox levels');
    const sandboxTable = await (await fetch(Path.sandboxTable)).json();
    for (const sandboxId of Object.keys(sandboxTable.sandboxActTables)) {
        const id = sandboxId.toLowerCase();
        const name = 'Fire Within the Sand';
        const type = 'sandbox';
        const sandboxData: { [key: string]: { [key: string]: any } } = sandboxTable.sandboxActTables[sandboxId];
        Zone.create(id, name, type, sandboxData);
        for (const levelData of Object.values(sandboxData.stageDatas)) {
            const levelId = levelData.stageId.toLowerCase();
            const zone = sandboxId.toLowerCase();
            Level.create(levelId, zone, levelData);
        }
    }
    const sandboxPermTable: { [key: string]: { [key: string]: any } } = await (await fetch(Path.sandboxPermTable)).json();
    for (const sandboxInfo of Object.values(sandboxPermTable.basicInfo)) {
        const id = sandboxInfo.topicId.toLowerCase();
        const name = sandboxInfo.topicName;
        const type = 'sandbox';
        const sandboxData: { [key: string]: { [key: string]: any } } = sandboxPermTable.detail.SANDBOX_V2[id];
        Zone.create(id, name, type, sandboxData);
        for (const levelData of Object.values(sandboxData.stageData)) {
            const levelId = levelData.stageId.toLowerCase();
            const zone = id.toLowerCase();
            Level.create(levelId, zone, levelData);
        }
    }
    Print.timeEnd('Load sandbox levels');

    // All tables have been loaded
    Print.table(Type.getAll());
    Print.table(Activity.getAll());
    Print.table(Zone.getAll());
    Print.table(Level.getAll());

    // Load level from query string, default to 0-1 if not valid
    const query = new URL(window.location.href).searchParams;
    const levelId = query.has('level') ? query.get('level') : 'main_00-01';
    try {
        const level = Level.get(levelId);
        const zone = Zone.get(level.zone);
        const activity = Activity.get(zone.id.split('_')[0]);
        const type = Type.get(zone.type);

        Print.time('Start app');
        await Load.loadNewLevel(levelId);
        Print.timeEnd('Start app');
    } catch (e) {
        const level = Level.get('main_00-01');
        const zone = Zone.get(level.zone);
        const activity = Activity.get(zone.id.split('_')[0]);
        const type = Type.get(zone.type);

        Print.time('Start app');
        await Load.loadNewLevel('main_00-01');
        Print.timeEnd('Start app');
    }
};
