import {exp as expConfig, equipment as zbData, shopItems, sets} from '../config/index.js';
import Goods, {getGoodsByName} from './goods.js';
import * as formulas from './formulas.js';

export default class Play {
    constructor(equipment, backpack) {
        this.equipment = equipment;
        this.backpack = backpack;
        // 成长系统
        this.level = 1;   // 当前等级（1-100）
        this.exp = 0;     // 当前经验值（达到升级要求后清零）
        //金贝，银贝，铜币
        this.gold = 0;
        this.copper = 0;
        // 声望和幸运属性
        this.reputation = 0;  // 声望
        this.luck = 0;       // 幸运
        // 战斗属性（基础真值）
        this._health = this._calculateStat(200, 30);
        this.currentHealth = this._health;
        this._attack = this._calculateStat(80, 5);
        this._maxAttack = this._calculateStat(150, 6);
        this._defense = this._calculateStat(10, 3);
        this._agility = this._calculateStat(8, 4);
        this._morale = 60;
        // 外部加成：卡片 / 队伍 / 结婚
        this._cardBonus = null;
        this._teamMemberCount = 0;
        this._marriageIntimacy = 0;

        // 百宝箱自动拾取开关
        this.autoPickup = false;

        // 异常状态属性
        this.statusEffects = {
            slow: false,      // 缓慢
            weak: false,      // 虚弱
            curse: false,     // 诅咒
            depressed: false, // 沮丧
            poison: 0,        // 中毒 (剩余回合数)
            paralysis: false  // 麻痹
        };

        // 抗性属性
        this.resistances = {
            slow: 0,          // 抗缓慢
            weak: 0,          // 抗虚弱
            curse: 0,         // 抗诅咒
            depressed: 0,     // 抗沮丧
            poison: 0,        // 抗中毒
            paralysis: 0      // 抗麻痹
        };

        // 造成异常状态的百分比属性
        this.inflictStatusChances = {
            slow: 0,          // 造成缓慢的概率
            weak: 0,          // 造成虚弱的概率
            curse: 0,         // 造成诅咒的概率
            depressed: 0,     // 造成沮丧的概率
            poison: 0,        // 造成中毒的概率
            paralysis: 0      // 造成麻痹的概率
        };

        // 经验配置
        this.expConfig = expConfig;

        // 添加体力宝相关属性
        this.staminaItems = []; // 存储拥有的体力宝
        this.staminaBonus = 0; // 当前体力宝提供的额外体力值
        this.currentStaminaItem = null; // 当前生效的体力宝

        // 节假日活动倍率（由 Holiday 系统控制）
        this.expMultiplier = 1.0;
        this.copperMultiplier = 1.0;
        this.dropMultiplier = 1.0;
        this.intimacyMultiplier = 1.0;
        this.mentorExpMultiplier = 1.0;
        this.mentorOnlineBonus = false;  // 师徒在线奖励是否激活
        this.shopDiscount = 0;

        // equipProperty 版本缓存（不可枚举属性，不会被 getFullState 序列化）：
        // 仅在装备版本号变化时全量重算，避免每次访问 getter 都遍历装备槽
        Object.defineProperty(this, '_equipPropCache', {value: null, writable: true, enumerable: false, configurable: true});
        Object.defineProperty(this, '_equipPropCacheVersion', {value: -1, writable: true, enumerable: false, configurable: true});
    }

    get equipProperty() {
        // 版本缓存：同版本多次访问直接返回缓存结果；装备穿脱/强化/镶嵌等入口会使版本号变化从而触发重算。
        // 兼容兜底：缓存字段不可枚举，不会随 getFullState 落库，restoreState/新建实例后首次访问必然重算。
        const version = this.equipment.getVersion();
        if (!this._equipPropCache || this._equipPropCacheVersion !== version) {
            this._equipPropCache = this._computeEquipProperty();
            this._equipPropCacheVersion = version;
        }
        // 保持与原实现一致的副作用：每次访问都同步抗性/施加概率字段（返回副本，避免外部篡改污染缓存）
        this.resistances = {...this._equipPropCache.resistances};
        this.inflictStatusChances = {...this._equipPropCache.inflictStatusChances};
        return {...this._equipPropCache.props};
    }

