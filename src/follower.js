/**
 * 随从系统模块 (v2)
 * - 招募 / 战出 / 休息 / 遗弃
 * - 培养（属性增幅）
 * - 传承（经验转移保留装备）
 * - 随从装备（武器/防具/饰品）
 * - 随从精灵（技能系统）
 *
 * 需求: system_docs/follower_system.md + follower_sprite_system.md
 */
import * as formulas from './formulas.js';

// 随从基础配置
const FOLLOWER_CONFIG = [
    { id: 1,  name: '路飞',   title: '草帽海贼团船长',   desc: '梦想是找到传说中的 ONE PIECE，成为海贼王',
        baseStats: { attack: 100, defense: 80,  agility: 90 },
        legendSkill: { name: '橡胶巨人枪', type: 'attack', chance: 0.10, desc: '攻击时10%概率对敌人造成5倍伤害，但接下来停止攻击2回合' } },
    { id: 2,  name: '索隆',   title: '草帽海贼团副船长', desc: '三刀流剑客，意志坚强，刻苦锻炼',
        baseStats: { attack: 120, defense: 70,  agility: 85 },
        legendSkill: { name: '三刀流鬼斩', type: 'attack', chance: 0.10, desc: '攻击时10%概率连续攻击3次，但额外承受20%伤害' } },
    { id: 3,  name: '香吉士', title: '草帽海贼团厨师',   desc: '踢技以快准狠被海军称之为黑足',
        baseStats: { attack: 90,  defense: 60,  agility: 110 },
        legendSkill: { name: '恶魔风脚', type: 'attack', chance: 0.10, desc: '攻击时10%概率让对手全部防具耐久度降为0' } },
    { id: 4,  name: '布鲁克', title: '草帽海贼团音乐家', desc: '身体已变成骷髅，但爆炸头仍然存在',
        baseStats: { attack: 70,  defense: 50,  agility: 100 },
        legendSkill: { name: '镇魂之歌', type: 'attack', chance: 0.10, desc: '攻击时10%概率让对手全部首饰耐久度降为0' } },
    { id: 5,  name: '福兰奇', title: '草帽海贼团船匠',   desc: '身体藏着各种兵器，一直努力的想制造出梦想之船',
        baseStats: { attack: 85,  defense: 95,  agility: 75 },
        legendSkill: { name: '终极铁锤', type: 'attack', chance: 0.10, desc: '攻击时10%概率让对手武器耐久度降为0' } },
    { id: 6,  name: '罗宾',   title: '草帽海贼团考古学家',desc: '能让身体的任何部位像开花变化出镜像迷惑和攻击敌人',
        baseStats: { attack: 75,  defense: 65,  agility: 95 },
        legendSkill: { name: '十六轮花', type: 'defend', chance: 0.26, desc: '受攻击时26%概率幻化出16个分身迷惑敌人攻击' } },
    { id: 7,  name: '娜美',   title: '草帽海贼团航海士', desc: '能精确画出航海图的天才航海士',
        baseStats: { attack: 60,  defense: 55,  agility: 120 },
        legendSkill: { name: '雷霆万钧', type: 'counter', chance: 0.15, desc: '闪避成功后有15%概率对敌人造成3000点雷电伤害', damage: 3000 } },
    { id: 8,  name: '乔巴',   title: '草帽海贼团船医',   desc: '可用蓝波球进行八段身体变形',
        baseStats: { attack: 50,  defense: 70,  agility: 80 },
        legendSkill: { name: '野性强化', type: 'passive', desc: '进入战斗后5回合内攻击/防御/敏捷提升30%', bonusMul: 1.3 } },
    { id: 9,  name: '乌索普', title: '草帽海贼团狙击手', desc: '立志要成为一名勇敢的海上战士',
        baseStats: { attack: 80,  defense: 50,  agility: 100 },
        legendSkill: { name: '必杀火星鸟', type: 'attack', chance: 0.10, desc: '攻击时10%概率让对手额外受到5000点火焰伤害', extraDamage: 5000 } }
];

