/**
 * 节假日活动系统模块 (v2 — 增强版)
 * 
 * 功能：
 * - 节日检测（公历 + 农历映射）
 * - 多类型活动追踪（每日签到、一次性、链式任务、每日重复）
 * - 丰富的奖励类型（金币、银币、经验、物品、临时属性）
 * - 节日福利解析（特殊功能文本 → 实际倍率）
 * - 追踪系统（战斗/击杀/NPC/步数/掉落/任务等统计）
 * - 领取记录持久化
 * 
 * 支持 exec() dispatch: holiday.claimLoginGift, holiday.claimReward
 * 保留 applyMultipliers() 用于 play.js 倍率注入
 */

import holidayConfig from '../config/holiday_events.json' with { type: 'json' };
import Goods from './goods.js';

export default class Holiday {
    constructor(userId, database, play, backpack) {
        this.userId = userId;
        this.db = database;
        this.play = play;
        this.backpack = backpack;
        this.config = holidayConfig;
        this._tempBuffs = [];
        this._loadTrackerData();
    }

    // ==================== 追踪数据 ====================

    _loadTrackerData() {
        if (!this.db) { this._initDefaultTracker(); return; }
        try {
            const result = this.db.executeSQL(
                `SELECT data FROM holiday_tracker WHERE user_id = ?`, [this.userId], 'get'
            );
            if (result?.data) {
                const p = JSON.parse(result.data);
                this.battleCount = p.battleCount || 0;
                this.battleWins = p.battleWins || 0;
                this.monsterKills = p.monsterKills || 0;
                this.npcVisits = p.npcVisits || 0;
                this.walkSteps = p.walkSteps || 0;
                this.itemDrops = p.itemDrops || 0;
                this.taskCompletes = p.taskCompletes || 0;
                this.trialCompletes = p.trialCompletes || 0;
                this.shopPurchase = p.shopPurchase || 0;
                this.teamKills = p.teamKills || 0;
                this.riddleSolved = p.riddleSolved || 0;
                this.claimedActivities = p.claimedActivities || {};
                this.dailyLoginDates = p.dailyLoginDates || {};
                this.chainProgress = p.chainProgress || {};
                this.lastLoginDate = p.lastLoginDate || null;
                this.lastCheckDate = p.lastCheckDate || null;
                this.activeEvents = p.activeEvents || [];
                this.claimed = p.claimed || {};
                this._tempBuffs = p._tempBuffs || [];
                this.loginStreak = p.loginStreak || 0;
            } else {
                this._initDefaultTracker();
                this._createTrackerRecord();
            }
        } catch (e) {
            console.error('[Holiday] 加载追踪数据失败:', e);
            this._initDefaultTracker();
        }
    }

    _initDefaultTracker() {
        this.battleCount = 0; this.battleWins = 0; this.monsterKills = 0;
        this.npcVisits = 0; this.walkSteps = 0; this.itemDrops = 0;
        this.taskCompletes = 0; this.trialCompletes = 0; this.shopPurchase = 0;
        this.teamKills = 0; this.riddleSolved = 0;
        this.claimedActivities = {}; this.dailyLoginDates = {};
        this.chainProgress = {}; this.lastLoginDate = null;
        this.lastCheckDate = null; this.activeEvents = [];
        this.claimed = {}; this._tempBuffs = [];
        this.loginStreak = 0;
    }

    _createTrackerRecord() {
        if (!this.db) return;
        try {
            this.db.executeSQL(
                `INSERT INTO holiday_tracker (user_id, data) VALUES (?, ?)`,
                [this.userId, JSON.stringify(this._getTrackerSnapshot())], 'run'
            );
        } catch (e) {
            try {
                this.db.executeSQL(
                    `UPDATE holiday_tracker SET data = ? WHERE user_id = ?`,
                    [JSON.stringify(this._getTrackerSnapshot()), this.userId], 'run'
                );
            } catch (e2) { console.error('[Holiday] 创建追踪记录失败:', e2); }
        }
    }

