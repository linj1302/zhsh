import * as config from '../config/index.js'

export default class Trial {
    constructor(city, task, play) {
        this.city = city;
        this.task = task;
        this.play = play;
        this.trialData = {}; // 存储副本进度数据，使用对象替代Map
    }

    levelTrial() {
        const trialConfig = config.trial.find(i => i.name === this.city._city);
        if (trialConfig) {
            // 清除任务标记，使用对象替代Set
            delete this.task.acceptedTasks[trialConfig.index];
            // 恢复进入副本前的位置
            this.city.moveCityAndLocation(trialConfig.receiveLocation);
        }
        // 清除副本数据
        delete this.trialData[this.play.id];
    }

    enterTrial(name, teamInfo, marriageInfo) {
        // 入参类型守卫：exec 反射在无 params 时会把 req.query（null 原型对象）直传进来，
        // 模板字符串/parseInt 处理它会抛 TypeError 导致 500，这里先行拦截
        if (typeof name !== 'string' || !name.trim()) {
            return { error: '副本参数错误', tip: '副本参数错误' };
        }
        const trialConfig = config.trial.find(i => i.name === name);
        if (!trialConfig) {
            return { error: `副本「${name}」不存在！`, tip: `副本「${name}」不存在！` };
        }

        // 等级校验：解析等级区间（如 "5-15级" → 下限5、上限15）
        if (trialConfig.levelRequirement) {
            const rangeMatch = String(trialConfig.levelRequirement).match(/(\d+)\s*-\s*(\d+)/);
            let minLevel;
            let maxLevel;
            if (rangeMatch) {
                minLevel = parseInt(rangeMatch[1]);
                maxLevel = parseInt(rangeMatch[2]);
            } else {
                minLevel = parseInt(trialConfig.levelRequirement);
            }
            if (minLevel && this.play.level < minLevel) {
                return { error: `进入「${name}」需要等级 ${minLevel}，你当前只有 ${this.play.level} 级！`, tip: `进入「${name}」需要等级 ${minLevel}，你当前只有 ${this.play.level} 级！` };
            }
            if (maxLevel && this.play.level > maxLevel) {
                return {
                    error: `进入「${name}」等级不能超过 ${maxLevel} 级，你当前已 ${this.play.level} 级，超出等级上限！`,
                    tip: `进入「${name}」等级不能超过 ${maxLevel} 级，你当前已 ${this.play.level} 级，超出等级上限！`
                };
            }
        }

        // 人数软校验：不强制拒绝，仅在人数不足/未组队时给出建议提示（不卡死单人玩家）
        let teamTip = '';
        if (trialConfig.playerRequirement) {
            // 情侣副本准入校验：playerRequirement 为“情侣”时 parseInt 得 NaN，原会被静默跳过；
            // marriageInfo 由 user.js 的 exec 分发处注入（参照 teamInfo 的做法），有配偶才放行
            if (String(trialConfig.playerRequirement).indexOf('情侣') !== -1) {
                if (!marriageInfo) {
                    return { error: `「${name}」是情侣专属副本，需要先结婚（找月老）才能进入！`, tip: `「${name}」是情侣专属副本，需要先结婚（找月老）才能进入！` };
                }
            }
            const requiredPlayers = parseInt(trialConfig.playerRequirement);
            if (requiredPlayers > 0) {
                if (teamInfo && teamInfo.members && teamInfo.members.length < requiredPlayers) {
                    teamTip = `该副本建议 ${requiredPlayers} 人同行，你当前队伍只有 ${teamInfo.members.length} 人，建议召集更多队友再挑战！`;
                } else if (!teamInfo) {
                    teamTip = `该副本建议 ${requiredPlayers} 人同行，你当前未组队，可以单人进入，但建议召集队友一起挑战！`;
                }
            }
        }

        // 扣费（从content中提取银币数）
        // 如: "需达到30级并支付10银币" → 10*100=1000铜贝
        const costMatch = trialConfig.content && trialConfig.content.match(/(\d+)银币/);
        const entryCost = costMatch ? parseInt(costMatch[1]) * 100 : 0;
        if (entryCost > 0 && this.play.copper < entryCost) {
            return { error: `进入「${name}」需要 ${entryCost/100} 银币，你的铜贝不足！`, tip: `进入「${name}」需要 ${entryCost/100} 银币，你的铜贝不足！` };
        }
        if (entryCost > 0) {
            this.play.addCopper(-entryCost);
        }

        // 设置副本位置信息
        this.city._city = name;
        this.city._position = trialConfig.submitLocation;
        this.city._coordinates = null;
        // 清除副本内的怪物缓存
        this.city.clearMonsterCache();

        // 初始化副本数据（BOSS 也登记为击杀目标，使面板进度与 submitTask 的 targetName 校验同源）
        this.trialData[this.play.id] = {
            name: name,
            startTime: Date.now(),
            targets: this.initializeTargets(trialConfig.target, trialConfig.boss),
            finished: false
        };

        // 清零本副本全部目标的历史击杀数（killCounts 是全局累计且随存档持久化，
        // 而副本走 acceptedTasks 直写、不经 acceptTask 的清零逻辑；不清零会让
        // submitTask 的 checkKillTask 命中历史残留击杀，进本 0 杀即可领奖）
        const resetNames = String(trialConfig.targetName || '').split(',')
            .map(s => s.trim()).filter(Boolean);
        if (trialConfig.target && Array.isArray(trialConfig.target.monsters)) {
            trialConfig.target.monsters.forEach(m => { if (m && m.name) resetNames.push(m.name); });
        }
        if (trialConfig.target && Array.isArray(trialConfig.target.items)) {
            trialConfig.target.items.forEach(it => { if (it && it.name) resetNames.push(it.name); });
        }
        if (trialConfig.boss && trialConfig.boss.name) {
            resetNames.push(trialConfig.boss.name);
        }
        // 【约束登记】副本目标怪名不得与普通打怪任务目标怪名重名，除非两者等级区间互斥；
        // killCounts 按怪名全局累计且随存档持久化，进本清零会抹掉同名普通任务的进度。
        // 已知唯一重名（剑齿虎：贝河精魄副本 30-40 级 vs task15#189 需 54 级）当前因等级互斥不可达。
        if (this.task && this.task.killCounts) {
            resetNames.forEach(n => {
                if (this.task.killCounts[n] !== undefined) this.task.killCounts[n] = 0;
            });
        }

        // 标记任务为已接受
        if (trialConfig.index !== undefined) {
            this.task.acceptedTasks[trialConfig.index] = true;
        }

        return { success: true, name: name, position: trialConfig.submitLocation, tip: teamTip };
    }

