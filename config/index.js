import requireContext from '../requireContext.cjs'


/*"神秘铁箱": [],
    "海皇的宝箱": [],*/
let configFiles;
if (typeof require !== "undefined") {
    configFiles = require.context('./', false, /\.json$/);
} else {
    configFiles = requireContext('./config', false, /\.json$/);
}

let configs = {}
configFiles.keys().forEach(key => {
    // 兼容含下划线的文件名（如 holiday_events.json），并转为 camelCase 键（如 holidayEvents）
    const k = key.match(/([^./\\]+)\.json$/)[1]
        .replace(/_([a-zA-Z0-9])/g, (m, c) => c.toUpperCase());
    configs[k] = configFiles(key);
});

// 简化配置导入
const {
    cityMap: cityMapRaw,
    fbMap,
    insideMap,
    worldMap,
    cityShop,
    sailingTips,
    exp,
    insideMapFlat,
    fish,
    treasureMap,
    equipment,
    jewel,
    marketItems,
    ship,
    lngLat,
    scp,
    trial,
    shopItems: shopItemsRaw,
    npc: npcRaw,
    fbNpc,
    npcs,
    monsters,
    monsterItems,
    monsterDrops,
    monsterRewards,
    shipFb,
    shipMap,
    shipNpc,
    shipFbTips,
    sailingEncounters,
    sets,
    sailingSpecialEvents,
    holidayEvents,
    balance,
    wings,
    strengthen,
    displayLabels
} = configs;

let cityMap = {
    ...cityMapRaw,
    ...fbMap,
    ...shipMap,
};

/*
1:未知
2：引路
3:异常接触药 缓慢、虚弱、诅咒、沮丧、中毒、麻痹
永久性负面状态

▼ 缓慢 [永久]
状态名称: 缓慢
状态描述: 减少 10% 敏捷。
持续时间: 战斗结束前持续有效
▼ 虚弱 [永久]
状态名称: 虚弱
状态描述: 减少 10% 攻击力。
持续时间: 战斗结束前持续有效
▼ 诅咒 [永久]
状态名称: 诅咒
状态描述: 每次攻击时，有 10% 的概率对自身造成 5% 最大 HP 的伤害。
持续时间: 战斗结束前持续有效
▼ 沮丧 [永久]
状态名称: 沮丧
状态描述: 减少 10% 防御力，并且减少 5 点士气。
持续时间: 战斗结束前持续有效
临时性负面状态
▼ 麻痹 [临时]
状态名称: 麻痹
状态描述: 有 50% 的概率无法行动（跳过回合造成伤害为0）。
持续时间: 1回合
▼ 中毒 [临时]
状态名称: 中毒
状态描述: 每回合减少 10% 当前生命值。
持续时间: 3回合
4:回复药
5：体力包
6：特殊药品
7：自动拾取
8：鱼饵
10：任务
* */

let shopItems = shopItemsRaw;
/*
    101: '出航',
    102: '船老板',
    103: '渔夫'
    104: '传送',
    105: '商人'
    106: '珠宝商',
    107: '神父',
    108: '证婚人'
    109: '铁匠'
    110: '赌场老板'
    111: '市场商人'
    112: '女巫'
*/

let npc = {
    ...npcRaw,
    ...fbNpc,
};

let files;
if (typeof require !== "undefined") {
    files = require.context('./task', true, /\.json$/);
} else {
    files = requireContext('./config/task', true, /\.json$/);
}


let tasks = files.keys().map(files);

const cityToWorld = {};
Object.keys(worldMap).forEach(w => {
    worldMap[w].forEach(c => {
        cityToWorld[c] = w;
    })
})

const nameToItem = {};

function getRandomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

Object.values(marketItems).forEach(item => {
    Object.keys(item).forEach(key => {
        const range = item[key];
        // 兜底：区间非法（非数组/非有限数）时剔除该条目，绝不产出 NaN 或 0 元价：
        // buy() 只校验价格有限性、不校验 >0，回退为 0 会造成“0 元购买”；NaN 会把 play.copper 污染并永久落库
        const lo = Array.isArray(range) ? +range[0] : NaN;
        const hi = Array.isArray(range) ? +range[1] : NaN;
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
            console.warn(`[config] marketItems 价格区间非法，该条目将在加载时被剔除：${key} = ${JSON.stringify(range)}`);
            delete item[key];
        } else {
            item[key] = getRandomBetween(lo, hi);
        }
    })
})

shopItems.forEach(item => {
    nameToItem[item.name] = item;
})
export {
    cityMap,
    insideMap,
    worldMap,
    npc,
    equipment,
    cityShop,
    shopItems,
    cityToWorld,
    nameToItem,
    jewel,
    marketItems,
    ship,
    exp,
    lngLat,
    tasks,
    trial,
    treasureMap,
    fish,
    sailingTips,
    insideMapFlat,
    npcs,
    monsters,
    fbNpc,
    monsterItems,
    monsterDrops,
    monsterRewards,
    shipFb,
    shipMap,
    shipNpc,
    scp,
    shipFbTips,
    sailingEncounters,
    sets,
    sailingSpecialEvents,
    holidayEvents,
    balance,
    wings,
    strengthen,
    displayLabels
}