    _getTrackerSnapshot() {
        return {
            battleCount: this.battleCount, battleWins: this.battleWins,
            monsterKills: this.monsterKills, npcVisits: this.npcVisits,
            walkSteps: this.walkSteps, itemDrops: this.itemDrops,
            taskCompletes: this.taskCompletes, trialCompletes: this.trialCompletes,
            shopPurchase: this.shopPurchase, teamKills: this.teamKills,
            riddleSolved: this.riddleSolved,
            claimedActivities: this.claimedActivities,
            dailyLoginDates: this.dailyLoginDates,
            chainProgress: this.chainProgress,
            lastLoginDate: this.lastLoginDate, lastCheckDate: this.lastCheckDate,
            activeEvents: this.activeEvents,
            claimed: this.claimed,
            _tempBuffs: this._tempBuffs,
            loginStreak: this.loginStreak || 0
        };
    }

    _saveTracker() {
        if (!this.db) return;
        try {
            this.db.executeSQL(
                `INSERT OR REPLACE INTO holiday_tracker (user_id, data) VALUES (?, ?)`,
                [this.userId, JSON.stringify(this._getTrackerSnapshot())], 'run'
            );
        } catch (e) { console.error('[Holiday] 保存追踪数据失败:', e); }
    }

    // ==================== 日期工具 ====================

    _getSolarDate() {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
    }

    _getLunarDateForEvent(eventId) {
        const cfg = this.config?.system_config;
        if (!cfg) return null;
        const solar = this._getSolarDate();
        const offsets = cfg.lunar_calendar_offset?.[solar.year];
        if (!offsets) return null;
        const map = {
            'spring_festival': 'lunar_new_year',
            'dragon_boat': 'lunar_5_5',
            'qixi': 'lunar_7_7',
            'mid_autumn': 'lunar_8_15',
            'chongyang': 'lunar_9_9'
        };
        const key = map[eventId];
        if (!key || !offsets[key]) return null;
        const [y, m, d] = offsets[key].split('-').map(Number);
        return { year: y, month: m, day: d };
    }

    // ==================== 节日检测 ====================

    _getAllEvents() {
        return this.config?.events || [];
    }

    isEventActive(event) {
        const solar = this._getSolarDate();
        const dur = event.duration_days || 1;

        if (event.date_type === 'solar' || event.date === 'solar') {
            const eD = new Date(solar.year, (event.solar_month || 1) - 1, event.solar_day || 1);
            const nD = new Date(solar.year, solar.month - 1, solar.day);
            const dDiff = Math.floor((nD.getTime() - eD.getTime()) / 86400000);
            return dDiff >= 0 && dDiff < dur;
        }
        if (event.date_type === 'lunar' || event.date === 'lunar') {
            const lunarD = this._getLunarDateForEvent(event.id);
            if (!lunarD) return false;
            const eD = new Date(lunarD.year, lunarD.month - 1, lunarD.day);
            const endD = new Date(eD.getTime() + dur * 86400000);
            const nD = new Date(solar.year, solar.month - 1, solar.day);
            return nD >= eD && nD < endD;
        }
        return false;
    }

    getActiveEvents() {
        const all = this._getAllEvents();
        const today = `${this._getSolarDate().year}-${String(this._getSolarDate().month).padStart(2,'0')}-${String(this._getSolarDate().day).padStart(2,'0')}`;
        if (this.lastCheckDate === today && this._cachedActive?.length) return this._cachedActive;
        const active = all.filter(e => this.isEventActive(e));
        this.activeEvents = active.map(e => e.id);
        this.lastCheckDate = today;
        this._cachedActive = active;
        this._saveTracker();
        return active;
    }

    // ==================== 追踪记录（供其他模块调用） ====================

    recordLogin() {
        const s = this._getSolarDate();
        this.lastLoginDate = `${s.year}-${String(s.month).padStart(2,'0')}-${String(s.day).padStart(2,'0')}`;
        this._saveTracker();
    }