    // 全量计算装备属性（内部方法，由 equipProperty getter 按版本号缓存）
    _computeEquipProperty() {
        const {
            weapon,
            offhand,
            headgear,
            clothes,
            belt,
            shoes,
            accessories,
        } = this.equipment.getStatus();
        let attack = 0;
        let maxAttack = 0;
        let defense = 0;
        let agility = 0;
        let morale = 0;
        let health = 0;

        // 初始化异常状态抗性和施加概率
        let resistances = {
            slow: 0,
            weak: 0,
            curse: 0,
            depressed: 0,
            poison: 0,
            paralysis: 0
        };

        let inflictStatusChances = {
            slow: 0,
            weak: 0,
            curse: 0,
            depressed: 0,
            poison: 0,
            paralysis: 0
        };

        [weapon, offhand, headgear, clothes, belt, shoes, ...accessories].forEach(item => {
            if (item) {
                attack += Number(item.info.attack) || 0;
                maxAttack += Number(item.info.maxAttack) || 0;
                defense += Number(item.info.defense) || 0;
                agility += Number(item.info.agility) || 0;
                morale += Number(item.info.morale) || 0;
                health += Number(item.info.health) || 0;
                // 强化属性加成
                if (item.info.strengthenLevel) {
                    const slv = item.info.strengthenLevel;
                    const eLv = Number(item.info.level) || item.level || 1;
                    // 强化属性换算（公式集中于 src/formulas.js + config/balance.json）
                    const sBonus = formulas.strengthenBonus(slv, eLv);
                    attack += sBonus.attack;
                    maxAttack += sBonus.maxAttack;
                    defense += sBonus.defense;
                    agility += sBonus.agility;
                    morale += sBonus.morale;
                    health += sBonus.health;
                    // 异常属性加成（强化6级以上，兼容状态效果）
                    if (item.info.abnormalAttrs) {
                        for (const attr of item.info.abnormalAttrs) {
                            switch (attr.name) {
                                case 'slowInflict':   inflictStatusChances.slow   += (attr.value||0)*0.01; break;
                                case 'weakInflict':   inflictStatusChances.weak   += (attr.value||0)*0.01; break;
                                case 'curseInflict':  inflictStatusChances.curse  += (attr.value||0)*0.01; break;
                                case 'depressedInflict': inflictStatusChances.depressed += (attr.value||0)*0.01; break;
                                case 'poisonInflict': inflictStatusChances.poison += (attr.value||0)*0.01; break;
                                case 'paralysisInflict': inflictStatusChances.paralysis += (attr.value||0)*0.01; break;
                                case '攻击+': attack += attr.value; break;
                                case '防御+': defense += attr.value; break;
                                case '敏捷+': agility += attr.value; break;
                                case '士气+': morale += attr.value; break;
                                case '生命+': health += attr.value; break;
                            }
                        }
                    }
                }

                // 添加装备提供的异常状态抗性
                if (item.info.slowRes) resistances.slow += item.info.slowRes;
                if (item.info.weakRes) resistances.weak += item.info.weakRes;
                if (item.info.curseRes) resistances.curse += item.info.curseRes;
                if (item.info.depressedRes) resistances.depressed += item.info.depressedRes;
                if (item.info.poisonRes) resistances.poison += item.info.poisonRes;
                if (item.info.paralysisRes) resistances.paralysis += item.info.paralysisRes;

                // 添加装备提供的异常状态施加概率
                if (item.info.slowInflict) inflictStatusChances.slow += item.info.slowInflict * 0.01; // 转换为小数
                if (item.info.weakInflict) inflictStatusChances.weak += item.info.weakInflict * 0.01;
                if (item.info.curseInflict) inflictStatusChances.curse += item.info.curseInflict * 0.01;
                if (item.info.depressedInflict) inflictStatusChances.depressed += item.info.depressedInflict * 0.01;
                if (item.info.poisonInflict) inflictStatusChances.poison += item.info.poisonInflict * 0.01;
                if (item.info.paralysisInflict) inflictStatusChances.paralysis += item.info.paralysisInflict * 0.01;
                
                // 添加装备上镶嵌的宝石属性
                if (item.info.sockets) {
                    item.info.sockets.forEach(socket => {
                        if (socket && socket.info) {
                            // 根据宝石的feature属性确定效果类型
                            switch (socket.info.feature) {
                                case 1: // 中毒概率
                                    inflictStatusChances.poison += (socket.info.percent || 0) * 0.01;
                                    break;
                                case 4: // 麻痹概率
                                    inflictStatusChances.paralysis += (socket.info.percent || 0) * 0.01;
                                    break;
                                case 5: // 虚弱概率
                                    inflictStatusChances.weak += (socket.info.percent || 0) * 0.01;
                                    break;
                                case 6: // 诅咒概率
                                    inflictStatusChances.curse += (socket.info.percent || 0) * 0.01;
                                    break;
                                case 7: // 抗致命概率（这里作为抗性处理）
                                    resistances.critical += (socket.info.percent || 0) * 0.01;
                                    break;
                                case 8: // 抗诅咒概率
                                    resistances.curse += (socket.info.percent || 0) * 0.01;
                                    break;
                                case 9: // 抗麻痹概率
                                    resistances.paralysis += (socket.info.percent || 0) * 0.01;
                                    break;
                                case 10: // 抗虚弱概率
                                    resistances.weak += (socket.info.percent || 0) * 0.01;
                                    break;
                                case 11: // 抗中毒概率
                                    resistances.poison += (socket.info.percent || 0) * 0.01;
                                    break;
                            }
                        }
                    });
                }
            }
        });

        // 计算套装属性加成
        const setBonuses = this.calculateSetBonuses();
        attack += setBonuses.attack || 0;
        maxAttack += setBonuses.maxAttack || 0;
        defense += setBonuses.defense || 0;
        agility += setBonuses.agility || 0;
        morale += setBonuses.morale || 0;
        health += setBonuses.health || 0;

        // 添加套装提供的异常状态施加概率
        if (setBonuses.slowInflict) inflictStatusChances.slow += setBonuses.slowInflict * 0.01;
        if (setBonuses.weakInflict) inflictStatusChances.weak += setBonuses.weakInflict * 0.01;
        if (setBonuses.curseInflict) inflictStatusChances.curse += setBonuses.curseInflict * 0.01;
        if (setBonuses.depressedInflict) inflictStatusChances.depressed += setBonuses.depressedInflict * 0.01;
        if (setBonuses.poisonInflict) inflictStatusChances.poison += setBonuses.poisonInflict * 0.01;
        if (setBonuses.paralysisInflict) inflictStatusChances.paralysis += setBonuses.paralysisInflict * 0.01;
        if (setBonuses.criticalChance) inflictStatusChances.critical = (inflictStatusChances.critical || 0) + setBonuses.criticalChance * 0.01;

        // === 觉醒属性加成（百分比叠加在基础+强化+套装之后） ===
        if (this._awakenModule) {
            const slotMap = [
                ['weapon', weapon],
                ['offhand', offhand],
                ['headgear', headgear],
                ['clothes', clothes],
                ['belt', belt],
                ['shoes', shoes]
            ];
            for (const [slot, item] of slotMap) {
                if (!item) continue;
                const itemId = item.id || item.info?.id;
                if (!itemId) continue;
                try {
                    const awakenAttrs = this._awakenModule.getAwakenAttributes(itemId, slot);
                    if (awakenAttrs.attackPercent)    attack    = Math.floor(attack    * (1 + awakenAttrs.attackPercent / 100));
                    if (awakenAttrs.defensePercent)   defense   = Math.floor(defense   * (1 + awakenAttrs.defensePercent / 100));
                    if (awakenAttrs.healthPercent)    health    = Math.floor(health    * (1 + awakenAttrs.healthPercent / 100));
                } catch(e) {}
            }
            // 配饰觉醒
            if (accessories) {
                for (const item of accessories) {
                    if (!item) continue;
                    const itemId = item.id || item.info?.id;
                    if (!itemId) continue;
                    try {
                        const awakenAttrs = this._awakenModule.getAwakenAttributes(itemId, 'accessories');
                        if (awakenAttrs.healthPercent)    health    = Math.floor(health    * (1 + awakenAttrs.healthPercent / 100));
                        if (awakenAttrs.defensePercent)   defense   = Math.floor(defense   * (1 + awakenAttrs.defensePercent / 100));
                    } catch(e) {}
                }
            }
        }

        // 套装加成计入后，输出属性与副作用数据（由 getter 统一回写 this.resistances / this.inflictStatusChances）
        return {
            props: {
                attack,
                maxAttack,
                defense,
                agility,
                morale,
                health
            },
            resistances,
            inflictStatusChances
        };
    }

