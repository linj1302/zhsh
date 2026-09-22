/**
 * 帮会战系统 - 帮会对抗、领土争夺、帮会排行榜
 */
export default class GangWar {
    constructor(gang, database) {
        this.gang = gang;
        this.db = database;
        this.wars = {}; // 活跃的帮会战
        this.territories = {}; // 领土状态
        this.gangActivity = {}; // 帮会活动记录
    }

    // 创建帮会战
    createWar(opponentGangId, warType, duration) {
        const myGangId = this.gang.id;
        if (!myGangId) return { success: false, tip: '你不在帮会中' };

        if (!this.gang.hasPermission('leader')) {
            return { success: false, tip: '只有帮主可以发起帮会战' };
        }

        const opponentGang = this.db.getGangById(opponentGangId);
        if (!opponentGang) {
            return { success: false, tip: '帮会不存在' };
        }

        if (opponentGangId === myGangId) {
            return { success: false, tip: '不能与自己的帮会开战' };
        }

        // 检查是否已有活跃的战争
        const existingWar = this.getActiveWar(myGangId);
        if (existingWar) {
            return { success: false, tip: '已有活跃的帮会战，无法发起新的' };
        }

        const war = {
            id: Date.now(),
            type: warType, // 'territory', 'battle', 'resource'
            attackerGangId: myGangId,
            attackerGangName: this.gang.name,
            defenderGangId: opponentGangId,
            defenderGangName: opponentGang.name,
            startTime: Date.now(),
            endTime: Date.now() + duration * 24 * 60 * 60 * 1000, // 持续天数
            status: 'active',
            attackerScore: 0,
            defenderScore: 0,
            territoryId: warType === 'territory' ? this.generateTerritoryId() : null,
            logs: []
        };

        this.wars[war.id] = war;

        // 通知对方帮会
        this.notifyGangWar(opponentGangId, war);

        return {
            success: true,
            tip: `成功向【${opponentGang.name}】发起${this.getWarTypeName(warType)}！`,
            warId: war.id,
            startTime: war.startTime,
            endTime: war.endTime
        };
    }

    // 获取活跃的帮会战
    getActiveWar(gangId) {
        return Object.values(this.wars).find(w =>
            w.status === 'active' &&
            (w.attackerGangId === gangId || w.defenderGangId === gangId)
        );
    }

    // 帮会战类型名称
    getWarTypeName(type) {
        const names = {
            territory: '领土争夺战',
            battle: '帮会决斗',
            resource: '资源争夺战'
        };
        return names[type] || '帮会战';
    }

    // 生成领土ID
    generateTerritoryId() {
        const territories = Object.values(this.territories);
        const usedIds = territories.map(t => t.id);
        for (let i = 1; i <= 100; i++) {
            if (!usedIds.includes(i)) return i;
        }
        return Date.now();
    }

    // 通知帮会战
    notifyGangWar(gangId, war) {
        if (this.db) {
            this.db.addNotification(gangId, {
                type: 'gang_war',
                title: '帮会战通知',
                content: `你的帮会收到了来自【${war.attackerGangName}】的${this.getWarTypeName(war.type)}邀请`,
                warId: war.id,
                timestamp: Date.now()
            });
        }
    }

    // 获取帮会战详情
    getWarDetail(warId) {
        const war = this.wars[warId];
        if (!war) return null;

        const isAttacker = war.attackerGangId === this.gang.id;
        const isDefender = war.defenderGangId === this.gang.id;
        const myScore = isAttacker ? war.attackerScore : war.defenderScore;
        const opponentScore = isAttacker ? war.defenderScore : war.attackerScore;

        return {
            id: war.id,
            type: war.type,
            warTypeName: this.getWarTypeName(war.type),
            opponentName: isAttacker ? war.defenderGangName : war.attackerGangName,
            myGangName: this.gang.name,
            myScore,
            opponentScore,
            scoreDiff: myScore - opponentScore,
            startTime: war.startTime,
            endTime: war.endTime,
            remainingHours: Math.ceil((war.endTime - Date.now()) / (1000 * 60 * 60)),
            status: war.status,
            canContribute: war.status === 'active' && (isAttacker || isDefender)
        };
    }

    // 为帮会战贡献
    contribute(warId, contributionType, amount) {
        const war = this.wars[warId];
        if (!war) return { success: false, tip: '帮会战不存在' };

        if (war.status !== 'active') {
            return { success: false, tip: '帮会战已结束' };
        }

        const myGangId = this.gang.id;
        if (!myGangId) return { success: false, tip: '你不在帮会中' };

        const isAttacker = war.attackerGangId === myGangId;
        const isDefender = war.defenderGangId === myGangId;

        if (!isAttacker && !isDefender) {
            return { success: false, tip: '你不在这场帮会战的相关帮会中' };
        }

        // 检查资源
        if (contributionType === 'copper') {
            if (this.gang.getPlay().copper < amount) {
                return { success: false, tip: '铜币不足' };
            }
            this.gang.getPlay().addCopper(-amount);
        } else if (contributionType === 'exp') {
            // 经验贡献消耗
            this.gang.getPlay().addExp(-amount);
        }

        // 计算贡献值
        const contributionValue = this.calculateContributionValue(contributionType, amount);
        
        if (isAttacker) {
            war.attackerScore += contributionValue;
        } else {
            war.defenderScore += contributionValue;
        }

        // 记录贡献日志
        war.logs.push({
            timestamp: Date.now(),
            gangId: myGangId,
            gangName: this.gang.name,
            userId: this.gang.getPlay().id,
            userName: this.gang.getPlay().nickname,
            type: contributionType,
            amount: amount,
            value: contributionValue
        });

        return {
            success: true,
            tip: `成功贡献${amount}${contributionType}，获得${contributionValue}分`,
            score: isAttacker ? war.attackerScore : war.defenderScore,
            remaining: Math.ceil((war.endTime - Date.now()) / (1000 * 60 * 60))
        };
    }

