import * as config from '../config/index.js'
import Goods from "./goods.js";

const {
    npc,
    equipment,
    cityShop,
    shopItems,
    cityToWorld,
    nameToItem,
    jewel,
    marketItems,
    ship,
    npcs,
    fbNpc,
    shipNpc,
    monsters,
    scp,
    trial
} = config;

let globalMarketPriceReductions = {};

// 副本接引 NPC 索引（模块加载期构建，普通对象，禁用 Map/Set）：
// trial.json 中每个副本的 receiveNpc 应跳转到 trial 页（含"进入副本"按钮），
// 其余 type=120 NPC（如新大陆的卡卡/罗纳/迪克）仍走 npc-task-direct。
const trialReceiveNpcIndex = Object.create(null);
(trial || []).forEach(t => {
    if (t && t.receiveNpc) trialReceiveNpcIndex[t.receiveNpc] = true;
});

const pages = {
    101: 'navigation',
    102: 'shop?shopType=102',
    103: 'shop?shopType=103',
    104: 'teleport',
    105: 'merchant',
    106: 'jeweler',
    107: 'priest',
    108: 'marriage',
    109: 'blacksmith',
    110: 'casino',
    111: 'market',
    112: 'witch',
    120: (npc) => trialReceiveNpcIndex[npc.name] ? 'trial?npc=' + npc.name : 'npc-task-direct?npc=' + npc.name
};

export default class Npc {
    constructor(city, play, backpack, task) {
        this.city = city;
        this.play = play;
        this.backpack = backpack;
        this.scpData = scp;
        this.task = task;
        this.marketPriceReductions = {};
    }

    get scp() {
        return this.scpData;
    }

    get reductions() {
        return this.marketPriceReductions;
    }

    static updatePriceReduction(priceKey, reductionData) {
        globalMarketPriceReductions[priceKey] = reductionData;
    }

    static cleanupExpiredReductions() {
        const currentTime = Date.now();
        for (const key in globalMarketPriceReductions) {
            if (currentTime - globalMarketPriceReductions[key].timestamp >= 60 * 60 * 1000) {
                delete globalMarketPriceReductions[key];
            }
        }
    }

    exchangeCoin({changeType, count}) {
        let type = parseInt(changeType);
        count = parseInt(count);

        if (isNaN(type) || (type !== 1 && type !== 2) || isNaN(count) || count <= 0) {
            return { tip: '参数错误' };
        }

        if (type === 1) {
            if (this.play.gold < count) {
                return { tip: '金贝不足' };
            }
            this.play.gold -= count;
            this.play.copper += count * 300 * 1000;
            return { tip: '成功兑换: 消耗' + count + '金贝，获得' + (count * 300) + '银币' };
        } else {
            const silverNeeded = count * 500 * 1000;
            if (this.play.copper < silverNeeded) {
                return { tip: '银币不足' };
            }
            this.play.copper -= silverNeeded;
            this.play.gold += count;
            return { tip: '成功兑换: 消耗' + (count * 500) + '银币，获得' + count + '金贝' };
        }
    }

    calculateTotalShipWeight() {
        let totalWeight = 0;
        const backpackItems = this.backpack.getStatus().items;
        backpackItems.forEach(item => {
            if (item.type === 12 && item.info && item.info.weight) {
                totalWeight += item.info.weight * item.num;
            }
        });
        return totalWeight;
    }

    calculateMarketItemsWeight() {
        let totalWeight = 0;
        const backpackItems = this.backpack.getStatus().items;
        backpackItems.forEach(item => {
            if (item.type === 11) {
                const itemWeight = (item.info && item.info.weight) ? item.info.weight : 1;
                totalWeight += itemWeight * item.num;
            }
        });
        return totalWeight;
    }

