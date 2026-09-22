/**
 * 宠物系统模块 (v2 增强版)
 * - 成长经验曲线 + level-up
 * - 天赋系统（5阶，影响属性/经验/技能）
 * - 资历新增"至尊"级
 * - 战斗参与属性计算
 */

import { petExpToNext } from './formulas.js';

// 宠物种类定义
const PET_TYPES = {
    // 原始宠物（普通宠物蛋孵化）
    '月虎': { category: 'original', desc: '攻防参半的均衡型宠物', atk: 1.0, def: 1.0, agi: 1.0 },
    '暗狼': { category: 'original', desc: '高攻低敏的猛攻型宠物', atk: 1.2, def: 0.7, agi: 1.0 },
    '龙猫': { category: 'original', desc: '攻敏参半的灵巧型宠物', atk: 0.8, def: 0.8, agi: 1.3 },
    '霸熊': { category: 'original', desc: '防敏参半的坦克型宠物', atk: 0.7, def: 1.3, agi: 0.7 },
    // QQ宠物（QQ宠物蛋孵化，疗伤技能概率加倍）
    'QQ月虎': { category: 'qq', desc: 'QQ版月虎，擅长疗伤', atk: 1.0, def: 1.0, agi: 1.0 },
    'QQ暗狼': { category: 'qq', desc: 'QQ版暗狼，擅长疗伤', atk: 1.2, def: 0.7, agi: 1.0 },
    'QQ龙猫': { category: 'qq', desc: 'QQ版龙猫，擅长疗伤', atk: 0.8, def: 0.8, agi: 1.3 },
    'QQ霸熊': { category: 'qq', desc: 'QQ版霸熊，擅长疗伤', atk: 0.7, def: 1.3, agi: 0.7 },
    // 远古宠物（远古宠物蛋孵化）
    '麒麟': { category: 'ancient', desc: '远古圣兽，攻守兼备', atk: 1.3, def: 1.1, agi: 1.2 },
    '九尾狐': { category: 'ancient', desc: '远古灵狐，敏捷超群', atk: 1.1, def: 0.9, agi: 1.35 },
    '雷霆战鹰': { category: 'ancient', desc: '远古战鹰，攻势凌厉', atk: 1.25, def: 0.85, agi: 1.3 },
    // 远古双超宠（根骨悟性满值）
    '混沌麒麟': { category: 'ancient_super', desc: '混沌之力，全属性卓越', atk: 1.5, def: 1.3, agi: 1.3 },
    '九天灵狐': { category: 'ancient_super', desc: '九天之灵，敏攻极致', atk: 1.4, def: 1.1, agi: 1.4 },
    // 活动宠物
    '圣龙': { category: 'event', desc: '神圣之龙，强力攻击', atk: 1.4, def: 1.2, agi: 1.1 },
    '梦铃': { category: 'event', desc: '梦幻铃音，灵巧型', atk: 0.9, def: 0.85, agi: 1.15 },
    '神兽': { category: 'event', desc: '远古神兽，均衡型', atk: 1.3, def: 1.15, agi: 1.0 },
    '雪精灵': { category: 'event', desc: '冰雪精灵，敏捷型', atk: 0.85, def: 0.9, agi: 1.25 },
    '犬神': { category: 'event', desc: '忠犬之神，攻守平衡', atk: 1.15, def: 1.0, agi: 1.05 },
    '梦魔': { category: 'event', desc: '噩梦之主，攻击型', atk: 1.2, def: 0.8, agi: 1.1 },
    '刑天': { category: 'event', desc: '战神刑天，重攻轻敏', atk: 1.35, def: 1.1, agi: 0.85 },
    '雪熊宝宝': { category: 'event', desc: '可爱雪熊，防御型', atk: 0.75, def: 1.3, agi: 0.7 },
    '球球': { category: 'event', desc: '圆滚小球，敏捷型', atk: 0.9, def: 1.0, agi: 1.2 },
    '财神': { category: 'event', desc: '财运亨通，均衡型', atk: 0.95, def: 0.95, agi: 1.0 },
    '汤小帅': { category: 'event', desc: '帅气小汤，攻击型', atk: 1.1, def: 0.85, agi: 1.1 },
    '叫兽': { category: 'event', desc: '学问之兽，均衡型', atk: 1.0, def: 0.9, agi: 1.05 },
    '粽子君': { category: 'event', desc: '端午之灵，防御型', atk: 1.05, def: 1.05, agi: 0.95 },
    '鲜花金古绿': { category: 'event', desc: '花之精灵，攻击型', atk: 1.15, def: 0.95, agi: 1.15 },
    '轰天彩吟猪': { category: 'event', desc: '彩吟神猪，猛攻型', atk: 1.25, def: 0.8, agi: 0.9 },
};

