/**
 * 装备觉醒系统
 * 
 * 觉醒效果（8种，满级10级，每级=满级效果/10=1%）：
 * - 吸血：满级+10%伤害吸血
 * - 利刃：满级+10%攻击
 * - 铁壁：满级+10%防御
 * - 体魄：满级+10%体力
 * - 荆棘：满级+10%反弹
 * - 抗反弹：满级+10%抗反弹
 * - 免伤：满级降低10%所受伤害
 * - 连击：满级10%几率连续打出2次
 * 
 * 觉醒部位映射：
 * - 手持(weapon)：利刃、吸血
 * - 副手(offhand)：利刃、铁壁、体魄、荆棘、抗反弹、免伤、连击、吸血
 * - 头部(headgear)：铁壁、荆棘、免伤、抗反弹
 * - 躯体(clothes)：铁壁、荆棘、免伤、抗反弹
 * - 腰部(belt)：铁壁、荆棘、免伤、抗反弹
 * - 脚部(shoes)：铁壁、荆棘、免伤、抗反弹
 * - 配饰(accessories)：连击、体魄、免伤、抗反弹
 */

// 觉醒效果定义
const AWAKEN_EFFECTS = {
    vampire:   { id: 'vampire',   name: '吸血',   desc: '伤害吸血+{val}%',       maxLevel: 10, maxPercent: 10 },
    blade:     { id: 'blade',     name: '利刃',   desc: '攻击+{val}%',           maxLevel: 10, maxPercent: 10 },
    ironwall:  { id: 'ironwall',  name: '铁壁',   desc: '防御+{val}%',           maxLevel: 10, maxPercent: 10 },
    physique:  { id: 'physique',  name: '体魄',   desc: '体力+{val}%',           maxLevel: 10, maxPercent: 10 },
    thorns:    { id: 'thorns',    name: '荆棘',   desc: '反弹+{val}%',           maxLevel: 10, maxPercent: 10 },
    antiThorns:{ id: 'antiThorns',name: '抗反弹', desc: '抗反弹+{val}%',         maxLevel: 10, maxPercent: 10 },
    dmgReduce: { id: 'dmgReduce', name: '免伤',   desc: '所受伤害降低{val}%',     maxLevel: 10, maxPercent: 10 },
    combo:     { id: 'combo',     name: '连击',   desc: '{val}%几率连续打出2次',  maxLevel: 10, maxPercent: 10 }
};

// 部位 -> 可觉醒效果映射
const SLOT_AWAKEN_MAP = {
    weapon:      ['blade', 'vampire'],
    offhand:     ['blade', 'ironwall', 'physique', 'thorns', 'antiThorns', 'dmgReduce', 'combo', 'vampire'],
    headgear:    ['ironwall', 'thorns', 'dmgReduce', 'antiThorns'],
    clothes:     ['ironwall', 'thorns', 'dmgReduce', 'antiThorns'],
    belt:        ['ironwall', 'thorns', 'dmgReduce', 'antiThorns'],
    shoes:       ['ironwall', 'thorns', 'dmgReduce', 'antiThorns'],
    accessories: ['combo', 'physique', 'dmgReduce', 'antiThorns']
};

// 觉醒成功率（按等级）
const AWAKEN_SUCCESS_RATE = {
    1: 100, 2: 100, 3: 100, 4: 100, 5: 100,
    6: 80, 7: 80, 8: 80,
    9: 50,
    10: 30
};

// 觉醒消耗配置（觉醒石名称 + 数量，按当前等级）
const AWAKEN_COST = {
    1:  { stoneName: '觉醒石·初', count: 1, minStrengthen: 1 },
    2:  { stoneName: '觉醒石·初', count: 2, minStrengthen: 1 },
    3:  { stoneName: '觉醒石·初', count: 3, minStrengthen: 2 },
    4:  { stoneName: '觉醒石·中', count: 1, minStrengthen: 3 },
    5:  { stoneName: '觉醒石·中', count: 2, minStrengthen: 3 },
    6:  { stoneName: '觉醒石·中', count: 3, minStrengthen: 5 },
    7:  { stoneName: '觉醒石·高', count: 1, minStrengthen: 6 },
    8:  { stoneName: '觉醒石·高', count: 2, minStrengthen: 8 },
    9:  { stoneName: '觉醒石·极', count: 1, minStrengthen: 10 },
    10: { stoneName: '觉醒石·极', count: 3, minStrengthen: 12 }
};