    buy(type, index, count = 1) {
        // count 整数守卫（不改签名）：非法/非整数/≤0/>100 一律拒绝。
        // 否则 params=105,0,-100 会让 price 为负绕过 `copper < price` 余额守卫、凭空加钱，
        // 且 new Goods({num: 负数}) 会把已有堆叠数量写成负数、落库污染存档。
        const n = parseInt(count, 10);
        if (!Number.isInteger(n) || n <= 0 || n > 100) {
            return { tip: '购买数量非法' };
        }

        // 先判空：item 为 undefined（越界 index、或 getShopItems(109) 恒返回 []）时，
        // 若先解引用 item.price 会抛 TypeError → 500，故判空必须提到任何 item.* 之前
        const item = this.getShopItems(type)[index];
        if (!item) {
            return { tip: '商品不存在，购买失败' };
        }

        const price = item.price * n;
        const priceType = item.priceType || "copper";

        // 价格有限性守卫保留在算出 price 之后：
        // 否则 `copper < NaN` 为 false 会绕过余额守卫、`copper -= NaN` 会把存档污染成 NaN
        if (!Number.isFinite(price)) {
            return { tip: '商品价格异常，购买失败' };
        }

        if (type == 111) {
            const itemWeight = item.weight || 1;
            const additionalWeight = itemWeight * n;
            const currentMarketItemsWeight = this.calculateMarketItemsWeight();
            const totalShipWeight = this.calculateTotalShipWeight();
            if (currentMarketItemsWeight + additionalWeight > totalShipWeight) {
                return { tip: '购买失败：商品总重量超过船只载重能力。当前船只总载重：' + totalShipWeight + '，已用载重：' + currentMarketItemsWeight + '，尝试增加：' + additionalWeight };
            }
        }

        if (type == 102) {
            const maxShips = Math.min(6, Math.floor(this.play.level / 10) + 1);
            const ships = this.backpack.getItemsByType(12);
            let currentShipsCount = 0;
            ships.forEach(ship => { currentShipsCount += ship.num; });
            if (currentShipsCount >= maxShips) {
                return { tip: '购买失败：您当前等级最多可以拥有' + maxShips + '艘船' };
            }
            if (currentShipsCount + n > maxShips) {
                const canBuyCount = maxShips - currentShipsCount;
                return { tip: '购买失败：您当前等级最多可以拥有' + maxShips + '艘船，最多只能再购买' + canBuyCount + '艘' };
            }
        }

        if (priceType === "gold") {
            if (this.play.gold < price) {
                return { tip: '金贝不足，购买失败' };
            }
        } else {
            if (this.play.copper < price) {
                return { tip: '铜币不足，购买失败' };
            }
        }

        // goods.js 分类: 1:装备 2:商店物品 3:解药 4:回复 5:宝石 6:宠物 7:百宝箱 8:鱼饵 10:其他 11:市场商品 12:船 13:鱼 14:鱼竿 20-30:宠物物品 33:任务 34:材料 37:卡片 38:图纸 39:礼包
        const itemType = item.type || {
            105: 2,
            106: 5,
            109: 39,
            111: 11,
            102: 12,
            103: 10,
        }[type] || 2;

        // 装备(type=1)、百宝箱/乾坤袋(type=7) 影响重量
        if ([1, 7].includes(itemType)) {
            const backpackStatus = this.backpack.getStatus();
            if (backpackStatus.weight + n > backpackStatus.maxWeight) {
                return { tip: '背包空间不足，购买失败' };
            }
        }

        if (priceType === "gold") {
            this.play.gold -= price;
        } else {
            this.play.copper -= price;
        }

        this.backpack.addItem(new Goods({
            name: item.name,
            type: itemType,
            num: n,
            info: item
        }));

        if (itemType === 45) {
            this.play.updateStaminaBonus();
        }

        return { tip: '购买成功' };
    }

