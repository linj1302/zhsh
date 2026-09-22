/**
 * 排行榜系统 - 综合排行榜
 * 包含等级、财富、战斗力、宠物、卡片、成就等 20+ 个榜单
 */
export default class Ranking {
    constructor(database) {
        this.db = database;
    }

    /**
     * 获取所有用户数据
     * @returns {Array} 用户数据列表
     */
    getAllUserData() {
        try {
            const sql = 'SELECT user_id, data FROM user_data';
            const rows = this.db.executeSQL(sql, [], 'all');
            return rows.map(row => {
                try {
                    const data = JSON.parse(row.data);
                    data.user_id = row.user_id;
                    return data;
                } catch (e) {
                    return null;
                }
            }).filter(d => d !== null);
        } catch (error) {
            console.error('获取所有用户数据失败:', error);
            return [];
        }
    }

    /**
     * 获取用户名
     * @param {number} userId - 用户ID
     * @returns {string} 用户名
     */
    getUsername(userId) {
        try {
            const sql = 'SELECT username FROM users WHERE id = ?';
            const row = this.db.executeSQL(sql, [userId], 'get');
            return row ? row.username : `玩家${userId}`;
        } catch (e) {
            return `玩家${userId}`;
        }
    }

    /**
     * 构建排行榜
     * @param {Array} dataList - 数据列表 [{userId, name, value}, ...]
     * @param {number} limit - 返回前N名
     * @returns {Array} 排序后的排行榜
     */
    buildRanking(dataList, limit = 30) {
        return dataList
            .sort((a, b) => b.value - a.value)
            .slice(0, limit)
            .map((item, index) => ({
                rank: index + 1,
                userId: item.userId,
                name: item.name,
                value: item.value
            }));
    }