// 宠物蛋种类与可孵出宠物映射
const EGG_PET_MAP = {
    'normal':  ['月虎', '暗狼', '龙猫', '霸熊'],
    'qq':      ['QQ月虎', 'QQ暗狼', 'QQ龙猫', 'QQ霸熊'],
    'ancient': ['麒麟', '九尾狐', '雷霆战鹰'],
    'ancient_super': ['混沌麒麟', '九天灵狐'],
};

// 天赋等级定义及效果（v3：对齐pet.json配置）
const TALENT_TIERS = {
    '极差':    { statBonus: 0,    expBonus: 0,   maxSkillPoints: 12, feedHunger: 4, feedClean: 5, weight: 15 },
    '较差':    { statBonus: 0,    expBonus: 0,   maxSkillPoints: 14, feedHunger: 3, feedClean: 4, weight: 25 },
    '普通':    { statBonus: 0.05, expBonus: 0,   maxSkillPoints: 16, feedHunger: 3, feedClean: 3, weight: 35 },
    '上佳':    { statBonus: 0.10, expBonus: 1,   maxSkillPoints: 16, feedHunger: 2, feedClean: 3, weight: 20 },
    '无比聪慧': { statBonus: 0.20, expBonus: 2,   maxSkillPoints: 18, feedHunger: 1, feedClean: 2, weight: 5 }
};

// 资历等级定义（根骨）
const QUALIFICATION_TIERS = ['极差', '较差', '普通', '上佳', '超群'];

// 宠物技能定义（对齐pet.json：4档 × 4技能 = 16个技能）
const PET_SKILLS = [
    // ---- 高级技能 ----
    { id: 1,  name: '威压',  type: 'debuff', desc: '20%概率降低对手全部属性10%',          tier: 'high',   skillCost: 4 },
    { id: 2,  name: '怒吼',  type: 'buff',   desc: '战斗提升自身全部属性10%',             tier: 'high',   skillCost: 4 },
    { id: 3,  name: '迷惑',  type: 'debuff', desc: '20%概率让对方宠物退出战斗',           tier: 'high',   skillCost: 4 },
    { id: 4,  name: '嗜血',  type: 'attack', desc: '10%概率将攻击伤害30%转化为生命恢复',  tier: 'high',   skillCost: 3 },
    // ---- 中级技能 ----
    { id: 5,  name: '卸刃',  type: 'debuff', desc: '20%概率直接卸掉对方武器',             tier: 'medium', skillCost: 3 },
    { id: 6,  name: '卸甲',  type: 'debuff', desc: '20%概率直接卸掉对方盔甲',             tier: 'medium', skillCost: 3 },
    { id: 7,  name: '疗伤',  type: 'heal',   desc: '战斗胜利后恢复主人10%体力',           tier: 'medium', skillCost: 3 },
    { id: 8,  name: '封血',  type: 'debuff', desc: '20%概率阻止对手自动加血',             tier: 'medium', skillCost: 3 },
    // ---- 低级技能 ----
    { id: 9,  name: '利刃',  type: 'buff',   desc: '本次战斗增加10%攻击',                  tier: 'low',    skillCost: 2 },
    { id: 10, name: '御敌',  type: 'buff',   desc: '本次战斗增加10%防御',                  tier: 'low',    skillCost: 2 },
    { id: 11, name: '轻身',  type: 'buff',   desc: '本次战斗增加20点敏捷',                  tier: 'low',    skillCost: 2 },
    { id: 12, name: '振幅',  type: 'buff',   desc: '本次战斗增加20点士气',                  tier: 'low',    skillCost: 2 },
    // ---- 特殊技能 ----
    { id: 13, name: '繁殖',  type: 'special', desc: '传说技能：可与同类繁殖下一代宠物',     tier: 'special', skillCost: 5 },
    { id: 14, name: '封毒',  type: 'debuff', desc: '20%概率让对手丧失毒攻技能',           tier: 'special', skillCost: 2 },
    { id: 15, name: '封虚',  type: 'debuff', desc: '20%概率让对手丧失虚弱攻技能',         tier: 'special', skillCost: 2 },
    { id: 16, name: '封麻',  type: 'debuff', desc: '20%概率让对手丧失麻痹攻技能',         tier: 'special', skillCost: 2 }
];

