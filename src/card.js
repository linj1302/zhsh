/**
 * 卡片系统模块
 * 实现卡片收集、附魔、升级、效果组合等功能
 * 需求: system_docs/card_system.md
 */

import Goods from './goods.js';

// 品质文本
const QUALITY_TEXT = { normal:'普通', exquisite:'精致', precious:'珍贵', rare:'稀有', legend:'传说' };
const QUALITY_ORDER = ['normal','exquisite','precious','rare','legend'];
// 品质乘数（每级比普通高多少倍）
const QUALITY_MULTIPLIER = { normal:1, exquisite:3, precious:6, rare:12, legend:24 };
// 星级系数：1星=1.0, 2星=1.1, ... 10星=1.9（防止数值爆炸）
const STAR_LEVEL_COEFF = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9];
const QUALITY_COLORS = { normal:'#999', exquisite:'#5cb85c', precious:'#5bc0de', rare:'#ff6600', legend:'#cc3300' };

// 附魔槽位映射（游戏中装备类型）
const ENCHANT_SLOTS = ['手持','头','躯体','脚','腰部','配饰'];

// 卡片计算
function makeCardConfig(props) {
    return { id: props.id, name: props.name, attachableParts: props.attachableParts,
        baseEffects: props.baseEffects,
        dropInfo: props.dropInfo || '',
        qualities: ['normal','exquisite','precious','rare','legend'].map(q => {
            const mul = QUALITY_MULTIPLIER[q] || 1;
            let effs = {};
            Object.keys(props.baseEffects).forEach(k => {
                effs[k] = Math.floor(props.baseEffects[k] * mul);
            });
            return { quality: q, name: QUALITY_TEXT[q]+'·'+props.name, effects: effs };
        })
    };
}