    // 计算套装属性加成
    calculateSetBonuses() {
        const equippedItems = this.equipment.getStatus();
        const items = [
            equippedItems.weapon,
            equippedItems.offhand,
            equippedItems.headgear,
            equippedItems.clothes,
            equippedItems.belt,
            equippedItems.shoes,
            ...equippedItems.accessories
        ].filter(item => item !== null);

        // 统计每个套装的装备数量
        const setCounts = {};
        const itemNames = items.map(item => item.name);

        for (const setName in sets) {
            const set = sets[setName];
            let count = 0;
            
            for (const itemName of set.items) {
                if (itemNames.includes(itemName)) {
                    count++;
                }
            }
            
            if (count > 0) {
                setCounts[setName] = count;
            }
        }

        // 计算套装属性加成
        const bonuses = {
            attack: 0,
            maxAttack: 0,
            defense: 0,
            agility: 0,
            morale: 0,
            health: 0
        };

        for (const setName in setCounts) {
            const count = setCounts[setName];
            const set = sets[setName];
            
            // 查找适合当前装备数量的最高加成
            let bestBonusLevel = 0;
            for (const bonusLevel in set.bonuses) {
                if (parseInt(bonusLevel) <= count && parseInt(bonusLevel) > bestBonusLevel) {
                    bestBonusLevel = parseInt(bonusLevel);
                }
            }
            
            // 应用加成
            if (bestBonusLevel > 0) {
                const bonus = set.bonuses[bestBonusLevel];
                bonuses.attack += bonus.attack || 0;
                bonuses.maxAttack += bonus.maxAttack || 0;
                bonuses.defense += bonus.defense || 0;
                bonuses.agility += bonus.agility || 0;
                bonuses.morale += bonus.morale || 0;
                bonuses.health += bonus.health || 0;
                
                // 套装特殊效果
                bonuses.slowInflict = (bonuses.slowInflict || 0) + (bonus.slowInflict || 0);
                bonuses.weakInflict = (bonuses.weakInflict || 0) + (bonus.weakInflict || 0);
                bonuses.curseInflict = (bonuses.curseInflict || 0) + (bonus.curseInflict || 0);
                bonuses.depressedInflict = (bonuses.depressedInflict || 0) + (bonus.depressedInflict || 0);
                bonuses.poisonInflict = (bonuses.poisonInflict || 0) + (bonus.poisonInflict || 0);
                bonuses.paralysisInflict = (bonuses.paralysisInflict || 0) + (bonus.paralysisInflict || 0);
                bonuses.criticalChance = (bonuses.criticalChance || 0) + (bonus.criticalChance || 0);
            }
        }

        return bonuses;
    }

    // 获取当前激活的套装信息
    getActiveSets() {
        const equippedItems = this.equipment.getStatus();
        const items = [
            equippedItems.weapon,
            equippedItems.offhand,
            equippedItems.headgear,
            equippedItems.clothes,
            equippedItems.belt,
            equippedItems.shoes,
            ...equippedItems.accessories
        ].filter(item => item !== null);

        const itemNames = items.map(item => item.name);
        const activeSets = [];

        for (const setName in sets) {
            const set = sets[setName];
            let equippedCount = 0;
            
            for (const itemName of set.items) {
                if (itemNames.includes(itemName)) {
                    equippedCount++;
                }
            }
            
            if (equippedCount > 0) {
                // 查找适合当前装备数量的最高加成
                let bestBonusLevel = 0;
                for (const bonusLevel in set.bonuses) {
                    if (parseInt(bonusLevel) <= equippedCount && parseInt(bonusLevel) > bestBonusLevel) {
                        bestBonusLevel = parseInt(bonusLevel);
                    }
                }
                
                activeSets.push({
                    name: set.name,
                    description: set.description,
                    equippedCount: equippedCount,
                    totalCount: set.items.length,
                    bonusLevel: bestBonusLevel,
                    bonuses: bestBonusLevel > 0 ? set.bonuses[bestBonusLevel] : {}
                });
            }
        }

        return activeSets;
    }