export default class Pet {
    constructor(name, type) {
        this.name = name || type || '未命名';
        this.type = type;
        this.level = 1;
        this.exp = 0;

        // 宠物状态属性
        this.hunger = 1000;
        this.cleanliness = 1000;
        this.mood = 1000;

        // 资质和天赋
        this.qualification = '普通';  // 根骨
        this.talent = '普通';          // 悟性

        // 技能相关
        this.skills = [];             // 已学后天技能
        this.innateSkills = [];       // 孵化时随机获得的先天技能
        this.usedSkillPoints = 0;     // 已用技能点数

        // 锁定与命名
        this.talentLocked = false;
        this.qualLocked = false;
        this.nameSet = false;

        // 其他属性
        this.isFighting = false;
        this.isBound = false;
    }

    /**
     * 获取升级所需经验（统一走 formulas.petExpToNext，与喂食/成长路径 database.growPet 同量级，
     * 避免与喂食路径的 100000/50000 系数量级分裂；等级封顶 100 级逻辑保持不变）
     */
    get expToNextLevel() {
        return petExpToNext(this.level);
    }

    /**
     * 获取天赋效果配置
     */
    get talentConfig() {
        return TALENT_TIERS[this.talent] || TALENT_TIERS['普通'];
    }

    /**
     * 添加经验并检查升级（每5级自动领悟一个技能）
     */
    addExp(amount) {
        // 天赋经验加成（上佳+1，无比聪慧+2）
        const bonus = this.talentConfig.expBonus;
        const actualAmount = amount + bonus;
        this.exp += actualAmount;

        let leveledUp = false;
        const unlockedSkills = [];
        while (this.exp >= this.expToNextLevel && this.level < 100) {
            this.exp -= this.expToNextLevel;
            this.level++;
            leveledUp = true;
            // 每5级触发一次技能领悟
            if (this.level % 5 === 0) {
                const unlockResult = this.unlockLevelSkill();
                if (unlockResult.success) {
                    unlockedSkills.push(unlockResult);
                }
            }
        }
        return { gained: actualAmount, leveledUp, newLevel: this.level, unlockedSkills };
    }

    /**
     * 获取最大可学技能数（默认8，食用魔纹果实后9）
     */
    get maxLearnableSkills() {
        const hasMagicFruit = this._hasMagicMarkFruit;
        return hasMagicFruit ? 9 : 8;
    }

    /**
     * 检查背包中是否有魔纹果实（通过外部注入）
     */
    get _hasMagicMarkFruit() {
        return this._backpackRef && this._backpackRef.hasItem('魔纹果实', 1);
    }

    /**
     * 注入背包引用（由 petManager 在添加宠物时调用）
     */
    setBackpackRef(backpack) {
        this._backpackRef = backpack;
    }

    /**
     * 等级领悟：随机获得一个未学会的技能
     * @returns {Object} 领悟结果
     */
    unlockLevelSkill() {
        // 统计已学技能总数（先天+后天）
        const allLearned = [...this.innateSkills, ...this.skills];
        if (allLearned.length >= this.maxLearnableSkills) {
            return { success: false, message: '技能栏已满' };
        }

        // 找出未学会的技能池
        const learnedIds = new Set(allLearned.map(s => s.id));
        const available = PET_SKILLS.filter(s => !learnedIds.has(s.id));
        if (available.length === 0) {
            return { success: false, message: '所有技能已学会' };
        }

        // 随机选取一个
        const picked = available[Math.floor(Math.random() * available.length)];
        this.skills.push({
            id: picked.id,
            name: picked.name,
            type: picked.type,
            desc: picked.desc,
            tier: picked.tier,
            skillCost: picked.skillCost,
            innate: false,
            levelUnlocked: true
        });

        return {
            success: true,
            message: `领悟了新技能【${picked.name}】！(${picked.desc})`,
            skill: picked
        };
    }

