/**
 * 声望系统 - 玩家聲望、NPC態度、 Discounts, 特權
 */
export default class Reputation {
    constructor(play, database) {
        this.play = play;
        this.db = database;
        this.factions = {
            // 勢力定義
            blacksmithGuild: {
                name: '鍛造 guild',
                color: '#c0392b',
                description: '專門製作 weapons 和 armor 的行會',
                repValues: {
                    hated: -100,
                    hostile: -50,
                    unfriendly: -20,
                    neutral: 0,
                    friendly: 20,
                    honored: 50,
                    revered: 100,
                    exalted: 200
                },
                repLabels: {
                    [-100]: '憎恨',
                    [-50]: '敵對',
                    [-20]: '不友好',
                    [0]: '中立',
                    [20]: '友好',
                    [50]: '尊敬',
                    [100]: '崇敬',
                    [200]: '崇拜'
                },
                baseDiscount: 0,
                maxDiscount: 0.3, // 最大折扣30%
                quests: ['blacksmith_quest_1', 'blacksmith_quest_2'],
                rewards: ['blacksmith_discount', 'exclusive_weapon_blueprint']
            },
            alchemistCouncil: {
                name: '煉藥議會',
                color: '#8e44ad',
                description: '研究藥物和製作強力药剂的组织',
                repValues: {
                    hated: -100,
                    hostile: -50,
                    unfriendly: -20,
                    neutral: 0,
                    friendly: 20,
                    honored: 50,
                    revered: 100,
                    exalted: 200
                },
                repLabels: {
                    [-100]: '憎恨',
                    [-50]: '敵對',
                    [-20]: '不友好',
                    [0]: '中立',
                    [20]: '友好',
                    [50]: '尊敬',
                    [100]: '崇敬',
                    [200]: '崇拜'
                },
                baseDiscount: 0,
                maxDiscount: 0.25,
                quests: ['alchemy_quest_1'],
                rewards: ['alchemy_discout', 'legendary_potion_recipe']
            },
            merchantsUnion: {
                name: '商人公會',
                color: '#f39c12',
                description: '控制貿易和商業活動的行會',
                repValues: {
                    hated: -100,
                    hostile: -50,
                    unfriendly: -20,
                    neutral: 0,
                    friendly: 20,
                    honored: 50,
                    revered: 100,
                    exalted: 200
                },
                repLabels: {
                    [-100]: '憎恨',
                    [-50]: '敵對',
                    [-20]: '不友好',
                    [0]: '中立',
                    [20]: '友好',
                    [50]: '尊敬',
                    [100]: '崇敬',
                    [200]: '崇拜'
                },
                baseDiscount: 0,
                maxDiscount: 0.2,
                quests: ['merchant_quest_1'],
                rewards: ['merchant_discount', 'trade_route_access']
            },
            adventurerGuild: {
                name: '冒險者公會',
                color: '#27ae60',
                description: '組織冒險和危機應對的公會',
                repValues: {
                    hated: -100,
                    hostile: -50,
                    unfriendly: -20,
                    neutral: 0,
                    friendly: 20,
                    honored: 50,
                    revered: 100,
                    exalted: 200
                },
                repLabels: {
                    [-100]: '憎恨',
                    [-50]: '敵對',
                    [-20]: '不友好',
                    [0]: '中立',
                    [20]: '友好',
                    [50]: '尊敬',
                    [100]: '崇敬',
                    [200]: '崇拜'
                },
                baseDiscount: 0,
                maxDiscount: 0.15,
                quests: ['adventure_quest_1'],
                rewards: ['adventure_discount', 'special_mission_access']
            }
        };

        this.playerFactionRep = {}; // 玩家在各勢力的聲望
        this.reputationHistory = {}; // 聲望變化歷史
        this.reputationAchievements = {}; // 聲望成就
    }

    // 获取玩家在某勢力的聲望
    getFactionRep(factionId) {
        if (!this.playerFactionRep[factionId]) {
            this.playerFactionRep[factionId] = 0;
        }
        return this.playerFactionRep[factionId];
    }