    // 一键卖出所有可卖出物品
    sellAll(npcType) {
        npcType = +npcType;
        const backpackItems = this.backpack.getStatus().items;
        const sellableItems = [];
        let totalCoin = 0;
        const city = this.city._city;

        for (const item of backpackItems) {
            if (item.locked) continue;
            if (item.type === 1 && item.status === 2) continue;

            let price = 0;

            if (npcType === 111) {
                if (item.type !== 11) continue;
                if (this.scpData[city] && this.scpData[city][item.name]) {
                    price = this.scpData[city][item.name];
                    const priceKey = city + '-' + item.name;
                    if (this.marketPriceReductions[priceKey]) {
                        const {timestamp, reductions} = this.marketPriceReductions[priceKey];
                        if (Date.now() - timestamp < 60 * 60 * 1000) {
                            const reductionCount = Math.min(5, reductions);
                            price = Math.max(1, Math.floor(price * Math.pow(0.9, reductionCount)));
                        }
                    }
                } else {
                    continue;
                }
            } else if (npcType === 105) {
                if (![1, 2, 4, 5, 10].includes(item.type)) continue;
                const merchantItemsList = this.getShopItems(105);
                const merchantItem = merchantItemsList.find(i => i.name === item.name);
                if (merchantItem) {
                    price = Math.max(1, Math.floor(merchantItem.price * 0.2));
                } else if (item.type === 1 && item.info) {
                    // 装备：根据 lj（品质等级）计算卖出价
                    const baseValue = Number(item.info.lj) || (Number(item.info.level) * 30);
                    price = Math.max(1, Math.floor(baseValue * 0.2));
                } else {
                    price = 1;
                }
            } else {
                continue;
            }

            sellableItems.push({item, price});
            totalCoin += price * (item.num || 1);
        }

        if (sellableItems.length === 0) {
            return {tip: '没有可卖出的物品'};
        }

        for (const {item} of sellableItems) {
            this.backpack.removeItem(item.id, item.num);
        }

        this.play.copper += totalCoin;

        const itemNames = sellableItems.map(s => s.item.name + 'x' + (s.item.num || 1)).join('、');
        return {
            tip: '一键卖出成功！共卖出 ' + sellableItems.length + ' 种物品：' + itemNames + '，获得 ' + totalCoin + ' 铜币'
        };
    }

    sell(itemName, npcType) {
        npcType = +npcType;
        const backpackItems = this.backpack.getStatus().items;
        const itemIndex = backpackItems.findIndex(item => item.name === itemName);

        if (itemIndex === -1) {
            return { tip: '未找到该物品' };
        }

        const item = backpackItems[itemIndex];

        // 检查是否已锁定
        if (item.locked) {
            return { tip: '该物品已锁定，无法卖出' };
        }

        // 检查是否已装备
        if (item.type === 1 && item.status === 2) {
            return { tip: '无法卖出已装备的物品' };
        }

        let price = 1;

        if (npcType === 111) {
            if (item.type !== 11) {
                return { tip: '市场商人只能收购市场商品' };
            }
            const city = this.city._city;
            if (this.scpData[city] && this.scpData[city][itemName]) {
                price = this.scpData[city][itemName];
                const priceKey = city + '-' + itemName;
                const currentTime = Date.now();
                let reductionCount = 0;
                if (this.marketPriceReductions[priceKey]) {
                    const {timestamp, reductions} = this.marketPriceReductions[priceKey];
                    if (currentTime - timestamp < 60 * 60 * 1000) {
                        reductionCount = Math.min(5, reductions);
                    } else {
                        delete this.marketPriceReductions[priceKey];
                    }
                }
                if (reductionCount > 0) {
                    price = Math.max(1, Math.floor(price * Math.pow(0.9, reductionCount)));
                }
            } else {
                return { tip: '该物品在该城市无法卖出' };
            }
        } else if (npcType === 105) {
            if (![1, 2, 4, 5, 10].includes(item.type)) {
                return { tip: '该物品不能卖出' };
            }
            const merchantItemsList = this.getShopItems(105);
            const merchantItem = merchantItemsList.find(i => i.name === itemName);
            if (merchantItem) {
                price = Math.max(1, Math.floor(merchantItem.price * 0.2));
            } else if (item.type === 1 && item.info) {
                // 装备：根据 lj（品质等级）计算卖出价
                const baseValue = Number(item.info.lj) || (Number(item.info.level) * 30);
                price = Math.max(1, Math.floor(baseValue * 0.2));
            }
        }

        const totalPrice = price * item.num;

        if (npcType === 111) {
            const city = this.city._city;
            const priceKey = city + '-' + itemName;
            const soldQuantity = item.num;
            const reductionIncrease = Math.floor(soldQuantity / 100);
            if (reductionIncrease > 0) {
                const currentTime = Date.now();
                let currentReductions = 0;
                if (this.marketPriceReductions[priceKey]) {
                    const {timestamp, reductions} = this.marketPriceReductions[priceKey];
                    if (currentTime - timestamp < 60 * 60 * 1000) {
                        currentReductions = Math.min(5, reductions + reductionIncrease);
                    } else {
                        currentReductions = reductionIncrease;
                    }
                } else {
                    currentReductions = reductionIncrease;
                }
                this.marketPriceReductions[priceKey] = {
                    timestamp: currentTime,
                    reductions: Math.min(5, currentReductions)
                };
            }
        }

        this.play.copper += totalPrice;

        const {name, num} = item;
        this.backpack.removeItem(item.id, item.num);

        return { tip: '成功卖出 ' + name + ' x' + num + '，获得 ' + totalPrice + ' 铜币' };
    }

