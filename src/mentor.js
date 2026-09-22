/**
 * 师徒系统模块
 * 实现师徒关系建立、奖励机制、师德等功能
 */

export default class Mentor {
    constructor(database, userId) {
        this.db = database;
        this.userId = userId;
    }

    /**
     * 检查是否可以拜师
     * @param {number} userId - 用户 ID
     * @param {number} userLevel - 用户等级
     * @returns {Object} 检查结果
     */
    canBecomeDisciple(userId, userLevel) {
        // 6 级才可以拜师
        if (userLevel < 6) {
            return { success: false, message: '需要达到 6 级才能拜师' };
        }

        // 检查是否已经有师傅
        const currentMentor = this.getCurrentMentor(userId);
        if (currentMentor) {
            return { success: false, message: '你已经是某人的徒弟了' };
        }

        return { success: true };
    }

    /**
     * 检查是否可以成为师傅
     * @param {number} userId - 用户 ID
     * @param {number} userLevel - 用户等级
     * @returns {Object} 检查结果
     */
    canBecomeMentor(userId, userLevel) {
        // 30 级才可以做师傅
        if (userLevel < 30) {
            return { success: false, message: '需要达到 30 级才能成为师傅' };
        }

        // 检查是否已经有徒弟
        const disciples = this.getDisciples(userId);
        if (disciples.length > 0) {
            return { success: false, message: '你需要先出师才能收徒' };
        }

        return { success: true };
    }

    /**
     * 拜师
     * @param {number} mentorId - 师傅 ID
     * @returns {Object} 操作结果
     */
    becomeDisciple(mentorId) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        // 检查师徒关系是否已存在
        const existingRelation = this.getMentorDiscipleRelation(this.userId, mentorId);
        if (existingRelation) {
            return { success: false, message: '师徒关系已存在' };
        }

        // 创建师徒关系
        const sql = `
            INSERT INTO mentor_disciple (mentor_id, disciple_id, created_at, level_when_joined)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
        `;

        // 获取用户等级
        const userData = db.loadUserData(this.userId);
        const userLevel = userData?.play?.level || 1;