    // 添加聲望
    addReputation(factionId, amount) {
        if (!this.factions[factionId]) {
            return { success: false, tip: '勢力不存在' };
        }

        const oldRep = this.getFactionRep(factionId);
        this.playerFactionRep[factionId] = this.playerFactionRep[factionId] + amount;

        const newRep = this.playerFactionRep[factionId];

        // 記錄歷史
        if (!this.reputationHistory[factionId]) {
            this.reputationHistory[factionId] = [];
        }
        this.reputationHistory[factionId].push({
            oldRep,
            newRep,
            change: amount,
            timestamp: Date.now(),
            source: 'manual'
        });

        // 檢查声望等级变化
        const oldLevel = this.getRepLevel(factionId, oldRep);
        const newLevel = this.getRepLevel(factionId, newRep);

        if (oldLevel !== newLevel) {
            this.onRepLevelChange(factionId, oldLevel, newLevel);
        }

        return {
            success: true,
            tip: `你的【${this.factions[factionId].name}】聲望${amount > 0 ? '增加' : '減少'}了${Math.abs(amount)}`,
            oldLevel,
            newLevel,
            oldRep,
            newRep
        };
    }

    // 获取聲望等级
    getRepLevel(factionId, repValue) {
        const faction = this.factions[factionId];
        if (!faction) return 'unknown';

        const repValues = faction.repValues;
        
        if (repValue <= repValues.hated) return 'hated';
        if (repValue <= repValues.hostile) return 'hostile';
        if (repValue <= repValues.unfriendly) return 'unfriendly';
        if (repValue <= repValues.neutral) return 'neutral';
        if (repValue <= repValues.friendly) return 'friendly';
        if (repValue <= repValues.honored) return 'honored';
        if (repValue <= repValues.revered) return 'revered';
        return 'exalted';
    }

    // 获取声望标签
    getRepLabel(factionId, repValue) {
        const faction = this.factions[factionId];
        if (!faction) return '未知';

        return faction.repLabels[repValue] || '中立';
    }

    // 声望等级变化回調
    onRepLevelChange(factionId, oldLevel, newLevel) {
        const faction = this.factions[factionId];
        const oldLabel = faction.repLabels[this.getRepLevel(factionId, oldLevel)];
        const newLabel = faction.repLabels[newLevel];

        // 發送通知
        if (this.db) {
            this.db.addNotification(this.play.id, {
                type: 'reputation_change',
                title: '聲望變化',
                content: `你的【${faction.name}】聲望從【${oldLabel}】提升至【${newLabel}】！`,
                factionId,
                oldLevel,
                newLevel,
                timestamp: Date.now()
            });
        }

        // 檢查成就
        this.checkReputationAchievements(factionId, newLevel);
    }

    // 檢查聲望成就
    checkReputationAchievements(factionId, newLevel) {
        const achievements = this.getReputationAchievements();
        const achievement = achievements.find(a => a.factionId === factionId && a.level === newLevel);

        if (achievement && !this.reputationAchievements[`${factionId}_${newLevel}`]) {
            this.reputationAchievements[`${factionId}_${newLevel}`] = {
                achievementId: achievement.id,
                factionId,
                level: newLevel,
                unlockedAt: Date.now()
            };

            // 發放獎励
            if (achievement.reward) {
                this.awardAchievementReward(achievement.reward);
            }
        }
    }

    // 获取聲望成就
    getReputationAchievements() {
        const factions = this.factions;
        const achievements = [];

        for (const factionId of Object.keys(factions)) {
            const faction = factions[factionId];
            
            for (const level of Object.keys(faction.repValues)) {
                const numericLevel = Number(level);
                achievements.push({
                    id: `rep_${factionId}_${numericLevel}`,
                    name: `${faction.name} ${faction.repLabels[numericLevel]}`,
                    description: `在【${faction.name}】中達到${faction.repLabels[numericLevel]}聲望`,
                    factionId,
                    level: numericLevel,
                    reward: this.getLevelReward(factionId, numericLevel)
                });
            }
        }

        return achievements;
    }

    // 获取等级奖励
    getLevelReward(factionId, level) {
        const rewards = {
            honored: { type: 'title', value: '尊敬者' },
            revered: { type: 'discount', value: 0.1 },
            exalted: { type: 'title', value: '崇拜者' }
        };

        return rewards[level] || null;
    }

    // 發放成就獎励
    awardAchievementReward(reward) {
        if (reward.type === 'title') {
            if (!this.play.titles) {
                this.play.titles = [];
            }
            if (!this.play.titles.includes(reward.value)) {
                this.play.titles.push(reward.value);
            }
        } else if (reward.type === 'discount') {
            // 自動應用折扣
        }
    }