    recordBattle(won = false, isTeam = false) {
        this.battleCount++; if (won) this.battleWins++; this._saveTracker();
    }

    recordMonsterKill(isTeam = false) {
        this.monsterKills++; if (isTeam) this.teamKills++; this._saveTracker();
    }

    recordNpcVisit() { this.npcVisits++; this._saveTracker(); }
    recordWalkStep() { this.walkSteps++; this._saveTracker(); }
    recordItemDrop() { this.itemDrops++; this._saveTracker(); }
    recordTaskComplete() { this.taskCompletes++; this._saveTracker(); }
    recordTrialComplete() { this.trialCompletes++; this._saveTracker(); }
    recordShopPurchase(gold) { this.shopPurchase += gold; this._saveTracker(); }
    recordRiddleSolved() { this.riddleSolved++; this._saveTracker(); }

    // ==================== 条件检查 ====================

    checkRequirement(activity, event) {
        if (!activity.requirement) return true;
        const req = activity.requirement;
        switch (req.type) {
            case 'battle_count': return this.battleCount >= (req.count || 0);
            case 'battle_win': return this.battleWins >= (req.count || 0);
            case 'monster_kills': return this.monsterKills >= (req.count || 0);
            case 'npc_visit': return this.npcVisits >= (req.count || 0);
            case 'walk_steps': return this.walkSteps >= (req.count || 0);
            case 'item_drops': return this.itemDrops >= (req.count || 0);
            case 'task_complete': return this.taskCompletes >= (req.count || 0);
            case 'trial_complete': return this.trialCompletes >= (req.count || 0);
            case 'shop_purchase': return this.shopPurchase >= (req.amount || 0);
            case 'team_kills': return this.teamKills >= (req.count || 0);
            case 'riddle_solved': return this.riddleSolved >= (req.count || 0);
            case 'online_time':
                const h = new Date().getHours();
                return h >= (req.start_hour || 0) && h < (req.end_hour || 24);
            default: return true;
        }
    }

    _checkDailyAvailable(eventId, activityId) {
        const today = `${this._getSolarDate().year}-${String(this._getSolarDate().month).padStart(2,'0')}-${String(this._getSolarDate().day).padStart(2,'0')}`;
        const key = `${eventId}__${activityId}`;
        return this.dailyLoginDates[key] !== today;
    }

    getActivityStatus(eventId, activityId, activity, daily) {
        if (daily) {
            if (!this._checkDailyAvailable(eventId, activityId)) return 'completed';
            return this.checkRequirement(activity, null) ? 'claimable' : 'locked';
        }
        const key = `${eventId}__${activityId}`;
        if (this.claimedActivities[key]) return 'completed';
        return this.checkRequirement(activity, null) ? 'claimable' : 'locked';
    }

    getChainStep(eventId, activityId) {
        return this.chainProgress[`${eventId}__${activityId}`] || 0;
    }

    // ==================== 奖励发放 ====================