    /**
     * 随机生成天赋（孵化时调用）
     */
    static randomTalent() {
        const totalWeight = Object.values(TALENT_TIERS).reduce((s, t) => s + t.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const [name, tier] of Object.entries(TALENT_TIERS)) {
            roll -= tier.weight;
            if (roll <= 0) return name;
        }
        return '普通';
    }

    /**
     * 随机生成资质（孵化/重置时调用）
     */
    static randomQualification() {
        const weights = { '极差': 5, '较差': 15, '普通': 45, '上佳': 25, '超群': 10 };
        const total = Object.values(weights).reduce((s, w) => s + w, 0);
        let roll = Math.random() * total;
        for (const [name, w] of Object.entries(weights)) {
            roll -= w;
            if (roll <= 0) return name;
        }
        return '普通';
    }

    /**
     * 重置资质（随机new value）
     */
    resetQualification() {
        this.qualification = Pet.randomQualification();
        return this.qualification;
    }

    /**
     * 重置天赋（随机new value，消耗道具）
     */
    resetTalent() {
        this.talent = Pet.randomTalent();
        return this.talent;
    }

    // ====== 属性计算 ======

    get attack() {
        let base = this.level * 5;
        switch (this.type) {
            // 原始宠物
            case '暗狼': base *= 1.2; break;   // 高攻低敏
            case '龙猫': base *= 0.8; break;   // 攻敏参半
            case '月虎': base *= 1.0; break;   // 攻防参半
            case '霸熊': base *= 0.7; break;   // 防敏参半
            // QQ宠物（类似原始但疗伤权重高）
            case 'QQ暗狼': base *= 1.2; break;
            case 'QQ龙猫': base *= 0.8; break;
            case 'QQ月虎': base *= 1.0; break;
            case 'QQ霸熊': base *= 0.7; break;
            // 远古宠物
            case '麒麟': base *= 1.3; break;
            case '九尾狐': base *= 1.1; break;
            case '雷霆战鹰': base *= 1.25; break;
            // 远古双超宠（根骨悟性满值）
            case '混沌麒麟': base *= 1.5; break;
            case '九天灵狐': base *= 1.4; break;
            // 活动宠物
            case '圣龙': base *= 1.4; break;
            case '梦铃': base *= 0.9; break;
            case '神兽': base *= 1.3; break;
            case '雪精灵': base *= 0.85; break;
            case '犬神': base *= 1.15; break;
            case '梦魔': base *= 1.2; break;
            case '刑天': base *= 1.35; break;
            case '雪熊宝宝': base *= 0.75; break;
            case '球球': base *= 0.9; break;
            case '财神': base *= 0.95; break;
            case '汤小帅': base *= 1.1; break;
            case '叫兽': base *= 1.0; break;
            case '粽子君': base *= 1.05; break;
            case '鲜花金古绿': base *= 1.15; break;
            case '轰天彩吟猪': base *= 1.25; break;
        }
        switch (this.qualification) {
            case '极差': base *= 0.7; break;
            case '较差': base *= 0.85; break;
            case '普通': base *= 1.0; break;
            case '上佳': base *= 1.15; break;
            case '超群': base *= 1.3; break;
        }
        // 天赋加成
        base *= (1 + this.talentConfig.statBonus);
        return Math.floor(base);
    }

