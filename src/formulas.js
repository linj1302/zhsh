/**
 * formulas.js —— 数值公式集中化地基（纯函数模块）
 *
 * 项目铁律：
 * - 不使用 Map / Set（一律普通对象/数组）
 * - 首版系数与历史硬编码逐字等价（见 config/balance.json），保证同输入同输出
 * - 所有系数集中在 config/balance.json，由 config/index.js 启动时自动加载导出为 balance
 */
import { balance as balanceConfig, exp as expConfig, monsterRewards } from '../config/index.js';

// 系数表：统一从这里读取，禁止在公式函数里再写魔法数字
export const balance = balanceConfig;

/* ============================== 角色经验 ============================== */

// 启动时预计算的公式查找表（仅作为 config/exp.json 缺失时的兜底）
let expTable = null;

/**
 * 参数化角色经验公式（兜底用）。
 * 与 config/exp.json 同时存在时，以 exp.json 为准（为后续数值重设计留口子）。
 */
export function expByFormula(level) {
    const { fallbackBase, fallbackExponent } = balance.playerExp;
    return Math.floor(fallbackBase * Math.pow(Math.max(1, level), fallbackExponent));
}

/** 预计算 1..maxLevel 的公式查找表（普通对象，不用 Map） */
export function buildExpTable(maxLevel = balance.playerExp.maxLevel) {
    const table = {};
    for (let level = 1; level <= maxLevel; level++) {
        table[level] = expByFormula(level);
    }
    expTable = table;
    return table;
}

// 模块加载时即预计算（启动时预计算查找表的能力）
buildExpTable();

/**
 * 角色升到下一级所需经验。
 * 优先读 config/exp.json（与原 play.getExpToNextLevel 行为一致），
 * 缺失时用公式表兜底，公式表也缺失时现算参数化公式。
 */
export function expToNext(level) {
    if (expConfig) {
        const fromConfig = expConfig[level];
        if (fromConfig !== undefined && fromConfig !== null && fromConfig !== '') {
            return Number(fromConfig);
        }
    }
    if (expTable && expTable[level] !== undefined) {
        return expTable[level];
    }
    return expByFormula(level);
}

/* ============================== 怪物经验/铜贝 ============================== */

/**
 * 固定化数值表查值：等级钳制到 config/monsterRewards.json 范围内。
 * 该表由 scripts/generate-monster-rewards.js 初始标定，之后以表为准可直接手改，
 * 与玩家经验曲线解耦（调 exp.json 不会隐式改变怪物奖励）。
 * 表缺失/条目异常时按 balance 公式兜底，保证战斗奖励永不为 NaN。
 */
function lookupMonsterReward(level, key, formulaFallback) {
    const lv = Math.max(1, Math.floor(level) || 1);
    const table = monsterRewards || {};
    const maxLv = Object.keys(table).reduce((m, k) => (+k > m ? +k : m), 0);
    const clampedLv = maxLv > 0 ? Math.min(lv, maxLv) : lv;
    const entry = table[clampedLv] && Number(table[clampedLv][key]);
    return Number.isFinite(entry) && entry >= 0 ? entry : formulaFallback(clampedLv);
}

/**
 * 怪物击杀经验：固定表 monsterRewards[level].exp（初始标定为玩家同级升级需求 ÷ killsPerLevel）。
 * 注意：petExpToNext/followerExpToNext 以本函数为单位。
 * @param {number} level 怪物等级
 * @param {number} [type] 怪物类型（5=普通, 40=船副本, 50=副本, 45=船boss, 6=任务boss, 55=副本boss）
 * @returns {number} 击杀获得的经验值
 */
export function calcMonsterExp(level, type) {
    const cfg = balance.monsterExp;
    let exp = lookupMonsterReward(level, 'exp',
        (lv) => Math.max(1, Math.floor(expToNext(lv) / (cfg.killsPerLevel || 6))));
    // 特殊怪物类型倍率
    if (type === 45 || type === 6 || type === 55) {
        exp = Math.floor(exp * cfg.bossMultiplier);
    } else if (type === 40 || type === 50) {
        exp = Math.floor(exp * cfg.dungeonMultiplier);
    }
    return exp;
}

/**
 * 怪物击杀铜贝：固定表 monsterRewards[level].copper（初始标定 base * level^exponent）。
 * @param {number} level 怪物等级
 * @param {number} [type] 怪物类型
 * @returns {number} 击杀获得的铜贝数
 */
export function calcMonsterCopper(level, type) {
    const cfg = balance.monsterCopper;
    let copper = lookupMonsterReward(level, 'copper',
        (lv) => Math.floor(cfg.base * Math.pow(lv, cfg.exponent)));
    if (type && (type === 45 || type === 6 || type === 55)) {
        copper = Math.floor(copper * cfg.bossMultiplier);
    }
    return copper;
}