    grantRewards(rewards, eventName) {
        const msgs = [];
        if (!rewards) return msgs;
        for (const r of rewards) {
            if (r.chance && Math.random() > r.chance) continue;
            if (r.everyone !== undefined && !r.everyone) {
                if (Math.random() > 0.7) continue;
            }
            switch (r.type) {
                case 'gold':
                    this.play.gold = (this.play.gold || 0) + (r.amount || 0);
                    msgs.push(`${r.amount}金贝`);
                    break;
                case 'silver':
                    this.play.addCopper((r.amount || 0) * 1000);
                    msgs.push(`${r.amount}银贝`);
                    break;
                case 'exp':
                    this.play.addExp(r.amount || 0);
                    msgs.push(`+${r.amount}经验`);
                    break;
                case 'item':
                    if (r.name && r.num > 0) {
                        // 项目规范：通过 Goods 实例发放；礼包/福袋类归为 9礼包，其余归 10其他（参考 src/npc.js）
                        const itemType = /(礼包|福袋|礼盒)/.test(r.name) ? 9 : 10;
                        this.backpack.addItem(new Goods({ name: r.name, type: itemType, num: r.num, info: {} }));
                        msgs.push(`${r.name} x${r.num}`);
                    }
                    break;
                case 'attribute_boost':
                    if (r.attr && r.amount && r.duration_ms) {
                        this._tempBuffs.push({ attr: r.attr, amount: r.amount, expiresAt: Date.now() + r.duration_ms });
                        const aNames = { attack:'攻', defense:'防', agility:'敏', stamina:'体力', health:'生命' };
                        const hrs = Math.floor(r.duration_ms / 3600000);
                        msgs.push(`${aNames[r.attr]||r.attr}+${r.amount}(${hrs}h)`);
                    }
                    break;
                case 'attribute_boost_percent':
                    if (r.attr && r.amount && r.duration_ms) {
                        this._tempBuffs.push({ attr: r.attr, amount: r.amount, isPercent: true, expiresAt: Date.now() + r.duration_ms });
                        const hrs = Math.floor(r.duration_ms / 3600000);
                        msgs.push(`全属性+${r.amount}%(${hrs}h)`);
                    }
                    break;
            }
        }
        return msgs;
    }

    // ==================== 领取操作 ====================

    /**
     * 领取登录礼物（保留兼容旧版）
     * exec dispatch: holiday.claimLoginGift
     */
    claimLoginGift(eventId) {
        // 兼容旧版：检查 holiday_claims 表
        if (this.db) {
            const r = this.db.executeSQL(
                `SELECT COUNT(*) as count FROM holiday_claims WHERE user_id=? AND holiday_id=? AND claim_type='login_gift'`,
                [this.userId, eventId], 'get'
            );
            if (r?.count > 0) return { success: false, tip: '已领取过该节日登录奖励' };
        }

        const all = this._getAllEvents();
        const event = all.find(e => e.id === eventId);
        if (!event) return { success: false, tip: '节日不存在' };
        if (!this.isEventActive(event)) return { success: false, tip: '该节日未在活动期' };

        // 查找 daily_login 类型活动
        const loginAct = event.activities?.find(a => a.type === 'daily_login');
        if (!loginAct) return { success: false, tip: '该节日无登录奖励' };

        // 检查每日领取
        if (!this._checkDailyAvailable(eventId, loginAct.id)) {
            return { success: false, tip: '今日已领取' };
        }

        const msgs = this.grantRewards(loginAct.rewards, event.name);
        const today = `${this._getSolarDate().year}-${String(this._getSolarDate().month).padStart(2,'0')}-${String(this._getSolarDate().day).padStart(2,'0')}`;
        this.dailyLoginDates[`${eventId}__${loginAct.id}`] = today;

        // 记录到 holiday_claims（旧表兼容）
        if (this.db) {
            this.db.executeSQL(
                `INSERT INTO holiday_claims (user_id, holiday_id, claim_type, claimed_at) VALUES (?, ?, 'login_gift', CURRENT_TIMESTAMP)`,
                [this.userId, eventId], 'run'
            );
        }
        this._saveTracker();

        return {
            success: true,
            tip: `${event.icon} ${event.name}登录奖励：${msgs.join('、')}`
        };
    }