    get defense() {
        let base = this.level * 3;
        switch (this.type) {
            // 原始宠物
            case '暗狼': base *= 0.7; break;
            case '龙猫': base *= 0.8; break;
            case '月虎': base *= 1.0; break;
            case '霸熊': base *= 1.3; break;
            // QQ宠物
            case 'QQ暗狼': base *= 0.7; break;
            case 'QQ龙猫': base *= 0.8; break;
            case 'QQ月虎': base *= 1.0; break;
            case 'QQ霸熊': base *= 1.3; break;
            // 远古宠物
            case '麒麟': base *= 1.1; break;
            case '九尾狐': base *= 0.9; break;
            case '雷霆战鹰': base *= 0.85; break;
            // 远古双超宠
            case '混沌麒麟': base *= 1.3; break;
            case '九天灵狐': base *= 1.1; break;
            // 活动宠物
            case '圣龙': base *= 1.2; break;
            case '梦铃': base *= 0.85; break;
            case '神兽': base *= 1.15; break;
            case '雪精灵': base *= 0.9; break;
            case '犬神': base *= 1.0; break;
            case '梦魔': base *= 0.8; break;
            case '刑天': base *= 1.1; break;
            case '雪熊宝宝': base *= 1.3; break;
            case '球球': base *= 1.0; break;
            case '财神': base *= 0.95; break;
            case '汤小帅': base *= 0.85; break;
            case '叫兽': base *= 0.9; break;
            case '粽子君': base *= 1.05; break;
            case '鲜花金古绿': base *= 0.95; break;
            case '轰天彩吟猪': base *= 0.8; break;
        }
        switch (this.qualification) {
            case '极差': base *= 0.7; break;
            case '较差': base *= 0.85; break;
            case '普通': base *= 1.0; break;
            case '上佳': base *= 1.15; break;
            case '超群': base *= 1.3; break;
        }
        base *= (1 + this.talentConfig.statBonus);
        return Math.floor(base);
    }

    get agility() {
        let base = this.level * 4;
        switch (this.type) {
            // 原始宠物
            case '暗狼': base *= 1.0; break;
            case '龙猫': base *= 1.3; break;
            case '月虎': base *= 1.0; break;
            case '霸熊': base *= 0.7; break;
            // QQ宠物
            case 'QQ暗狼': base *= 1.0; break;
            case 'QQ龙猫': base *= 1.3; break;
            case 'QQ月虎': base *= 1.0; break;
            case 'QQ霸熊': base *= 0.7; break;
            // 远古宠物
            case '麒麟': base *= 1.2; break;
            case '九尾狐': base *= 1.35; break;
            case '雷霆战鹰': base *= 1.3; break;
            // 远古双超宠
            case '混沌麒麟': base *= 1.3; break;
            case '九天灵狐': base *= 1.4; break;
            // 活动宠物
            case '圣龙': base *= 1.1; break;
            case '梦铃': base *= 1.15; break;
            case '神兽': base *= 1.0; break;
            case '雪精灵': base *= 1.25; break;
            case '犬神': base *= 1.05; break;
            case '梦魔': base *= 1.1; break;
            case '刑天': base *= 0.85; break;
            case '雪熊宝宝': base *= 0.7; break;
            case '球球': base *= 1.2; break;
            case '财神': base *= 1.0; break;
            case '汤小帅': base *= 1.1; break;
            case '叫兽': base *= 1.05; break;
            case '粽子君': base *= 0.95; break;
            case '鲜花金古绿': base *= 1.15; break;
            case '轰天彩吟猪': base *= 0.9; break;
        }
        switch (this.qualification) {
            case '极差': base *= 0.7; break;
            case '较差': base *= 0.85; break;
            case '普通': base *= 1.0; break;
            case '上佳': base *= 1.15; break;
            case '超群': base *= 1.3; break;
        }
        base *= (1 + this.talentConfig.statBonus);
        return Math.floor(base);
    }

    // ====== 照料功能 ======

    feed(food) {
        if (this.hunger >= 1000) return { success: false, message: '宠物已经很饱了' };
        const increase = food.info?.add || 0;
        this.hunger = Math.min(1000, this.hunger + increase);
        food.num--;
        return { success: true, message: `喂食成功，饱食度+${increase}` };
    }

    clean(cleaner) {
        if (this.cleanliness >= 1000) return { success: false, message: '宠物已经很干净了' };
        const increase = cleaner.info?.add || 0;
        this.cleanliness = Math.min(1000, this.cleanliness + increase);
        cleaner.num--;
        return { success: true, message: `清洁成功，清洁度+${increase}` };
    }

    // ====== 孵化 ======