// 卡片配置（对齐 system_docs/card_system.md）
const CARD_CONFIG = [
    { id: 1, name: '莱温特卡片', attachableParts: ['腰部','头','躯','脚'],
        baseEffects: { healthPercent: 0.5 }, dropInfo: '210满级-丧尸谷副本最后BOSS' },
    { id: 2, name: '莫的奥拉卡片', attachableParts: ['手持'],
        baseEffects: { attackPercent: 1.0 }, dropInfo: '210满级-黑暗深渊副本最后BOSS' },
    { id: 3, name: '巴德拉卡片', attachableParts: ['手持'],
        baseEffects: { attackPercent: 0.5 }, dropInfo: '玛雅潘谷地北南-大地祭坛（需要大地水晶）' },
    { id: 4, name: '狼人卡片', attachableParts: ['手持','配饰'],
        baseEffects: { attack: 11 }, dropInfo:'爱丁堡-东门直东-狼牙堡' },
    { id: 5, name: '飞翼兽卡片', attachableParts: ['手持','配饰'],
        baseEffects: { health: 30, attack: 3 }, dropInfo:'长安三清观东东到封印之地-北（影山前妄荒绝地）' },
    { id: 6, name: '贪婪的哥布林卡片', attachableParts: ['配饰'],
        baseEffects: { defensePercent: 0.5 }, dropInfo:'荷姆丝北门直北-牛头寨十二层' },
    { id: 7, name: '灰太狼卡片', attachableParts: ['腰部','头','躯','脚'],
        baseEffects: { defense: 11 }, dropInfo:'伊斯坦堡-西门真西-收场' },
    { id: 8, name: '泉州路霸卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { antiReflect: 3 }, dropInfo:'泉州西门-往西-白云山' },
    { id: 9, name: '巨型仙人掌卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { reflect: 3 }, dropInfo:'达卡尔西门-2西2朝（没有就在附近走动刷出）' },
    { id: 10, name: '幽灵卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { antiCurse: 3 }, dropInfo:'威尼斯北门-4北-东（荒树林）' },
    { id: 11, name: '偷矿者卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { antiSlow: 3 }, dropInfo: '威尼斯-北门-矿山' },
    { id: 12, name: '巨熊卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { weak: 3 }, dropInfo: '威尼斯-住宅区 -北西（后山）' },
    { id: 13, name: '白野象卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { depressed: 3 }, dropInfo: '开普敦西城门-直北-草原深处' },
    { id: 14, name: '变异向日葵卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { poison: 3 }, dropInfo:'汉堡-北门全北-沙丘' },
    { id: 15, name: '吸血僵尸卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { antiCurse: 3 }, dropInfo:'伦敦吸血鬼坟墓（需要任务-德拉格之心）' },
    { id: 16, name: '天狼蜘蛛卡片', attachableParts: ['腰部','头','躯','脚'],
        baseEffects: { agility: 5 }, dropInfo:'开普敦西门-4被3框-北（沼泽荒岛）' },
    { id: 17, name: '变异魔鬼鱼卡片', attachableParts: ['腰部','头','躯','脚'],
        baseEffects: { health: 20, agility: 1 }, dropInfo:'萌巴萨-东门东-经南' },
    { id: 18, name: '火蝙蝠卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { curse: 3 }, dropInfo:'莫桑比克北门-北西（没有就左右走动刷）' },
    { id: 19, name: '变异史莱姆卡片', attachableParts: ['头','躯','脚','腰部'],
        baseEffects: { health: 30, defense: 3 }, dropInfo:'主线任务封印迷阵162环节虫蛾' },
    { id: 20, name: '假太先卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { antiPoison: 3 }, dropInfo:'长安东城门' },
    { id: 21, name: '艾斯卡片', attachableParts: ['手持','腰部','头','躯','脚','配饰'],
        baseEffects: { paralysis: 3 }, dropInfo: '活动/交易获得' }
].map(props => makeCardConfig(props));

export default class Card {
    constructor(userId, database, backpack, play) {
        this.userId = userId;
        this.db = database;
        this.backpack = backpack;
        this.play = play;
    }

    static getCardList() { return CARD_CONFIG; }
    static qualityText(q) { return QUALITY_TEXT[q] || q; }
    static qualityColor(q) { return QUALITY_COLORS[q] || '#999'; }

    // 实例方法：供 card.ejs 模板 user.card?.qualityText?.(...) 调用，转发到静态方法
    qualityText(q) { return Card.qualityText(q); }
    qualityColor(q) { return Card.qualityColor(q); }

    // ========== 数据查询 ==========

    getCollectedCards() {
        if (!this.db) return [];
        const rows = this.db.executeSQL(
            'SELECT * FROM cards WHERE user_id = ?', [this.userId], 'all'
        ) || [];
        return rows.map(r => {
            const cfg = CARD_CONFIG.find(c => c.id === r.card_id);
            return { ...r, config: cfg || {} };
        });
    }

    getEquippedCards() {
        if (!this.db) return [];
        const rows = this.db.executeSQL(
            'SELECT * FROM card_enchanted WHERE user_id = ?', [this.userId], 'all'
        ) || [];
        return rows;
    }

    // ========== 卡片效果计算 ==========

    _computeEffects(cardId, quality, level) {
        const cfg = CARD_CONFIG.find(c => c.id === cardId);
        if (!cfg) return {};
        const mul = QUALITY_MULTIPLIER[quality] || 1;
        // 星级系数：1星=1.0, 2星=1.1, ... 10星=1.9（防止数值爆炸）
        const starCoeff = STAR_LEVEL_COEFF[level - 1] || 1.0;
        const effects = {};
        Object.keys(cfg.baseEffects).forEach(k => {
            effects[k] = Math.floor(cfg.baseEffects[k] * mul * starCoeff);
        });
        return effects;
    }

    // ========== 收集 ==========

    collectCard(cardId, quality = 'normal') {
        const cfg = CARD_CONFIG.find(c => c.id === cardId);
        if (!cfg) return { success: false, tip: '卡片不存在' };

        if (!QUALITY_ORDER.includes(quality)) return { success: false, tip: '无效的品质' };

        // 允许重复入库（升星需要消耗 2 张同种同品卡片）
        this.db.executeSQL(
            'INSERT INTO cards (user_id, card_id, card_name, quality, level, collected_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)',
            [this.userId, cardId, cfg.name, quality], 'run'
        );

        // 卡片物品侧记录：同步进背包（type=37 为卡片；类型7已被百宝箱/乾坤袋占用）
        try {
            if (this.backpack) {
                this.backpack.addItem(new Goods({
                    name: cfg.name + '[' + QUALITY_TEXT[quality] + ']',
                    type: 37,
                    num: 1,
                    info: { cardId: cardId, quality: quality }
                }));
            }
        } catch (e) {
            console.error('卡片入背包失败:', e);
        }

        return { success: true, tip: '获得 ' + QUALITY_TEXT[quality] + '·' + cfg.name + '！' };
    }

    // 随机掉落一张卡（从怪物掉落）
    collectRandom(rarityBonus = false) {
        const pool = CARD_CONFIG;
        const idx = Math.floor(Math.random() * pool.length);
        let quality = 'normal';
        const roll = Math.random();
        if (rarityBonus) {
            // 活动/稀有掉落：传说0.5%，稀有2.5%，珍贵7%，精致20%
            if (roll < 0.005) quality = 'legend';
            else if (roll < 0.03) quality = 'rare';
            else if (roll < 0.10) quality = 'precious';
            else if (roll < 0.30) quality = 'exquisite';
        } else {
            // 普通掉落：传说0.1%，稀有1%，珍贵7%，精致20%
            if (roll < 0.001) quality = 'legend';
            else if (roll < 0.011) quality = 'rare';
            else if (roll < 0.081) quality = 'precious';
            else if (roll < 0.281) quality = 'exquisite';
        }
        return this.collectCard(pool[idx].id, quality);
    }

    /**
     * 根据怪物名称掉落对应卡片（怪物-卡片映射）
     * 如果该怪物有专属卡片映射则掉落对应卡片，否则走随机掉落
     * @param {string} monsterName - 怪物名称
     * @param {boolean} rarityBonus - 是否提高品质概率
     * @returns {Object} 掉落结果
     */
    collectByMonster(monsterName, rarityBonus = false) {
        // 怪物名称 -> 卡片ID 映射（根据 dropInfo 中的地点/BOSS信息建立）
        const MONSTER_CARD_MAP = {
            '丧尸王': 1, '深渊领主': 2, '大地祭司': 3,
            '狼王': 4, '影山妄主': 5, '牛头寨主': 6,
            '伊斯坦守卫': 7, '白云道长': 8, '达卡尔暗影': 9,
            '荒树长老': 10, '矿山巨人': 11, '威尼斯幽灵': 12,
            '草原巫师': 13, '沙丘法老': 14,
        };

        const mappedCardId = MONSTER_CARD_MAP[monsterName];
        if (mappedCardId) {
            let quality = 'normal';
            const roll = Math.random();
            if (rarityBonus) {
                if (roll < 0.005) quality = 'legend';
                else if (roll < 0.03) quality = 'rare';
                else if (roll < 0.10) quality = 'precious';
                else if (roll < 0.30) quality = 'exquisite';
            } else {
                if (roll < 0.001) quality = 'legend';
                else if (roll < 0.011) quality = 'rare';
                else if (roll < 0.081) quality = 'precious';
                else if (roll < 0.281) quality = 'exquisite';
            }
            return this.collectCard(mappedCardId, quality);
        }
        return this.collectRandom(rarityBonus);
    }

    /**
     * 指定卡片掉落（用于特定奖励/任务发放）
     * @param {number} cardId - 卡片ID
     * @param {string} quality - 品质 (normal/exquisite/precious/rare/legend)
     */
    collectSpecific(cardId, quality = 'normal') {
        return this.collectCard(cardId, quality);
    }

    /**
     * 获取卡片的爆点信息
     */
    static getCardDropInfo(cardId) {
        const card = CARD_CONFIG.find(c => c.id === cardId);
        return card ? card.dropInfo : '';
    }

    // ========== 附魔 ==========

    enchant(cardDbId, slot) {
        // cardDbId = the cards table row id
        const cards = this.getCollectedCards();
        const src = cards.find(c => c.id === parseInt(cardDbId));
        if (!src) return { success: false, tip: '未拥有该卡片' };

        const cfg = src.config;
        if (!cfg || !cfg.attachableParts.includes(slot)) {
            return { success: false, tip: '该卡片不能附魔到 ' + slot };
        }

        // 卸载该槽位的旧卡
        this.unequipCard(slot);

        this.db.executeSQL(
            'INSERT INTO card_enchanted (user_id, card_id, card_name, card_db_id, quality, level, slot, equipped_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [this.userId, cfg.id, cfg.name, cardDbId, src.quality, src.level, slot], 'run'
        );
        return { success: true, tip: cfg.name + '（' + QUALITY_TEXT[src.quality] + ' ★'+src.level+'）附魔至 ' + slot };
    }

    unequipCard(slot) {
        if (!this.db) return;
        this.db.executeSQL('DELETE FROM card_enchanted WHERE user_id = ? AND slot = ?', [this.userId, slot], 'run');
    }

    // ========== 升级 ==========

    // 判断某张卡（cards 表行 id）是否已附魔（存在于 card_enchanted 表）
    _isCardEnchanted(cardDbId) {
        if (!this.db) return false;
        const row = this.db.executeSQL(
            'SELECT id FROM card_enchanted WHERE user_id = ? AND card_db_id = ?',
            [this.userId, cardDbId], 'get'
        );
        return !!row;
    }

    // 核心升星逻辑：以 keep 为保留卡、material 为材料卡完成一次升星。
    // keep/material 为已查出的卡片行对象（含 config）。行为与原 upgradeCard 核心段完全一致。
    _upgradePair(keep, material) {
        // 满级守卫：任一参与卡已达★10 则拒绝升级，不做任何删除
        if (keep.level >= 10 || material.level >= 10) {
            return { success: false, tip: '卡片已满级，无法升级' };
        }

        // 附魔守卫：已附魔的卡不得作为升星材料（keep 卡已附魔不受影响，与现状一致）
        if (this._isCardEnchanted(material.id)) {
            return { success: false, tip: '该卡片已附魔，不能作为升星材料' };
        }

        const newLevel = Math.min(10, Math.max(keep.level, material.level) + 1);

        // 保留 keep 卡并升星，删除材料卡（均带 user_id 归属约束）
        this.db.executeSQL('UPDATE cards SET level = ? WHERE id = ? AND user_id = ?', [newLevel, keep.id, this.userId], 'run');
        this.db.executeSQL('DELETE FROM cards WHERE id = ? AND user_id = ?', [material.id, this.userId], 'run');

        // keep 卡已附魔时同步 card_enchanted 的 level 快照，否则 getCardBonus 读旧星级 → 附魔卡升星零收益
        if (this._isCardEnchanted(keep.id)) {
            this.db.executeSQL('UPDATE card_enchanted SET level = ? WHERE user_id = ? AND card_db_id = ?', [newLevel, this.userId, keep.id], 'run');
        }

        // 同步扣减背包中一件匹配的卡片物品（type=37）；
        // 约定：附魔/卸下属状态变化，背包卡片物品记录保留，不随之增减
        try {
            if (this.backpack) {
                const match = this.backpack.items.find(item =>
                    item.type === 37 && item.info &&
                    item.info.cardId === material.card_id &&
                    item.info.quality === material.quality
                );
                if (match) {
                    this.backpack.removeItem(match.id, 1);
                } else {
                    console.warn(`升星消耗卡片但背包未找到匹配卡片物品: card_id=${material.card_id} quality=${material.quality}`);
                }
            }
        } catch (e) {
            console.error('升星扣减背包卡片物品失败:', e);
        }

        const cfg = keep.config || {};
        const name = cfg.name || keep.card_name || '卡片';
        return { success: true, tip: name + ' (' + QUALITY_TEXT[keep.quality] + ') ★' + (newLevel - 1) + ' → ★' + newLevel + '！！' };
    }

    upgradeCard(foodCardId) {
        // foodCardId 是 cards 表的主键（URL 参数为字符串，需转数字）
        foodCardId = parseInt(foodCardId);
        const myCards = this.getCollectedCards();
        // 用户点击的卡为保留卡（升星对象），其余同种同品卡中取第一张作为材料卡消耗
        const keep = myCards.find(c => c.id === foodCardId);
        if (!keep) return { success: false, tip: '卡片不存在' };

        const materials = myCards.filter(c => c.card_id === keep.card_id && c.quality === keep.quality && c.id !== foodCardId);
        if (materials.length === 0) return { success: false, tip: '需要2张同种同品卡片才能升级' };
        // 与 upgradeAll 行为对齐：顺延选取第一张未附魔的材料卡
        const material = materials.find(m => !this._isCardEnchanted(m.id));
        if (!material) return { success: false, tip: '同种同品的材料卡均已附魔，请先卸下附魔后再升星' };

        return this._upgradePair(keep, material);
    }

    // 一键升星：反复合成同种同品的未满级卡片，直至无可配对。
    // 注意：忽略全部入参（无 params 调用时 index.js 会把 query 对象作为首参传入）。
    upgradeAll() {
        let upgraded = 0, safety = 0, capped = false;
        let bestLevel = 0, bestName = '';
        this.db && this.db.beginBatch && this.db.beginBatch();
        let inTx = false;
        try {
            try {
                this.db.executeSQL('BEGIN', [], 'run');
                inTx = true;
            } catch (e) {
                console.warn('[card] 批量事务开启失败，降级为无事务批量:', e && e.message);
            }
            while (safety++ < 2000) {
                const cards = this.getCollectedCards();
                // 已附魔卡 id 集合（普通对象作为集合，禁用 Set）
                const enchanted = {};
                this.getEquippedCards().forEach(e => { enchanted[e.card_db_id] = true; });

                // 普通对象分组：key = card_id + '|' + quality（禁用 Map）
                const groups = {};
                cards.forEach(c => {
                    const key = c.card_id + '|' + c.quality;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(c);
                });

                let paired = false;
                const keys = Object.keys(groups);
                for (let i = 0; i < keys.length; i++) {
                    // 组内未满级卡，按 level 降序（两高相配，避免高级材料浪费）
                    const usable = groups[keys[i]].filter(c => c.level < 10);
                    if (usable.length < 2) continue;
                    usable.sort((a, b) => b.level - a.level);
                    const keep = usable[0];
                    // material 从次高开始找第一张未附魔的
                    let material = null;
                    for (let j = 1; j < usable.length; j++) {
                        if (!enchanted[usable[j].id]) { material = usable[j]; break; }
                    }
                    if (!material) continue;

                    const r = this._upgradePair(keep, material);
                    if (r.success) {
                        upgraded++;
                        paired = true;
                        if (keep.level + 1 > bestLevel) { bestLevel = keep.level + 1; bestName = (keep.config || {}).name || keep.card_name || '卡片'; }
                    }
                    // 无论成败都只处理第一个可配对组，随后重新读取 fresh 状态
                    break;
                }
                if (!paired) break;
            }
            if (safety > 2000) capped = true; // 循环因 safety 上限退出（而非无可配对）
            if (inTx) {
                this.db.executeSQL('COMMIT', [], 'run');
                inTx = false; // COMMIT 成功；若抛异常则 inTx 保持 true，由 finally 回滚
            }
        } catch (e) {
            // 中途异常且已回滚：返回失败，避免“计数已重置但 tip 报成功”的矛盾
            if (inTx) {
                return { success: false, tip: '一键升星失败，已回滚' };
            }
            throw e;
        } finally {
            if (inTx) {
                try { this.db.executeSQL('ROLLBACK', [], 'run'); } catch (_) {}
            }
            this.db && this.db.endBatch && this.db.endBatch();
        }

        if (upgraded === 0) {
            return { success: false, tip: '没有可升星的卡片（需 2 张同种同品且未满级）' };
        }
        // consumed = upgraded：每次升星消耗一张材料卡
        let tip = `一键升星完成：消耗 ${upgraded} 张卡片，共升星 ${upgraded} 次，最高 ★${bestLevel}（${bestName}）`;
        if (capped) tip += '（已达单次处理上限，可再次点击继续）';
        return { success: true, tip };
    }

    // ========== 汇总加成 ==========

    getCardBonus() {
        const eq = this.getEquippedCards();
        let bonus = {};

        eq.forEach(row => {
            const effs = this._computeEffects(row.card_id, row.quality, row.level);
            Object.keys(effs).forEach(k => {
                bonus[k] = (bonus[k] || 0) + effs[k];
            });
        });

        return bonus;
    }

    // ========== 状态 ==========

    getStatus() {
        const collected = this.getCollectedCards();
        const enchanted = this.getEquippedCards();
        const bonus = this.getCardBonus();

        // 为已收集卡添加效果详情
        const enriched = collected.map(c => {
            const effs = this._computeEffects(c.card_id, c.quality, c.level);
            return { ...c, effects: effs, effectText: this._effectToText(effs) };
        });

        // 已装卡详情
        const enchantedDetail = enchanted.map(e => {
            const cfg = CARD_CONFIG.find(c => c.id === e.card_id) || {};
            const effs = this._computeEffects(e.card_id, e.quality, e.level);
            return { ...e, config: cfg, effects: effs, effectText: this._effectToText(effs) };
        });

        // 已收集卡种数（按 card_id 去重，避免重复行导致 N/21 分母漂移）
        const uniqueCardIds = [];
        enriched.forEach(c => {
            if (!uniqueCardIds.includes(c.card_id)) uniqueCardIds.push(c.card_id);
        });

        return {
            collectedCards: enriched,
            enchantedCards: enchantedDetail,
            cardBonus: bonus,
            bonusText: this._effectToText(bonus),
            totalCards: uniqueCardIds.length,
            totalCardTypes: CARD_CONFIG.length,
            cardList: CARD_CONFIG // 百科全书
        };
    }

    _effectToText(effs) {
        if (!effs || Object.keys(effs).length === 0) return '无效果';
        const parts = [];
        const map = {
            attackPercent:'攻%', healthPercent:'血%', defensePercent:'防%',
            attack:'攻', health:'血', defense:'防', agility:'敏',
            reflect:'反弹%', antiReflect:'抗反弹%', curse:'诅咒%', antiCurse:'抗诅咒%',
            antiSlow:'抗迟防%', weak:'虚弱%', paralysis:'麻痹%',
            depressed:'沮丧%', poison:'毒%', antiPoison:'抗毒%'
        };
        Object.entries(effs).forEach(([k, v]) => {
            const label = map[k] || k;
            parts.push(label + '+' + v);
        });
        return parts.join(', ');
    }
}