// 品质映射
const QUALITY_TEXT = { normal:'普通', excellent:'优秀', elite:'精锐', perfect:'完美', legend:'传说' };
const QUALITY_COLORS = { normal:'#999', excellent:'#5cb85c', elite:'#5bc0de', perfect:'#ff6600', legend:'#cc3300' };
const QUALITY_ORDER = ['normal','excellent','elite','perfect','legend'];
const QUALITY_TRAIN_MUL = { normal:1, excellent:1.3, elite:1.8, perfect:2.5, legend:4 };
const QUALITY_RECRUIT_WEIGHTS = { normal:50, excellent:28, elite:15, perfect:5, legend:2 };

// 随从精灵品质上限
const SPRITE_MAX_LVL = { normal:20, excellent:30, elite:40, perfect:50, legend:50 };
const SPRITE_MAX_SLOTS = { normal:4, excellent:5, elite:6, perfect:8, legend:8 };

// 精灵技能定义（21种）
const SPRITE_SKILLS = {
    'claw_strike':    { id:'claw_strike',    name:'利爪一击',   desc:'攻击+{val}',        effect:'attack',        base: 5 },
    'rock_armor':     { id:'rock_armor',     name:'磐石护甲',   desc:'防御+{val}',        effect:'defense',       base: 4 },
    'wind_step':      { id:'wind_step',      name:'疾风之步',   desc:'敏捷+{val}',        effect:'agility',       base: 4 },
    'blood_thirst':   { id:'blood_thirst',   name:'嗜血狂暴',   desc:'吸血+{val}%',       effect:'vampire',       base: 1 },
    'critical_eye':   { id:'critical_eye',   name:'致命洞察',   desc:'暴击率+{val}%',     effect:'critChance',    base: 1 },
    'iron_wall':      { id:'iron_wall',      name:'铁壁',       desc:'铁壁+{val}%',        effect:'ironWall',      base: 1 },
    'double_strike':  { id:'double_strike',  name:'二连击',     desc:'连击率+{val}%',     effect:'comboChance',    base: 1 },
    'venom_fang':     { id:'venom_fang',     name:'毒牙',        desc:'附着毒功成功率+{val}%', effect:'poisonChance', base: 1.5 },
    'flame_claw':     { id:'flame_claw',     name:'烈焰爪',      desc:'附加{val}点火焰伤害', effect:'fireDamage',   base: 2 },
    'shadow_step':    { id:'shadow_step',    name:'影步',        desc:'闪避率+{val}%',     effect:'dodgeChance',   base: 1.5 },
    'berserk':        { id:'berserk',        name:'狂战士',      desc:'攻击+{val}%',       effect:'atkPercent',    base: 1 },
    'fortify':        { id:'fortify',        name:'铁骨',        desc:'防御+{val}%',       effect:'defPercent',    base: 1 },
    'fleet_foot':     { id:'fleet_foot',     name:'轻盈',        desc:'敏捷+{val}%',       effect:'agiPercent',    base: 1 },
    'executioner':    { id:'executioner',    name:'处决者',      desc:'对30%HP以下敌人伤害+{val}%', effect:'executioner',    base: 3 },
    'last_stand':     { id:'last_stand',     name:'舍身一击',   desc:'HP低于30%时伤害+{val}%',   effect:'lastStand',  base: 3 },
    'quick_learn':    { id:'quick_learn',    name:'快速学习',   desc:'获得经验+{val}%',    effect:'expBonus',      base: 2 },
    'flame_aura':     { id:'flame_aura',     name:'火焰之环',     desc:'每回合对敌造成{val}灼烧伤害', effect:'burning',  base: 3 },
    'chill_blast':    { id:'chill_blast',    name:'冰冻冲击',   desc:'每回合{val}%概率冻住敌人1轮', effect:'freeze',   base: 2 },
    'regenerate':     { id:'regenerate',     name:'再生',        desc:'每回合回复{val}点体力', effect:'regen',        base: 2 },
    'storm_call':     { id:'storm_call',     name:'唤雷',        desc:'发动攻击时{val}%召唤雷电', effect:'stormCall', base: 2 },
    'mirror':         { id:'mirror',         name:'镜像',        desc:'反弹{val}%伤害',    effect:'reflection',    base: 1 }
};