    /**
     * 领取活动奖励（新版核心方法）
     * exec dispatch: holiday.claimReward
     */
    claimReward(eventId, activityId) {
        const all = this._getAllEvents();
        const event = all.find(e => e.id === eventId);
        if (!event) return { success: false, tip: '节日活动不存在' };

        const activity = event.activities?.find(a => a.id === activityId);
        if (!activity) return { success: false, tip: '活动不存在' };

        if (!this.isEventActive(event)) return { success: false, tip: '该节日活动已结束' };

        const isDaily = activity.daily === true;
        const key = `${eventId}__${activityId}`;

        // 一次性已领
        if (activity.type === 'one_time' && this.claimedActivities[key]) {
            return { success: false, tip: '该活动奖励已领取' };
        }
        // 每日登录已领
        if (activity.type === 'daily_login' && !this._checkDailyAvailable(eventId, activityId)) {
            return { success: false, tip: '今日已领取' };
        }
        // 每日重复已领
        if (isDaily && !this._checkDailyAvailable(eventId, activityId)) {
            return { success: false, tip: '今日活动奖励已领取' };
        }

        // 链式任务
        if (activity.type === 'chain') {
            const steps = activity.chain_steps;
            if (!steps?.length) return { success: false, tip: '活动配置错误' };
            const cur = this.getChainStep(eventId, activityId);
            if (cur >= steps.length) return { success: false, tip: '所有任务已完成' };
            const step = steps[cur];
            if (!this.checkRequirement({ requirement: step.requirement }, event)) {
                return { success: false, tip: `当前"${step.name}"要求未达成，请查看详情` };
            }
            const msgs = this.grantRewards(step.rewards, event.name);
            this.chainProgress[key] = cur + 1;
            this._saveTracker();
            return {
                success: true,
                tip: `完成${step.name}！（${cur + 1}/${steps.length}）${msgs.length ? '获得：' + msgs.join('、') : ''}`
            };
        }

        // 条件检查
        if (!this.checkRequirement(activity, event)) {
            const reqDesc = this._describeRequirement(activity.requirement);
            return { success: false, tip: `条件未达成：${reqDesc}` };
        }

        // 发放
        const msgs = this.grantRewards(activity.rewards, event.name);
        if (isDaily || activity.type === 'daily_login') {
            const today = `${this._getSolarDate().year}-${String(this._getSolarDate().month).padStart(2,'0')}-${String(this._getSolarDate().day).padStart(2,'0')}`;
            this.dailyLoginDates[key] = today;
        } else {
            this.claimedActivities[key] = true;
        }
        this._saveTracker();

        return {
            success: true,
            tip: `领取成功！${msgs.length ? '获得：' + msgs.join('、') : ''}`
        };
    }

    _describeRequirement(req) {
        if (!req) return '无要求';
        const m = {
            battle_count: `战斗${req.count}场`, battle_win: `胜利${req.count}场`,
            monster_kills: `击杀${req.count}只怪物`, npc_visit: `拜访${req.count}个NPC`,
            walk_steps: `行走${req.count}步`, item_drops: `获得${req.count}次掉落`,
            task_complete: `完成${req.count}个任务`, trial_complete: `完成${req.count}次副本`,
            shop_purchase: `商城消费${req.amount}金贝`, team_kills: `组队击杀${req.count}只`,
            riddle_solved: `答对${req.count}灯谜`,
            online_time: `${req.start_hour}:00-${req.end_hour}:00在线`
        };
        return m[req.type] || '满足特殊条件';
    }

    // ==================== 倍率系统 ====================

    /**
     * 解析特殊功能文本提取倍率
     */
    getFestivalBonuses() {
        const bonuses = { expBoost: 1.0, goldBoost: 1.0, dropBoost: 1.0, staminaRegen: 1.0, shopDiscount: 0, intimacyMultiplier: 1.0, marriageFree: false };
        const active = this.getActiveEvents();
        for (const event of active) {
            for (const feat of event.special_features || []) {
                const pct = parseInt(feat.match(/(\d+)%/)?.[1] || '');
                if (!pct) continue;
                if (feat.includes('经验')) bonuses.expBoost = Math.max(bonuses.expBoost, 1 + pct/100);
                if (feat.includes('金币')) bonuses.goldBoost = Math.max(bonuses.goldBoost, 1 + pct/100);
                if (feat.includes('掉落')) bonuses.dropBoost = Math.max(bonuses.dropBoost, 1 + pct/100);
                if (feat.includes('体力')) bonuses.staminaRegen = Math.max(bonuses.staminaRegen, 1 + pct/100);
                if (feat.includes('亲密度')) bonuses.intimacyMultiplier = Math.max(bonuses.intimacyMultiplier, 1 + pct/100);
                if (feat.includes('%折') || feat.includes('折')) {
                    const dPct = parseInt(feat.match(/(\d+)折/)?.[1] || '');
                    if (dPct) bonuses.shopDiscount = Math.max(bonuses.shopDiscount, (10 - dPct) * 10);
                }
            }
            for (const feat of event.special_features || []) {
                if (feat.includes('结婚费用全免') || feat.includes('结婚免费')) bonuses.marriageFree = true;
                if (feat.includes('半价') || feat.includes('5折')) bonuses.shopDiscount = Math.max(bonuses.shopDiscount, 50);
                if (feat.includes('8折')) bonuses.shopDiscount = Math.max(bonuses.shopDiscount, 20);
            }
        }
        return bonuses;
    }