    // 添加装备时更新体力宝加成
    equip(id, fallbackIndex) {
        let item = this.backpack.getItemById(id);
        // 索引后备查找（URL 传了 ID,INDEX 双参数）
        if (!item && fallbackIndex !== undefined) {
            const idx = parseInt(fallbackIndex);
            if (!isNaN(idx) && idx >= 0 && idx < this.backpack.items.length) {
                item = this.backpack.items[idx];
            }
        }
        if (item) {
            // 添加等级校验
            if (item.info && item.info.level && item.info.level > this.level) {
                return {success: false, tip: `物品等级要求: ${item.info.level}级，当前角色等级: ${this.level}级`};
            }
            this.equipment.equip(item);
            // 穿戴的装备自动锁定（不能卖出/捐赠/赠送）
            item.locked = true;
            // 更新体力宝加成
            this.updateStaminaBonus();
            return {success: true, tip: `已穿戴 ${item.name}`};
        }
        return {success: false, tip: '物品不存在'};
    }

    // 卸载装备
    unequip(slotType, accessorySlot) {
        slotType = parseInt(slotType);

        // 卸载前获取当前装备的物品ID，用于同步更新背包物品状态
        const getSlotItem = {
            1: () => this.equipment._weapon,
            7: () => this.equipment._offhand,
            2: () => this.equipment._headgear,
            3: () => this.equipment._clothes,
            4: () => this.equipment._belt,
            5: () => this.equipment._shoes,
            6: () => slotType === 6 ? this.equipment._accessories[parseInt(accessorySlot)] : null
        };
        const equippedItem = getSlotItem[slotType] ? getSlotItem[slotType]() : null;
        const itemId = equippedItem ? equippedItem.id : null;

        // 执行卸载
        const slotMap = {
            1: () => this.equipment.unequipWeapon(),
            7: () => this.equipment.unequipOffhand(),
            2: () => this.equipment.unequipHeadgear(),
            3: () => this.equipment.unequipClothes(),
            4: () => this.equipment.unequipBelt(),
            5: () => this.equipment.unequipShoes(),
            6: () => this.equipment.unequipAccessory(parseInt(accessorySlot))
        };
        const fn = slotMap[slotType];
        if (fn) {
            fn();
            // 同步更新背包物品的status（因为save/restore后装备副本是深拷贝，单独改eq不影响背包）
            if (itemId) {
                const backpackItem = this.backpack.getItemById(itemId);
                if (backpackItem) {
                    backpackItem.status = 1;
                    // 卸载后自动解锁
                    backpackItem.locked = false;
                }
            }
            this.updateStaminaBonus();
            return {success: true, tip: '装备已卸载'};
        }
        return {success: false, tip: '无效的装备槽类型'};
    }

    // 切换物品锁定状态
    toggleLockItem(id, fallbackIndex) {
        let item = this.backpack.getItemById(id);
        if (!item && fallbackIndex !== undefined) {
            const idx = parseInt(fallbackIndex);
            if (!isNaN(idx) && idx >= 0 && idx < this.backpack.items.length) {
                item = this.backpack.items[idx];
            }
        }
        if (!item) return {success: false, tip: '物品不存在'};
        item.locked = !item.locked;
        return {
            success: true,
            locked: item.locked,
            tip: item.locked ? '物品已锁定（无法卖出/交易）' : '物品已解锁'
        };
    }

