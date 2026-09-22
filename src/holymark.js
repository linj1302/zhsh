/**
 * 圣痕系统模块
 * - 圣痕收集（圣战掉落）
 * - 圣化（装备至槽位 1-6）
 * - 吞噬升级（低品质→高品质经验转化）
 * - 属性加成汇总
 * - 触发型效果扩展（生命吸收、伤害反射、负面状态额外伤害）
 *
 * 需求: system_docs/holy_mark_system.md
 */

// 圣痕类型映射 - 扩展效果分类
const HOLY_TYPE_MAP = {
    'divine_power':      { name: '神力',     icon: '⚡', category: '攻击' },
    'reverse_scale':     { name: '逆鳞',     icon: '🐉', category: '防御' },
    'blood_soul':        { name: '血魂',     icon: '🩸', category: '生命' },
    'quick_flash':       { name: '疾闪',     icon: '⚔️', category: '速度' },
    'brave':             { name: '英勇',     icon: '🛡️', category: '精神' },
    'judgment_light':    { name: '审判之光', icon: '⚖️', category: '攻击' },
    'steel_wheel':       { name: '钢铁之轮', icon: '🔩', category: '防御' },
    'ancestor_soul':     { name: '先祖之魂', icon: '👻', category: '生命' },
    'hurricane_spirit':  { name: '飓风之灵', icon: '🌪️', category: '速度' },
    'heaven_song':       { name: '天堂之歌', icon: '🎵', category: '支持' }
};

// 触发型圣痕效果定义
const TRIGGER_EFFECTS = {
    'blood_soul': {
        trigger: 'on_kill',
        effect: 'life_steal',
        baseValue: 5,
        description: '击杀敌人后回复5%最大生命'
    },
    'reverse_scale': {
        trigger: 'on_critical_hit_received',
        effect: 'damage_reflection',
        baseValue: 30,
        description: '受致命伤害时有50%概率免疫并反弹30%伤害'
    },
    'judgment_light': {
        trigger: 'on_debuff_target',
        effect: 'bonus_damage',
        multiplier: 1.5,
        description: '对处于负面状态的敌人造成150%伤害'
    }
};

const QUALITY_ORDER  = ['white', 'green', 'blue', 'purple'];
const QUALITY_NAMES  = { white: '白', green: '绿', blue: '蓝', purple: '紫' };
const QUALITY_COLORS = { white: '#ccc', green: '#5cb85c', blue: '#5bc0de', purple: '#9b59b6' };
const QUALITY_WEIGHTS = { white: 60, green: 25, blue: 12, purple: 3 };
const DEVOUR_BASE_EXP = { white: 100, green: 300, blue: 1000, purple: 3000 };
const LEVEL_UP_BASE   = 100;
const LEVEL_UP_MULT   = { white: 1.5, green: 2.5, blue: 3.5, purple: 5.0 };
const MAX_SANCTIFIED  = 6;

export { HOLY_TYPE_MAP, QUALITY_ORDER, QUALITY_NAMES, QUALITY_COLORS, MAX_SANCTIFIED };

export default class HolyMark {
    constructor(userId, database, play) {
        this.userId = userId;
        this.db = database;
        this.play = play;
    }

    // ========== 静态工具 ==========

    static getTypeName(type) {
        return HOLY_TYPE_MAP[type]?.name || type;
    }

    static getTypeIcon(type) {
        return HOLY_TYPE_MAP[type]?.icon || '❓';
    }

    static getCategory(type) {
        return HOLY_TYPE_MAP[type]?.category || '未分类';
    }

    static randomQuality(rarityBonus = false) {
        const weights = { ...QUALITY_WEIGHTS };
        if (rarityBonus) {
            weights.white = 40; weights.green = 30; weights.blue = 20; weights.purple = 10;
        }
        const total = Object.values(weights).reduce((a, w) => a + w, 0);
        let roll = Math.random() * total;
        for (const [q, w] of Object.entries(weights)) {
            roll -= w;
            if (roll <= 0) return q;
        }
        return 'white';
    }

    /**
     * 吞噬规则判定：可吞噬同类的所有圣痕（不限品质），以及不同类蓝色及以下品质的圣痕
     * @param {Object} food   材料圣痕
     * @param {Object} target 目标圣痕
     * @returns {boolean} 该材料是否可被目标吞噬
     */
    static isDevourable(food, target) {
        if (food.mark_type === target.mark_type) return true;
        return QUALITY_ORDER.indexOf(food.quality) <= QUALITY_ORDER.indexOf('blue');
    }