    /**
     * 应用倍率到 play 对象（保持现有架构）
     * 在 getFullState/每次请求前调用
     */
    applyMultipliers() {
        const bonuses = this.getFestivalBonuses();
        this.play.expMultiplier = bonuses.expBoost;
        this.play.copperMultiplier = bonuses.goldBoost;
        this.play.dropMultiplier = bonuses.dropBoost;
        this.play.shopDiscount = bonuses.shopDiscount;
        this.play.intimacyMultiplier = bonuses.intimacyMultiplier;
        this.play.marriageFree = bonuses.marriageFree;
        this.play.mentorExpMultiplier = bonuses.expBoost > 1 ? bonuses.expBoost : this.play.mentorExpMultiplier || 1.0;
    }

    /**
     * 获取临时属性 buff（供 play/getFullState 使用）
     */
    getActiveBuffs() {
        if (!this._tempBuffs) return {};
        const now = Date.now();
        this._tempBuffs = this._tempBuffs.filter(b => b.expiresAt > now);
        const result = {};
        for (const b of this._tempBuffs) {
            const key = b.isPercent ? `${b.attr}Percent` : b.attr;
            result[key] = (result[key] || 0) + b.amount;
        }
        return result;
    }

    // ==================== 状态总览 ====================

    /**
     * 获取最近即将到来的节日
     */
    _getNearestUpcoming() {
        const solar = this._getSolarDate();
        const today = new Date(solar.year, solar.month - 1, solar.day);
        let nearest = null, minDiff = Infinity;
        for (const event of this._getAllEvents()) {
            let eventDate;
            if (event.date_type === 'solar' || event.date === 'solar') {
                eventDate = new Date(solar.year, (event.solar_month || 1) - 1, event.solar_day || 1);
            } else if (event.date_type === 'lunar' || event.date === 'lunar') {
                const lunar = this._getLunarDateForEvent(event.id);
                if (!lunar) continue;
                eventDate = new Date(lunar.year, lunar.month - 1, lunar.day);
            } else continue;
            const diff = eventDate.getTime() - today.getTime();
            if (diff > 0 && diff < minDiff) {
                minDiff = diff;
                nearest = { id: event.id, name: event.name, icon: event.icon || '🎉', daysUntil: Math.ceil(diff / 86400000) };
            }
        }
        return nearest;
    }

