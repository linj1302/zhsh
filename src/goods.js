import * as config from '../config/index.js'

const {
    equipment,
    shopItems,
    marketItems
} = config;

const equipments = Object.values(equipment).sort((a, b) => {
    return a.level - b.level
})

// 解析装备的特殊属性
function parseSpecialAttributes(info) {
    const specialAttributes = {};

    // 解析抗性属性
    if (info.tx) {
        const tx = info.tx;

        // 抗性属性
        if (tx.includes("抗缓慢")) {
            const match = tx.match(/抗缓慢\+(\d+)/);
            specialAttributes.slowRes = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("抗虚弱")) {
            const match = tx.match(/抗虚弱\+(\d+)/);
            specialAttributes.weakRes = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("抗诅咒")) {
            const match = tx.match(/抗诅咒\+(\d+)/);
            specialAttributes.curseRes = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("抗沮丧")) {
            const match = tx.match(/抗沮丧\+(\d+)/);
            specialAttributes.depressedRes = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("抗毒")) {
            const match = tx.match(/抗毒\+(\d+)/);
            specialAttributes.poisonRes = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("抗麻痹")) {
            const match = tx.match(/抗麻痹\+(\d+)/);
            specialAttributes.paralysisRes = match ? parseInt(match[1]) : 1;
        }

        // 异常状态施加属性
        if (tx.includes("迟缓攻")) {
            const match = tx.match(/迟缓攻\+(\d+)/);
            specialAttributes.slowInflict = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("虚弱攻")) {
            const match = tx.match(/虚弱攻\+(\d+)/);
            specialAttributes.weakInflict = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("诅咒攻")) {
            const match = tx.match(/诅咒攻\+(\d+)/);
            specialAttributes.curseInflict = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("沮丧攻")) {
            const match = tx.match(/沮丧攻\+(\d+)/);
            specialAttributes.depressedInflict = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("毒攻")) {
            const match = tx.match(/毒攻\+(\d+)/);
            specialAttributes.poisonInflict = match ? parseInt(match[1]) : 1;
        }
        if (tx.includes("麻痹攻")) {
            const match = tx.match(/麻痹攻\+(\d+)/);
            specialAttributes.paralysisInflict = match ? parseInt(match[1]) : 1;
        }
    }

    return specialAttributes;
}

export default class Goods {
    constructor({
                    name,
                    type,
                    num,
                    status = 1,
                    info
                }) {
        this.name = name;
        // 1:装备 2:商店物品 3:解药 4:回复  5:宝石 6:宠物 7：百宝箱/乾坤袋 8：鱼饵 10:其他 11:市场商品 12: 船  13:鱼 14：鱼竿 20-30宠物物品 33:任务 34:材料 37:卡片 38:图纸  39:礼包
        this.type = type;
        this.num = +num || 1;
        //1:未装备 2:已装备
        this.status = status;
        this.info = info;

        // 如果是装备类型，解析特殊属性
        if (type === 1 && info) {
            const specialAttributes = parseSpecialAttributes(info);
            this.info = {...info, ...specialAttributes};

            // 为装备添加孔位系统
            if (!this.info.sockets) {
                // 根据装备等级计算孔位数 (1-200级对应1-4个孔位)
                const socketsCount = Math.max(1, Math.min(4, Math.ceil(this.info.level / 50)));
                this.info.sockets = Array(socketsCount).fill(null);
            }
        }

        // 如果是宝石类型，处理宝石属性
        if (type == 5 && info) {
            // 从宝石名称中提取等级和类型
            const levelMatch = name.match(/^([小中高完美])(.*)$/);
            if (levelMatch) {
                const level = levelMatch[1];
                const gemType = levelMatch[2];

                // 根据等级设置属性加成
                let bonusPercent = 0;
                switch (level) {
                    case '小':
                        bonusPercent = 2;
                        break;
                    case '中':
                        bonusPercent = 3;
                        break;
                    case '高':
                        bonusPercent = 4;
                        break;
                    case '完美':
                        bonusPercent = 5;
                        break;
                }

                // 设置宝石效果
                this.info.bonusPercent = bonusPercent;
                this.info.gemLevel = level;
                this.info.gemType = gemType;
            }
        }
    }
}

export function getLevelGoods(level) {
    const index = equipments.findIndex(v => {
        return v.level - level > -4
    })
    // 怪物等级超过最高装备等级时 findIndex 返回 -1，slice(-1,3) 会错误取到列表头部；
    // 此时取等级最高的 4 件装备作为掉落窗口
    const start = index === -1 ? Math.max(0, equipments.length - 4) : index
    return equipments.slice(start, start + 4).map(v => new Goods({
        name: v.name,
        type: 1,
        num: 1,
        status: 1,
        info: v
    }))
}

export function getGoodsByName(name, num) {
    let rewardItem;
    // 先在装备中查找
    if (equipment[name]) {
        rewardItem = {
            name: name,
            type: 1, // 装备类型
            info: equipment[name]
        };
    }
    // 再在商店物品中查找
    else if (shopItems.find(item => item.name === name)) {
        const shopItem = shopItems.find(item => item.name === name);
        if (shopItem) {
            rewardItem = {
                ...shopItem,
                name: name,
                type: shopItem.type,
                info: shopItem.info
            };
        }
    }
    // 再在市场商店物品中查找
    else if (Object.values(marketItems).find(item => item[name])) {
        rewardItem = {
            name: name,
            type: 11,
            info: {}
        };
    }
    //全部没有就是任务物品
    if (!rewardItem) {
        rewardItem = {
            name: name,
            type: 33,
            info: {}
        }
    }
    rewardItem.num = (+num) || 1;
    return new Goods(rewardItem);
}