// 获得技能所需经验（委托给 formulas.js 集中管理）
function spriteExpForLevel(lvl) { return formulas.followerSpriteExpForLevel(lvl); }

export default class Follower {
    constructor(userId, database, play, backpack) {
        this.userId = userId;
        this.db = database;
        this.play = play;
        this.backpack = backpack;
    }

    // ========== 基础数据 ==========

    static getFollowerList() {
        return FOLLOWER_CONFIG;
    }

    static getQualityText(q) { return QUALITY_TEXT[q] || q; }
    static getQualityColor(q) { return QUALITY_COLORS[q] || '#999'; }
    static getFollowerById(id) { return FOLLOWER_CONFIG.find(f => f.id === id); }

    // ========== 招募 ==========

    /**
     * 获取可招募池（2小时自动刷新，可使用刷新卡立即刷新）
     */
    getRecruitPool() {
        const all = FOLLOWER_CONFIG;
        // 检查是否需要自动刷新（2小时间隔）
        const lastRefresh = this._getLastRefreshTime();
        const now = Date.now();
        const REFRESH_INTERVAL = 2 * 60 * 60 * 1000; // 2小时
        
        if (lastRefresh && (now - lastRefresh) < REFRESH_INTERVAL) {
            // 未过期，返回缓存的池
            const cached = this._getCachedPool();
            if (cached && cached.length > 0) return cached;
        }
        
        // 需要刷新或无缓存
        return this._generateNewPool();
    }

    /**
     * 手动刷新招募池（消耗刷新卡或铜贝）
     */
    refreshPool() {
        // 优先使用刷新卡
        const refreshCard = this.backpack.items.find(i => i.name === '随从刷新卡' && i.num > 0);
        if (refreshCard) {
            this.backpack.removeItem(refreshCard.id);
        } else if (this.play && this.play.copper >= 5000) {
            this.play.copper -= 5000;
        } else {
            return { success: false, tip: '需要随从刷新卡或5000铜贝' };
        }
        
        const newPool = this._generateNewPool();
        return { success: true, tip: '招募池已刷新', pool: newPool };
    }