export default class EquipmentAwaken {
    constructor(userId, database, play, backpack) {
        this.userId = userId;
        this.db = database;
        this.play = play;
        this.backpack = backpack;
    }

    /**
     * 获取该部位可觉醒的效果列表
     * @param {string} slot - 装备部位 (weapon/offhand/headgear/clothes/belt/shoes/accessories)
     * @returns {Array} 可觉醒效果配置数组
     */
    getAwakenConfig(slot) {
        const effectIds = SLOT_AWAKEN_MAP[slot] || [];
        return effectIds.map(id => {
            const effect = AWAKEN_EFFECTS[id];
            return { ...effect };
        });
    }

    /**
     * 获取装备的觉醒数据（从数据库读取）
     * @param {string} itemId - 装备唯一ID
     * @returns {Object} 觉醒数据 { awakenLevels: { effectId: level, ... } }
     */
    getAwakenData(itemId) {
        if (!this.db) return { awakenLevels: {} };
        const rows = this.db.executeSQL(
            'SELECT awaken_data FROM equipment_awaken WHERE item_id = ?',
            [itemId], 'all'
        );
        if (!rows || rows.length === 0) return { awakenLevels: {} };
        try {
            const data = typeof rows[0].awaken_data === 'string'
                ? JSON.parse(rows[0].awaken_data)
                : rows[0].awaken_data;
            return { awakenLevels: data || {} };
        } catch (e) {
            return { awakenLevels: {} };
        }
    }

    /**
     * 保存觉醒数据到数据库
     */
    _saveAwakenData(itemId, awakenLevels) {
        if (!this.db) return;
        const existing = this.db.executeSQL(
            'SELECT item_id FROM equipment_awaken WHERE item_id = ?',
            [itemId], 'all'
        );
        if (existing && existing.length > 0) {
            this.db.executeSQL(
                'UPDATE equipment_awaken SET awaken_data = ? WHERE item_id = ?',
                [JSON.stringify(awakenLevels), itemId], 'run'
            );
        } else {
            this.db.executeSQL(
                'INSERT INTO equipment_awaken (item_id, awaken_data) VALUES (?, ?)',
                [itemId, JSON.stringify(awakenLevels)], 'run'
            );
        }
    }

    /**
     * 计算装备的觉醒属性加成
     * @param {string} itemId - 装备唯一ID
     * @param {string} slot - 装备部位
     * @returns {Object} 觉醒属性加成
     */
    getAwakenAttributes(itemId, slot) {
        const { awakenLevels } = this.getAwakenData(itemId);
        const attrs = {
            attackPercent: 0,
            defensePercent: 0,
            healthPercent: 0,
            vampirePercent: 0,
            thornsPercent: 0,
            antiThornsPercent: 0,
            dmgReducePercent: 0,
            comboChance: 0
        };

        for (const [effectId, level] of Object.entries(awakenLevels)) {
            if (level <= 0) continue;
            const percent = level; // 每级=1%
            switch (effectId) {
                case 'blade':      attrs.attackPercent += percent; break;
                case 'ironwall':   attrs.defensePercent += percent; break;
                case 'physique':   attrs.healthPercent += percent; break;
                case 'vampire':    attrs.vampirePercent += percent; break;
                case 'thorns':     attrs.thornsPercent += percent; break;
                case 'antiThorns': attrs.antiThornsPercent += percent; break;
                case 'dmgReduce':  attrs.dmgReducePercent += percent; break;
                case 'combo':      attrs.comboChance += percent; break;
            }
        }

        return attrs;
    }

    /**
     * 计算觉醒消耗
     * @param {number} currentLevel - 当前觉醒等级（目标效果的）
     * @returns {Object} 消耗信息
     */
    getAwakenCost(currentLevel) {
        const nextLevel = currentLevel + 1;
        if (nextLevel > 10) return null;
        const costCfg = AWAKEN_COST[nextLevel];
        const successRate = AWAKEN_SUCCESS_RATE[nextLevel] || 30;
        return {
            nextLevel,
            stoneName: costCfg.stoneName,
            stoneCount: costCfg.count,
            minStrengthen: costCfg.minStrengthen,
            successRate
        };
    }