    // 使用物品方法
    useItem(id, fallbackIndex) {
        let item = this.backpack.getItemById(id);
        // 索引后备查找
        if (!item && fallbackIndex !== undefined) {
            const idx = parseInt(fallbackIndex);
            if (!isNaN(idx) && idx >= 0 && idx < this.backpack.items.length) {
                item = this.backpack.items[idx];
            }
        }
        if (!item) return {success: false, tip: "物品不存在！"};

        // item.type 含义（goods.js分类）: 2=商店物品, 3=解药, 4=回复药, 5=宝石/体力包, 7=百宝箱/乾坤袋
        const usableTypes = [2, 3, 4, 5, 7];
        if (!usableTypes.includes(item.type)) {
            return {success: false, tip: "该物品不能使用！"};
        }

        if (item.num <= 0) {
            return {success: false, tip: "物品数量不足！"};
        }

        // 执行使用逻辑
        if (item.type === 2) { // 商店物品（通用消耗品）
            const singleHeal = item.info?.addHp || 0;
            const totalPool = item.info?.allHp || 0;
            if (singleHeal > 0 || totalPool > 0) {
                // 追踪剩余池子（首次使用时初始化）
                if (totalPool > 0) {
                    if (item.info._poolLeft === undefined) item.info._poolLeft = totalPool;
                    const healAmount = Math.min(singleHeal || totalPool, item.info._poolLeft);
                    if (healAmount <= 0) {
                        this.backpack.removeItem(id);
                        return {success: true, tip: '你使用了' + item.name + '，已耗尽！'};
                    }
                    const maxHealth = this.health;
                    const newHealth = Math.min(maxHealth, this.currentHealth + healAmount);
                    const actualHeal = newHealth - this.currentHealth;
                    this.currentHealth = newHealth;
                    item.info._poolLeft -= actualHeal;
                    if (item.info._poolLeft <= 0) {
                        this.backpack.removeItem(id);
                        return {success: true, tip: '你使用了' + item.name + '（最后' + actualHeal + '点），恢复了' + actualHeal + '点生命值！已耗尽'};
                    }
                    return {success: true, tip: '你使用了' + item.name + '，恢复了' + actualHeal + '点生命值！剩余池: ' + item.info._poolLeft};
                }
                // 无总量池，单次使用扣除
                const maxHealth = this.health;
                const newHealth = Math.min(maxHealth, this.currentHealth + singleHeal);
                const actualHeal = newHealth - this.currentHealth;
                this.currentHealth = newHealth;
                this.backpack.removeItem(id);
                this.updateStaminaBonus();
                return {success: true, tip: '你使用了' + item.name + '，恢复了' + actualHeal + '点生命值！'};
            }
            return {success: false, tip: '该物品没有使用效果'};
        } else if (item.type === 3) { // 异常状态清除类物品
            if (item.info && item.info.clear) {
                let tip = "";
                // 清除指定的状态
                if (item.info.clear.includes("all")) {
                    // 清除所有异常状态
                    this.statusEffects.slow = false;
                    this.statusEffects.weak = false;
                    this.statusEffects.curse = false;
                    this.statusEffects.depressed = false;
                    this.statusEffects.poison = 0;
                    this.statusEffects.paralysis = false;
                    tip = "你使用了" + item.name + "，清除了所有异常状态！";
                } else {
                    // 清除特定状态
                    const cleared = [];
                    if (item.info.clear.includes("slowness") && this.statusEffects.slow) {
                        this.statusEffects.slow = false;
                        cleared.push("缓慢");
                    }
                    if (item.info.clear.includes("weakness") && this.statusEffects.weak) {
                        this.statusEffects.weak = false;
                        cleared.push("虚弱");
                    }
                    if (item.info.clear.includes("curse") && this.statusEffects.curse) {
                        this.statusEffects.curse = false;
                        cleared.push("诅咒");
                    }
                    if (item.info.clear.includes("depression") && this.statusEffects.depressed) {
                        this.statusEffects.depressed = false;
                        cleared.push("沮丧");
                    }
                    if (item.info.clear.includes("poison") && this.statusEffects.poison > 0) {
                        this.statusEffects.poison = 0;
                        cleared.push("中毒");
                    }
                    if (item.info.clear.includes("paralysis") && this.statusEffects.paralysis) {
                        this.statusEffects.paralysis = false;
                        cleared.push("麻痹");
                    }

                    if (cleared.length > 0) {
                        tip = "你使用了" + item.name + "，清除了" + cleared.join("、") + "状态！";
                    } else {
                        tip = "你使用了" + item.name + "，但没有可清除的异常状态。";
                    }
                }

                this.backpack.removeItem(id);

                // 更新体力宝加成
                this.updateStaminaBonus();

                return {success: true, tip};
            }
        } else if (item.type === 4) { // 生命恢复类物品
            const singleHeal = item.info?.heal || item.info?.addHp || 0;
            const totalPool = item.info?.allHp || 0;
            if (singleHeal > 0 || totalPool > 0) {
                if (totalPool > 0) {
                    if (item.info._poolLeft === undefined) item.info._poolLeft = totalPool;
                    const healAmount = Math.min(singleHeal || totalPool, item.info._poolLeft, this.health - this.currentHealth);
                    if (healAmount <= 0) { return {success: true, tip: '体力已满，无需使用'};
                    }
                    const newHealth = Math.min(this.health, this.currentHealth + healAmount);
                    const actualHeal = newHealth - this.currentHealth;
                    this.currentHealth = newHealth;
                    item.info._poolLeft -= actualHeal;
                    if (item.info._poolLeft <= 0) {
                        this.backpack.removeItem(id); this.updateStaminaBonus();
                        return {success: true, tip: '你使用了' + item.name + '，恢复了' + actualHeal + '点生命值！（已耗尽）'};
                    }
                    return {success: true, tip: '你使用了' + item.name + '，恢复了' + actualHeal + '点生命值！剩余池: ' + item.info._poolLeft};
                }
                const maxHealth = this.health;
                const currentHealth = this.currentHealth;
                const newHealth = Math.min(maxHealth, currentHealth + singleHeal);
                const actualHeal = newHealth - currentHealth;
                this.currentHealth = newHealth;
                this.backpack.removeItem(id);
                this.updateStaminaBonus();
                return {success: true, tip: '你使用了' + item.name + '，恢复了' + actualHeal + '点生命值！'};
            }
        } else if (item.type === 5) { // 体力包
            const singleHeal = item.info?.heal || item.info?.addHp || 0;
            const totalPool = item.info?.allHp || 0;
            if (singleHeal > 0 || totalPool > 0) {
                if (totalPool > 0) {
                    if (item.info._poolLeft === undefined) item.info._poolLeft = totalPool;
                    const healAmount = Math.min(singleHeal || totalPool, item.info._poolLeft, this.health - this.currentHealth);
                    if (healAmount <= 0) { return {success: true, tip: '体力已满，无需使用'}; }
                    const newHealth = Math.min(this.health, this.currentHealth + healAmount);
                    const actualHeal = newHealth - this.currentHealth;
                    this.currentHealth = newHealth;
                    item.info._poolLeft -= actualHeal;
                    if (item.info._poolLeft <= 0) {
                        this.backpack.removeItem(id); this.updateStaminaBonus();
                        return {success: true, tip: '你使用了' + item.name + '，恢复了' + actualHeal + '点体力！（已耗尽）'};
                    }
                    this.updateStaminaBonus();
                    return {success: true, tip: '你使用了' + item.name + '，恢复了' + actualHeal + '点体力！剩余池: ' + item.info._poolLeft};
                }
                const maxHealth = this.health;
                const currentHealth = this.currentHealth;
                const newHealth = Math.min(maxHealth, currentHealth + singleHeal);
                const actualHeal = newHealth - currentHealth;
                this.currentHealth = newHealth;
                this.backpack.removeItem(id);
                this.updateStaminaBonus();
                return {success: true, tip: '你使用了' + item.name + '，恢复了' + actualHeal + '点体力！'};
            }
        } else if (item.type === 7) {
            // type=7 百宝箱/乾坤袋：按名称区分功能，使用后均不消失
            if (item.name === '百宝箱') {
                this.autoPickup = !this.autoPickup;
                if (this.autoPickup) {
                    return {success: true, tip: '百宝箱已开启！击杀怪物后将自动拾取掉落物品'};
                } else {
                    return {success: true, tip: '百宝箱已关闭'};
                }
            } else if (item.name === '乾坤袋') {
                const expansionAmount = item.info && item.info.expand ? item.info.expand : 100;
                this.backpack.maxWeight += expansionAmount;
                // 乾坤袋不消失，保留在背包中
                return {success: true, tip: '乾坤袋已激活！背包负重上限永久+' + expansionAmount + '，当前上限' + this.backpack.maxWeight};
            } else {
                return {success: false, tip: '无法使用该物品！'};
            }
        }

        return {success: false, tip: "无法使用该物品！"};
    }