    /**
     * 生成新的招募池
     */
    _generateNewPool() {
        const all = FOLLOWER_CONFIG;
        const pool = [];
        const shuffled = [...all].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(3, shuffled.length); i++) {
            const f = { ...shuffled[i] };
            f.quality = this._randomQuality();
            pool.push(f);
        }
        // 保存刷新时间
        this._setLastRefreshTime(Date.now());
        this._setCachedPool(pool);
        return pool;
    }

    _getLastRefreshTime() {
        if (!this.db) return null;
        try {
            const row = this.db.executeSQL(
                "SELECT data FROM user_settings WHERE user_id = ? AND key_name = 'follower_refresh_time'",
                [this.userId], 'get'
            );
            return row ? parseInt(row.data) : null;
        } catch (e) { return null; }
    }

    _setLastRefreshTime(time) {
        if (!this.db) return;
        try {
            this.db.executeSQL(
                "INSERT OR REPLACE INTO user_settings (user_id, key_name, data) VALUES (?, 'follower_refresh_time', ?)",
                [this.userId, String(time)], 'run'
            );
        } catch (e) { /* 静默 */ }
    }

    _getCachedPool() {
        if (!this.db) return null;
        try {
            const row = this.db.executeSQL(
                "SELECT data FROM user_settings WHERE user_id = ? AND key_name = 'follower_pool'",
                [this.userId], 'get'
            );
            return row ? JSON.parse(row.data) : null;
        } catch (e) { return null; }
    }

    _setCachedPool(pool) {
        if (!this.db) return;
        try {
            this.db.executeSQL(
                "INSERT OR REPLACE INTO user_settings (user_id, key_name, data) VALUES (?, 'follower_pool', ?)",
                [this.userId, JSON.stringify(pool)], 'run'
            );
        } catch (e) { /* 静默 */ }
    }

    _randomQuality() {
        const total = Object.values(QUALITY_RECRUIT_WEIGHTS).reduce((a, w) => a + w, 0);
        let roll = Math.random() * total;
        for (const [q, w] of Object.entries(QUALITY_RECRUIT_WEIGHTS)) {
            roll -= w;
            if (roll <= 0) return q;
        }
        return 'normal';
    }

    recruit(followerId, poolQuality) {
        const config = FOLLOWER_CONFIG.find(f => f.id === followerId);
        if (!config) return { success: false, tip: '随从不存在' };

        const current = this.getFollowers();
        if (current.length >= 3) return { success: false, tip: '随从已达上限（3只）' };
        if (current.some(f => f.follower_id === followerId)) return { success: false, tip: '已招募该随从' };

        const recruitId = Date.now().toString(36) + Math.random().toString(36).substr(2, 7);
        // 使用招募池中展示的品质；若无则回退到随机
        const validQualities = QUALITY_ORDER;
        const quality = (poolQuality && validQualities.includes(poolQuality)) ? poolQuality : this._randomQuality();
        const stats     = { ...config.baseStats };
        // 品质基础加成
        const qIdx = QUALITY_ORDER.indexOf(quality) + 1;
        stats.attack  += 10 * qIdx;
        stats.defense += 8 * qIdx;
        stats.agility += 6 * qIdx;

        if (this.db) {
            this.db.executeSQL(
                `INSERT INTO followers (user_id, follower_id, recruit_id, quality, level, exp, state, stats, skill_level, created_at)
                 VALUES (?, ?, ?, ?, 1, 0, 'rest', ?, 0, CURRENT_TIMESTAMP)`,
                [this.userId, followerId, recruitId, quality, JSON.stringify(stats)], 'run'
            );
        }
        
        // 传说品质自动附带传说天赋标记
        const legendSkill = quality === 'legend' ? { legendSkill: true, name: config.name } : null;
        
        return { success: true, tip: `成功招募${config.name}（${QUALITY_TEXT[quality]}）！${legendSkill ? '✨传说品质自带传说天赋！' : ''}` };
    }

    // ========== 状态操作 ==========

    setState(recruitId, state) {
        if (state === 'fighting') {
            // 先让所有非遗弃的随从 rest（不能影响已遗弃的）
            this.db?.executeSQL(
                'UPDATE followers SET state = ? WHERE user_id = ? AND recruit_id != ? AND state != ?',
                ['rest', this.userId, recruitId, 'abandoned'], 'run'
            );
        }
        if (this.db) {
            this.db.executeSQL(
                'UPDATE followers SET state = ? WHERE recruit_id = ? AND user_id = ?',
                [state, recruitId, this.userId], 'run'
            );
        }
        const labels = { fighting: '出战', rest: '休息' };
        return { success: true, tip: `随从${labels[state] || state}` };
    }

    abandon(recruitId) {
        const followers = this.getFollowers();
        const follower = followers.find(f => f.recruit_id === recruitId);
        
        // 计算随魂获取量（根据品质和等级）
        let soulGained = 0;
        if (follower) {
            const qualityMultiplier = { normal: 1, excellent: 2, elite: 4, perfect: 8, legend: 16 };
            const qMult = qualityMultiplier[follower.quality] || 1;
            soulGained = Math.floor((follower.level || 1) * qMult * 10);
            
            // 保存随魂
            if (this.db) {
                const currentSoul = this._getSoulPoints();
                this._setSoulPoints(currentSoul + soulGained);
            }
        }
        
        // 卸下装备后遗弃
        ['weapon','armor','accessory'].forEach(s => this.unequipItem(recruitId, s));
        if (this.db) {
            this.db.executeSQL(
                'UPDATE followers SET state = ? WHERE recruit_id = ? AND user_id = ?',
                ['abandoned', recruitId, this.userId], 'run'
            );
        }
        
        const tip = soulGained > 0 
            ? `随从已遗弃，获得 ${soulGained} 随魂` 
            : '随从已遗弃';
        return { success: true, tip, soulGained };
    }

    /**
     * 获取当前随魂点数
     */
    _getSoulPoints() {
        if (!this.db) return 0;
        try {
            const row = this.db.executeSQL(
                "SELECT data FROM user_settings WHERE user_id = ? AND key_name = 'follower_soul'",
                [this.userId], 'get'
            );
            return row ? parseInt(row.data) || 0 : 0;
        } catch (e) { return 0; }
    }

    _setSoulPoints(value) {
        if (!this.db) return;
        try {
            this.db.executeSQL(
                "INSERT OR REPLACE INTO user_settings (user_id, key_name, data) VALUES (?, 'follower_soul', ?)",
                [this.userId, String(value)], 'run'
            );
        } catch (e) { /* 静默 */ }
    }

    /**
     * 获取随魂信息（用于UI显示）
     */
    getSoulInfo() {
        return {
            soulPoints: this._getSoulPoints(),
            legendExchangeCost: 100
        };
    }

    /**
     * 用随魂兑换传说随从
     */
    exchangeLegend() {
        const cost = 100;
        const current = this.getFollowers();
        if (current.length >= 3) return { success: false, tip: '随从已达上限（3只）' };
        
        const soulPoints = this._getSoulPoints();
        if (soulPoints < cost) return { success: false, tip: `随魂不足（需要${cost}，当前${soulPoints}）` };
        
        // 随机选一个随从配置
        const config = FOLLOWER_CONFIG[Math.floor(Math.random() * FOLLOWER_CONFIG.length)];
        const recruitId = Date.now().toString(36) + Math.random().toString(36).substr(2, 7);
        const quality = 'legend';
        const stats = { ...config.baseStats };
        const qIdx = QUALITY_ORDER.indexOf(quality) + 1;
        stats.attack += 10 * qIdx;
        stats.defense += 8 * qIdx;
        stats.agility += 6 * qIdx;
        
        if (this.db) {
            this.db.executeSQL(
                `INSERT INTO followers (user_id, follower_id, recruit_id, quality, level, exp, state, stats, skill_level, created_at)
                 VALUES (?, ?, ?, ?, 1, 0, 'rest', ?, 0, CURRENT_TIMESTAMP)`,
                [this.userId, config.id, recruitId, quality, JSON.stringify(stats)], 'run'
            );
            this._setSoulPoints(soulPoints - cost);
        }
        
        return { success: true, tip: `🌟 消耗${cost}随魂，兑换了传说随从：${config.name}！` };
    }

    // ========== 经验/升级 ==========

    _expForLevel(level) {
        // 委托给 formulas.js 集中管理（公式：calcMonsterExp(level) * followerBattleRatio）
        return formulas.followerExpToNext(level);
    }

    addExp(recruitId, amount) {
        const f = this.getFollowers().find(x => x.recruit_id === recruitId);
        if (!f) return { gained: 0, didLevel: false };
        let remainingExp = f.exp + amount;
        let lv = f.level;
        // 逐级扣除升级所需经验
        while (lv < 100) {
            const cost = this._expForLevel(lv);
            if (remainingExp >= cost) {
                remainingExp -= cost;
                lv++;
            } else {
                break;
            }
        }
        const leveled = lv > f.level;
        // 升级的同时提升精灵等级（同等级）
        if (leveled) this._levelUpSprite(recruitId, f.quality); // 升级时提升精灵等级
        this.db?.executeSQL('UPDATE followers SET exp = ?, level = ? WHERE recruit_id = ?',
            [remainingExp, lv, recruitId], 'run');
        return { gained: amount, leveled, newLevel: lv, oldLevel: f.level };
    }

    // ========== 培养（train） ==========

    train(recruitId) {
        const f = this.getFollowers().find(x => x.recruit_id === recruitId);
        if (!f) return { success: false, tip: '随从不存在' };

        // 培养次数限制
        const maxTrains = { normal:50, excellent:100, elite:150, perfect:200, legend:300 }[f.quality] || 50;
        const trainCount = f.trainCount || 0;
        if (trainCount >= maxTrains) {
            return { success: false, tip: `该随从已达到培养上限（${maxTrains}次），无法继续培养` };
        }

        const mul = QUALITY_TRAIN_MUL[f.quality] || 1;
        const gains = {
            attack: Math.floor((Math.random() * 15 + 3) * mul),
            defense: Math.floor((Math.random() * 12 + 2) * mul),
            agility: Math.floor((Math.random() * 10 + 2) * mul)
        };

        return { success: true, tip: `攻+${gains.attack} 防+${gains.defense} 敏+${gains.agility}`, statGains: gains, trainCount, maxTrains };
    }

    confirmTrain(recruitId, statGains) {
        const f = this.getFollowers().find(x => x.recruit_id === recruitId);
        if (!f) return { success: false, tip: '随从不存在' };

        let stats = { ...(f.stats || f.baseStats) };
        stats.attack = (stats.attack || 0) + (statGains.attack || 0);
        stats.defense = (stats.defense || 0) + (statGains.defense || 0);
        stats.agility = (stats.agility || 0) + (statGains.agility || 0);

        const newTrainCount = (f.trainCount || 0) + 1;
        this.db.executeSQL('UPDATE followers SET stats = ?, train_count = ? WHERE recruit_id = ?', [JSON.stringify(stats), newTrainCount, recruitId], 'run');
        return { success: true, tip: '培养成功！属性已保存' };
    }

    // ========== 传承 ==========

    inherit(fromId, toId) {
        const followers = this.getFollowers();
        const src  = followers.find(f => f.recruit_id === fromId);
        const dest = followers.find(f => f.recruit_id === toId);
        if (!src || !dest) return { success: false, tip: '随从不存在' };
        if (fromId === toId) return { success: false, tip: '不能传承给自己' };
        if (dest.level > src.level + 20) return { success: false, tip: '目标随从等级不能超过源随从等级20级' };

        // 传承之书检查
        const book = this.backpack?.items?.find(i => i.name === '传承之书' && i.num > 0);
        if (!book) return { success: false, tip: '需要消耗传承之书 x1，背包中没有' };

        const transferExp = Math.floor(src.exp * 0.9);
        this.backpack.removeItem(book.id);

        // 目标获得经验
        const destResult = this.addExp(toId, transferExp);
        // 源随从废弃（装备已由 abandon 处理）
        this.abandon(fromId);

        return { success: true, tip: '传承成功！转移了' + transferExp + '点经验' + (destResult?.leveled ? '（升到' + destResult.newLevel + '级）' : '') };
    }

    // ========== 装备 ==========

    getEquipment(recruitId) {
        if (!this.db) return { weapon: null, armor: null, accessory: null };
        const rows = this.db.executeSQL(
            'SELECT * FROM follower_equipment WHERE recruit_id = ?',
            [recruitId], 'all'
        ) || [];
        const ret = { weapon: null, armor: null, accessory: null };
        rows.forEach(r => {
            ret[r.slot] = {
                item_id: r.item_id,
                item_name: r.item_name,
                item_type: r.item_type,
                info: JSON.parse(r.item_info || '{}')
            };
        });
        return ret;
    }

    getEquipmentStats(recruitId) {
        const eq = this.getEquipment(recruitId);
        let bonus = { attack: 0, defense: 0, agility: 0, health: 0 };
        Object.values(eq).forEach(item => {
            if (item && item.info) {
                bonus.attack += item.info.attack || 0;
                bonus.defense += item.info.defense || 0;
                bonus.agility += item.info.agility || 0;
                bonus.health += item.info.health || 0;
            }
        });
        return bonus;
    }

    equipItem(recruitId, itemId, slot) {
        if (!['weapon','armor','accessory'].includes(slot)) return { success: false, tip: '槽位无效' };
        const item = this.backpack.items.find(i => i.id === itemId && i.status === 1);
        if (!item) return { success: false, tip: '背包中无此物品' };

        // 卸下旧
        this.unequipItem(recruitId, slot);

        this.backpack.removeItem(item.id);
        this.db.executeSQL(
            `INSERT OR REPLACE INTO follower_equipment (user_id, recruit_id, slot, item_id, item_name, item_type, item_info, equipped_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [this.userId, recruitId, slot, item.id, item.name, item.type, JSON.stringify(item.info || {})], 'run'
        );
        return { success: true, tip: `装备了${item.name}` };
    }

    unequipItem(recruitId, slot) {
        const eq = this.getEquipment(recruitId);
        const item = eq[slot];
        if (!item) return { success: false, tip: '槽位为空' };

        this.backpack.addItem({ name: item.item_name, type: item.item_type, num: 1, info: item.info });
        this.db.executeSQL('DELETE FROM follower_equipment WHERE recruit_id = ? AND slot = ?', [recruitId, slot], 'run');
        return { success: true, tip: `卸下${item.item_name}` };
    }

    // ========== 数据查询 ==========

    getFollowers() {
        if (!this.db) return [];
        const sql = "SELECT * FROM followers WHERE user_id = ? AND state != 'abandoned'";
        const results = this.db.executeSQL(sql, [this.userId], 'all') || [];
        const allConfigs = FOLLOWER_CONFIG;

        return results.map(row => {
            const config = allConfigs.find(c => c.id === row.follower_id) || {};
            const stats = JSON.parse(typeof row.stats === 'string' ? row.stats : '{}');
            return {
                id: row.id,
                recruit_id: row.recruit_id,
                follower_id: row.follower_id,
                quality: row.quality,
                level: row.level,
                exp: row.exp,
                state: row.state,
                skill_level: row.skill_level || 0,
                created_at: row.created_at,
                name: config.name || ('随从#' + row.follower_id),
                title: config.title || '',
                desc: config.desc || '',
                baseStats: config.baseStats || {},
                legendSkill: config.legendSkill || null,
                stats: stats,
                trainCount: row.train_count || 0
            };
        });
    }

    getFightingFollower() {
        const followers = this.getFollowers();
        return followers.find(f => f.state === 'fighting') || null;
    }

    getStatus() {
        const followers = this.getFollowers();
        const fighting = this.getFightingFollower();

        // enrich each with equipment info
        const followersWithEquip = followers.map(f => ({
            ...f,
            equipment: this.getEquipment(f.recruit_id),
            equipmentStats: this.getEquipmentStats(f.recruit_id)
        }));

        const fightingWithEquip = fighting ? {
            ...fighting,
            equipment: this.getEquipment(fighting.recruit_id),
            equipStats: this.getEquipmentStats(fighting.recruit_id)
        } : null;

        return {
            followers: followersWithEquip,
            fightingFollower: fightingWithEquip,
            recruitPool: this.getRecruitPool(),
            followerCount: followers.length,
            soulInfo: this.getSoulInfo(),
            lastRefreshTime: this._getLastRefreshTime()
        };
    }

    // ========== 随从精灵系统 ==========

    getSprite(recruitId) {
        if (!this.db) return { level: 1, exp: 0, skills: [] };
        const rows = this.db.executeSQL(
            'SELECT * FROM follower_sprite WHERE recruit_id = ?', [recruitId], 'all'
        ) || [];
        if (rows.length === 0) return { level: 1, exp: 0, skills: [] };
        return {
            level: rows[0].sprite_level || 1,
            exp: rows[0].sprite_exp || 0,
            skills: JSON.parse(rows[0].skills || '[]')
        };
    }

    _saveSprite(recruitId, spriteLevel, spriteExp, skills) {
        if (!this.db) return;
        this.db.executeSQL(
            "INSERT OR REPLACE INTO follower_sprite (recruit_id, sprite_level, sprite_exp, skills) VALUES (?, ?, ?, ?)",
            [recruitId, spriteLevel, spriteExp, JSON.stringify(skills)], 'run'
        );
    }

    // 获取技能值：基础值 × 等级
    _spriteSkillValue(skillDef, level) {
        return Math.floor(skillDef.base * level);
    }

    // 精灵升级时随机学会技能（自动开1个技能槽）
    _spriteGainRandomSkill(recruitId, quality, skills) {
        const maxSlots = SPRITE_MAX_SLOTS[quality] || 4;
        const skillKeys = Object.keys(SPRITE_SKILLS);
        const knownIds = skills.map(s => s.id);

        // 过滤未学的技能
        const available = skillKeys.filter(k => !knownIds.includes(k));
        if (available.length === 0) return skills;

        const newSkillId = available[Math.floor(Math.random() * available.length)];
        const newLvl = Math.floor(Math.random() * 3) + 1; // 1-3级
        skills.push({ skillId: newSkillId, level: newLvl });
        return skills;
    }

    _levelUpSprite(recruitId, quality) {
        const sp = this.getSprite(recruitId);
        const maxLvl = SPRITE_MAX_LVL[quality] || 20;
        if (sp.level >= maxLvl) return sp;

        const newLvl = sp.level + 1;
        let skills = [...sp.skills];
        if (skills.length < (SPRITE_MAX_SLOTS[quality] || 4)) {
            skills = this._spriteGainRandomSkill(recruitId, quality, skills);
        }
        this._saveSprite(recruitId, newLvl, sp.exp, skills);
        return { level: newLvl, exp: sp.exp, skills };
    }

    // 使用启迪之书开启技能槽
    openSkillSlot(recruitId) {
        const follower = this.getFollowers().find(f => f.recruit_id === recruitId);
        if (!follower) return { success: false, tip: '随从不存在' };

        const sp = this.getSprite(recruitId);
        const maxSlots = SPRITE_MAX_SLOTS[follower.quality] || 4;
        if (sp.skills.length >= maxSlots) return { success: false, tip: '技能槽已达上限' };

        const book = this.backpack?.items?.find(i => i.name === '启迪之书' && i.num > 0);
        if (!book) return { success: false, tip: '缺少启迪之书 x1' };

        this.backpack.removeItem(book.id);

        // 随机获得1个新技能 1-10级
        const skillKeys = Object.keys(SPRITE_SKILLS);
        const knownIds = sp.skills.map(s => s.skillId);
        const available = skillKeys.filter(k => !knownIds.includes(k));
        if (available.length === 0) return { success: false, tip: '已学完所有技能' };

        const newSkillId = available[Math.floor(Math.random() * available.length)];
        const newLvl = Math.floor(Math.random() * 10) + 1;
        const newSkills = [...sp.skills, { skillId: newSkillId, level: newLvl }];
        this._saveSprite(recruitId, sp.level, sp.exp, newSkills);

        const skillDef = SPRITE_SKILLS[newSkillId];
        return { success: true, tip: '学会了' + skillDef.name + ' Lv.' + newLvl };
    }

    // 领悟技能（消耗启迪之书获得随机技能）
    enlighten(recruitId) {
        return this.openSkillSlot(recruitId);
    }

    // 学习卷轴提升技能
    learnFromScroll(recruitId, skillId, scrollLevel) {
        const sp = this.getSprite(recruitId);
        const existing = sp.skills.find(s => s.skillId === skillId);
        if (!existing) return { success: false, tip: '必须已有该技能才能用卷轴提升' };
        if (scrollLevel <= existing.level) return { success: false, tip: '卷轴技能等级需要大于当前技能等级' };
        if (scrollLevel > 10) return { success: false, tip: '技能最高10级' };

        const skills = sp.skills.map(s => s.skillId === skillId ? { ...s, level: scrollLevel } : s);
        this._saveSprite(recruitId, sp.level, sp.exp, skills);

        const skillDef = SPRITE_SKILLS[skillId];
        return { success: true, tip: skillDef.name + ' 提升至 Lv.' + scrollLevel };
    }
}