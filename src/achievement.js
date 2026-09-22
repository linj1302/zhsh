/**
 * 成就系统模块
 * 实现成就获取、领取奖励、成就展示等功能
 */

export default class Achievement {
    constructor(userId, database, play, backpack) {
        this.userId = userId;
        this.db = database;
        this.play = play;
        this.backpack = backpack;
    }

    /**
     * 获取所有成就配置列表
     * @returns {Array} 成就配置
     */
    getAchievementList() {
        return [
            // === 等级成就 ===
            {
                id: 'level_10',
                category: '等级',
                name: '初出茅庐',
                description: '角色等级达到10级',
                condition: { type: 'level', value: 10 },
                rewards: { stamina: 50, achievementPoints: 10 },
                icon: '🌱'
            },
            {
                id: 'level_50',
                category: '等级',
                name: '江湖小侠',
                description: '角色等级达到50级',
                condition: { type: 'level', value: 50 },
                rewards: { stamina: 200, achievementPoints: 30 },
                icon: '⚔️'
            },
            {
                id: 'level_100',
                category: '等级',
                name: '一代宗师',
                description: '角色等级达到100级',
                condition: { type: 'level', value: 100 },
                rewards: { stamina: 500, achievementPoints: 50, trait: '宗师气度' },
                icon: '👑'
            },
            {
                id: 'level_150',
                category: '等级',
                name: '武林至尊',
                description: '角色等级达到150级',
                condition: { type: 'level', value: 150 },
                rewards: { stamina: 1000, achievementPoints: 80, trait: '至尊威压' },
                icon: '🔱'
            },
            {
                id: 'level_200',
                category: '等级',
                name: '超凡入圣',
                description: '角色等级达到200级',
                condition: { type: 'level', value: 200 },
                rewards: { stamina: 2000, achievementPoints: 100, trait: '圣者光环' },
                icon: '🌟'
            },

            // === 财富成就 ===
            {
                id: 'gold_1000',
                category: '财富',
                name: '腰缠万贯',
                description: '拥有1000金贝',
                condition: { type: 'gold', value: 1000 },
                rewards: { achievementPoints: 20 },
                icon: '💰'
            },
            {
                id: 'gold_10000',
                category: '财富',
                name: '富甲一方',
                description: '拥有10000金贝',
                condition: { type: 'gold', value: 10000 },
                rewards: { achievementPoints: 50, trait: '富贵逼人' },
                icon: '💎'
            },

            // === 声望成就 ===
            {
                id: 'reputation_100',
                category: '声望',
                name: '声名鹊起',
                description: '声望达到100',
                condition: { type: 'reputation', value: 100 },
                rewards: { stamina: 100, achievementPoints: 15 },
                icon: '📢'
            },
            {
                id: 'reputation_500',
                category: '声望',
                name: '名满天下',
                description: '声望达到500',
                condition: { type: 'reputation', value: 500 },
                rewards: { stamina: 500, achievementPoints: 40, trait: '名士风流' },
                icon: '🏆'
            },

            // === 战斗成就 ===
            {
                id: 'monster_100',
                category: '战斗',
                name: '百战勇士',
                description: '累计击败100个怪物',
                condition: { type: 'monsterKills', value: 100 },
                rewards: { stamina: 100, achievementPoints: 20 },
                icon: '💀'
            },
            {
                id: 'monster_500',
                category: '战斗',
                name: '屠魔勇士',
                description: '累计击败500个怪物',
                condition: { type: 'monsterKills', value: 500 },
                rewards: { stamina: 300, achievementPoints: 40 },
                icon: '🗡️'
            },
            {
                id: 'monster_1000',
                category: '战斗',
                name: '万人斩',
                description: '累计击败1000个怪物',
                condition: { type: 'monsterKills', value: 1000 },
                rewards: { stamina: 600, achievementPoints: 60, trait: '杀神' },
                icon: '☠️'
            },

            // === 帮会成就 ===
            {
                id: 'gang_join',
                category: '帮会',
                name: '有组织的人',
                description: '加入一个帮会',
                condition: { type: 'gangMember', value: true },
                rewards: { stamina: 50, achievementPoints: 10 },
                icon: '🏠'
            },
            {
                id: 'gang_leader',
                category: '帮会',
                name: '一帮之主',
                description: '成为帮主',
                condition: { type: 'gangLeader', value: true },
                rewards: { stamina: 200, achievementPoints: 30, trait: '领袖气质' },
                icon: '👔'
            },

            // === 社交成就 ===
            {
                id: 'friend_10',
                category: '社交',
                name: '广交好友',
                description: '拥有10个好友',
                condition: { type: 'friendCount', value: 10 },
                rewards: { achievementPoints: 15 },
                icon: '🤝'
            },
            {
                id: 'marriage',
                category: '社交',
                name: '比翼双飞',
                description: '成功结婚',
                condition: { type: 'married', value: true },
                rewards: { stamina: 200, achievementPoints: 30 },
                icon: '💍'
            },

            // === 宠物成就 ===
            {
                id: 'pet_hatch',
                category: '宠物',
                name: '宠物孵化师',
                description: '孵化第一个宠物',
                condition: { type: 'petCount', value: 1 },
                rewards: { stamina: 100, achievementPoints: 15 },
                icon: '🥚'
            },
            {
                id: 'pet_5',
                category: '宠物',
                name: '宠物收藏家',
                description: '拥有5个宠物',
                condition: { type: 'petCount', value: 5 },
                rewards: { stamina: 300, achievementPoints: 30 },
                icon: '🐾'
            },

            // === 钓鱼成就 ===
            {
                id: 'fish_first',
                category: '生活',
                name: '初试身手',
                description: '第一次钓到鱼',
                condition: { type: 'fishCount', value: 1 },
                rewards: { stamina: 30, achievementPoints: 5 },
                icon: '🐟'
            },
            {
                id: 'fish_50',
                category: '生活',
                name: '钓鱼达人',
                description: '累计钓到50条鱼',
                condition: { type: 'fishCount', value: 50 },
                rewards: { stamina: 200, achievementPoints: 25 },
                icon: '🎣'
            },

            // === 幸运成就 ===
            {
                id: 'luck_50',
                category: '运道',
                name: '鸿运当头',
                description: '幸运值达到50',
                condition: { type: 'luck', value: 50 },
                rewards: { achievementPoints: 20 },
                icon: '🍀'
            },
            {
                id: 'luck_70',
                category: '运道',
                name: '天命所归',
                description: '幸运值达到70（满值）',
                condition: { type: 'luck', value: 70 },
                rewards: { stamina: 500, achievementPoints: 50, trait: '天选之人' },
                icon: '🌈'
            },

            // === 装备成就 ===
            {
                id: 'equip_full_set',
                category: '装备',
                name: '全副武装',
                description: '装备所有8个装备槽位',
                condition: { type: 'equippedAll', value: true },
                rewards: { stamina: 200, achievementPoints: 25 },
                icon: '🛡️'
            },
            {
                id: 'strengthen_first',
                category: '装备',
                name: '千锤百炼',
                description: '第一次强化装备',
                condition: { type: 'strengthened', value: true },
                rewards: { achievementPoints: 10 },
                icon: '🔨'
            }
        ];
    }