    craftGem(gemName, count) {
        count = Math.max(1, parseInt(count) || 1);
        const backpackItems = this.backpack.getStatus().items;
        const city = this.city._city;

        let lowGemName, highGemName, costPer;
        if (gemName.startsWith('小')) {
            lowGemName = gemName;
            highGemName = gemName.replace('小', '中');
            costPer = 50;
        } else if (gemName.startsWith('中')) {
            if (city !== '泉州' && city !== '伦敦') {
                return {tip: '高级宝石合成只能在泉州或伦敦进行'};
            }
            lowGemName = gemName;
            highGemName = gemName.replace('中', '高');
            costPer = 150;
        } else if (gemName.startsWith('高')) {
            if (city !== '伦敦') {
                return {tip: '完美宝石合成只能在伦敦进行'};
            }
            lowGemName = gemName;
            highGemName = gemName.replace('高', '完美');
            costPer = 450;
        } else {
            return {tip: '无效的宝石类型'};
        }

        const needCount = count * 3;
        const totalCost = costPer * count;

        if (this.play.copper < totalCost) {
            return {tip: '合成' + count + '个' + highGemName + '需要' + totalCost + '铜币，当前只有' + this.play.copper + '铜币'};
        }

        const lowGemItem = backpackItems.find(item => item.name === lowGemName);
        if (!lowGemItem || lowGemItem.num < needCount) {
            return {tip: '合成' + count + '个' + highGemName + '需要' + needCount + '个' + lowGemName + '，你只有' + (lowGemItem ? lowGemItem.num : 0) + '个'};
        }

        const highGemTemplate = jewel.find(item => item.name === highGemName);
        if (!highGemTemplate) {
            return {tip: '无法找到' + highGemName + '的模板'};
        }

        this.play.copper -= totalCost;

        lowGemItem.num -= needCount;
        if (lowGemItem.num <= 0) {
            const idx = this.backpack.items.findIndex(item => item.id == lowGemItem.id);
            if (idx >= 0) this.backpack.items.splice(idx, 1);
        }

        this.backpack.addItem(new Goods({
            name: highGemTemplate.name,
            type: 5,
            num: count,
            info: highGemTemplate
        }));

        return {tip: '成功合成 ' + count + ' 个' + highGemName + '，消耗 ' + needCount + ' 个' + lowGemName + ' + ' + totalCost + '铜币'};
    }

    inlayGem(gemId, itemId, socketIndex) {
        const backpackItems = this.backpack.getStatus().items;

        let item = null;
        for (let i = 0; i < backpackItems.length; i++) {
            if (backpackItems[i].id === itemId) { item = backpackItems[i]; break; }
        }
        if (!item) { return {tip: '未找到指定装备'}; }
        if (item.type !== 1) { return {tip: '只能对装备进行宝石镶嵌'}; }

        if (!item.info.sockets) {
            const socketsCount = Math.max(1, Math.min(4, Math.ceil(item.info.level / 50)));
            item.info.sockets = Array(socketsCount).fill(null);
        }

        socketIndex = parseInt(socketIndex);
        if (socketIndex < 0 || socketIndex >= item.info.sockets.length) {
            return {tip: '无效的孔位索引'};
        }

        let gemItem = null;
        for (let i = 0; i < backpackItems.length; i++) {
            if (backpackItems[i].id === gemId && backpackItems[i].type === 5) {
                gemItem = backpackItems[i]; break;
            }
        }
        if (!gemItem) { return {tip: '背包中没有可用的宝石'}; }
        if (gemItem.num <= 0) { return {tip: '宝石数量不足'}; }
        if (gemItem.status === 2) { return {tip: '不能使用已装备的宝石'}; }

        const oldGem = item.info.sockets[socketIndex];
        item.info.sockets[socketIndex] = {
            name: gemItem.name,
            type: gemItem.type,
            info: {...gemItem.info}
        };

        this.backpack.removeItem(gemItem.id);

        // 镶嵌会改变装备属性：使 equipProperty 版本缓存失效（装备未落库前与槽内可能是同一对象引用）
        if (this.play && this.play.equipment && typeof this.play.equipment.bumpVersion === 'function') {
            this.play.equipment.bumpVersion();
        }

        let tipMessage = '成功在' + item.name + '的孔位' + (socketIndex + 1) + '镶嵌' + gemItem.name;
        if (oldGem) { tipMessage += '，替换掉原来的' + oldGem.name; }
        return {tip: tipMessage + '！'};
    }