    /**
     * 获取活动总览（新版 UI 使用）
     */
    getOverview() {
        const activeEvents = this.getActiveEvents();
        const nearest = this._getNearestUpcoming();

        const eventDetails = activeEvents.map(event => ({
            id: event.id, name: event.name, icon: event.icon || '🎉',
            description: event.description, duration_days: event.duration_days || 3,
            special_features: event.special_features || [],
            startTime: event.start,
            endTime: event.end,
            activities: (event.activities || []).map(a => {
                const daily = a.daily || a.type === 'daily_login';
                return {
                    id: a.id, name: a.name, type: a.type, description: a.description,
                    requirement: a.requirement ? this._describeRequirement(a.requirement) : null,
                    isDaily: daily,
                    status: this.getActivityStatus(event.id, a.id, a, daily),
                    chainDetails: a.type === 'chain' ? this._describeChain(event.id, a) : null,
                    rewards: a.rewards || []
                };
            })
        }));

        // 连续签到信息
        const streakInfo = this._getStreakInfo();

        return {
            active: eventDetails,
            nearest,
            activeCount: activeEvents.length,
            total: this._getAllEvents().length,
            systemMessage: activeEvents.length > 0
                ? `${activeEvents.map(e => e.icon + e.name).join('、')}进行中！快来领福利！`
                : '暂无节日活动，敬请期待～',
            bonuses: this.getFestivalBonuses(),
            allEvents: this._getAllEvents(),
            streakInfo,
            claimableCount: this._getClaimableCount()
        };
    }

    /**
     * 获取连续签到信息
     */
    _getStreakInfo() {
        const today = new Date().toISOString().slice(0, 10);
        const lastLogin = this.lastLoginDate;
        let streak = this.loginStreak || 0;
        
        if (lastLogin) {
            const last = new Date(lastLogin);
            const now = new Date(today);
            const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
            if (diffDays > 1) streak = 0; // 超过1天未登录，重置
        }
        
        // 里程碑奖励
        const milestones = [
            { days: 7, reward: '7天签到奖励', claimed: this._isMilestoneClaimed(7) },
            { days: 14, reward: '14天签到奖励', claimed: this._isMilestoneClaimed(14) },
            { days: 30, reward: '30天签到奖励', claimed: this._isMilestoneClaimed(30) }
        ];
        
        return {
            currentStreak: streak,
            todayChecked: lastLogin === today,
            milestones
        };
    }

    _isMilestoneClaimed(days) {
        const key = `milestone_${days}`;
        return this.claimed && this.claimed[key];
    }

    /**
     * 每日签到（含连续签到递增奖励）
     */
    dailyCheckIn() {
        const today = new Date().toISOString().slice(0, 10);
        
        if (this.lastLoginDate === today) {
            return { success: false, tip: '今天已经签到过了' };
        }
        
        // 计算连续天数
        let streak = this.loginStreak || 0;
        if (this.lastLoginDate) {
            const last = new Date(this.lastLoginDate);
            const now = new Date(today);
            const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
                streak++;
            } else {
                streak = 1;
            }
        } else {
            streak = 1;
        }
        
        this.loginStreak = streak;
        this.lastLoginDate = today;
        this._saveTracker();
        
        // 根据连续天数计算奖励
        let rewardDesc = '';
        if (streak >= 30) {
            rewardDesc = '铜贝x5000 + 经验x5000';
            if (this.play) {
                this.play.copper += 5000;
                this.play.addExp(5000);
            }
        } else if (streak >= 14) {
            rewardDesc = '铜贝x3000 + 经验x3000';
            if (this.play) {
                this.play.copper += 3000;
                this.play.addExp(3000);
            }
        } else if (streak >= 7) {
            rewardDesc = '铜贝x1500 + 经验x1500';
            if (this.play) {
                this.play.copper += 1500;
                this.play.addExp(1500);
            }
        } else {
            rewardDesc = `铜贝x${streak * 100}`;
            if (this.play) {
                this.play.copper += streak * 100;
            }
        }
        