    // 初始化副本目标（boss 为本副本 BOSS 配置，登记为 monster 类目标；
    // 若 BOSS 已存在于 target.monsters（如牛头山的玄武骨妖）则跳过，避免重复登记）
    initializeTargets(target, boss) {
        target = target || {};
        const targets = {};

        // 初始化怪物目标
        if (target.monsters) {
            target.monsters.forEach(monster => {
                targets[`monster_${monster.name}`] = {
                    type: 'monster',
                    name: monster.name,
                    current: 0,
                    required: monster.quantity
                };
            });
        }

        // 初始化物品目标
        if (target.items) {
            target.items.forEach(item => {
                targets[`item_${item.name}`] = {
                    type: 'item',
                    name: item.name,
                    current: 0,
                    required: item.quantity
                };
            });
        }

        // 登记 BOSS 目标：_recordMonsterKill 自动计数、allCompleted 的 every() 自动含 BOSS
        if (boss && boss.name && !targets[`monster_${boss.name}`]) {
            targets[`monster_${boss.name}`] = {
                type: 'monster',
                name: boss.name,
                current: 0,
                required: boss.quantity || 1
            };
        }

        return targets;
    }

    // 获取玩家的副本数据
    getPlayerTrialData() {
        const data = this.trialData[this.play.id];
        // 收集类目标实时按背包内该物品数量计算进度（方案b：更稳，不怕重复计数/漏计，
        // 兼容碎片可堆叠 Goods.num、手动拾取、进本前已持有等情况）
        if (data && data.targets && this.task) {
            for (const key in data.targets) {
                const t = data.targets[key];
                if (t && t.type === 'item') {
                    t.current = this.task.getItemCount(t.name);
                }
            }
        }
        return data;
    }

    // 副本内击杀怪物时递增“打怪”类目标进度（内部方法，下划线前缀，禁止 exec 反射调用）。
    // 仅当玩家确实处于该副本内（trialData 激活且 city._city 是副本名）才计数，
    // 避免在野外击杀同名怪误增进度。对全部副本通用，无任何副本名硬编码。
    _recordMonsterKill(monsterName) {
        if (!monsterName) return;
        const data = this.trialData[this.play.id];
        if (!data || !data.targets) return;
        if (data.name !== this.city._city) return;
        for (const key in data.targets) {
            const t = data.targets[key];
            // 目标名精确匹配（initializeTargets 已按 target.monsters 逐项拆分，无需再拆逗号）
            if (t && t.type === 'monster' && t.name === monsterName && t.current < t.required) {
                t.current += 1;
            }
        }
    }

    // 获取副本配置信息
    getTrialConfig(name) {
        return config.trial.find(i => i.name === name);
    }

    // 是否在副本中
    isInTrial() {
        const trialNames = config.trial.map(t => t.name);
        return trialNames.includes(this.city._city);
    }

    // 获取剩余时间（秒）
    getRemainingTime() {
        const trialInfo = this.trialData[this.play.id];
        if (!trialInfo) return 0;

        const trialConfig = this.getTrialConfig(trialInfo.name);
        if (!trialConfig || !trialConfig.timeLimit) return 0;

        // 处理时间限制格式，例如 "50分钟"
        const timeLimitMinutes = parseInt(trialConfig.timeLimit);
        const elapsedMs = Date.now() - trialInfo.startTime;
        const remainingMs = timeLimitMinutes * 60 * 1000 - elapsedMs;

        return Math.max(0, Math.floor(remainingMs / 1000));
    }

    // 检查副本是否超时
    isTrialTimeout() {
        return this.getRemainingTime() <= 0;
    }

}