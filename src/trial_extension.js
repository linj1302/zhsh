/**
 * 副本系统扩展 - 奖励机制、进度保存、成就系统
 */
import * as config from '../config/index.js';
import Trial from './trial.js';

export default class TrialExtension {
    constructor(trial, play) {
        this.trial = trial;
        this.play = play;
        this.completedTrials = {}; // 已完成副本记录
        this.trialProgress = {}; // 副本内进度保存
        this.trialAchievements = {}; // 副本相关成就
    }

    // 获取副本奖励配置
    getTrialReward(name) {
        const trialConfig = config.trial.find(t => t.name === name);
        if (!trialConfig) return null;

        return {
            expReward: this.calculateExpReward(trialConfig),
            copperReward: this.calculateCopperReward(trialConfig),
            itemRewards: this.getItemRewards(trialConfig),
            achievementRewards: this.getAchievementRewards(trialConfig)
        };
    }

    // 计算经验奖励
    calculateExpReward(trialConfig) {
        const baseExp = trialConfig.expReward || 1000;
        const levelBonus = this.play.level * 10;
        return baseExp + levelBonus;
    }

    // 计算铜币奖励
    calculateCopperReward(trialConfig) {
        const baseCopper = trialConfig.copperReward || 500;
        const levelBonus = this.play.level * 5;
        return baseCopper + levelBonus;
    }

    // 获取物品奖励
    getItemRewards(trialConfig) {
        return trialConfig.rewards || [];
    }

    // 获取成就奖励
    getAchievementRewards(trialConfig) {
        const achievementConfig = config.achievements?.find(a => a.trial === trialConfig.name);
        return achievementConfig ? {
            achievementId: achievementConfig.id,
            achievementName: achievementConfig.name,
            points: achievementConfig.points
        } : null;
    }

    // 保存副本进度
    saveTrialProgress() {
        const trialData = this.trial.getPlayerTrialData();
        if (!trialData) return;

        // 保存进度到localStorage或数据库
        const progress = {
            trialName: trialData.name,
            startTime: trialData.startTime,
            targets: trialData.targets,
            finished: trialData.finished,
            playerLevel: this.play.level,
            playerExp: this.play.exp,
            playerHealth: this.play.currentHealth,
            playerPosition: this.trial.city._position,
            lastUpdate: Date.now()
        };

        this.trialProgress[this.play.id] = progress;

        // 持久化保存
        if (window.localStorage) {
            try {
                localStorage.setItem(`trial_progress_${this.play.id}`, JSON.stringify(progress));
            } catch (e) {
                console.warn('保存副本进度失败:', e);
            }
        }

        return progress;
    }

    // 加载副本进度
    loadTrialProgress() {
        if (window.localStorage) {
            try {
                const saved = localStorage.getItem(`trial_progress_${this.play.id}`);
                if (saved) {
                    const progress = JSON.parse(saved);
                    this.trialProgress[this.play.id] = progress;
                    return progress;
                }
            } catch (e) {
                console.warn('加载副本进度失败:', e);
            }
        }

        return this.trialProgress[this.play.id] || null;
    }

    // 检查副本完成
    checkTrialComplete() {
        const trialData = this.trial.getPlayerTrialData();
        if (!trialData) return null;

        // 检查所有目标是否完成
        const targets = trialData.targets;
        if (!targets) return null;

        let allComplete = true;
        let incompleteTargets = [];

        for (const key in targets) {
            const target = targets[key];
            if (target.current < target.required) {
                allComplete = false;
                incompleteTargets.push({
                    name: target.name,
                    current: target.current,
                    required: target.required
                });
            }
        }

        if (allComplete) {
            // 标记完成
            trialData.finished = true;
            this.completedTrials[trialData.name] = {
                completedAt: Date.now(),
                playerLevel: this.play.level,
                targets: targets
            };

            // 清除保存的进度
            delete this.trialProgress[this.play.id];

            return {
                completed: true,
                trialName: trialData.name,
                targets: targets,
                reward: this.getTrialReward(trialData.name)
            };
        }

        return {
            completed: false,
            incompleteTargets: incompleteTargets
        };
    }