    static hatchFromEgg(eggType, petType) {
        const newPet = new Pet(petType, petType);
        // 远古/高级蛋有更好资质和天赋
        if (eggType === 'ancient' || eggType === 'advanced') {
            newPet.qualification = Pet.randomQualification();
            // 保底至少普通
            if (newPet.qualification === '极差' || newPet.qualification === '较差') {
                newPet.qualification = '普通';
            }
            newPet.talent = Pet.randomTalent();
            // 保底至少普通天赋
            if (newPet.talent === '极差' || newPet.talent === '较差') {
                newPet.talent = '普通';
            }
        } else {
            newPet.qualification = Pet.randomQualification();
            newPet.talent = Pet.randomTalent();
        }
        // 孵化时随机获得先天技能（QQ宠物疗伤权重加倍）
        newPet.innateSkills = Pet.generateInnateSkills(newPet.talent, petType);
        return newPet;
    }

    // ====== 状态获取 ======

    getStatus() {
        return {
            name: this.name,
            type: this.type,
            level: this.level,
            exp: this.exp,
            expToNextLevel: this.expToNextLevel,
            hunger: this.hunger,
            cleanliness: this.cleanliness,
            mood: this.mood,
            attack: this.attack,
            defense: this.defense,
            agility: this.agility,
            qualification: this.qualification,
            talent: this.talent,
            talentConfig: this.talentConfig,
            isFighting: this.isFighting,
            isBound: this.isBound,
            skills: this.skills,
            innateSkills: this.innateSkills,
            usedSkillPoints: this.usedSkillPoints,
            maxSkillPoints: this.maxSkillPoints,
            remainingSkillPoints: this.remainingSkillPoints,
            maxLearnableSkills: this.maxLearnableSkills,
            nextUnlockLevel: Math.ceil((this.level + 1) / 5) * 5
        };
    }

    // ====== 技能系统 ======

    /**
     * 获取最大技能点数（由天赋决定）
     */
    get maxSkillPoints() {
        return this.talentConfig.maxSkillPoints;
    }

    /**
     * 获取剩余可用技能点数
     */
    get remainingSkillPoints() {
        return this.maxSkillPoints - this.usedSkillPoints;
    }

    /**
     * 获取所有技能定义
     */
    static getSkillDefinitions() {
        return PET_SKILLS;
    }

    /**
     * 获取某档次下的技能定义
     */
    static getSkillsByTier(tier) {
        return PET_SKILLS.filter(s => s.tier === tier);
    }