    // 计算贡献值
    calculateContributionValue(type, amount) {
        const multipliers = {
            copper: 0.1,
            exp: 0.05,
            item: 1
        };
        return Math.floor(amount * multipliers[type] || 0);
    }

    // 获取帮会战排行
    getWarRanking() {
        const activeWars = Object.values(this.wars).filter(w => w.status === 'active');

        return activeWars.map(war => {
            const isAttacker = war.attackerGangId === this.gang.id;
            const isDefender = war.defenderGangId === this.gang.id;

            return {
                warId: war.id,
                type: war.type,
                warTypeName: this.getWarTypeName(war.type),
                opponentName: isAttacker ? war.defenderGangName : war.attackerGangName,
                myScore: isAttacker ? war.attackerScore : war.defenderScore,
                opponentScore: isAttacker ? war.defenderScore : war.attackerScore,
                winning: (isAttacker && war.attackerScore > war.defenderScore) ||
                         (isDefender && war.defenderScore > war.attackerScore),
                remainingHours: Math.ceil((war.endTime - Date.now()) / (1000 * 60 * 60))
            };
        });
    }

    // 获取领土状态
    getTerritoryStatus(territoryId) {
        const territory = this.territories[territoryId];
        if (!territory) return null;

        return {
            id: territory.id,
            name: territory.name,
            ownerGangId: territory.ownerGangId,
            ownerGangName: territory.ownerGangName,
            controlValue: territory.controlValue,
            maxControlValue: territory.maxControlValue,
            controllingFactions: territory.controllingFactions,
            lastUpdated: territory.lastUpdated
        };
    }

    // 開始領土爭奪
    startTerritoryWar(territoryId) {
        const territory = this.territories[territoryId];
        if (!territory) {
            return { success: false, tip: '领土不存在' };
        }

        if (territory.ownerGangId === this.gang.id) {
            return { success: false, tip: '你已是该领土的拥有者' };
        }

        // 创建领土战
        const war = this.createWar(territory.ownerGangId, 'territory', 7);
        if (war.success) {
            war.territoryId = territoryId;
            war.territoryName = territory.name;
        }

        return war;
    }

    // 获取帮会活动统计
    getGangActivityStats() {
        const activities = this.gangActivity[this.gang.id] || [];
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        const recentActivities = activities.filter(a => a.timestamp >= oneWeekAgo);

        return {
            totalActivities: activities.length,
            weeklyActivities: recentActivities.length,
            weeklyWarParticipations: recentActivities.filter(a => a.type === 'war').length,
            weeklyDonations: recentActivities.filter(a => a.type === 'donation').length,
            weeklyContributions: recentActivities.filter(a => a.type === 'contribution').length,
            topContributors: this.getTopContributors()
        };
    }

    // 获取顶级贡献者
    getTopContributors() {
        const activities = this.gangActivity[this.gang.id] || [];
        const contributorStats = {};

        activities.forEach(a => {
            if (!contributorStats[a.userId]) {
                contributorStats[a.userId] = {
                    userId: a.userId,
                    userName: a.userName,
                    totalValue: 0,
                    activityCount: 0
                };
            }
            contributorStats[a.userId].totalValue += a.value;
            contributorStats[a.userId].activityCount++;
        });

        return Object.values(contributorStats)
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 10);
    }

    // 记录帮会活动
    recordActivity(type, data) {
        if (!this.gangActivity[this.gang.id]) {
            this.gangActivity[this.gang.id] = [];
        }

        this.gangActivity[this.gang.id].push({
            timestamp: Date.now(),
            type,
            ...data
        });
    }

    // 获取帮会战历史
    getWarHistory(limit = 10) {
        const allWars = Object.values(this.wars)
            .filter(w => w.status !== 'active')
            .sort((a, b) => b.endTime - a.endTime)
            .slice(0, limit);

        return allWars.map(war => ({
            warId: war.id,
            type: war.type,
            warTypeName: this.getWarTypeName(war.type),
            opponentName: war.attackerGangId === this.gang.id ? war.defenderGangName : war.attackerGangName,
            myScore: war.attackerGangId === this.gang.id ? war.attackerScore : war.defenderScore,
            opponentScore: war.attackerGangId === this.gang.id ? war.defenderScore : war.attackerScore,
            won: war.attackerScore > war.defenderScore || war.defenderScore > war.attackerScore,
            endTime: war.endTime
        }));
    }
}