        return {
            success: true,
            tip: `签到成功！连续签到${streak}天，获得：${rewardDesc}`,
            streak,
            reward: rewardDesc
        };
    }

    /**
     * 一键领取所有可领取奖励
     */
    claimAllRewards() {
        const activeEvents = this.getActiveEvents();
        let claimed = 0;
        let totalTip = '';
        
        for (const event of activeEvents) {
            for (const activity of (event.activities || [])) {
                const status = this.getActivityStatus(event.id, activity.id, activity, activity.daily);
                if (status === 'claimable') {
                    const result = this.claimReward(event.id, activity.id);
                    if (result && result.success) {
                        claimed++;
                        totalTip += result.tip + '；';
                    }
                }
            }
        }
        
        if (claimed === 0) {
            return { success: false, tip: '没有可领取的奖励' };
        }
        
        return {
            success: true,
            tip: `一键领取完成！共领取 ${claimed} 项奖励`,
            claimed
        };
    }

    /**
     * 获取可领取奖励数量
     */
    _getClaimableCount() {
        const activeEvents = this.getActiveEvents();
        let count = 0;
        
        for (const event of activeEvents) {
            for (const activity of (event.activities || [])) {
                const status = this.getActivityStatus(event.id, activity.id, activity, activity.daily);
                if (status === 'claimable') count++;
            }
        }
        
        return count;
    }

    /**
     * 节日抽奖活动
     */
    lotteryDraw(eventId) {
        // 消耗节日代币
        const tokenName = '节日代币';
        if (!this.backpack.hasItem(tokenName, 1)) {
            return { success: false, tip: `需要${tokenName} x1` };
        }
        
        this.backpack.removeItemByName(tokenName);
        
        // 随机奖励池
        const rewardPool = [
            { name: '铜贝x500', weight: 40, action: () => { if (this.play) this.play.copper += 500; } },
            { name: '铜贝x1000', weight: 25, action: () => { if (this.play) this.play.copper += 1000; } },
            { name: '经验x500', weight: 20, action: () => { if (this.play) this.play.addExp(500); } },
            { name: '经验x2000', weight: 10, action: () => { if (this.play) this.play.addExp(2000); } },
            { name: '声望x50', weight: 4, action: () => { if (this.play) this.play.reputation += 50; } },
            { name: '✨稀有奖励：金币x1', weight: 1, action: () => { if (this.play) this.play.gold += 1; } },
        ];
        
        const totalWeight = rewardPool.reduce((s, r) => s + r.weight, 0);
        let roll = Math.random() * totalWeight;
        let reward = rewardPool[0];
        for (const r of rewardPool) {
            roll -= r.weight;
            if (roll <= 0) { reward = r; break; }
        }
        
        reward.action();
        
        return {
            success: true,
            tip: `抽奖结果：获得 ${reward.name}！`,
            reward: reward.name
        };
    }

    _describeChain(eventId, activity) {
        if (!activity.chain_steps) return null;
        const cur = this.getChainStep(eventId, activity.id);
        return {
            current: cur,
            total: activity.chain_steps.length,
            steps: activity.chain_steps.map((s, i) => ({
                name: s.name, completed: i < cur, current: i === cur
            }))
        };
    }

    /**
     * 获取状态（保留旧版兼容 getStatus 接口）
     */
    getStatus() {
        return this.getOverview();
    }

    // ==================== 持久化 ====================

    getState() {
        return this._getTrackerSnapshot();
    }

    restoreState(state) {
        if (!state) return;
        this.battleCount = state.battleCount || 0;
        this.battleWins = state.battleWins || 0;
        this.monsterKills = state.monsterKills || 0;
        this.npcVisits = state.npcVisits || 0;
        this.walkSteps = state.walkSteps || 0;
        this.itemDrops = state.itemDrops || 0;
        this.taskCompletes = state.taskCompletes || 0;
        this.trialCompletes = state.trialCompletes || 0;
        this.shopPurchase = state.shopPurchase || 0;
        this.teamKills = state.teamKills || 0;
        this.riddleSolved = state.riddleSolved || 0;
        this.claimedActivities = state.claimedActivities || {};
        this.dailyLoginDates = state.dailyLoginDates || {};
        this.chainProgress = state.chainProgress || {};
        this.lastLoginDate = state.lastLoginDate || null;
        this.lastCheckDate = state.lastCheckDate || null;
        this.activeEvents = state.activeEvents || [];
        this.claimed = state.claimed || {};
        this._tempBuffs = state._tempBuffs || [];
        this.loginStreak = state.loginStreak || 0;
    }
}