    /**
     * 获取成就分类列表
     * @returns {Array} 分类名称
     */
    getCategories() {
        const list = this.getAchievementList();
        const cats = [...new Set(list.map(a => a.category))];
        return cats;
    }

    /**
     * 获取用户已领取的成就
     * @returns {Array} 已领取成就记录
     */
    getClaimedAchievements() {
        if (!this.db) return [];

        const sql = `
            SELECT * FROM achievements
            WHERE user_id = ?
        `;
        return this.db.executeSQL(sql, [this.userId], 'all') || [];
    }

    /**
     * 检查成就条件是否满足
     * @param {Object} achievement - 成就配置
     * @returns {boolean} 是否满足
     */
    checkCondition(achievement) {
        const { type, value } = achievement.condition;
        const play = this.play;

        switch (type) {
            case 'level':
                return play.level >= value;
            case 'gold':
                return play.gold >= value;
            case 'reputation':
                return play.reputation >= value;
            case 'monsterKills':
                return (play.monsterKills || 0) >= value;
            case 'gangMember':
                return this._checkGangMember();
            case 'gangLeader':
                return this._checkGangLeader();
            case 'friendCount':
                return this._checkFriendCount(value);
            case 'married':
                return this._checkMarried();
            case 'petCount':
                return this._checkPetCount(value);
            case 'fishCount':
                return (play.fishCount || 0) >= value;
            case 'luck':
                return play.luck >= value;
            case 'equippedAll':
                return this._checkEquippedAll();
            case 'strengthened':
                return this._checkStrengthened();
            default:
                return false;
        }
    }

