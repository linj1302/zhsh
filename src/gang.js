class Gang {
    constructor(database = null) {
        this.db = database;
        // 帮会信息
        this.id = null;
        this.name = '';
        this.level = 1;
        this.fund = 0;
        this.notice = '';
        this.maxMembers = 50;
        // 用户在帮会中的信息
        this.role = ''; // leader, elder, member
        this.contribution = 0;
    }

    /**
     * 初始化帮会数据
     * @param {number} userId - 用户ID
     * @returns {boolean} 是否初始化成功
     */
    init(userId) {
        if (!this.db) return false;

        const gangInfo = this.db.getUserGang(userId);
        if (gangInfo) {
            this.id = gangInfo.id;
            this.name = gangInfo.name;
            this.level = gangInfo.level;
            this.fund = gangInfo.fund;
            this.notice = gangInfo.notice;
            this.maxMembers = gangInfo.max_members;
            this.role = gangInfo.role;
            this.contribution = gangInfo.contribution;
            return true;
        }
        return false;
    }

    /**
     * 创建帮会
     * @param {string} name - 帮会名称
     * @param {number} leaderId - 帮主ID
     * @param {string} leaderName - 帮主名称
     * @returns {object} 创建结果
     */
    create(name, leaderId, leaderName) {
        if (!this.db) {
            return { success: false, tip: '数据库未初始化' };
        }

        // 检查帮会名称是否已存在
        const existingGang = this.db.getGangByName(name);
        if (existingGang) {
            return { success: false, tip: '帮会名称已存在' };
        }

        try {
            const gangInfo = this.db.createGang(name, leaderId, leaderName);
            if (gangInfo) {
                this.id = gangInfo.id;
                this.name = gangInfo.name;
                this.level = gangInfo.level;
                this.fund = gangInfo.fund;
                this.notice = gangInfo.notice;
                this.maxMembers = gangInfo.max_members;
                this.role = 'leader';
                this.contribution = 0;
                return { success: true, tip: '帮会创建成功' };
            } else {
                return { success: false, tip: '帮会创建失败' };
            }
        } catch (error) {
            console.error('创建帮会错误:', error);
            return { success: false, tip: '帮会创建失败：' + error.tip };
        }
    }

    /**
     * 获取帮会列表
     * @returns {Array} 帮会列表
     */
    getGangList() {
        if (!this.db) return [];
        return this.db.getGangList();
    }

    /**
     * 加入帮会
     * @param {number} gangId - 帮会ID
     * @param {number} userId - 用户ID
     * @param {string} username - 用户名
     * @returns {object} 加入结果
     */
    joinGang(gangId, userId, username) {
        if (!this.db) {
            return { success: false, tip: '数据库未初始化' };
        }

        // 检查是否已经有帮会
        const currentGang = this.db.getUserGang(userId);
        if (currentGang) {
            return { success: false, tip: '您已经有帮会了' };
        }

        // 检查帮会是否存在
        const gang = this.db.getGangById(gangId);
        if (!gang) {
            return { success: false, tip: '帮会不存在' };
        }

        // 检查帮会人数是否已满
        const members = this.db.getGangMembers(gangId);
        if (members.length >= gang.max_members) {
            return { success: false, tip: '帮会人数已满' };
        }

        // 添加成员
        const result = this.db.addGangMember(gangId, userId, username);
        if (result) {
            this.id = gang.id;
            this.name = gang.name;
            this.level = gang.level;
            this.fund = gang.fund;
            this.notice = gang.notice;
            this.maxMembers = gang.max_members;
            this.role = 'member';
            this.contribution = 0;
            return { success: true, tip: '成功加入帮会' };
        } else {
            return { success: false, tip: '加入帮会失败' };
        }
    }

    /**
     * 退出帮会
     * @param {number} userId - 用户ID
     * @returns {object} 退出结果
     */
    leaveGang(userId) {
        if (!this.db) {
            return { success: false, tip: '数据库未初始化' };
        }

        if (!this.id) {
            return { success: false, tip: '您没有加入任何帮会' };
        }

        // 检查是否是帮主
        if (this.role === 'leader') {
            // 如果是帮主，则解散帮会
            return this.disbandGang(userId);
        }

        const result = this.db.removeGangMember(this.id, userId);
        if (result) {
            // 清空当前帮会信息
            this.id = null;
            this.name = '';
            this.level = 1;
            this.fund = 0;
            this.notice = '';
            this.maxMembers = 50;
            this.role = '';
            this.contribution = 0;
            return { success: true, tip: '成功退出帮会' };
        } else {
            return { success: false, tip: '退出帮会失败' };
        }
    }

    /**
     * 解散帮会（仅帮主可以操作）
     * @param {number} userId - 帮主ID
     * @returns {object} 解散结果
     */
    disbandGang(userId) {
        if (!this.db) {
            return { success: false, tip: '数据库未初始化' };
        }

        if (!this.id) {
            return { success: false, tip: '您没有加入任何帮会' };
        }

        // 检查是否是帮主
        if (this.role !== 'leader') {
            return { success: false, tip: '只有帮主可以解散帮会' };
        }

        try {
            // 删除帮会所有成员
            const deleteMembersSql = `DELETE FROM gang_members WHERE gang_id = ?`;
            this.db.executeSQL(deleteMembersSql, [this.id], 'run');
            
            // 删除帮会仓库物品
            const deleteStorageSql = `DELETE FROM gang_storage WHERE gang_id = ?`;
            this.db.executeSQL(deleteStorageSql, [this.id], 'run');
            
            // 删除帮会捐献记录
            const deleteDonationsSql = `DELETE FROM gang_donations WHERE gang_id = ?`;
            this.db.executeSQL(deleteDonationsSql, [this.id], 'run');
            
            // 删除帮会本身
            const deleteGangSql = `DELETE FROM gangs WHERE id = ?`;
            this.db.executeSQL(deleteGangSql, [this.id], 'run');

            // 清空当前帮会信息
            this.id = null;
            this.name = '';
            this.level = 1;
            this.fund = 0;
            this.notice = '';
            this.maxMembers = 50;
            this.role = '';
            this.contribution = 0;
            
            return { success: true, tip: '帮会已成功解散' };
        } catch (error) {
            console.error('解散帮会错误:', error);
            return { success: false, tip: '解散帮会失败：' + error.message };
        }
    }

    /**
     * 获取帮会成员列表
     * @returns {Array} 成员列表
     */
    getMembers() {
        if (!this.db || !this.id) return [];
        return this.db.getGangMembers(this.id);
    }

    /**
     * 获取帮会仓库物品列表
     * @returns {Array} 物品列表
     */
    getStorageItems() {
        if (!this.db || !this.id) return [];
        return this.db.getGangStorageItems(this.id);
    }
    
    /**
     * 根据ID获取帮会仓库中的单个物品
     * @param {number} itemId - 物品ID
     * @returns {object|null} 物品信息
     */
    getStorageItemById(itemId) {
        if (!this.db || !this.id) return null;
        return this.db.getGangStorageItemById(itemId, this.id);
    }

    /**
     * 添加物品到帮会仓库
     * @param {string} itemName - 物品名称
     * @param {number} itemLevel - 物品等级
     * @param {object} itemInfo - 物品详细信息
     * @returns {object} 添加结果
     */
    addItemToStorage(itemName, itemLevel, itemInfo = null) {
        if (!this.db || !this.id) {
            return { success: false, tip: '帮会信息未初始化' };
        }

        // 检查权限（只有帮众及以上可以操作）
        if (!this.role) {
            return { success: false, tip: '您没有权限执行此操作' };
        }

        // 将物品信息序列化为JSON字符串存储
        const itemInfoStr = itemInfo ? JSON.stringify(itemInfo) : null;
        
        const result = this.db.addItemToGangStorage(this.id, itemName, itemLevel, itemInfoStr);
        if (result === true) {
            return { success: true, tip: '物品已存入帮会仓库' };
        } else {
            return { success: false, tip: '存入帮会仓库失败' };
        }
    }

    /**
     * 从帮会仓库取出物品
     * @param {number} storageId - 仓库物品ID
     * @returns {object} 取出结果
     */
    removeItemFromStorage(storageId) {
        if (!this.db || !this.id) {
            return { success: false, tip: '帮会信息未初始化' };
        }

        // 检查权限（只有帮众及以上可以操作）
        if (!this.role) {
            return { success: false, tip: '您没有权限执行此操作' };
        }

        const result = this.db.removeItemFromGangStorage(storageId, this.id);
        if (result === true) {
            return { success: true, tip: '物品已从帮会仓库取出' };
        } else {
            return { success: false, tip: '从帮会仓库取出物品失败' };
        }
    }

    /**
     * 捐献资源到帮会
     * @param {number} userId - 用户ID
     * @param {string} username - 用户名
     * @param {string} donationType - 捐献类型 (silver, gold, token)
     * @param {number} amount - 捐献数量
     * @param {number} contribution - 获得的贡献值
     * @returns {object} 捐献结果
     */
    donate(userId, username, donationType, amount, contribution) {
        if (!this.db || !this.id) {
            return { success: false, tip: '帮会信息未初始化' };
        }

        // 检查权限（只有帮众及以上可以操作）
        if (!this.role) {
            return { success: false, tip: '您没有权限执行此操作' };
        }

        const result = this.db.recordGangDonation(
            this.id, 
            userId, 
            username, 
            donationType, 
            amount, 
            contribution
        );

        if (result) {
            // 更新本地贡献值
            this.contribution += contribution;
            return { success: true, tip: `捐献成功，获得${contribution}贡献值` };
        } else {
            return { success: false, tip: '捐献失败' };
        }
    }

    /**
     * 获取帮会捐献记录
     * @param {number} limit - 限制返回的记录数量
     * @returns {Array} 捐献记录列表
     */
    getDonationRecords(limit = 10) {
        if (!this.db || !this.id) return [];
        return this.db.getGangDonations(this.id, limit);
    }

    /**
     * 获取帮会商店物品列表
     * @returns {Array} 商店物品列表
     */
    getShopItems() {
        // 帮会商店物品列表（67个商品）
        // 字段：id, name, level, price(帮贡), monthlyLimit, type(物品类型), tip
        return [
            // === 药水/食物类 ===
            { id: 1, name: '龙泉水', level: 1, price: 4000, monthlyLimit: 80, type: 34, tip: '强化神兵必备材料' },
            { id: 2, name: '泉水', level: 1, price: 500, monthlyLimit: 100, type: 34, tip: '普通的泉水' },
            { id: 3, name: '奶瓶', level: 1, price: 10000, monthlyLimit: 30, type: 4, tip: '恢复体力+3000' },
            { id: 4, name: '葡萄汁', level: 1, price: 100, monthlyLimit: 200, type: 4, tip: '恢复生命30点' },
            { id: 5, name: '海鲜披萨', level: 1, price: 700, monthlyLimit: 100, type: 4, tip: '恢复生命200点' },
            { id: 6, name: '狮子奶', level: 1, price: 1000, monthlyLimit: 80, type: 4, tip: '恢复生命100点' },
            { id: 7, name: '曲奇饼', level: 1, price: 3000, monthlyLimit: 50, type: 4, tip: '恢复生命80点' },
            { id: 8, name: '牛肉馅饼', level: 1, price: 300, monthlyLimit: 150, type: 4, tip: '恢复少量生命' },
            { id: 9, name: '肉夹馍', level: 1, price: 2500, monthlyLimit: 80, type: 4, tip: '恢复中等生命' },
            
            // === 体力类 ===
            { id: 10, name: '体力宝', level: 1, price: 200000, monthlyLimit: 5, type: 4, tip: '永久增加体力上限' },
            { id: 11, name: '大体力包', level: 1, price: 50000, monthlyLimit: 20, type: 4, tip: '大幅增加体力上限' },
            { id: 12, name: '小体力包', level: 1, price: 10000, monthlyLimit: 50, type: 4, tip: '小幅增加体力上限' },
            
            // === 解毒/状态解除类 ===
            { id: 13, name: '解毒剂', level: 1, price: 100, monthlyLimit: 200, type: 3, tip: '解除中毒状态' },
            { id: 14, name: '圣水', level: 1, price: 100, monthlyLimit: 200, type: 3, tip: '解除诅咒状态' },
            { id: 15, name: '固元膏', level: 1, price: 100, monthlyLimit: 200, type: 3, tip: '解除虚弱状态' },
            { id: 16, name: '加速剂', level: 1, price: 100, monthlyLimit: 200, type: 3, tip: '解除缓慢状态' },
            { id: 17, name: '二锅头', level: 1, price: 100, monthlyLimit: 200, type: 3, tip: '解除沮丧状态' },
            { id: 18, name: '朗姆酒', level: 1, price: 200, monthlyLimit: 150, type: 3, tip: '解除麻痹状态' },
            { id: 19, name: '万能药', level: 1, price: 1000, monthlyLimit: 50, type: 3, tip: '清除所有异常状态' },
            
            // === 宠物用品 ===
            { id: 20, name: '宠物清洁剂', level: 1, price: 20, monthlyLimit: 300, type: 26, tip: '增加宠物50点清洁度' },
            { id: 21, name: '中型宠物清洁剂', level: 1, price: 150, monthlyLimit: 150, type: 26, tip: '增加宠物100点清洁度' },
            { id: 22, name: '大型宠物清洁剂', level: 1, price: 500, monthlyLimit: 80, type: 26, tip: '增加宠物200点清洁度' },
            { id: 23, name: '宠物蛋', level: 1, price: 2, monthlyLimit: 500, type: 20, tip: '可孵化暗狼、龙猫、月虎、霸熊' },
            { id: 24, name: '高级宠物蛋', level: 1, price: 10, monthlyLimit: 200, type: 20, tip: '可孵化圣龙、麒麟' },
            { id: 25, name: 'QQ宠物蛋', level: 1, price: 50, monthlyLimit: 100, type: 20, tip: '可孵化QQ宠物' },
            { id: 26, name: '远古宠物蛋', level: 1, price: 100, monthlyLimit: 50, type: 20, tip: '可孵化远古宠物' },
            { id: 27, name: '宠物饲料', level: 1, price: 100, monthlyLimit: 300, type: 25, tip: '宠物成长饲料' },
            { id: 28, name: '中型宠物饲料', level: 1, price: 500, monthlyLimit: 150, type: 25, tip: '中型宠物成长饲料' },
            { id: 29, name: '大型宠物饲料', level: 1, price: 1500, monthlyLimit: 80, type: 25, tip: '大型宠物成长饲料' },
            
            // === 特殊材料 ===
            { id: 30, name: '灵魂结晶', level: 60, price: 100, monthlyLimit: 200, type: 34, tip: '珍贵的强化材料' },
            { id: 31, name: '银块', level: 1, price: 2000, monthlyLimit: 100, type: 7, tip: '可以兑换银币' },
            { id: 32, name: '香料', level: 1, price: 1000, monthlyLimit: 150, type: 11, tip: '烹饪必备材料' },
            { id: 33, name: '香水', level: 1, price: 2000, monthlyLimit: 80, type: 7, tip: '赠送NPC的好礼物' },
            
            // === 钓鱼用品 ===
            { id: 34, name: '优质鱼饵', level: 1, price: 10000, monthlyLimit: 50, type: 15, tip: '提高钓鱼成功率' },
            { id: 35, name: '包大红袍', level: 1, price: 10000, monthlyLimit: 30, type: 11, tip: '珍贵的茶叶' },
            
            // === 功能道具 ===
            { id: 36, name: '引路蜂', level: 1, price: 2000, monthlyLimit: 100, type: 2, tip: '城市内传送到任务地点' },
            { id: 37, name: '藏宝图', level: 1, price: 2000, monthlyLimit: 80, type: 2, tip: '潜水时可获得宝物' },
            { id: 38, name: '高级藏宝图', level: 1, price: 20000, monthlyLimit: 30, type: 2, tip: '潜水时可获得稀有宝物' },
            { id: 39, name: '百宝箱', level: 1, price: 10000, monthlyLimit: 50, type: 7, tip: '自动拾取物品，扩大背包10格' },
            { id: 40, name: '乾坤袋', level: 1, price: 30000, monthlyLimit: 20, type: 7, tip: '扩大背包负重上限100点' },
            
            // === 其他道具 ===
            { id: 41, name: '老鼠药', level: 1, price: 200, monthlyLimit: 200, type: 2, tip: '清除老鼠' },
            { id: 42, name: '猫', level: 1, price: 200, monthlyLimit: 100, type: 2, tip: '捕捉老鼠' },
            { id: 43, name: '潜水镜', level: 1, price: 200, monthlyLimit: 150, type: 2, tip: '潜水必备' },
            { id: 44, name: '丝巾', level: 1, price: 500, monthlyLimit: 100, type: 2, tip: '装饰用品' },
            { id: 45, name: '避雷针', level: 1, price: 20000, monthlyLimit: 30, type: 2, tip: '防止雷击' },
            { id: 46, name: '金瓶梅', level: 1, price: 1000, monthlyLimit: 50, type: 2, tip: '珍贵书籍' },
            { id: 47, name: '端砚', level: 1, price: 8000, monthlyLimit: 40, type: 2, tip: '文房四宝' },
            
            // === 活动道具 ===
            { id: 48, name: '参赛外卡', level: 1, price: 150000, monthlyLimit: 10, type: 2, tip: '参加特殊活动' },
            { id: 49, name: '三色球', level: 1, price: 150000, monthlyLimit: 10, type: 2, tip: '特殊活动道具' },
            { id: 50, name: '回复卡', level: 1, price: 20000, monthlyLimit: 50, type: 2, tip: '快速回城' },
            { id: 51, name: '交易证', level: 1, price: 10000, monthlyLimit: 80, type: 2, tip: '交易必备' },
            { id: 52, name: '雪人结构图', level: 1, price: 10000, monthlyLimit: 30, type: 2, tip: '制作雪人的图纸' },
            
            // === 强化材料 ===
            { id: 53, name: '正龙泉水', level: 1, price: 1, monthlyLimit: 500, type: 34, tip: '强化神兵必备材料' },
            { id: 54, name: '强化石', level: 1, price: 5000, monthlyLimit: 100, type: 34, tip: '装备强化材料' },
            { id: 55, name: '高级强化石', level: 1, price: 20000, monthlyLimit: 50, type: 34, tip: '高级装备强化材料' },
            { id: 56, name: '保护符', level: 1, price: 10000, monthlyLimit: 60, type: 2, tip: '强化失败时保护装备' },
            
            // === 宝石类 ===
            { id: 57, name: '红宝石', level: 1, price: 5000, monthlyLimit: 80, type: 5, tip: '镶嵌增加攻击' },
            { id: 58, name: '蓝宝石', level: 1, price: 5000, monthlyLimit: 80, type: 5, tip: '镶嵌增加防御' },
            { id: 59, name: '绿宝石', level: 1, price: 5000, monthlyLimit: 80, type: 5, tip: '镶嵌增加敏捷' },
            { id: 60, name: '黄宝石', level: 1, price: 5000, monthlyLimit: 80, type: 5, tip: '镶嵌增加体力' },
            { id: 61, name: '紫宝石', level: 1, price: 8000, monthlyLimit: 50, type: 5, tip: '镶嵌增加暴击' },
            { id: 62, name: '钻石', level: 1, price: 20000, monthlyLimit: 20, type: 5, tip: '顶级镶嵌宝石' },
            
            // === 坐骑/羽翼材料 ===
            { id: 63, name: '坐骑口粮', level: 1, price: 3000, monthlyLimit: 100, type: 34, tip: '坐骑培养材料' },
            { id: 64, name: '羽翼精华', level: 1, price: 15000, monthlyLimit: 40, type: 34, tip: '羽翼升级材料' },
            { id: 65, name: '进阶丹', level: 1, price: 50000, monthlyLimit: 15, type: 34, tip: '坐骑/羽翼进阶' },
            
            // === 特殊消耗品 ===
            { id: 66, name: '改名卡', level: 1, price: 100000, monthlyLimit: 5, type: 2, tip: '修改角色名称' },
            { id: 67, name: '洗点卡', level: 1, price: 150000, monthlyLimit: 5, type: 2, tip: '重置属性点' }
        ];
    }

    /**
     * 获取帮会状态信息
     * @returns {object} 帮会状态信息
     */
    getStatus() {
        return {
            id: this.id,
            name: this.name,
            level: this.level,
            fund: this.fund,
            notice: this.notice,
            maxMembers: this.maxMembers,
            role: this.role,
            contribution: this.contribution
        };
    }
}

export default Gang;