    _calculateStat(base, increment) {
        return Math.floor(base + (this.level - 1) * increment);
    }

    // 战斗属性访问器
    get health() {
        let h = this.equipProperty.health;
        let base = this._health + h + this.staminaBonus;
        // 卡片加成
        if (this._cardBonus) {
            base += (this._cardBonus.health || 0);
            // 血量百分比
            base = Math.floor(base * (1 + ((this._cardBonus.healthPercent || 0) / 100)));
        }
        return base;
    }

    set health(value) {
        this._health = value;
    }

    // 获取考虑异常状态的敏捷值
    get agility() {
        let a = this.equipProperty.agility;
        let agility = this._agility + a;
        if (this._cardBonus) {
            agility += (this._cardBonus.agility || 0);
        }
        // 队伍/结婚加成
        let mult = 1 + (this.teamBonusPercent / 100) + this.marriageBonusPercent;
        agility = Math.floor(agility * mult);
        if (this.statusEffects.slow) {
            agility = Math.floor(agility * 0.9);
        }
        return agility;
    }

    set agility(value) {
        this._agility = value;
    }

    // 获取考虑异常状态的攻击力
    get attack() {
        let a = this.equipProperty.attack;
        let attack = this._attack + a;
        // 卡片加式
        if (this._cardBonus) {
            attack += (this._cardBonus.attack || 0);
            attack = Math.floor(attack * (1 + ((this._cardBonus.attackPercent || 0) / 100)));
        }
        // 队伍/结婚加成
        let mult = 1 + (this.teamBonusPercent / 100) + this.marriageBonusPercent;
        attack = Math.floor(attack * mult);
        // 异常状态
        if (this.statusEffects.weak) {
            attack = Math.floor(attack * 0.9);
        }
        return attack;
    }

    set attack(value) {
        this._attack = value;
    }

    // 获取考虑异常状态的最大攻击力
    get maxAttack() {
        let m = this.equipProperty.maxAttack;
        let maxAttack = this._maxAttack + m;
        if (this._cardBonus) {
            // card bonus mainly from attack values (not maxAttack-specific)
            maxAttack += (this._cardBonus.attack || 0);
            maxAttack = Math.floor(maxAttack * (1 + ((this._cardBonus.attackPercent || 0) / 100)));
        }
        let mult = 1 + (this.teamBonusPercent / 100) + this.marriageBonusPercent;
        maxAttack = Math.floor(maxAttack * mult);
        if (this.statusEffects.weak) {
            maxAttack = Math.floor(maxAttack * 0.9);
        }
        return maxAttack;
    }

    set maxAttack(value) {
        this._maxAttack = value;
    }

    // 获取考虑异常状态的防御力
    get defense() {
        let d = this.equipProperty.defense;
        let defense = this._defense + d;
        if (this._cardBonus) {
            defense += (this._cardBonus.defense || 0);
            defense = Math.floor(defense * (1 + ((this._cardBonus.defensePercent || 0) / 100)));
        }
        // 队伍/结婚加成
        let mult = 1 + (this.teamBonusPercent / 100) + this.marriageBonusPercent;
        defense = Math.floor(defense * mult);
        if (this.statusEffects.depressed) {
            defense = Math.floor(defense * 0.9);
        }
        return defense;
    }

    set defense(value) {
        this._defense = value;
    }

    // 获取考虑异常状态的士气值
    get morale() {
        let m = this.equipProperty.morale;
        let morale = this._morale + m;

        // 沮丧状态减少5点士气
        if (this.statusEffects.depressed) {
            morale -= 5;
        }

        return morale;
    }

    set morale(value) {
        this._morale = value;
    }

    addMorale(amount) {
        this._morale += amount;
        if (this._morale < 0) {
            this._morale = 0;
        }
    }

    addCopper(amount) {
        this.copper += Math.floor(parseInt(amount) * (this.copperMultiplier || 1));
        if (this.copper < 0) {
            this.copper = 0;
        }
    }

    // 添加声望
    addReputation(amount) {
        this.reputation += amount;
    }

    // 添加幸运
    addLuck(amount) {
        this.luck += amount;
        if (this.luck > 100) {
            this.luck = 100;
        }
        if (this.luck < 0) {
            this.luck = 0;
        }
    }

    // 成长系统方法
    /**
     * 增加经验值
     * @param {number} amount - 获得经验值
     */
    addExp(amount, fromMentor = false, source = '') {
        let multiplier = this.expMultiplier || 1;
        if (fromMentor && this.mentorOnlineBonus) {
            multiplier *= 1.2; // 师徒在线时额外20%经验
        }
        const gained = Math.floor(amount * multiplier);
        this.exp += gained;
        // 经验来源追踪（便于日志和统计）
        if (source) {
            this._expHistory = this._expHistory || [];
            this._expHistory.push({ source, amount: gained, time: Date.now() });
            if (this._expHistory.length > 50) this._expHistory.shift();
        }
        // 等级封顶：满级后不再累积经验（防止大额经验一次性击穿最高等级）
        const maxLevel = (formulas.balance.playerExp && formulas.balance.playerExp.maxLevel) || 210;
        if (this.level >= maxLevel) {
            this.exp = 0;
            return;
        }
        while (this.level < maxLevel && this.exp >= this.getExpToNextLevel()) {
            this.levelUp();
        }
        if (this.level >= maxLevel) this.exp = 0;
    }