    /**
     * 领取成就奖励
     * @param {string} achievementId - 成就ID
     * @returns {Object} 领取结果
     */
    claim(achievementId) {
        const achievements = this.getAchievementList();
        const achievement = achievements.find(a => a.id === achievementId);

        if (!achievement) {
            return { success: false, tip: '成就不存在' };
        }

        // 检查是否已领取
        const claimed = this.getClaimedAchievements();
        if (claimed.find(c => c.achievement_id === achievementId)) {
            return { success: false, tip: '该成就已领取' };
        }

        // 检查条件
        if (!this.checkCondition(achievement)) {
            return { success: false, tip: `条件未达成：${achievement.description}` };
        }

        // 发放奖励
        const rewards = achievement.rewards;
        const rewardMessages = [];

        // 体力奖励
        if (rewards.stamina) {
            this.play.currentHealth = Math.min(
                this.play.health,
                this.play.currentHealth + rewards.stamina
            );
            rewardMessages.push(`体力 +${rewards.stamina}`);
        }

        // 成就点数
        if (rewards.achievementPoints) {
            const currentPoints = this.play.achievementPoints || 0;
            this.play.achievementPoints = currentPoints + rewards.achievementPoints;
            rewardMessages.push(`成就点数 +${rewards.achievementPoints}`);
        }

        // 特性奖励（称号）
        if (rewards.trait) {
            if (!this.play.traits) this.play.traits = [];
            this.play.traits.push(rewards.trait);
            rewardMessages.push(`获得称号【${rewards.trait}】`);
        }

        // 道具奖励
        if (rewards.items) {
            for (const item of rewards.items) {
                this.backpack.addItem(item);
                rewardMessages.push(`获得道具【${item.name}】x${item.num || 1}`);
            }
        }

        // 保存成就记录到数据库
        if (this.db) {
            const sql = `
                INSERT INTO achievements (user_id, achievement_id, claimed_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `;
            try {
                this.db.executeSQL(sql, [this.userId, achievementId], 'run');
            } catch (e) {
                console.error('保存成就记录失败:', e);
                return { success: false, tip: '系统错误：成就保存失败' };
            }
        }

        return {
            success: true,
            tip: `恭喜获得成就【${achievement.name}】！${rewardMessages.join('，')}`,
            rewards: rewardMessages.join('，')
        };
    }

    /**
     * 获取成就系统完整状态
     * @returns {Object} 成就状态
     */
    getStatus() {
        const allAchievements = this.getAchievementList();
        const claimed = this.getClaimedAchievements();
        const claimedIds = claimed.map(c => c.achievement_id);
        const totalPoints = this.play.achievementPoints || 0;
        const traits = this.play.traits || [];
        const categories = this.getCategories();

        // 按分类整理成就
        const achievementsByCategory = {};
        for (const cat of categories) {
            achievementsByCategory[cat] = allAchievements
                .filter(a => a.category === cat)
                .map(a => ({
                    ...a,
                    claimed: claimedIds.includes(a.id),
                    completed: this.checkCondition(a)
                }));
        }

        // 统计
        const completedCount = allAchievements.filter(a => this.checkCondition(a)).length;
        const claimedCount = claimed.length;
        const totalCount = allAchievements.length;

        return {
            achievementsByCategory,
            categories,
            totalPoints,
            traits,
            completedCount,
            claimedCount,
            totalCount,
            claimedIds,
            allAchievements
        };
    }

    // === 辅助检查方法 ===

    _checkGangMember() {
        try {
            return !!this._userGangStatus();
        } catch (e) {
            return false;
        }
    }

    _checkGangLeader() {
        try {
            const gang = this._userGangStatus();
            return gang && (gang.role === 'leader');
        } catch (e) {
            return false;
        }
    }

    _userGangStatus() {
        if (!this.db) return null;
        const sql = `
            SELECT gm.*, g.name, g.level, g.fund, g.max_members
            FROM gang_members gm
            JOIN gangs g ON gm.gang_id = g.id
            WHERE gm.user_id = ?
        `;
        const result = this.db.executeSQL(sql, [this.userId], 'get');
        if (result) {
            return {
                id: result.gang_id,
                name: result.name,
                level: result.level,
                role: result.role
            };
        }
        return null;
    }

    _checkFriendCount(value) {
        if (!this.db) return false;
        const sql = `
            SELECT COUNT(*) as count FROM friends
            WHERE user_id = ? AND status = 'accepted'
        `;
        const result = this.db.executeSQL(sql, [this.userId], 'get');
        return result && result.count >= value;
    }

    _checkMarried() {
        if (!this.db) return false;
        const sql = `
            SELECT COUNT(*) as count FROM marriages
            WHERE (user1_id = ? OR user2_id = ?) AND status = 'married'
        `;
        const result = this.db.executeSQL(sql, [this.userId, this.userId], 'get');
        return result && result.count > 0;
    }

    _checkPetCount(value) {
        if (!this.db) return false;
        const sql = `
            SELECT COUNT(*) as count FROM pets
            WHERE user_id = ?
        `;
        const result = this.db.executeSQL(sql, [this.userId], 'get');
        return result && result.count >= value;
    }

    _checkEquippedAll() {
        try {
            const equipStatus = this.play.equipment.getStatus();
            const slots = ['weapon', 'offhand', 'headgear', 'clothes', 'belt', 'shoes', 'accessories'];
            let equipped = 0;
            for (const slot of slots) {
                if (equipStatus[slot]) equipped++;
            }
            if (Array.isArray(equipStatus.accessories) && equipStatus.accessories.length >= 2) {
                equipped++;
            }
            return equipped >= 7;
        } catch (e) {
            return false;
        }
    }

    _checkStrengthened() {
        return (this.play.strengthenCount || 0) > 0;
    }
}