    getShopItems(type) {
        type = +type;
        const city = this.city._city;

        if (type === 1) {
            return shopItems.filter(v => v.sellPosition?.includes(1));
        }
        if (type === 105) {
            let items;
            if (cityShop[city]) {
                items = cityShop[city];
            } else {
                let world = cityToWorld[city];
                items = cityShop[world];
            }
            items = items || [];
            // 跳过 nameToItem 无法解析的条目，避免产出缺字段物品或抛 TypeError
            return items
                .filter(v => v && nameToItem[v.name])
                .map(v => {
                    const k = nameToItem[v.name];
                    // value=0 为 falsy，原 `v.value || k.price` 会误回退默认价；这里显式判定正有限数
                    return { ...k, price: Number.isFinite(+v.value) && +v.value > 0 ? +v.value : k.price };
                });
        }
        if (type === 102) {
            return ship[city] || ship.威尼斯;
        }
        if (type === 103) {
            return shopItems.filter(v => v.type === 8);
        }
        if (type === 106) {
            return jewel.filter(item => item.name.startsWith('小'));
        }
        if (type === 109) {
            return [];
        }
        if (type === 111) {
            const obj = marketItems[city];
            return Object.keys(obj || {}).map(k => ({
                name: k,
                price: obj[k],
            }));
        }
        return [];
    }

    getHref(npc) {
        let {type} = npc;
        if (typeof pages[type] === 'string') {
            return pages[type];
        }
        if (typeof pages[type] === 'function') {
            return pages[type](npc);
        }
        return 'npc-task-direct?npc=' + npc.name;
    }

    getHsref(npc) {
        return this.getHref(npc);
    }

    getStatus(isMonsters = false) {
        if (shipNpc[this.city._city]?.[this.city._position]) {
            const arr = shipNpc[this.city._city][this.city._position];
            const shipNpcTypes = [49];
            if (!isMonsters) {
                return arr.filter(v => shipNpcTypes.includes(v.type));
            }
            let shipMonsters = this.city.getMonsterCache(this.play);
            // 与 city.js 船副本生成白名单 [40(普通),45(BOSS)] 对齐，避免普通怪被隐藏
            return (shipMonsters || []).filter(v => [40, 45].includes(v.type));
        }
        if (fbNpc[this.city._city]?.[this.city._position]) {
            const arr = fbNpc[this.city._city][this.city._position];
            const fbNpcTypes = [60];
            if (!isMonsters) {
                return arr.filter(v => fbNpcTypes.includes(v.type));
            }
            let fbMonsters = this.city.getMonsterCache(this.play);
            // 与 city.js 副本生成白名单 [50(普通),55(BOSS)] 对齐，避免副本BOSS(type55)不可见
            return (fbMonsters || []).filter(v => [50, 55].includes(v.type));
        }
        const currentAddress = this.city._city + this.city._position;
        if (!isMonsters) {
            let arr = npcs[this.city._city][this.city._position] || [];

            const taskRelatedNpcs = {};
            const taskSystem = this.task;
            if (taskSystem) {
                const allTasks = taskSystem.getAllTasks();
                allTasks.forEach(task => {
                    if (taskSystem.isTaskAccepted(task.index) && !taskSystem.isTaskCompleted(task.index)) {
                        if (currentAddress === task.receiveLocation && task.receiveNpc) {
                            taskRelatedNpcs[task.receiveNpc] = true;
                        }
                        if (currentAddress === task.submitLocation && task.submitNpc) {
                            taskRelatedNpcs[task.submitNpc] = true;
                        }
                    }
                });
            }
            return arr;
        }
        return monsters[this.city._city]?.[this.city._position] || [];
    }
}