    /**
     * 等级排行榜
     */
    getLevelRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.play?.level || 1
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 经验排行榜
     */
    getExpRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.play?.exp || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 铜币排行榜（财富榜）
     */
    getCopperRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.play?.copper || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 声望排行榜
     */
    getReputationRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.play?.reputation || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 幸运值排行榜
     */
    getLuckRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.play?.luck || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 战斗力排行榜（基于装备属性）
     */
    getCombatPowerRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => {
            // 计算战斗力：等级 + 装备属性总和
            const level = u.play?.level || 1;
            const equip = u.play?.equipProperty || {};
            const equipPower = (equip.attack || 0) + (equip.defense || 0) + 
                              (equip.agility || 0) + (equip.morale || 0) + (equip.health || 0);
            const combatPower = level * 100 + equipPower * 10;
            return {
                userId: u.user_id,
                name: u.nickname || this.getUsername(u.user_id),
                value: combatPower
            };
        });
        return this.buildRanking(dataList, limit);
    }

    /**
     * 宠物数量排行榜
     */
    getPetCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.petManager?.pets?.length || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 最高宠物等级排行榜
     */
    getMaxPetLevelRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => {
            const pets = u.petManager?.pets || [];
            const maxLevel = pets.reduce((max, p) => Math.max(max, p.level || 1), 0);
            return {
                userId: u.user_id,
                name: u.nickname || this.getUsername(u.user_id),
                value: maxLevel
            };
        });
        return this.buildRanking(dataList, limit);
    }

    /**
     * 卡片收集排行榜
     */
    getCardCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.card?.cards?.length || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 圣痕收集排行榜
     */
    getHolyMarkCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.holymark?.marks?.length || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 装备强化排行榜（最高强化等级）
     */
    getMaxStrengthenRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => {
            const backpack = u.backpack?.items || [];
            const equips = backpack.filter(i => i.type === 'equipment');
            const maxLevel = equips.reduce((max, e) => Math.max(max, e.strengthenLevel || 0), 0);
            return {
                userId: u.user_id,
                name: u.nickname || this.getUsername(u.user_id),
                value: maxLevel
            };
        });
        return this.buildRanking(dataList, limit);
    }

    /**
     * 装备觉醒排行榜（觉醒装备数量）
     */
    getAwakenCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => {
            const backpack = u.backpack?.items || [];
            const equips = backpack.filter(i => i.type === 'equipment');
            const awakenCount = equips.filter(e => e.awakened && e.awakened.length > 0).length;
            return {
                userId: u.user_id,
                name: u.nickname || this.getUsername(u.user_id),
                value: awakenCount
            };
        });
        return this.buildRanking(dataList, limit);
    }

    /**
     * 好友数量排行榜
     */
    getFriendCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.play?.friends?.length || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 成就完成数排行榜
     */
    getAchievementCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.achievement?.completedCount || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 任务完成数排行榜
     */
    getTaskCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.task?.completedTasks?.length || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 钓鱼等级排行榜
     */
    getFishingLevelRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.fish?.fishingLevel || 1
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 钓鱼总数排行榜
     */
    getFishCaughtRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.fish?.totalFishCaught || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 坐骑数量排行榜
     */
    getMountCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.mount?.mounts?.length || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 羽翼等级排行榜
     */
    getWingLevelRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.wing?.level || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 随从数量排行榜
     */
    getFollowerCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.follower?.followers?.length || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 最高随从等级排行榜
     */
    getMaxFollowerLevelRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => {
            const followers = u.follower?.followers || [];
            const maxLevel = followers.reduce((max, f) => Math.max(max, f.level || 1), 0);
            return {
                userId: u.user_id,
                name: u.nickname || this.getUsername(u.user_id),
                value: maxLevel
            };
        });
        return this.buildRanking(dataList, limit);
    }

    /**
     * 怪物击杀排行榜
     */
    getKillCountRanking(limit = 30) {
        const users = this.getAllUserData();
        const dataList = users.map(u => ({
            userId: u.user_id,
            name: u.nickname || this.getUsername(u.user_id),
            value: u.play?.killCount || 0
        }));
        return this.buildRanking(dataList, limit);
    }

    /**
     * 获取所有排行榜汇总
     * @returns {Object} 所有排行榜数据
     */
    getAllRankings(limit = 30) {
        return {
            level: { name: '等级排行榜', data: this.getLevelRanking(limit) },
            exp: { name: '经验排行榜', data: this.getExpRanking(limit) },
            copper: { name: '财富排行榜', data: this.getCopperRanking(limit) },
            reputation: { name: '声望排行榜', data: this.getReputationRanking(limit) },
            luck: { name: '幸运值排行榜', data: this.getLuckRanking(limit) },
            combatPower: { name: '战斗力排行榜', data: this.getCombatPowerRanking(limit) },
            petCount: { name: '宠物数量排行榜', data: this.getPetCountRanking(limit) },
            maxPetLevel: { name: '最高宠物等级排行榜', data: this.getMaxPetLevelRanking(limit) },
            cardCount: { name: '卡片收集排行榜', data: this.getCardCountRanking(limit) },
            holyMarkCount: { name: '圣痕收集排行榜', data: this.getHolyMarkCountRanking(limit) },
            maxStrengthen: { name: '装备强化排行榜', data: this.getMaxStrengthenRanking(limit) },
            awakenCount: { name: '装备觉醒排行榜', data: this.getAwakenCountRanking(limit) },
            friendCount: { name: '好友数量排行榜', data: this.getFriendCountRanking(limit) },
            achievementCount: { name: '成就完成排行榜', data: this.getAchievementCountRanking(limit) },
            taskCount: { name: '任务完成排行榜', data: this.getTaskCountRanking(limit) },
            fishingLevel: { name: '钓鱼等级排行榜', data: this.getFishingLevelRanking(limit) },
            fishCaught: { name: '钓鱼总数排行榜', data: this.getFishCaughtRanking(limit) },
            mountCount: { name: '坐骑数量排行榜', data: this.getMountCountRanking(limit) },
            wingLevel: { name: '羽翼等级排行榜', data: this.getWingLevelRanking(limit) },
            followerCount: { name: '随从数量排行榜', data: this.getFollowerCountRanking(limit) },
            maxFollowerLevel: { name: '最高随从等级排行榜', data: this.getMaxFollowerLevelRanking(limit) },
            killCount: { name: '怪物击杀排行榜', data: this.getKillCountRanking(limit) }
        };
    }

    /**
     * 获取指定排行榜
     * @param {string} type - 排行榜类型
     * @returns {Object} 排行榜数据
     */
    getRanking(type, limit = 30) {
        const methods = {
            level: 'getLevelRanking',
            exp: 'getExpRanking',
            copper: 'getCopperRanking',
            reputation: 'getReputationRanking',
            luck: 'getLuckRanking',
            combatPower: 'getCombatPowerRanking',
            petCount: 'getPetCountRanking',
            maxPetLevel: 'getMaxPetLevelRanking',
            cardCount: 'getCardCountRanking',
            holyMarkCount: 'getHolyMarkCountRanking',
            maxStrengthen: 'getMaxStrengthenRanking',
            awakenCount: 'getAwakenCountRanking',
            friendCount: 'getFriendCountRanking',
            achievementCount: 'getAchievementCountRanking',
            taskCount: 'getTaskCountRanking',
            fishingLevel: 'getFishingLevelRanking',
            fishCaught: 'getFishCaughtRanking',
            mountCount: 'getMountCountRanking',
            wingLevel: 'getWingLevelRanking',
            followerCount: 'getFollowerCountRanking',
            maxFollowerLevel: 'getMaxFollowerLevelRanking',
            killCount: 'getKillCountRanking'
        };

        const method = methods[type];
        if (method && this[method]) {
            return {
                type,
                name: this.getRankingName(type),
                data: this[method](limit)
            };
        }
        return null;
    }

    /**
     * 获取排行榜中文名
     */
    getRankingName(type) {
        const names = {
            level: '等级排行榜',
            exp: '经验排行榜',
            copper: '财富排行榜',
            reputation: '声望排行榜',
            luck: '幸运值排行榜',
            combatPower: '战斗力排行榜',
            petCount: '宠物数量排行榜',
            maxPetLevel: '最高宠物等级排行榜',
            cardCount: '卡片收集排行榜',
            holyMarkCount: '圣痕收集排行榜',
            maxStrengthen: '装备强化排行榜',
            awakenCount: '装备觉醒排行榜',
            friendCount: '好友数量排行榜',
            achievementCount: '成就完成排行榜',
            taskCount: '任务完成排行榜',
            fishingLevel: '钓鱼等级排行榜',
            fishCaught: '钓鱼总数排行榜',
            mountCount: '坐骑数量排行榜',
            wingLevel: '羽翼等级排行榜',
            followerCount: '随从数量排行榜',
            maxFollowerLevel: '最高随从等级排行榜',
            killCount: '怪物击杀排行榜'
        };
        return names[type] || '排行榜';
    }

    /**
     * 获取所有排行榜类型列表
     */
    getRankingTypes() {
        return [
            { type: 'level', name: '等级', icon: '🎖️' },
            { type: 'exp', name: '经验', icon: '✨' },
            { type: 'copper', name: '财富', icon: '💰' },
            { type: 'reputation', name: '声望', icon: '🏆' },
            { type: 'luck', name: '幸运', icon: '🍀' },
            { type: 'combatPower', name: '战斗力', icon: '⚔️' },
            { type: 'killCount', name: '击杀', icon: '💀' },
            { type: 'petCount', name: '宠物数', icon: '🐾' },
            { type: 'maxPetLevel', name: '宠物等级', icon: '🐲' },
            { type: 'cardCount', name: '卡片', icon: '🃏' },
            { type: 'holyMarkCount', name: '圣痕', icon: '✝️' },
            { type: 'maxStrengthen', name: '强化', icon: '🔨' },
            { type: 'awakenCount', name: '觉醒', icon: '🌟' },
            { type: 'friendCount', name: '好友', icon: '👥' },
            { type: 'achievementCount', name: '成就', icon: '🏅' },
            { type: 'taskCount', name: '任务', icon: '📜' },
            { type: 'fishingLevel', name: '钓鱼等级', icon: '🎣' },
            { type: 'fishCaught', name: '钓鱼数', icon: '🐟' },
            { type: 'mountCount', name: '坐骑', icon: '🐎' },
            { type: 'wingLevel', name: '羽翼', icon: '🪽' },
            { type: 'followerCount', name: '随从数', icon: '👤' },
            { type: 'maxFollowerLevel', name: '随从等级', icon: '🛡️' }
        ];
    }
}