    // 获取副本完成奖励
    getCompletionReward(trialName) {
        return this.getTrialReward(trialName);
    }

    // 分配奖励给玩家
    distributeReward(trialName) {
        const reward = this.getTrialReward(trialName);
        if (!reward) return { success: false, tip: '副本奖励未找到' };

        // 发放经验
        if (reward.expReward > 0) {
            this.play.addExp(reward.expReward);
        }

        // 发放铜币
        if (reward.copperReward > 0) {
            this.play.addCopper(reward.copperReward);
        }

        // 发放物品
        if (reward.itemRewards && reward.itemRewards.length > 0) {
            reward.itemRewards.forEach(item => {
                this.play.backpack.addItem(item);
            });
        }

        return {
            success: true,
            tip: `副本奖励已发放：+${reward.expReward}经验，+${reward.copperReward}铜币`,
            reward: reward
        };
    }

    // 获取副本成就进度
    getTrialAchievementProgress() {
        const achievements = config.achievements || [];
        const player = this.play;

        return achievements.filter(a => a.trial).map(a => {
            const trialConfig = config.trial.find(t => t.name === a.trial);
            if (!trialConfig) return null;

            const completed = this.completedTrials[a.trial];
            const progress = completed ? {
                completed: true,
                completedAt: completed.completedAt,
                playerLevel: completed.playerLevel
            } : {
                completed: false,
                requiredLevel: trialConfig.levelRequirement,
                currentLevel: player.level
            };

            return {
                id: a.id,
                name: a.name,
                description: a.description,
                points: a.points,
                progress: progress
            };
        }).filter(Boolean);
    }

    // 获取副本统计
    getTrialStats() {
        const completedTrials = Object.keys(this.completedTrials);
        const allTrials = config.trial || [];

        return {
            totalTrials: allTrials.length,
            completedTrials: completedTrials.length,
            completionRate: allTrials.length > 0 ? Math.round(completedTrials.length / allTrials.length * 100) : 0,
            bestClearTime: this.getBestClearTime(),
            totalExpEarned: this.calculateTotalExpEarned(),
            totalCopperEarned: this.calculateTotalCopperEarned()
        };
    }

    // 获取最佳完成时间
    getBestClearTime() {
        const completedTrials = Object.values(this.completedTrials);
        if (completedTrials.length === 0) return null;

        let bestTime = Infinity;
        let bestTrial = null;

        completedTrials.forEach(trial => {
            const timeMs = Date.now() - trial.completedAt;
            if (timeMs < bestTime) {
                bestTime = timeMs;
                bestTrial = trial;
            }
        });

        return {
            trialName: bestTrial?.name,
            timeSeconds: Math.round(bestTime / 1000)
        };
    }

    // 计算总获得经验
    calculateTotalExpEarned() {
        const completedTrials = Object.values(this.completedTrials);
        return completedTrials.reduce((total, trial) => {
            const reward = this.getTrialReward(trial.name);
            return total + (reward?.expReward || 0);
        }, 0);
    }

    // 计算总获得铜币
    calculateTotalCopperEarned() {
        const completedTrials = Object.values(this.completedTrials);
        return completedTrials.reduce((total, trial) => {
            const reward = this.getTrialReward(trial.name);
            return total + (reward?.copperReward || 0);
        }, 0);
    }

    // 获取未完成的副本列表
    getIncompleteTrials() {
        const allTrials = config.trial || [];
        const completedNames = Object.keys(this.completedTrials);

        return allTrials.filter(t => !completedNames.includes(t.name));
    }

    // 重置副本进度（用于debug）
    resetTrialProgress() {
        this.trialProgress = {};
        if (window.localStorage) {
            try {
                localStorage.removeItem(`trial_progress_${this.play.id}`);
            } catch (e) {}
        }
        return { success: true, tip: '副本进度已重置' };
    }
}