    // ========== 查询 ==========

    getCollectedHolyMarks() {
        if (!this.db) return [];
        try {
            return this.db.executeSQL(
                'SELECT * FROM holy_marks WHERE user_id = ? ORDER BY collected_at DESC',
                [this.userId],
                'all'
            ) || [];
        } catch (_) {
            return [];
        }
    }

    getSanctifiedSlots() {
        if (!this.db) return [];
        try {
            return this.db.executeSQL(
                'SELECT * FROM holy_sanctified WHERE user_id = ? ORDER BY slot ASC',
                [this.userId],
                'all'
            ) || [];
        } catch (_) {
            return [];
        }
    }

    getEquippedMarks() {
        const slots   = this.getSanctifiedSlots();
        const allMarks = this.getCollectedHolyMarks();
        const markMap  = new Map(allMarks.map(m => [m.id, m]));
        return slots
            .filter(s => markMap.has(s.mark_id))
            .map(s => ({ slot: s.slot, mark: markMap.get(s.mark_id) }));
    }

    // ========== 收集 ==========

    collect(type, quality) {
        if (!HOLY_TYPE_MAP[type]) return { success: false, tip: '圣痕类型不存在' };
        if (!QUALITY_ORDER.includes(quality)) return { success: false, tip: '品质无效' };

        try {
            this.db.executeSQL(
                `INSERT INTO holy_marks (user_id, mark_type, quality, level, exp, collected_at)
                 VALUES (?, ?, ?, 1, 0, CURRENT_TIMESTAMP)`,
                [this.userId, type, quality],
                'run'
            );
            const typeName = HOLY_TYPE_MAP[type].name;
            const typeIcon = HOLY_TYPE_MAP[type].icon;
            return { success: true, tip: `收集了${QUALITY_NAMES[quality]}品质【${typeIcon}${typeName}】！` };
        } catch (error) {
            console.error('收集圣痕失败:', error);
            return { success: false, tip: '收集失败' };
        }
    }

    collectRandom(rarityBonus = false) {
        const types = Object.keys(HOLY_TYPE_MAP);
        const type  = types[Math.floor(Math.random() * types.length)];
        const quality = HolyMark.randomQuality(rarityBonus);
        return this.collect(type, quality);
    }

    // ========== 圣化（装备） ==========

    sanctify(markId, slot) {
        const marks = this.getCollectedHolyMarks();
        const mark  = marks.find(m => m.id === parseInt(markId));
        if (!mark) return { success: false, tip: '圣痕不存在' };

        const slotNum = parseInt(slot);
        if (isNaN(slotNum) || slotNum < 0 || slotNum >= MAX_SANCTIFIED) {
            return { success: false, tip: `槽位范围 1-${MAX_SANCTIFIED}` };
        }

        // 先检查该圣痕是否已装备到其他槽位
        const existingSlots = this.getSanctifiedSlots();
        if (existingSlots.find(s => s.mark_id === mark.id)) {
            return { success: false, tip: '该圣痕已圣化，请先卸下' };
        }

        // 卸下目标槽位已有圣痕
        this._unsanctifySlot(slotNum);

        const typeName = HOLY_TYPE_MAP[mark.mark_type]?.name || mark.mark_type;
        try {
            this.db.executeSQL(
                'INSERT INTO holy_sanctified (user_id, mark_id, slot) VALUES (?, ?, ?)',
                [this.userId, mark.id, slotNum],
                'run'
            );
            return { success: true, tip: `【${typeName}】圣化到槽位 ${slotNum + 1}！` };
        } catch (error) {
            console.error('圣化失败:', error);
            return { success: false, tip: '圣化失败，槽位可能已满' };
        }
    }

    unsanctify(markId) {
        try {
            this.db.executeSQL(
                'DELETE FROM holy_sanctified WHERE user_id = ? AND mark_id = ?',
                [this.userId, parseInt(markId)],
                'run'
            );
            return { success: true, tip: '圣痕已卸下' };
        } catch (error) {
            return { success: false, tip: '卸下失败' };
        }
    }