    /** 计算升级所需经验（优先 config/exp.json，缺失时公式兜底，见 src/formulas.js） */
    getExpToNextLevel() {
        return formulas.expToNext(this.level);
    }

    /** 升级属性提升（成长系数集中于 config/balance.json） */
    levelUp(onLevelUp) {
        this.level++;
        const growth = formulas.levelUpGrowth(this.level);
        this._health += growth.health;
        this._attack += growth.attack;
        this._maxAttack += growth.maxAttack;
        this._defense += growth.defense;
        this._agility += growth.agility;
        this._morale += growth.morale;
        if (typeof onLevelUp === 'function') {
            onLevelUp(this.level);
        }
    }

    /**
     * 处理任务奖励
     * @param {object} prize - 任务奖励对象
     */
    addPrize(prize) {
        // 遍历奖励对象的所有键
        for (const [key, value] of Object.entries(prize)) {
            switch (key) {
                case '经验':
                    this.addExp(value);
                    break;
                case '声望':
                    this.addReputation(value);
                    break;
                case '金贝':
                    this.gold += value;
                    break;
                case '银贝':
                    this.copper += value * 1000;
                    break;
                case '铜贝':
                    this.addCopper(value);
                    break;
                case '幸运':
                    this.addLuck(value);
                    break;
                default:
                    // 处理物品奖励 - 使用getGoodsByName方法
                    const rewardItem = getGoodsByName(key, value);
                    this.backpack.addItem(rewardItem);

                    // 如果是体力宝类物品（type 45），立即更新加成
                    if (rewardItem.type === 45) {
                        this.updateStaminaBonus();
                    }
                    break;
            }
        }
    }

    // 应用异常状态的方法
    applyStatusEffect(effectName) {
        switch (effectName) {
            case 'slow':
                if (Math.random() > this.resistances.slow) {
                    this.statusEffects.slow = true;
                }
                break;
            case 'weak':
                if (Math.random() > this.resistances.weak) {
                    this.statusEffects.weak = true;
                }
                break;
            case 'curse':
                if (Math.random() > this.resistances.curse) {
                    this.statusEffects.curse = true;
                }
                break;
            case 'depressed':
                if (Math.random() > this.resistances.depressed) {
                    this.statusEffects.depressed = true;
                }
                break;
            case 'poison':
                if (Math.random() > this.resistances.poison) {
                    this.statusEffects.poison = 3; // 持续3回合
                }
                break;
            case 'paralysis':
                if (Math.random() > this.resistances.paralysis) {
                    this.statusEffects.paralysis = true;
                }
                break;
        }
    }

    // 处理每回合的状态效果
    processStatusEffects() {
        const effectsLog = [];

        // 处理中毒状态
        if (this.statusEffects.poison > 0) {
            const poisonDamage = Math.floor(this.health * 0.1);
            this.currentHealth = Math.max(0, this.currentHealth - poisonDamage);
            effectsLog.push("你受到中毒效果影响，损失了10%当前生命值");
            this.statusEffects.poison--;

            if (this.statusEffects.poison === 0) {
                effectsLog.push("你的中毒状态已解除");
            }
        }

        // 清除临时麻痹状态
        if (this.statusEffects.paralysis) {
            this.statusEffects.paralysis = false;
            effectsLog.push("你的麻痹状态已解除");
        }

        return effectsLog;
    }

    // 检查是否被麻痹
    isParalyzed() {
        if (this.statusEffects.paralysis) {
            // 50%概率无法行动
            return Math.random() < 0.5;
        }
        return false;
    }

    // 检查诅咒效果
    checkCurseEffect() {
        if (this.statusEffects.curse) {
            // 10%概率对自己造成5%最大HP的伤害
            if (Math.random() < 0.1) {
                const curseDamage = Math.floor(this.health * 0.05);
                this.currentHealth = Math.max(0, this.currentHealth - curseDamage);
                return true;
            }
        }
        return false;
    }

    // 战斗时注入外部加式
    setCardBonus(bonus) { this._cardBonus = bonus || null; }
    setTeamBonus(memberCount) { this._teamMemberCount = Math.max(0, Math.min(5, (memberCount || 1) - 1)); }
    setMarriageBonus(intimacy) { this._marriageIntimacy = intimacy || 0; }
    setAwakenModule(module) { this._awakenModule = module || null; }

    // 计算队伍加成百分比（每位在线队友 +5%，最多20%）
    get teamBonusPercent() {
        return this._teamMemberCount * 5;
    }
    // 结婚加成百分比（亲密度×5%，满100=10%）
    get marriageBonusPercent() {
        // 婚倍力：那种关系力
        return Math.min(0.1, (this._marriageIntimacy || 0) * 0.001);
    }