    /**
     * 执行觉醒操作（随机觉醒效果）
     * @param {object|string} itemOrId - 装备对象 或 装备ID字符串（从URL exec调用时）
     * @param {string} slot - 装备部位
     * @returns {Object} 觉醒结果
     */
    awaken(itemOrId, slot) {
        // 获取该部位可觉醒的效果列表
        const allowedEffects = SLOT_AWAKEN_MAP[slot];
        if (!allowedEffects || allowedEffects.length === 0) {
            return { success: false, tip: '该装备部位无法觉醒' };
        }

        // 支持两种调用方式：item对象 或 itemId字符串
        let item, itemId;
        if (typeof itemOrId === 'string') {
            itemId = itemOrId;
            // 从装备栏中查找该装备
            item = this._findEquipById(itemId);
            if (!item) {
                return { success: false, tip: '未找到该装备' };
            }
        } else {
            item = itemOrId;
            itemId = item.id || item.info?.id || item.recruit_id;
        }

        // 获取当前觉醒数据
        const { awakenLevels } = this.getAwakenData(itemId);

        // 确定觉醒目标效果：已有觉醒效果则继续觉醒该效果，否则随机选择
        let awakenType;
        const existingEffect = Object.keys(awakenLevels).find(key => awakenLevels[key] > 0);
        if (existingEffect) {
            // 已觉醒过，继续觉醒同一效果
            awakenType = existingEffect;
        } else {
            // 首次觉醒：从该部位可用效果中随机选择一个
            awakenType = allowedEffects[Math.floor(Math.random() * allowedEffects.length)];
        }

        const effect = AWAKEN_EFFECTS[awakenType];
        const currentLevel = awakenLevels[awakenType] || 0;

        if (currentLevel >= 10) {
            return { success: false, tip: `${effect.name}已达到最高等级！` };
        }

        // 获取消耗配置
        const cost = this.getAwakenCost(currentLevel);
        if (!cost) {
            return { success: false, tip: '无法计算觉醒消耗' };
        }

        // 检查强化等级要求
        const strengthenLevel = item.info?.strengthenLevel || 0;
        if (strengthenLevel < cost.minStrengthen) {
            return {
                success: false,
                tip: `觉醒需要装备强化等级至少+${cost.minStrengthen}，当前为+${strengthenLevel}`
            };
        }

        // 检查觉醒石是否足够
        if (!this.backpack.hasItem(cost.stoneName, cost.stoneCount)) {
            return {
                success: false,
                tip: `需要${cost.stoneName} x${cost.stoneCount}，背包中不足`
            };
        }

        // 扣除觉醒石
        this.backpack.removeItemByName(cost.stoneName, cost.stoneCount);

        // 判定成功率
        const roll = Math.random() * 100;
        const isSuccess = roll < cost.successRate;

        if (isSuccess) {
            // 觉醒成功
            awakenLevels[awakenType] = currentLevel + 1;
            this._saveAwakenData(itemId, awakenLevels);

            // 刷新装备属性缓存
            if (this.play && this.play.equipment && typeof this.play.equipment.bumpVersion === 'function') {
                this.play.equipment.bumpVersion();
            }

            const newPercent = awakenLevels[awakenType];
            const descText = effect.desc.replace('{val}', newPercent);
            const isFirstAwaken = !existingEffect;
            const randomNote = isFirstAwaken ? `（随机觉醒为【${effect.name}】）` : '';
            return {
                success: true,
                tip: `觉醒成功！${randomNote}${effect.name} 提升到 ${awakenLevels[awakenType]} 级（${descText}）`,
                newLevel: awakenLevels[awakenType],
                effect: effect
            };
        } else {
            // 觉醒失败：不降等级但消耗材料
            return {
                success: false,
                tip: `觉醒失败！${effect.name} 等级未提升（成功率${cost.successRate}%），已消耗${cost.stoneName} x${cost.stoneCount}`,
                currentLevel: currentLevel
            };
        }
    }