    /**
     * 孵化时：随机获得1~2个先天技能（跟天赋无关）
     * @param {string} talent - 天赋等级
     * @param {string} [petType] - 宠物类型（QQ宠物提高疗伤权重）
     */
    static generateInnateSkills(talent, petType) {
        const skills = [];
        // 天赋越高获得高级技能概率越大
        const highWeight = talent === '无比聪慧' ? 40 : (talent === '上佳' ? 25 : (talent === '普通' ? 15 : 5));
        const mediumWeight = 30;
        const lowWeight = 50;
        const specialWeight = 5;
        
        for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
            const total = highWeight + mediumWeight + lowWeight + specialWeight;
            let roll = Math.random() * total;
            let tier;
            if (roll < highWeight) tier = 'high';
            else if (roll < highWeight + mediumWeight) tier = 'medium';
            else if (roll < highWeight + mediumWeight + lowWeight) tier = 'low';
            else tier = 'special';

            let pool = PET_SKILLS.filter(s => s.tier === tier && !skills.find(ss => ss.id === s.id));
            // QQ宠物：疗伤技能(id=7)权重翻倍
            if (petType && petType.startsWith('QQ') && tier === 'medium') {
                const healSkill = pool.find(s => s.id === 7);
                if (healSkill) {
                    pool = [...pool, { ...healSkill }]; // 重复一份以加倍概率
                }
            }
            if (pool.length > 0) {
                const picked = pool[Math.floor(Math.random() * pool.length)];
                skills.push({ id: picked.id, name: picked.name, type: picked.type, desc: picked.desc, tier: picked.tier, skillCost: picked.skillCost, innate: true });
            }
        }
        return skills;
    }

    /**
     * 获取可学习技能列表（有足够技能点且未学的技能）
     */
    getAvailableSkills() {
        const learnedIds = new Set([
            ...this.innateSkills.map(s => s.id),
            ...this.skills.map(s => s.id)
        ]);
        return PET_SKILLS.filter(s => !learnedIds.has(s.id) && s.skillCost <= this.remainingSkillPoints);
    }

    /**
     * 学习指定技能（消耗技能点+饱食/清洁）
     * @param {number} skillId
     * @returns {Object}
     */
    learnSkill(skillId) {
        const alreadyKnown = [
            ...this.innateSkills.map(s => s.id),
            ...this.skills.map(s => s.id)
        ];
        if (alreadyKnown.includes(skillId)) {
            return { success: false, message: '已学会该技能' };
        }

        const skillDef = PET_SKILLS.find(s => s.id === skillId);
        if (!skillDef) {
            return { success: false, message: '技能不存在' };
        }

        if (skillDef.skillCost > this.remainingSkillPoints) {
            return { success: false, message: `技能点数不足（需${skillDef.skillCost}，剩${this.remainingSkillPoints}）` };
        }

        // 学习消耗饱食度和清洁度（天赋越好消耗越低）
        const hungerCost = this.talentConfig.feedHunger * skillDef.skillCost;
        const cleanCost = this.talentConfig.feedClean * skillDef.skillCost;
        if (this.hunger < hungerCost || this.cleanliness < cleanCost) {
            return { success: false, message: `饱食度或清洁度不足（需饱食≥${hungerCost} 清洁≥${cleanCost}）` };
        }

        this.hunger = Math.max(0, this.hunger - hungerCost);
        this.cleanliness = Math.max(0, this.cleanliness - cleanCost);
        this.usedSkillPoints += skillDef.skillCost;

        this.skills.push({
            id: skillDef.id,
            name: skillDef.name,
            type: skillDef.type,
            desc: skillDef.desc,
            tier: skillDef.tier,
            skillCost: skillDef.skillCost,
            innate: false
        });

        return {
            success: true,
            message: `宠物学会了【${skillDef.name}】！（消耗${hungerCost}饱食、${cleanCost}清洁、${skillDef.skillCost}技能点）`
        };
    }

    /**
     * 战斗中执行技能效果
     * @returns {{skillName:string, effect:string, type:string, bonus:{attack:number,defense:number}}|null}
     */
    useBattleSkill(monster, battleLog) {
        // 合并所有技能（先天+后天）
        const allSkills = [...(this.innateSkills||[]), ...(this.skills||[])];
        if (allSkills.length === 0) return null;

        // 战斗中有技能激活概率（25%-45%，天赋越高概率越高）
        const talentBonus = { '极差':0, '较差':5, '普通':8, '上佳':12, '无比慧':15 };
        const activateChance = 0.25 + ((talentBonus[this.talent] || 8) / 100);
        if (Math.random() > activateChance) return null;

        // 随机选取一个技能
        const skill = allSkills[Math.floor(Math.random() * allSkills.length)];
        const result = { skillName: skill.name, skillId: skill.id, type: skill.type, bonus: {} };
        const dice = Math.random();

        switch (skill.type) {
            case 'attack': {
                // 嗜血(type=attack): 10%概率造成30%吸血
                if (skill.id === 4 && dice < 0.1) {
                    const heal = Math.floor(this.attack * 0.3);
                    result.bonus.healthToRestore = heal;
                    result.bonus.extraDamagePercent = 0; // no extra damage, just healing
                }
                break;
            }
            case 'buff': {
                // 提升属性的buff（利刃/御敌/轻身/振幅/怒吼）
                switch (skill.id) {
                    case 2: // 怒吼：全能+10%
                        result.bonus.attackBuff = Math.floor(this.attack * 0.1);
                        result.bonus.defenseBuff = Math.floor(this.defense * 0.1);
                        result.bonus.agilityBuff = Math.floor(this.agility * 0.1);
                        break;
                    case 9: // 利刃：+10%攻击
                        result.bonus.attackBuff = Math.floor(this.attack * 0.1);
                        break;
                    case 10: // 御敌：+10%防御
                        result.bonus.defenseBuff = Math.floor(this.defense * 0.1);
                        break;
                    case 11: // 随身：+20点敏捷
                        result.bonus.agilityBuff = 20;
                        break;
                    case 12: // 振幅：+20点士气（pet没有士气属性，影响玩家的士气）
                        result.bonus.moraleBuff = 20;
                        break;
                }
                break;
            }
            case 'debuff': {
                // 对怪物施加减效/debuff
                switch (skill.id) {
                    case 1: { // 威压：20%降低怪物全部属性10%
                        if (dice < 0.2) {
                            result.bonus.monsterDebuffAll =  0.1;
                            result.skillEffect = '降低了怪物的全部属性！';
                        }
                        break;
                    }
                    case 5: case 6: { // 卸叉/卸甲：对怪物没有切实装备系统，改为降低防御
                        if (dice < 0.2) {
                            result.bonus.monsterDefBreak = Math.floor(monster._defense * 0.3);
                            result.skillEffect = '撕裂了敌人的护甲！';
                        }
                        break;
                    }
                    case 8: // 封血：阻止怪物自动回血（本次战斗标记）
                        if (dice < 0.2) {
                            monster._blockAutoHeal = true;
                            result.bonus.monsterBlockHeal = true;
                            result.skillEffect = '封住了敌人的气血恢复！';
                        }
                        break;
                    case 14: case 15: case 16: { // 封毒/封虚/封麻
                        if (dice < 0.2) {
                            // 暂时移除对方的状态施加
                            const key = {14:'poison', 15:'weak', 16:'paralysis'}[skill.id];
                            if (key && monster.inflictStatusChances) {
                                monster.inflictStatusChances[key] = 0;
                                result.skillEffect = `封印了敌人的${skill.name.replace('封','')}能力！`;
                            }
                        }
                        break;
                    }
                }
                break;
            }
            case 'special': {
                // 繁殖不在战斗中、其他不适用于 PvE
                break;
            }
        }

        // 记录战斗日志
        if (result.skillEffect) {
            battleLog.push(`${this.name}使用了【${skill.name}】！${result.skillEffect}`);
        } else if (Object.keys(result.bonus).length > 0) {
            // 处理buff类的log
            const buffNames = [];
            if (result.bonus.attackBuffPercent) buffNames.push(`攻击+${result.bonus.attackBuffPercent}`);
            if (result.bonus.defenseBuffPercent) buffNames.push(`防御+${result.bonus.defenseBuffPercent}`);
            if (result.bonus.agilityBuff) buffNames.push(`敏捷+${result.bonus.agilityBuff}`);
            if (result.bonus.moraleBuff) buffNames.push(`士气+${result.bonus.moraleBuff}`);
            if (buffNames.length > 0) {
                battleLog.push(`${this.name} 使用了【${skill.name}】！${buffNames.join('，')}`);
            }
        }

        return result;
    }

    /**
     * 战斗胜利后治愈（疗伤技能）
     */
    applyPostBattleHeal(play) {
        const allSkills = [...(this.innateSkills||[]), ...(this.skills||[])];
        const hasHeal = allSkills.some(s => s.id === 7);
        if (hasHeal) {
            const healAmount = Math.floor(play.health * 0.1);
            play.currentHealth = Math.min(play.health, play.currentHealth + healAmount);
            return healAmount;
        }
        return 0;
    }

    /**
     * 获取所有宠物种类定义
     */
    static getPetTypes() {
        return PET_TYPES;
    }

    /**
     * 获取某种类下的所有宠物名
     */
    static getPetsByCategory(category) {
        return Object.entries(PET_TYPES)
            .filter(([_, v]) => v.category === category)
            .map(([name]) => name);
    }

    /**
     * 获取蛋种类对应的可孵出宠物列表
     */
    static getEggPetMap(eggType) {
        return EGG_PET_MAP[eggType] || EGG_PET_MAP['normal'];
    }

    /**
     * 获取宠物种类信息
     */
    static getPetTypeInfo(petType) {
        return PET_TYPES[petType] || { category: 'unknown', desc: '未知种类', atk: 1, def: 1, agi: 1 };
    }
}

export { PET_TYPES, EGG_PET_MAP, PET_SKILLS, TALENT_TIERS, QUALIFICATION_TIERS };