    // 状态获取方法
    /** 获取完整角色状态（纯读，不修改任何内部状态） */
    getStatus() {
        // 纯读：直接根据 currentStaminaItem 计算显示值。
        // updateStaminaBonus 仅在 useItem / useStaminaItem 中显式调用。
        // 但若 currentStaminaItem 无效且背包里有治疗品，则懒初始化。
        let needsUpdate = false;
        if (!this.currentStaminaItem || !this.currentStaminaItem.info) {
            // 检查背包里是否有符合条件的治疗品
            const candidates = this.backpack.getStatus().items.filter(i => i.info && i.info.allHp && i.info.addHp);
            if (candidates.length > 0) {
                needsUpdate = true;
            }
        }
        if (needsUpdate) {
            this.updateStaminaBonus();
        }

        let currentStaminaAllHp = 0;
        if (this.currentStaminaItem && this.currentStaminaItem.info) {
            currentStaminaAllHp = this.currentStaminaItem.info._poolLeft !== undefined
                ? this.currentStaminaItem.info._poolLeft
                : (this.currentStaminaItem.info.allHp || 0);
        }

        return {
            gold: this.gold,
            copper: this.copper,
            showSilver: this.showSilver,
            showCopper: this.showCopper,
            level: this.level,
            exp: `${this.exp}/${this.getExpToNextLevel()}`,
            health: this.health,
            attack: this.attack,
            maxAttack: this.maxAttack,
            defense: this.defense,
            agility: this.agility,
            morale: this.morale,
            currentHealth: this.currentHealth,
            reputation: this.reputation,  // 声望
            luck: this.luck,              // 幸运
            statusEffects: this.statusEffects,
            resistances: this.resistances,
            inflictStatusChances: this.inflictStatusChances,
            staminaBonus: this.staminaBonus,  // 体力宝加成
            currentStaminaAllHp: currentStaminaAllHp  // 当前体力宝的allHp值
        };
    }

    // 获取体力宝信息
    getStaminaItems() {
        // 查找所有有 allHp 池子的物品（奶瓶/体力宝/大体力宝等，不分 type）
        const allItems = this.backpack.getStatus().items;
        return allItems.filter(item => item.info && item.info.allHp);
    }

    // 更新体力宝加成
    updateStaminaBonus() {
        // 获取所有体力宝物品
        const staminaItems = this.getStaminaItems();

        // 如果没有体力宝，清除加成
        if (staminaItems.length === 0) {
            this.staminaBonus = 0;
            this.currentStaminaItem = null;
            return {
                item: null,
                bonus: 0
            };
        }

        // 按照物品名称排序
        staminaItems.sort((a, b) => a.name.localeCompare(b.name));

        // 检查当前生效的体力宝是否还在背包中
        if (this.currentStaminaItem) {
            const currentItem = staminaItems.find(item => item.id === this.currentStaminaItem.id);
            if (currentItem) {
                // 当前生效的体力宝还在背包中，保持其生效状态
                if (currentItem.info && currentItem.info.addHp) {
                    this.staminaBonus = currentItem.info.addHp;
                    return {
                        item: currentItem,
                        bonus: this.staminaBonus
                    };
                }
            }
        }

        // 如果没有当前生效的体力宝或者当前生效的体力宝已不存在，选择第一个
        const firstItem = staminaItems[0];
        if (firstItem.info && firstItem.info.addHp) {
            this.staminaBonus = firstItem.info.addHp;
            this.currentStaminaItem = firstItem; // 记录当前生效的体力宝
            return {
                item: firstItem,
                bonus: this.staminaBonus
            };
        }

        // 如果第一个体力宝没有addHp属性，清除加成
        this.staminaBonus = 0;
        this.currentStaminaItem = null;
        return {
            item: null,
            bonus: 0
        };
    }

    // 使用体力宝恢复体力
    useStaminaItem() {
        // 获取所有体力宝物品
        const staminaItems = this.getStaminaItems();

        // 按照物品名称排序
        staminaItems.sort((a, b) => a.name.localeCompare(b.name));

        // 只取第一个生效（如果有）
        if (staminaItems.length > 0) {
            const firstItem = staminaItems[0];
            // 检查是否有allHp属性（用于恢复体力的总量）
            if (firstItem.info && firstItem.info.allHp) {
                const maxHealth = this.health;
                const currentHealth = this.currentHealth;
                const missingHealth = maxHealth - currentHealth;

                if (missingHealth <= 0) {
                    return { success: false, tip: "体力充沛，无需使用体力宝！" };
                }

                // 初始化池子追踪
                if (firstItem.info._poolLeft === undefined) firstItem.info._poolLeft = firstItem.info.allHp;

                const singleHeal = firstItem.info.addHp || firstItem.info.allHp;
                const healAmount = Math.min(singleHeal, firstItem.info._poolLeft, missingHealth);

                if (healAmount <= 0) {
                    this.backpack.removeItem(firstItem.id);
                    this.currentStaminaItem = null;
                    this.updateStaminaBonus();
                    return { success: true, tip: '使用了' + firstItem.name + '（已耗尽），恢复了全部体力！' };
                }

                this.currentHealth = currentHealth + healAmount;
                firstItem.info._poolLeft -= healAmount;

                // 池子耗尽才移除
                if (firstItem.info._poolLeft <= 0) {
                    this.backpack.removeItem(firstItem.id);
                }

                // 如果使用的正是当前生效的体力宝并且已耗尽，需要清除
                if (this.currentStaminaItem && this.currentStaminaItem.id === firstItem.id && firstItem.info._poolLeft <= 0) {
                    this.currentStaminaItem = null;
                }

                this.updateStaminaBonus();

                return {
                    success: true,
                    tip: '使用了' + firstItem.name + '，恢复了' + healAmount + '点体力！（剩余池: ' + (firstItem.info._poolLeft || 0) + '）',
                    item: firstItem
                };
            }
        }

        return {
            success: false,
            tip: "没有可用的体力宝！"
        };
    }

    get showCopper() {
        return this.copper % 1000;
    }

    get showSilver() {
        return Math.floor(this.copper / 1000);
    }
}