/* ============================== 宠物经验 ============================== */

/**
 * 宠物当前等级升到下一级所需经验。
 * petExpToNext = calcMonsterExp(level) * petBattleRatio（同级击杀升级所需次数 = petBattleRatio / battleGainRatio）
 */
export function petExpToNext(level) {
    const ratio = balance.petExp.petBattleRatio || 10;
    return calcMonsterExp(level) * ratio;
}

/* ============================== 随从经验 ============================== */

/**
 * 随从当前等级升到下一级所需经验。
 * followerExpToNext = calcMonsterExp(level) * followerBattleRatio（同级击杀升级所需次数 = followerBattleRatio / battleGainRatio）
 */
export function followerExpToNext(level) {
    const ratio = (balance.followerExp && balance.followerExp.followerBattleRatio) || 10;
    return calcMonsterExp(level) * ratio;
}

/**
 * 随从精灵升级所需经验。
 * 从 follower.js 移入，公式：100 * 1.3^(level-1)
 */
export function followerSpriteExpForLevel(level) {
    return Math.floor(100 * Math.pow(1.3, level - 1));
}

/* ============================== 伤害公式 ============================== */

/** 防御减伤率：原实现 Math.min(0.99, defense / (defense + 300)) */
export function defenseRate(defense) {
    return Math.min(
        balance.damage.maxDefenseRate,
        defense / (defense + balance.damage.defenseConstant)
    );
}

/**
 * 基础伤害：原实现（monster.js calculateDamage）
 * attack * (1 - Math.min(0.99, defense / (defense + 300)))
 */
export function calcDamage(attack, defenderDefense) {
    return attack * (1 - defenseRate(defenderDefense));
}

/* ============================== 怪物成长 ============================== */

/**
 * 怪物属性成长：原实现（monster.js _calculateStat）
 * Math.floor(base + (level - 1) * increment * (0.9 + Math.random() * 0.2))
 * 抖动幅度参数化：jitter=0.1 时随机因子为 [1-0.1, 1+0.1]，与原实现逐字等价。
 * @param {Function} rand 随机源，默认 Math.random；测试时可注入固定值
 */
export function monsterStat(base, increment, level, jitter = balance.monster.statJitter, rand = Math.random) {
    return Math.floor(base + (level - 1) * increment * ((1 - jitter) + rand() * (2 * jitter)));
}

/* ============================== 角色升级成长 ============================== */

/**
 * 角色升级属性提升：原实现（play.js levelUp，level 为升级后的新等级）
 * health   += 25 + floor(level / 3)
 * attack   += 5  + floor(level / 7)
 * maxAttack+= 6  + floor(level / 7)
 * defense  += 3  + floor(level / 10)
 * agility  += 2
 * morale   += 5
 */
export function levelUpGrowth(level) {
    const c = balance.playerLevelUp;
    return {
        health: c.healthBase + Math.floor(level / c.healthLevelDivisor),
        attack: c.attackBase + Math.floor(level / c.attackLevelDivisor),
        maxAttack: c.maxAttackBase + Math.floor(level / c.maxAttackLevelDivisor),
        defense: c.defenseBase + Math.floor(level / c.defenseLevelDivisor),
        agility: c.agilityFixed,
        morale: c.moraleFixed
    };
}

/* ============================== 装备强化加成 ============================== */

/**
 * 装备强化等级换算属性加成（新规则）：
 * - 每级+体力（sl * 2）
 * - 3级开始增加攻防敏
 * - 10级后体力 += equipLevel * 10，攻防敏 +20%
 * @param {number} strengthenLevel 强化等级
 * @param {number} [equipLevel] 装备等级（10级后加成需要）
 */
export function strengthenBonus(strengthenLevel, equipLevel) {
    const s = balance.strengthen;
    const slv = strengthenLevel;
    const eLv = equipLevel || 1;

    let attack = 0, maxAttack = 0, defense = 0, agility = 0, morale = 0, health = 0;

    // 每级+体力
    health += slv * s.healthPerLevel;

    // 3级开始增加攻防敏
    if (slv >= 3) {
        const bonusLevels = slv - 2;
        attack += bonusLevels * s.attackPerLevel;
        maxAttack += bonusLevels * s.maxAttackPerLevel;
        defense += bonusLevels * s.defensePerLevel;
        agility += Math.floor(bonusLevels / s.agilityDivisor);
        morale += Math.floor(bonusLevels / s.moraleDivisor);
    }

    // 10级后额外加成
    if (slv >= 10) {
        health += eLv * 10;
        attack = Math.floor(attack * 1.2);
        maxAttack = Math.floor(maxAttack * 1.2);
        defense = Math.floor(defense * 1.2);
        agility = Math.floor(agility * 1.2);
    }

    return { attack, maxAttack, defense, agility, morale, health };
}