        try {
            db.executeSQL(sql, [mentorId, this.userId, userLevel], 'run');
            
            // 发送系统通知
            return { 
                success: true, 
                message: '拜师成功！' 
            };
        } catch (error) {
            console.error('拜师失败:', error);
            return { success: false, message: '拜师失败，请稍后重试' };
        }
    }

    /**
     * 收徒
     * @param {number} discipleId - 徒弟 ID
     * @returns {Object} 操作结果
     */
    acceptDisciple(discipleId) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        // 获取徒弟用户数据
        const discipleData = db.getUserById(discipleId);
        if (!discipleData) {
            return { success: false, message: '用户不存在' };
        }

        const discipleUserData = db.loadUserData(discipleId);
        const discipleLevel = discipleUserData?.play?.level || 1;

        // 检查徒弟等级是否符合要求
        if (discipleLevel < 6) {
            return { success: false, message: '徒弟需要达到 6 级才能拜师' };
        }

        // 检查自己是否符合师傅条件
        const myData = db.loadUserData(this.userId);
        const myLevel = myData?.play?.level || 1;
        
        if (myLevel < 30) {
            return { success: false, message: '需要达到 30 级才能成为师傅' };
        }

        try {
            // 创建师徒关系
            const sql = `
                INSERT INTO mentor_disciple (mentor_id, disciple_id, created_at, level_when_joined)
                VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            `;
            db.executeSQL(sql, [this.userId, discipleId, discipleLevel], 'run');
            
            return { 
                success: true, 
                message: '收徒成功！' 
            };
        } catch (error) {
            console.error('收徒失败:', error);
            return { success: false, message: '收徒失败，请稍后重试' };
        }
    }

    /**
     * 获取当前的师傅
     * @param {number} userId - 用户 ID
     * @returns {Object|null} 师傅信息
     */
    getCurrentMentor(userId) {
        const db = this.db;
        if (!db) {
            return null;
        }

        const sql = `
            SELECT md.*, u.nickname as mentor_nickname
            FROM mentor_disciple md
            JOIN users u ON md.mentor_id = u.id
            WHERE md.disciple_id = ? AND md.status = 'active'
        `;

        return db.executeSQL(sql, [userId], 'get');
    }

    /**
     * 获取当前的徒弟
     * @param {number} userId - 用户 ID
     * @returns {Array} 徒弟列表
     */
    getDisciples(userId) {
        const db = this.db;
        if (!db) {
            return [];
        }

        const sql = `
            SELECT md.*, u.nickname as disciple_nickname, u.id as disciple_user_id
            FROM mentor_disciple md
            JOIN users u ON md.disciple_id = u.id
            WHERE md.mentor_id = ? AND md.status = 'active'
        `;

        return db.executeSQL(sql, [userId], 'all') || [];
    }

    /**
     * 获取师徒关系
     * @param {number} userId1 
     * @param {number} userId2 
     * @returns {Object|null} 关系信息
     */
    getMentorDiscipleRelation(userId1, userId2) {
        const db = this.db;
        if (!db) {
            return null;
        }

        const sql = `
            SELECT *
            FROM mentor_disciple
            WHERE ((mentor_id = ? AND disciple_id = ?) OR (mentor_id = ? AND disciple_id = ?))
              AND status = 'active'
        `;

        return db.executeSQL(sql, [userId1, userId2, userId2, userId1], 'get');
    }

    /**
     * 出师
     * @param {number} discipleId - 徒弟 ID
     * @returns {Object} 操作结果
     */
    graduate(discipleId) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        // 更新师徒关系状态
        const sql = `
            UPDATE mentor_disciple
            SET status = 'graduated', graduated_at = CURRENT_TIMESTAMP
            WHERE mentor_id = ? AND disciple_id = ? AND status = 'active'
        `;

        try {
            db.executeSQL(sql, [this.userId, discipleId], 'run');
            return { 
                success: true, 
                message: '出师成功！' 
            };
        } catch (error) {
            console.error('出师失败:', error);
            return { success: false, message: '出师失败，请稍后重试' };
        }
    }

    /**
     * 自动出师（徒弟满 40 级）
     * @param {number} discipleId - 徒弟 ID
     * @param {number} newLevel - 新等级
     */
    autoGraduate(discipleId, newLevel) {
        if (newLevel >= 40) {
            const db = this.db;
            if (db) {
                const sql = `
                    UPDATE mentor_disciple
                    SET status = 'graduated', graduated_at = CURRENT_TIMESTAMP
                    WHERE disciple_id = ? AND status = 'active'
                `;
                db.executeSQL(sql, [discipleId], 'run');
            }
        }
    }

    /**
     * 计算授业时间系数
     * @param {string} createdAt - 创建时间
     * @param {number} tier - 奖励档位 (1, 2, 3)
     * @returns {number} 系数
     */
    calculateTeachingTimeCoefficient(createdAt, tier) {
        const createTime = new Date(createdAt);
        const now = new Date();
        const hours = (now - createTime) / (1000 * 60 * 60); // 转换为小时

        let divisor = 0;
        switch (tier) {
            case 1:
                divisor = 6;
                break;
            case 2:
                divisor = 10;
                break;
            case 3:
                divisor = 20;
                break;
            default:
                divisor = 6;
        }

        return Math.min(1, hours / divisor);
    }

    /**
     * 徒弟升级奖励师傅
     * @param {number} discipleId - 徒弟 ID
     * @param {number} newLevel - 新等级
     */
    rewardMentorOnDiscipleLevelUp(discipleId, newLevel) {
        const relation = this.getCurrentMentor(discipleId);
        if (!relation) {
            return;
        }

        const mentorId = relation.mentor_id;
        
        // 计算这是第几次 10 级奖励
        const levelWhenJoined = relation.level_when_joined || 1;
        const levelsGained = newLevel - levelWhenJoined;
        const tier = Math.floor(levelsGained / 10);

        if (tier > 0 && tier <= 3) {
            // 计算奖励
            let expReward = 0;
            let silverReward = 0;

            switch (tier) {
                case 1:
                    expReward = 20000;
                    silverReward = 20;
                    break;
                case 2:
                    expReward = 40000;
                    silverReward = 40;
                    break;
                case 3:
                    expReward = 80000;
                    silverReward = 80;
                    break;
            }

            // 计算系数
            const coefficient = this.calculateTeachingTimeCoefficient(relation.created_at, tier);
            const finalExpReward = Math.floor(expReward * coefficient);

            // 给师傅发放奖励
            const mentorUserData = db.loadUserData(mentorId);
            if (mentorUserData && mentorUserData.play) {
                mentorUserData.play.addExp(finalExpReward);
                mentorUserData.play.addCopper(silverReward * 1000); // 银贝转换为铜贝
            }
        }
    }

    /**
     * 徒弟感恩，增加师傅师德
     * @param {number} tier - 感恩档位 (10 级=1, 20 级=2, 30 级=3)
     * @returns {Object} 操作结果
     */
    showGratitude(tier) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        // 获取师傅信息
        const mentorRelation = this.getCurrentMentor(this.userId);
        if (!mentorRelation) {
            return { success: false, message: '你没有师傅' };
        }

        const mentorId = mentorRelation.mentor_id;
        
        // 计算需要的银贝
        let requiredSilver = 0;
        let virtuePoints = 0;

        switch (tier) {
            case 1: // 10 级
                requiredSilver = 5;
                virtuePoints = 10;
                break;
            case 2: // 20 级
                requiredSilver = 10;
                virtuePoints = 20;
                break;
            case 3: // 30 级
                requiredSilver = 20;
                virtuePoints = 30;
                break;
            case 4: // 40 级
                requiredSilver = 40;
                virtuePoints = 40;
                break;
        }

        // 检查银贝是否足够
        const userData = db.loadUserData(this.userId);
        if (!userData || userData.play.showSilver < requiredSilver) {
            return { success: false, message: `银贝不足，需要${requiredSilver}银` };
        }

        // 扣除银贝
        userData.play.addCopper(-requiredSilver * 1000);

        // 增加师傅师德
        const mentorData = db.loadUserData(mentorId);
        if (mentorData && mentorData.play) {
            mentorData.play.virtue = (mentorData.play.virtue || 0) + virtuePoints;
        }

        return { 
            success: true, 
            message: `感恩成功！师傅师德增加${virtuePoints}点` 
        };
    }

    /**
     * 获取师傅的师德
     * @param {number} mentorId - 师傅 ID
     * @returns {number} 师德值
     */
    getMentorVirtue(mentorId) {
        const db = this.db;
        if (!db) {
            return 0;
        }

        const mentorData = db.loadUserData(mentorId);
        return mentorData?.play?.virtue || 0;
    }

    /**
     * 检查师徒是否同时在线，返回攻防加成
     * @param {number} userId - 用户 ID
     * @returns {Object} 加成信息
     */
    getMentorDiscipleBonus(userId) {
        const relation = this.getCurrentMentor(userId);
        
        // 如果是徒弟，检查师傅是否在线
        if (relation) {
            const mentorId = relation.mentor_id;
            const isMentorOnline = this.isUserOnline(mentorId);
            
            if (isMentorOnline) {
                return {
                    active: true,
                    attackBonus: 0.10,  // 10%
                    defenseBonus: 0.10,
                    expBonus: 0.20      // 徒弟经验加成 20%
                };
            }
        }

        // 如果是师傅，检查是否有徒弟在线
        const disciples = this.getDisciples(userId);
        const onlineDisciples = disciples.filter(d => this.isUserOnline(d.disciple_user_id));
        
        if (onlineDisciples.length > 0) {
            return {
                active: true,
                attackBonus: 0.10,
                defenseBonus: 0.10,
                expBonus: 0.05         // 师傅经验加成 5%
            };
        }

        return { active: false };
    }

    /**
     * 检查用户是否在线
     * @param {number} userId - 用户 ID
     * @returns {boolean} 是否在线
     */
    isUserOnline(userId) {
        const db = this.db;
        if (!db) {
            return false;
        }

        const userData = db.loadUserData(userId);
        if (!userData || !userData.updated_at) {
            return false;
        }

        // 5 分钟内有活动视为在线
        const lastActiveTime = new Date(userData.updated_at).getTime();
        return (Date.now() - lastActiveTime) < 300000;
    }

    /**
     * 徒弟加入帮会时奖励师傅
     * @param {number} discipleId - 徒弟 ID
     */
    rewardMentorOnDiscipleJoinGang(discipleId) {
        const relation = this.getCurrentMentor(discipleId);
        if (!relation) {
            return;
        }

        const mentorId = relation.mentor_id;
        
        // 检查是否是第一次加入帮会
        const hasJoinedGangBefore = this.hasDiscipleJoinedGangBefore(discipleId);
        if (hasJoinedGangBefore) {
            return;
        }

        // 奖励师傅 1 万经验和 10 银
        const mentorData = db.loadUserData(mentorId);
        if (mentorData && mentorData.play) {
            mentorData.play.addExp(10000);
            mentorData.play.addCopper(10 * 1000); // 10 银贝

            // 记录徒弟已加入帮会
            this.markDiscipleAsJoinedGang(discipleId);
        }
    }

    /**
     * 标记徒弟已加入帮会
     * @param {number} discipleId - 徒弟 ID
     */
    markDiscipleAsJoinedGang(discipleId) {
        const db = this.db;
        if (!db) {
            return;
        }

        const sql = `
            UPDATE mentor_disciple
            SET has_joined_gang = 1
            WHERE disciple_id = ?
        `;
        
        try {
            db.executeSQL(sql, [discipleId], 'run');
        } catch (error) {
            console.error('标记加入帮会失败:', error);
        }
    }

    /**
     * 检查徒弟是否已经加入过帮会
     * @param {number} discipleId - 徒弟 ID
     * @returns {boolean} 是否已加入
     */
    hasDiscipleJoinedGangBefore(discipleId) {
        const db = this.db;
        if (!db) {
            return false;
        }

        const sql = `
            SELECT has_joined_gang
            FROM mentor_disciple
            WHERE disciple_id = ?
            LIMIT 1
        `;

        const result = db.executeSQL(sql, [discipleId], 'get');
        return result && result.has_joined_gang === 1;
    }

    /**
     * 获取师徒状态
     * @param {number} userId - 用户 ID
     * @returns {Object} 师徒状态
     */
    getStatus(userId) {
        const mentor = this.getCurrentMentor(userId);
        const disciples = this.getDisciples(userId);
        const virtue = mentor ? this.getMentorVirtue(mentor.mentor_id) : (disciples.length > 0 ? this.getMyVirtue() : 0);
        const bonus = this.getMentorDiscipleBonus(userId);
        
        // 计算授业时间
        let teachingDays = 0;
        if (mentor) {
            const createdAt = new Date(mentor.created_at);
            teachingDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        } else if (disciples.length > 0) {
            // 取最早的徒弟
            const earliestDisciple = disciples.reduce((a, b) => 
                new Date(a.created_at) < new Date(b.created_at) ? a : b
            );
            const createdAt = new Date(earliestDisciple.created_at);
            teachingDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
            hasMentor: !!mentor,
            mentor: mentor,
            hasDisciples: disciples.length > 0,
            disciples: disciples,
            virtue: virtue,
            bonus: bonus,
            teachingDays: teachingDays,
            graduated: this.getGraduatedHistory(userId)
        };
    }

    /**
     * 获取自己的师德（作为师傅时）
     * @returns {number} 师德值
     */
    getMyVirtue() {
        const db = this.db;
        if (!db) return 0;
        const userData = db.loadUserData(this.userId);
        return userData?.play?.virtue || 0;
    }

    /**
     * 寻找可拜师的师傅列表
     * @returns {Array} 可拜师的师傅列表
     */
    findAvailableMentors() {
        const db = this.db;
        if (!db) return [];

        // 查找30级以上、当前没有徒弟的玩家
        const sql = `
            SELECT u.id, u.nickname
            FROM users u
            WHERE u.id != ?
              AND u.id NOT IN (
                  SELECT mentor_id FROM mentor_disciple WHERE status = 'active'
              )
            LIMIT 50
        `;

        const candidates = db.executeSQL(sql, [this.userId], 'all') || [];
        
        // 过滤出等级>=30的
        return candidates.filter(c => {
            const userData = db.loadUserData(c.id);
            const level = userData?.play?.level || 0;
            if (level >= 30) {
                c.level = level;
                c.virtue = userData?.play?.virtue || 0;
                c.isOnline = this.isUserOnline(c.id);
                return true;
            }
            return false;
        }).slice(0, 10);
    }

    /**
     * 寻找可收徒的徒弟列表
     * @returns {Array} 可收徒的徒弟列表
     */
    findAvailableDisciples() {
        const db = this.db;
        if (!db) return [];

        // 查找6-39级、当前没有师傅的玩家
        const sql = `
            SELECT u.id, u.nickname
            FROM users u
            WHERE u.id != ?
              AND u.id NOT IN (
                  SELECT disciple_id FROM mentor_disciple WHERE status = 'active'
              )
            LIMIT 50
        `;

        const candidates = db.executeSQL(sql, [this.userId], 'all') || [];
        
        // 过滤出等级6-39的
        return candidates.filter(c => {
            const userData = db.loadUserData(c.id);
            const level = userData?.play?.level || 0;
            if (level >= 6 && level < 40) {
                c.level = level;
                c.isOnline = this.isUserOnline(c.id);
                return true;
            }
            return false;
        }).slice(0, 10);
    }

    /**
     * 解除师徒关系
     * @returns {Object} 操作结果
     */
    breakRelationship() {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        // 检查是否有师徒关系
        const mentor = this.getCurrentMentor(this.userId);
        const disciples = this.getDisciples(this.userId);
        
        if (!mentor && disciples.length === 0) {
            return { success: false, message: '你没有师徒关系' };
        }

        const sql = `
            UPDATE mentor_disciple
            SET status = 'broken'
            WHERE (mentor_id = ? OR disciple_id = ?) AND status = 'active'
        `;

        try {
            db.executeSQL(sql, [this.userId, this.userId], 'run');
            return { success: true, message: '已解除师徒关系' };
        } catch (error) {
            console.error('解除师徒关系失败:', error);
            return { success: false, message: '操作失败，请稍后重试' };
        }
    }

    /**
     * 获取出师历史
     * @param {number} userId - 用户 ID
     * @returns {Array} 出师记录
     */
    getGraduatedHistory(userId) {
        const db = this.db;
        if (!db) return [];

        // 作为师傅的出师记录
        const asMentor = `
            SELECT md.*, u.nickname as disciple_name,
                   '师傅' as role
            FROM mentor_disciple md
            JOIN users u ON md.disciple_id = u.id
            WHERE md.mentor_id = ? AND md.status = 'graduated'
            ORDER BY md.graduated_at DESC
        `;

        // 作为徒弟的出师记录
        const asDisciple = `
            SELECT md.*, u.nickname as mentor_name,
                   '徒弟' as role
            FROM mentor_disciple md
            JOIN users u ON md.mentor_id = u.id
            WHERE md.disciple_id = ? AND md.status = 'graduated'
            ORDER BY md.graduated_at DESC
        `;

        const mentorRecords = db.executeSQL(asMentor, [userId], 'all') || [];
        const discipleRecords = db.executeSQL(asDisciple, [userId], 'all') || [];

        return [...mentorRecords, ...discipleRecords].sort((a, b) => 
            new Date(b.graduated_at) - new Date(a.graduated_at)
        );
    }

    /**
     * 徒弟感恩（增加师傅师德）- 带等级检查
     * @param {number} tier - 感恩档位
     * @returns {Object} 操作结果
     */
    showGratitudeWithCheck(tier) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        // 获取徒弟信息
        const userData = db.loadUserData(this.userId);
        const myLevel = userData?.play?.level || 0;

        // 检查等级是否达到对应档位
        const requiredLevels = { 1: 10, 2: 20, 3: 30, 4: 40 };
        const requiredLevel = requiredLevels[tier] || 999;
        
        if (myLevel < requiredLevel) {
            return { success: false, message: `需要达到${requiredLevel}级才能进行此档位感恩` };
        }

        return this.showGratitude(tier);
    }
}