    // 获取所有勢力聲望
    getAllFactionReputation() {
        const repData = [];

        for (const factionId of Object.keys(this.factions)) {
            const faction = this.factions[factionId];
            const rep = this.getFactionRep(factionId);
            const level = this.getRepLevel(factionId, rep);

            repData.push({
                factionId,
                factionName: faction.name,
                repValue: rep,
                repLevel: level,
                repLabel: faction.repLabels[level],
                color: faction.color,
                description: faction.description,
                discount: this.calculateDiscount(factionId),
                questProgress: this.getQuestProgress(factionId)
            });
        }

        return repData;
    }

    // 计算折扣
    calculateDiscount(factionId) {
        const faction = this.factions[factionId];
        if (!faction) return 0;

        const rep = this.getFactionRep(factionId);
        const neutralRep = faction.repValues.neutral;

        if (rep <= neutralRep) return 0;

        const repAboveNeutral = rep - neutralRep;
        const maxRepAboveNeutral = faction.repValues.exalted - neutralRep;
        
        const discountRatio = repAboveNeutral / maxRepAboveNeutral;
        return Math.min(faction.maxDiscount, faction.baseDiscount + discountRatio * faction.maxDiscount);
    }

    // 获取任務進度
    getQuestProgress(factionId) {
        // 從 Quest 系統獲取
        return { completed: 0, total: 0 };
    }

    // 通過任務增加聲望
    gainRepFromQuest(factionId, questId, repAmount) {
        const result = this.addReputation(factionId, repAmount);
        if (result.success) {
            // 記錄來源
            const history = this.reputationHistory[factionId];
            if (history && history.length > 0) {
                history[history.length - 1].source = questId;
            }
        }
        return result;
    }

    // 通過交易增加聲望
    gainRepFromTrade(factionId, repPerTrade) {
        this.addReputation(factionId, repPerTrade);
    }

    // 聲望排行
    getReputationRanking(limit = 10) {
        const rankings = Object.entries(this.playerFactionRep)
            .map(([factionId, rep]) => ({
                factionId,
                factionName: this.factions[factionId].name,
                rep,
                level: this.getRepLevel(factionId, rep)
            }))
            .filter(f => f.level !== 'hated' && f.level !== 'hostile')
            .sort((a, b) => b.rep - a.rep)
            .slice(0, limit);

        rankings.forEach((r, index) => {
            r.rank = index + 1;
        });

        return rankings;
    }

    // 獲取声望歷史
    getReputationHistory(factionId, limit = 20) {
        const history = this.reputationHistory[factionId];
        if (!history) return [];

        return history.slice(-limit).map(entry => ({
            ...entry,
            oldLevel: this.getRepLevel(factionId, entry.oldRep),
            newLevel: this.getRepLevel(factionId, entry.newRep)
        }));
    }

    // 重置聲望（用於 Debug）
    resetFactionRep(factionId) {
        if (!this.factions[factionId]) {
            return { success: false, tip: '勢力不存在' };
        }

        this.playerFactionRep[factionId] = 0;
        return { success: true, tip: `【${this.factions[factionId].name}】聲望已重置為中立` };
    }

    // 获取特權
    getPrivileges() {
        const privileges = [];
        const allFactionRep = this.getAllFactionReputation();

        allFactionRep.forEach(f => {
            if (f.repLevel === 'honored' || f.repLevel === 'revered' || f.repLevel === 'exalted') {
                privileges.push({
                    type: 'discount',
                    name: `${f.factionName}優惠`,
                    description: `在${f.factionName}獲得${Math.round(f.discount * 100)}%折扣`,
                    factionId: f.factionId
                });
            }

            if (f.repLevel === 'revered' || f.repLevel === 'exalted') {
                privileges.push({
                    type: 'quest_access',
                    name: `${f.factionName}高級任務`,
                    description: `可以接取${f.factionName}的高級任務`,
                    factionId: f.factionId
                });
            }

            if (f.repLevel === 'exalted') {
                privileges.push({
                    type: 'title',
                    name: `獲得稱號：${f.factionName}崇拜者`,
                    description: `成為${f.factionName}的崇拜者，享有最高待遇`,
                    factionId: f.factionId
                });
            }
        });

        return privileges;
    }
}