    /**
     * 根据ID从装备栏查找装备
     */
    _findEquipById(itemId) {
        const status = this.play.equipment.getStatus();
        const allEquips = [
            status.weapon, status.offhand, status.headgear,
            status.clothes, status.belt, status.shoes,
            ...(status.accessories || [])
        ];
        return allEquips.find(e => e && (e.id === itemId || e.info?.id === itemId)) || null;
    }

    /**
     * 确保数据库表存在
     */
    static ensureTable(db) {
        if (!db) return;
        try {
            db.executeSQL(`
                CREATE TABLE IF NOT EXISTS equipment_awaken (
                    item_id TEXT PRIMARY KEY,
                    awaken_data TEXT DEFAULT '{}'
                )
            `, [], 'run');
        } catch (e) {
            // 表已存在时忽略
        }
    }

    /**
     * 获取觉醒页面数据
     * @returns {Object} 页面渲染所需的全部数据
     */
    getPageData() {
        const equipStatus = this.play.equipment.getStatus();
        const slotDefs = [
            { key: 'weapon', label: '手持(武器)', item: equipStatus.weapon },
            { key: 'offhand', label: '副手', item: equipStatus.offhand },
            { key: 'headgear', label: '头部', item: equipStatus.headgear },
            { key: 'clothes', label: '躯体', item: equipStatus.clothes },
            { key: 'belt', label: '腰部', item: equipStatus.belt },
            { key: 'shoes', label: '脚部', item: equipStatus.shoes },
        ];
        // 饰品3个槽位
        const accs = equipStatus.accessories || [];
        for (let i = 0; i < 3; i++) {
            slotDefs.push({ key: 'accessories', label: `配饰${i + 1}`, item: accs[i] || null, accIndex: i });
        }

        const slots = slotDefs.map(sd => {
            const item = sd.item;
            if (!item) {
                return { ...sd, hasItem: false, awakenEffects: [] };
            }
            const itemId = item.id || item.info?.id;
            const awakenEffects = this.getAwakenConfig(sd.key);
            const { awakenLevels } = this.getAwakenData(itemId);
            const strengthenLevel = item.info?.strengthenLevel || 0;
            const itemName = item.info?.name || item.name || '未知装备';
            const itemLevel = item.info?.level || item.level || 0;

            // 找出已觉醒的效果（每件装备只能觉醒一种）
            const activeEffectId = Object.keys(awakenLevels).find(key => awakenLevels[key] > 0) || null;

            const effects = awakenEffects.map(ef => {
                const currentLevel = awakenLevels[ef.id] || 0;
                const cost = this.getAwakenCost(currentLevel);
                const currentVal = currentLevel; // 每级=1%
                const nextVal = Math.min(currentLevel + 1, ef.maxLevel);
                // 如果已有其他觉醒效果，则锁定此效果
                const isLocked = activeEffectId && activeEffectId !== ef.id && currentLevel === 0;
                return {
                    ...ef,
                    currentLevel,
                    currentVal,
                    nextVal,
                    isMaxed: currentLevel >= ef.maxLevel,
                    isLocked,
                    lockedBy: isLocked ? (AWAKEN_EFFECTS[activeEffectId]?.name || activeEffectId) : null,
                    cost: cost ? {
                        stoneName: cost.stoneName,
                        stoneCount: cost.stoneCount,
                        minStrengthen: cost.minStrengthen,
                        successRate: cost.successRate,
                        canAfford: !isLocked && cost.minStrengthen <= strengthenLevel &&
                            this.backpack.hasItem(cost.stoneName, cost.stoneCount),
                        strengthenMet: cost.minStrengthen <= strengthenLevel,
                    } : null,
                };
            });

            return {
                ...sd,
                hasItem: true,
                itemId,
                itemName,
                itemLevel,
                strengthenLevel,
                awakenEffects: effects,
            };
        });

        return { slots, AWAKEN_EFFECTS };
    }
}

// 导出常量供外部使用
export { AWAKEN_EFFECTS, SLOT_AWAKEN_MAP, AWAKEN_SUCCESS_RATE, AWAKEN_COST };