    _unsanctifySlot(slot) {
        try {
            this.db.executeSQL(
                'DELETE FROM holy_sanctified WHERE user_id = ? AND slot = ?',
                [this.userId, slot],
                'run'
            );
        } catch (_) {}
    }

    // ========== 吞噬升级 ==========

    devour(targetId, foodId) {
        const marks = this.getCollectedHolyMarks();
        if (!marks.length) return { success: false, tip: '没有圣痕' };

        const tid = parseInt(targetId);
        const fid = parseInt(foodId);
        const target = marks.find(m => m.id === tid);
        const food   = marks.find(m => m.id === fid);
        if (!target || !food) return { success: false, tip: '圣痕不存在' };
        if (tid === fid) return { success: false, tip: '不能吞噬自己' };

        // 吞噬规则：同类全部可吞；异类仅限蓝色及以下品质
        if (!HolyMark.isDevourable(food, target)) {
            return { success: false, tip: '不能吞噬异类紫色品质圣痕' };
        }

        // 已装备的不能被吞噬
        const slots = this.getSanctifiedSlots();
        if (slots.find(s => s.mark_id === fid)) {
            return { success: false, tip: '该圣痕已圣化，请先卸下再吞噬' };
        }

        const expGain  = (DEVOUR_BASE_EXP[food.quality] || 100) * food.level;
        const newExp   = target.exp + expGain;
        const oldLevel = target.level;
        const newLvl   = this._calcNewLevel(target.quality, newExp);
        const leveled  = newLvl > oldLevel;
        const typeName = HOLY_TYPE_MAP[target.mark_type]?.name || target.mark_type;

        try {
            this.db.executeSQL('UPDATE holy_marks SET exp = ?, level = ? WHERE id = ?',
                [newExp, newLvl, tid], 'run');
            this.db.executeSQL('DELETE FROM holy_marks WHERE id = ?', [fid], 'run');
            this.db.executeSQL('DELETE FROM holy_sanctified WHERE mark_id = ?', [fid], 'run');
        } catch (_) {
            return { success: false, tip: '吞噬失败' };
        }

        const msg = leveled
            ? `吞噬成功！【${typeName}】升为 ${newLvl} 级（+${expGain}经验）！`
            : `吞噬成功！【${typeName}】获得 +${expGain} 经验`;

        return { success: true, tip: msg, leveledUp: leveled, newLevel: newLvl, expGain };
    }

    /**
     * 一键吞噬：自动选择最强圣痕为目标，吞噬所有符合条件的材料圣痕
     * - 未指定 targetId 时自动选：品质降序 → 等级降序 → id 升序
     * - 已圣化的材料跳过（绝不强拆装备），异类紫色品质材料被吞噬规则跳过
     * - 循环期间 beginBatch 抑制逐条全量写盘，endBatch 统一落盘一次
     * @param {number} [targetId] 可选目标圣痕 id（无 params 调用时 index.js 会传入 query 对象，需 NaN 防御）
     */
    devourAll(targetId) {
        // 参数防御：无 params 调用时 index.js 会 push(req.query) 作为首参；
        // Express5 的 query 为 null 原型对象，parseInt(它) 会抛“Cannot convert object to primitive value”，
        // 故仅对 string/number 尝试 parseInt，其余一律视为 NaN → 走自动选择
        const tid = (typeof targetId === 'string' || typeof targetId === 'number')
            ? parseInt(targetId)
            : NaN;

        const marks = this.getCollectedHolyMarks();
        if (marks.length < 2) return { success: false, tip: '圣痕不足，无法一键吞噬' };

        // 目标选择
        let target;
        if (isNaN(tid)) {
            target = marks.slice().sort((a, b) => {
                const qd = QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality);
                if (qd !== 0) return qd;
                if (b.level !== a.level) return b.level - a.level;
                return a.id - b.id;
            })[0];
        } else {
            target = marks.find(m => m.id === tid);
            if (!target) return { success: false, tip: '目标圣痕不存在' };
        }
        if (!target) return { success: false, tip: '目标圣痕不存在' };

        // 已圣化集合（普通对象，禁 Map/Set）
        const sanctifiedIds = {};
        this.getSanctifiedSlots().forEach(s => { sanctifiedIds[s.mark_id] = true; });

        // 候选材料：快照遍历，跳过自身与已圣化（已圣化计数 skipped）；吞噬规则与 devour 一致（同类全部可吞，异类仅限蓝及以下，不符合计数 skippedQuality）
        const foods = [];
        let skipped = 0;
        let skippedQuality = 0;
        marks.forEach(m => {
            if (m.id === target.id) return;
            if (sanctifiedIds[m.id]) { skipped++; return; }
            if (!HolyMark.isDevourable(m, target)) { skippedQuality++; return; }
            foods.push(m);
        });
        if (!foods.length) {
            return { success: false, tip: '没有可吞噬的圣痕（可能均已圣化）' };
        }

        // 批量吞噬：事务包裹，循环内 executeSQL 的 saveDatabase 被 beginBatch 抑制，finally 中 endBatch 统一落盘一次
        let devoured = 0, totalExp = 0, finalLevel = target.level;
        this.db && this.db.beginBatch && this.db.beginBatch();
        let inTx = false;
        let rolledBack = false;
        try {
            try {
                this.db.executeSQL('BEGIN', [], 'run');
                inTx = true;
            } catch (e) {
                // BEGIN 不兼容时降级为无事务，仅保留落盘抑制；不再静默吞掉，便于发现共享库被卡在事务中的隐患
                console.warn('[holymark] 批量事务开启失败，降级为无事务批量:', e && e.message);
            }
            foods.forEach(food => {
                const r = this.devour(target.id, food.id);
                if (r && r.success) {
                    devoured++;
                    totalExp += (r.expGain || 0);
                    finalLevel = r.newLevel || finalLevel;
                }
            });
            if (inTx) {
                this.db.executeSQL('COMMIT', [], 'run');
                inTx = false; // COMMIT 成功；若抛异常则 inTx 保持 true，由 finally 回滚
            }
        } catch (e) {
            // 事务内异常：由 finally 回滚，此处标记后统一返回失败（避免“计数已发生但 tip 报成功”的矛盾）
            rolledBack = inTx;
            console.error('[holymark] 一键吞噬批量执行异常:', e && e.message);
        } finally {
            if (inTx) {
                try { this.db.executeSQL('ROLLBACK', [], 'run'); } catch (_) {}
            }
            this.db && this.db.endBatch && this.db.endBatch();
        }

        if (rolledBack) {
            // 真的回滚了：计数复位，磁盘状态未变，返回失败
            devoured = 0; totalExp = 0; finalLevel = target.level;
            return { success: false, tip: '一键吞噬失败，已回滚' };
        }

        if (devoured === 0) {
            return { success: false, tip: '没有可吞噬的圣痕（可能均已圣化）' };
        }

        const typeName = HOLY_TYPE_MAP[target.mark_type]?.name || target.mark_type;
        let skipMsg = skipped > 0 ? `，跳过 ${skipped} 枚已圣化` : '';
        if (skippedQuality > 0) skipMsg += `，另有 ${skippedQuality} 枚异类紫色品质不可吞噬`;
        return {
            success: true,
            devoured,
            totalExp,
            tip: `一键吞噬完成：消耗 ${devoured} 枚圣痕，【${typeName}】升至 Lv.${finalLevel}（累计 +${totalExp} 经验）${skipMsg}`
        };
    }

    /**
     * 一键吞噬（含圣化）：与 devourAll 类似，但不跳过已圣化的圣痕
     * 吞噬前会自动卸下已圣化的材料圣痕
     * @param {number|string} [targetId] 可选目标圣痕ID，不传则自动选最强
     */
    devourSanctified(targetId) {
        const tid = (typeof targetId === 'string' || typeof targetId === 'number')
            ? parseInt(targetId)
            : NaN;

        const marks = this.getCollectedHolyMarks();
        if (marks.length < 2) return { success: false, tip: '圣痕不足，无法吞噬' };

        // 目标选择：与 devourAll 一致
        let target;
        if (isNaN(tid)) {
            target = marks.slice().sort((a, b) => {
                const qd = QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality);
                if (qd !== 0) return qd;
                if (b.level !== a.level) return b.level - a.level;
                return a.id - b.id;
            })[0];
        } else {
            target = marks.find(m => m.id === tid);
            if (!target) return { success: false, tip: '目标圣痕不存在' };
        }
        if (!target) return { success: false, tip: '目标圣痕不存在' };

        // 候选材料：包含已圣化的（吞噬规则仍然生效：同类全部可吞，异类仅限蓝及以下）
        const foods = [];
        let skippedQuality = 0;
        let sanctifiedFoods = 0;
        marks.forEach(m => {
            if (m.id === target.id) return;
            if (!HolyMark.isDevourable(m, target)) { skippedQuality++; return; }
            foods.push(m);
        });

        if (!foods.length) {
            return { success: false, tip: '没有可吞噬的圣痕' };
        }

        // 批量吞噬：先卸下已圣化的材料，再逐个吞噬
        let devoured = 0, totalExp = 0, finalLevel = target.level;
        this.db && this.db.beginBatch && this.db.beginBatch();
        let inTx = false;
        let rolledBack = false;
        try {
            try {
                this.db.executeSQL('BEGIN', [], 'run');
                inTx = true;
            } catch (e) {
                console.warn('[holymark] 含圣化吞噬事务开启失败，降级:', e && e.message);
            }

            foods.forEach(food => {
                // 如果材料已圣化，先自动卸下
                const sanctifiedSlots = this.getSanctifiedSlots();
                const slotEntry = sanctifiedSlots.find(s => s.mark_id === food.id);
                if (slotEntry) {
                    this._unsanctifySlot(slotEntry.slot);
                    sanctifiedFoods++;
                }
                const r = this.devour(target.id, food.id);
                if (r && r.success) {
                    devoured++;
                    totalExp += (r.expGain || 0);
                    finalLevel = r.newLevel || finalLevel;
                }
            });

            if (inTx) {
                this.db.executeSQL('COMMIT', [], 'run');
                inTx = false;
            }
        } catch (e) {
            rolledBack = inTx;
            console.error('[holymark] 含圣化吞噬批量异常:', e && e.message);
        } finally {
            if (inTx) {
                try { this.db.executeSQL('ROLLBACK', [], 'run'); } catch (_) {}
            }
            this.db && this.db.endBatch && this.db.endBatch();
        }

        if (rolledBack) {
            return { success: false, tip: '一键吞噬（含圣化）失败，已回滚' };
        }
        if (devoured === 0) {
            return { success: false, tip: '没有可吞噬的圣痕' };
        }

        const typeName = HOLY_TYPE_MAP[target.mark_type]?.name || target.mark_type;
        let extraMsg = '';
        if (sanctifiedFoods > 0) extraMsg += `，自动卸下并吞噬 ${sanctifiedFoods} 枚已圣化`;
        if (skippedQuality > 0) extraMsg += `，${skippedQuality} 枚异类紫色品质不可吞噬`;
        return {
            success: true,
            devoured,
            totalExp,
            tip: `一键吞噬（含圣化）完成：消耗 ${devoured} 枚圣痕，【${typeName}】升至 Lv.${finalLevel}（+${totalExp} 经验）${extraMsg}`
        };
    }

    // 吞噬优化：允许用低品质圣痕碎片提升高品质圣痕的特定效果
    refine(targetId, foodId) {
        // 与 devour 类似，但保留被吞噬圣痕的"记忆片段"用于提升特定效果
        // 当前版本先实现基础吞噬，refine 作为未来扩展
        return this.devour(targetId, foodId);
    }

    /**
     * 按品质批量吞噬：在吞噬规则（同类全部可吞，异类仅限蓝及以下）内，吞噬品质不超过指定上限的材料
     * @param {number|string} targetId - 目标圣痕ID
     * @param {string} maxQuality - 材料品质上限（如 'white', 'green', 'blue', 'purple'；异类实际最多到蓝）
     * @returns {Object} 吞噬结果
     */
    devourByQuality(targetId, maxQuality) {
        const tid = parseInt(targetId);
        if (isNaN(tid)) return { success: false, tip: '目标圣痕ID无效' };

        const marks = this.getCollectedHolyMarks();
        const target = marks.find(m => m.id === tid);
        if (!target) return { success: false, tip: '目标圣痕不存在' };

        // 确定品质上限
        const maxQi = QUALITY_ORDER.indexOf(maxQuality);
        if (maxQi < 0) return { success: false, tip: '未知品质: ' + maxQuality };

        // 已圣化集合
        const sanctifiedIds = {};
        this.getSanctifiedSlots().forEach(s => { sanctifiedIds[s.mark_id] = true; });

        // 筛选候选材料：品质 ≤ 所选上限，且符合吞噬规则（同类全部可吞；异类最多到蓝）
        const foods = marks.filter(m => {
            if (m.id === target.id) return false;
            if (sanctifiedIds[m.id]) return false;
            if (QUALITY_ORDER.indexOf(m.quality) > maxQi) return false;
            return HolyMark.isDevourable(m, target);
        });

        if (!foods.length) {
            return { success: false, tip: '没有符合品质条件的可吞噬圣痕' };
        }

        // 批量吞噬
        let devoured = 0, totalExp = 0, finalLevel = target.level;
        this.db && this.db.beginBatch && this.db.beginBatch();
        try {
            foods.forEach(food => {
                const r = this.devour(target.id, food.id);
                if (r && r.success) {
                    devoured++;
                    totalExp += (r.expGain || 0);
                    finalLevel = r.newLevel || finalLevel;
                }
            });
        } catch (e) {
            console.error('[holymark] 按品质吞噬异常:', e && e.message);
        } finally {
            this.db && this.db.endBatch && this.db.endBatch();
        }

        if (devoured === 0) {
            return { success: false, tip: '吞噬失败或无符合条件的圣痕' };
        }

        const typeName = HOLY_TYPE_MAP[target.mark_type]?.name || target.mark_type;
        const qualityName = { white: '白色', green: '绿色', blue: '蓝色', purple: '紫色' }[maxQuality] || maxQuality;
        return {
            success: true,
            devoured,
            totalExp,
            tip: `按品质吞噬完成：消耗 ${devoured} 枚${qualityName}及以下圣痕，【${typeName}】升至 Lv.${finalLevel}（+${totalExp}经验）`
        };
    }

    _levelUpNeed(quality, level) {
        return Math.floor(LEVEL_UP_BASE * (LEVEL_UP_MULT[quality] || 1.5) * level);
    }

    _calcNewLevel(quality, exp) {
        let lv = 1;
        let acc = 0;
        while (exp >= acc + this._levelUpNeed(quality, lv + 1)) {
            acc += this._levelUpNeed(quality, lv + 1);
            lv++;
            if (lv >= 50) break;
        }
        return lv;
    }

    // ========== 属性汇总 ==========

    getHolyMarkBonus() {
        const equipped = this.getEquippedMarks();
        const bonus = {};

        for (const { mark } of equipped) {
            const qi  = QUALITY_ORDER.indexOf(mark.quality);
            const mul = (1 + qi) * (1 + (mark.level - 1) * 0.2);  // white=1x + quality bonus + level bonus

            switch (mark.mark_type) {
                case 'divine_power':
                    bonus.attack  = (bonus.attack  || 0) + 5 * mul;
                    bonus.defense = (bonus.defense || 0) + 5 * mul;
                    break;
                case 'reverse_scale':
                    bonus.attackPercent = (bonus.attackPercent || 0) + 0.01 * mul;
                    break;
                case 'blood_soul':
                    bonus.vampire = (bonus.vampire || 0) + 0.01 * mul;
                    break;
                case 'quick_flash':
                    bonus.agility = (bonus.agility || 0) + 5 * mul;
                    break;
                case 'brave':
                    bonus.morale = (bonus.morale || 0) + 5 * mul;
                    break;
                case 'judgment_light':
                    bonus.critChance = (bonus.critChance || 0) + 0.01 * mul;
                    break;
                case 'steel_wheel':
                    bonus.defensePercent = (bonus.defensePercent || 0) + 0.01 * mul;
                    break;
                case 'ancestor_soul':
                    bonus.healthPercent = (bonus.healthPercent || 0) + 0.01 * mul;
                    break;
                case 'hurricane_spirit':
                    bonus.agilityPercent = (bonus.agilityPercent || 0) + 0.01 * mul;
                    break;
                case 'heaven_song':
                    bonus.combo    = (bonus.combo    || 0) + 0.01 * mul;
                    bonus.ironWall = (bonus.ironWall || 0) + 0.01 * mul;
                    break;
            }
        }

        // 获取触发型圣痕效果
        const triggerEffects = this.getTriggerEffects();
        Object.assign(bonus, triggerEffects);

        // 限制百分比类奖励上限
        const clampKeys = ['attackPercent', 'defensePercent', 'healthPercent', 'agilityPercent', 'critChance', 'vampire', 'combo', 'ironWall'];
        for (const k of clampKeys) {
            if (bonus[k] > 0.50) bonus[k] = 0.50;
        }

        // 取整
        for (const k of Object.keys(bonus)) {
            bonus[k] = Math.round(bonus[k] * 10000) / 10000;
        }

        return bonus;
    }

    // 获取触发型圣痕效果（根据已装备的触发型圣痕）
    getTriggerEffects() {
        const equipped = this.getEquippedMarks();
        const triggerEffects = {};

        for (const { mark } of equipped) {
            const trigger = TRIGGER_EFFECTS[mark.mark_type];
            if (!trigger) continue;

            const qi  = QUALITY_ORDER.indexOf(mark.quality);
            const mul = (1 + qi) * (1 + (mark.level - 1) * 0.2);

            switch (trigger.effect) {
                case 'life_steal':
                    // 生命吸收：每击杀一个敌人回复生命
                    triggerEffects.lifeStealPercent = (triggerEffects.lifeStealPercent || 0) + trigger.baseValue * 0.01 * mul;
                    break;
                case 'damage_reflection':
                    // 伤害反射：受致命伤害时概率免疫并反弹
                    triggerEffects.damageReflectionChance = (triggerEffects.damageReflectionChance || 0) + 0.5 * mul;
                    triggerEffects.damageReflectionPercent = (triggerEffects.damageReflectionPercent || 0) + trigger.baseValue * 0.01 * mul;
                    break;
                case 'bonus_damage':
                    // 负面状态目标额外伤害
                    triggerEffects.debuffBonusMultiplier = (triggerEffects.debuffBonusMultiplier || 1) + (trigger.multiplier - 1) * mul;
                    break;
            }
        }

        return triggerEffects;
    }

    // ========== 状态导出（给EJS模板） ==========

    getStatus() {
        const collected  = this.getCollectedHolyMarks();
        const equipped   = this.getEquippedMarks();
        const totalBonus = this.getHolyMarkBonus();

        const allMarks = collected.map(m => {
            const typeDef = HOLY_TYPE_MAP[m.mark_type] || { name: m.mark_type, icon: '❓' };
            const nextExp = this._levelUpNeed(m.quality, m.level + 1);
            const pct     = nextExp > 0 ? Math.min(100, Math.floor((m.exp / nextExp) * 100)) : 100;
            const isEquipped = equipped.some(e => e.mark && e.mark.id === m.id);
            const trigger = TRIGGER_EFFECTS[m.mark_type];
            return {
                ...m,
                typeName:    typeDef.name,
                typeIcon:    typeDef.icon,
                category:    typeDef.category || '未分类',
                qualityColor: QUALITY_COLORS[m.quality] || '#ccc',
                qualityName:  QUALITY_NAMES[m.quality] || m.quality,
                expPercent:   pct,
                nextExp:      nextExp,
                isEquipped:   isEquipped,
                slotNum:      isEquipped ? (equipped.find(e => e.mark && e.mark.id === m.id)?.slot + 1) : null,
                hasTriggerEffect: !!trigger,
                triggerDescription: trigger ? trigger.description : null
            };
        });

        const sanctifiedSlots = this.getSanctifiedSlots();
        // Build a full slot map (0-5)
        const allSlots = [];
        for (let i = 0; i < MAX_SANCTIFIED; i++) {
            const entry = sanctifiedSlots.find(s => s.slot === i);
            if (entry) {
                const mark = allMarks.find(m => m.id === entry.mark_id);
                allSlots.push({ slot: i, slotLabel: i + 1, markId: entry.mark_id, mark });
            } else {
                allSlots.push({ slot: i, slotLabel: i + 1, markId: null, mark: null });
            }
        }

        return {
            collectedMarks: collected,
            allMarks:       allMarks,
            totalMarks:     collected.length,
            totalBonus:     totalBonus,
            sanctifiedSlots: sanctifiedSlots,
            equippedMarks:   equipped,
            allSlots:        allSlots,
            maxSlots:        MAX_SANCTIFIED,
            triggerEffects: this.getTriggerEffects()
        };
    }
}
