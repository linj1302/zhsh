import Play from './play.js';
import Monster from "./monster.js";
import Npc from "./npc.js";
import City from "./city.js";
import Equipment from "./equipment.js";
import Backpack from "./backpack.js";
import Sailing from "./sailing.js";
import Chat from "./chat.js";
import Team from "./team.js";
import ChatHandler from "./chatHandler.js";
import TeamHandler from "./teamHandler.js";
import Task from "./task.js";
import Gang from "./gang.js";
import Goods from "./goods.js";
import PetManager from "./petManager.js";
import Trial from "./trial.js";
import Fish from "./fish.js";
import Strengthen from "./strengthen.js";
// 导入新系统模块
import Mentor from "./mentor.js";
import Mount from "./mount.js";
import Wing from "./wing.js";
import Follower from "./follower.js";
import Card from "./card.js";
import HolyMark from "./holymark.js";
import Siege from "./siege.js";
import Achievement from "./achievement.js";
import MountainFortress from "./mountain_fortress.js";
import Holiday from "./holiday.js";
import FishingTournament from "./fishing_tournament.js";
import TeamDungeon from "./team_dungeon.js";
import EquipmentAwaken from "./equipment_awaken.js";
import Ranking from "./ranking.js";
// 强化展示表（等级→颜色/符号/称号）下沉至 config/strengthen.json
import { strengthen as strengthenDisplayConfig } from '../config/index.js';

export default class User {
    constructor(nickname, id, database = null) {
        this.nickname = nickname;
        this.id = id;
        this.backpack = new Backpack();
        this.equipment = new Equipment();
        // 初始化任务系统
        this.play = new Play(this.equipment, this.backpack);
        this.city = new City();
        this.task = new Task(this.backpack, this.city, this.play);
        this.npc = new Npc(this.city, this.play, this.backpack, this.task);
        this.sailing = new Sailing(this.play, this.city);
        this.trial = new Trial(this.city, this.task, this.play);
        // 初始化聊天系统
        this.chat = new Chat(database, id);
        // 初始化队伍系统
        this.team = new Team(database);
        // 初始化帮会系统
        this.gang = new Gang(database);
        this.gang.init(id);
        // 初始化宠物管理系统
        this.petManager = new PetManager(id, database, this.backpack, this.play);
        // 初始化随从系统（必须在monster之前）
        this.follower = new Follower(id, database, this.play, this.backpack);
        // 初始化节日活动（必须在monster之前）
        this.holiday = new Holiday(id, database, this.play, this.backpack);
        // 卡片系统与圣痕系统必须在 monster 之前初始化：
        // Monster 构造函数会保存 holymark/card 的引用，若在其之后创建，
        // monster 持有的引用将是 undefined，导致卡片战斗加成与卡片掉落失效。
        // Card/HolyMark 仅依赖 id/database/backpack/play（均已提前创建），无循环依赖。
        this.card = new Card(id, database, this.backpack, this.play);
        this.holymark = new HolyMark(id, database, this.play);
        this.monster = new Monster(this.play, this.city, this.backpack, this.task, this.petManager, this.follower, this.holiday, this.holymark, this.card);
        // 注入副本系统引用：怪物胜利结算时递增副本目标进度、战败时回退副本入口。
        // 'trial' 键名在 modalNames 中，getFullState/restoreState 会自动跳过，不会被序列化覆盖活实例。
        this.monster.trial = this.trial;
        // 初始化自动攻击状态
        this.isAutoAttackEnabled = false;
        this.fish = new Fish(this.play, this.sailing);
        // 初始化强化系统
        this.strengthen = new Strengthen();
        // 初始化药品栏设置
        this.medicineSettings = [];
        
        // 初始化新系统模块
        this.mentor = new Mentor(database, id);
        this.mount = new Mount(this.play, this.backpack);
        this.wing = new Wing(this.play, this.backpack);
        // 注意：card/holymark 已在 monster 之前初始化（见上方注释）
        this.siege = new Siege(database, id, this.gang);
        this.achievement = new Achievement(id, database, this.play, this.backpack);
        this.mountainFortress = new MountainFortress(id, database, this.play, this.backpack);
        // 初始化钓鱼大赛（依赖 play 与 fish，均已在上方创建）
        this.fishingTournament = new FishingTournament(this.play, this.fish, id, nickname);
        // 注入大赛引用：fish 钓获时自动记录大赛成绩（fish.js 内部已做判空保护）
        this.fish.tournament = this.fishingTournament;
        // 初始化组队副本（依赖 team 与 database，均已在上方创建）
        this.teamDungeon = new TeamDungeon(this.team, database, id);
        // 初始化装备觉醒系统（依赖 play/backpack/database）
        EquipmentAwaken.ensureTable(database);
        this.equipmentAwaken = new EquipmentAwaken(id, database, this.play, this.backpack);
        this.play.setAwakenModule(this.equipmentAwaken);
        // 初始化排行榜系统（依赖 database）
        this.ranking = new Ranking(database);
    }

    getPlay() {
        // 每次获取Play实例时更新体力宝加成
        this.play.updateStaminaBonus();
        return this.play;
    }

    getCity() {
        return this.city.getStatus()
    }

    getNpc(isMonsters) {
        return this.npc.getStatus(isMonsters)
    }

    getEquipment() {
        return this.equipment.getStatus()
    }

    getBackpack() {
        return this.backpack.getStatus()
    }

    getMonster() {
        return this.monster.getStatus()
    }

    // 切换自动攻击状态
    toggleAutoAttack() {
        this.isAutoAttackEnabled = !this.isAutoAttackEnabled;
    }

    getSailing() {
        return this.sailing.getSailingStatus()
    }

    // 发送聊天消息
    sendChatMessage(message, channel = 'public', targetUserId = null, gangId = null, teamId = null) {
        return this.chat.sendMessage(this.nickname, this.id, message, channel, targetUserId, gangId, teamId);
    }

    // 获取私聊会话列表
    getPrivateChatSessions() {
        if (this.chat.db) {
            return this.chat.db.getPrivateChatSessions(this.id);
        }
        return [];
    }

    // 获取聊天消息
    getChatMessages(limit = 50) {
        return this.chat.getMessages(limit);
    }

    // 获取全局聊天栏数据（每个页面调用）
    getGlobalChatBar(channel = 'public') {
        const gangInfo = this.gang ? this.gang.getStatus() : null;
        const hasGang = !!(gangInfo && gangInfo.id);
        const myTeam = this.team.getMyTeam(this.id);
        // 无权限查看的频道回退到公共频道
        if (channel === 'gang' && !hasGang) channel = 'public';
        if (channel === 'team' && !myTeam) channel = 'public';

        // 加载指定频道的最新消息
        let messages = [];
        if (this.chat.db) {
            let msgs = [];
            if (channel === 'gang') {
                msgs = this.chat.db.getChatMessages(8, 'gang', this.id)
                    .filter(msg => !msg.gang_id || msg.gang_id === gangInfo.id);
            } else if (channel === 'team') {
                msgs = this.chat.db.getChatMessages(8, 'team', this.id)
                    .filter(msg => !msg.team_id || msg.team_id === myTeam.id);
            } else if (channel === 'private') {
                // 私聊：显示与自己相关的最近消息（跨会话）
                msgs = this.chat.db.getChatMessages(8, 'private', this.id);
            } else {
                msgs = this.chat.db.getChatMessages(8, 'public');
            }
            messages = msgs.map(msg => ({
                user: msg.username,
                userId: msg.user_id,
                targetUserId: msg.target_user_id,
                toUser: null,
                message: msg.message,
                time: new Date(msg.created_at).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})
            }));
        }
        return {
            channel,
            hasGang,
            hasTeam: !!myTeam,
            publicMessages: messages
        };
    }

    // 创建队伍
    createTeam(teamName, teamType, target) {
        return this.team.createTeam(this, teamName, teamType, target);
    }

    // 加入队伍
    joinTeam(teamId) {
        return this.team.joinTeam(this.id, this.nickname, this.play.level, teamId);
    }

    // 退出队伍
    leaveTeam(teamId) {
        return this.team.leaveTeam(this.id, teamId);
    }

    // 解散队伍
    disbandTeam(teamId) {
        return this.team.disbandTeam(this.id, teamId);
    }

    // 获取队伍列表
    getTeams(page = 1, pageSize = 10) {
        return this.team.getTeams(page, pageSize);
    }

    // 获取我的队伍
    getMyTeam() {
        return this.team.getMyTeam(this.id);
    }

    // 帮会相关方法
    createGang(name) {
        return this.gang.create(name, this.id, this.nickname);
    }

    joinGang(gangId) {
        return this.gang.joinGang(gangId, this.id, this.nickname);
    }

    leaveGang() {
        return this.gang.leaveGang(this.id);
    }

    donateToGang(donationType, amount, contribution) {
        // 确保amount和contribution是数字类型
        const amountNum = parseInt(amount, 10);
        const contributionNum = parseInt(contribution, 10);

        // 检查参数是否为有效数字
        if (isNaN(amountNum) || isNaN(contributionNum)) {
            return {success: false, message: '参数错误：捐献数量和贡献值必须是数字'};
        }

        return this.gang.donate(this.id, this.nickname, donationType, amountNum, contributionNum);
    }

    // 帮会商店购买物品
    buyGangItem(itemId) {
        try {
            if (!this.gang || !this.gang.id) {
                return {success: false, tip: '您还没有加入帮会'};
            }
            const shopItems = this.gang.getShopItems();
            if (!shopItems || !shopItems.length) {
                return {success: false, tip: '商店暂无商品'};
            }
            // 通过 id 查找商品
            const id = parseInt(itemId);
            let item = null;
            if (!isNaN(id)) {
                item = shopItems.find(i => i.id === id);
            }
            // 兜底：通过数组索引查找
            if (!item && !isNaN(id) && id >= 0 && id < shopItems.length) {
                item = shopItems[id];
            }
            if (!item) {
                return {success: false, tip: '商品不存在'};
            }
            // 检查帮贡是否足够
            const myContribution = Number(this.gang.contribution) || 0;
            const price = Number(item.price) || 0;
            if (myContribution < price) {
                return {success: false, tip: '帮贡不足！需要' + price + '帮贡，当前只有' + myContribution};
            }
            // 扣帮贡
            this.gang.contribution -= price;
            // 添加到背包
            this.backpack.addItem({
                name: String(item.name),
                type: item.type || 1,
                num: 1,
                status: 1,
                info: { name: String(item.name), type: item.type || 1, level: Number(item.level) || 1 }
            });
            return {success: true, tip: '成功购买' + String(item.name) + '！消耗' + price + '帮贡'};
        } catch (error) {
            console.error('buyGangItem error:', error);
            return {success: false, tip: '购买失败：' + (error.message || '未知错误')};
        }
    }

    addGangStorageItem(itemId) {
        // 获取背包中的物品
        const backpackItems = this.backpack.getStatus().items;
        // 使用id属性查找物品（装备类型为1）
        const equipItems = backpackItems.filter(item => item.type === 1);
        const item = equipItems.find(item => item.id == itemId);

        if (!item) {
            return {success: false, message: '物品不存在'};
        }

        // 检查物品是否已锁定
        if (item.locked) {
            return {success: false, message: '该物品已锁定，无法捐献'};
        }

        // 添加到帮会仓库（包含物品的完整信息）
        const result = this.gang.addItemToStorage(item.name, item.level, item.info);

        // 如果添加成功，从背包中移除物品
        if (result.success) {
            // 根据物品的id属性从背包中移除物品
            this.backpack.removeItem(item.id);
        }

        // 无论是否成功都返回结果，以便前端显示消息
        return result;
    }

    removeGangStorageItem(storageId) {
        // 先获取物品信息
        const item = this.gang.getStorageItemById(storageId);
        if (!item) {
            return {success: false, message: '物品不存在'};
        }

        // 从仓库中移除物品
        const result = this.gang.removeItemFromStorage(storageId);

        // 如果移除成功，将物品添加到背包中
        if (result.success) {
            // 使用Goods类创建物品并添加到背包（包含完整信息）
            const goods = new Goods({
                name: item.item_name,
                type: 1, // 装备类型
                num: 1,
                info: item.item_info
            });
            this.backpack.addItem(goods);
        }

        return result;
    }

    getBackpackItems() {
        // 获取背包中的所有物品，并筛选出装备类物品（类型为1的物品）
        return this.backpack.getStatus().items.filter(item => item.type === 1);
    }

    // 任务系统相关方法
    acceptTask(taskIndex) {
        return this.task.acceptTask(taskIndex);
    }

    submitTask(taskIndex) {
        return this.task.submitTask(taskIndex);
    }

    // 好友系统相关方法
    addFriend(friendId) {
        const db = this.chat.db;
        if (!db) {
            return {success: false, message: '数据库连接失败'};
        }

        // 不能添加自己为好友
        if (this.id === friendId) {
            return {success: false, message: '不能添加自己为好友'};
        }

        const result = db.addFriendRequest(this.id, friendId);
        if (result) {
            return {success: true, message: '好友申请已发送'};
        } else {
            return {success: false, message: '好友申请发送失败，可能已发送过申请或已经是好友'};
        }
    }

    setMedicine({slot, itemId}) {
        slot = +slot
        if (slot >= 0 && slot < 6 && itemId) {
            var item = this.backpack.getItemById(itemId);
            if (item && (item.type === 3 || item.type === 4)) {
                // 初始化药品栏设置（如果不存在）
                if (!this.medicineSettings) {
                    this.medicineSettings = [];
                }

                // 设置药品栏
                this.medicineSettings[slot] = {
                    id: item.id,
                    name: item.name
                };

                return {
                    tip: '药品设置成功'
                }
            }
        }
    }

    clearMedicineSettings() {
        this.medicineSettings = [];
        return {
            tip: '药品栏已清空'
        }
    }

    /**
     * 接受好友申请
     * @param {number} friendId - 好友ID（发起申请的人）
     * @returns {object} 操作结果
     */
    acceptFriendRequest(friendId) {
        const db = this.chat.db;
        if (!db) {
            return {success: false, message: '数据库连接失败'};
        }

        const result = db.acceptFriendRequest(this.id, friendId);
        if (result) {
            return {success: true, message: '已接受好友申请'};
        } else {
            return {success: false, message: '接受好友申请失败'};
        }
    }

    rejectFriendRequest(friendId) {
        return this.removeFriend(friendId);
    }

    removeFriend(friendId) {
        const db = this.chat.db;
        if (!db) {
            return {success: false, message: '数据库连接失败'};
        }

        const result = db.removeFriend(this.id, friendId);
        if (result) {
            return {success: true, message: '已删除好友'};
        } else {
            return {success: false, message: '删除好友失败'};
        }
    }

    getFriends() {
        const db = this.chat.db;
        if (!db) {
            return [];
        }

        return db.getFriends(this.id);
    }

    getFriendRequests() {
        const db = this.chat.db;
        if (!db) {
            return [];
        }

        return db.getFriendRequests(this.id);
    }

    /**
     * 获取当前位置的在线用户列表
     * @returns {Array} 在线用户列表
     */
    getOnlineUsersInLocation() {
        // 获取数据库实例
        const db = this.chat.db;
        if (!db) {
            return [];
        }

        // 获取当前用户的位置信息
        const currentUserCity = this.city._city;
        const currentUserPosition = this.city._position;
        const currentUserId = this.id;
        const currentTime = Date.now();

        // 获取所有用户数据
        const sql = 'SELECT id, username, nickname FROM users';
        const allUsers = db.executeSQL(sql, [], 'all');

        // 过滤出在同一位置且在线的用户（5分钟内有活动）
        const onlineUsers = allUsers.filter(user => {
            // 排除自己
            if (user.id === currentUserId) {
                return false;
            }

            // 获取该用户的游戏数据
            const userData = db.loadUserData(user.id);
            if (!userData || !userData.city || !userData.updated_at) {
                return false;
            }

            // 检查位置是否相同
            if (userData.city._city !== currentUserCity ||
                userData.city._position !== currentUserPosition) {
                return false;
            }

            // 检查最后活动时间是否在5分钟内 (300000毫秒)
            const lastActiveTime = new Date(userData.updated_at).getTime();
            if (currentTime - lastActiveTime > 300000) {
                return false;
            }

            // 添加用户昵称到返回数据中
            user.nickname = user.nickname || user.username;
            return true;
        });

        return onlineUsers;
    }

    // 处理特殊页面的统一入口
    handleSpecialPage(page, query, config) {
        switch (page) {
            case 'chat': {
                const channel = query.channel || 'public';
                let chatMessages = [];
                let targetUserInfo = null;
                let privateChatSessions = [];
                let sendTip = '';

                // 获取私聊会话列表
                privateChatSessions = this.getPrivateChatSessions();

                // 处理发送消息（在这里处理而不是exec，以便自动注入gangId/teamId）
                if (query.type === 'sendChatMessage' && query.message && query.message.trim()) {
                    let gangId = null;
                    let teamId = null;
                    let targetUserId = query.targetUserId ? parseInt(query.targetUserId) : null;

                    // 自动注入gangId/teamId
                    if (channel === 'gang') {
                        const gangInfo = this.gang.getStatus();
                        gangId = gangInfo ? gangInfo.id : null;
                    } else if (channel === 'team') {
                        const teamInfo = this.team.getMyTeam(this.id);
                        teamId = teamInfo ? teamInfo.id : null;
                    }

                    const result = this.sendChatMessage(query.message, channel, targetUserId, gangId, teamId);
                    if (result && result.error) {
                        sendTip = result.error;
                    }
                }

                // 处理发起新私聊（通过用户名）
                if (channel === 'private' && !query.targetUserId && query.targetUsername) {
                    const targetUser = this.chat.db.getUserByUsername(query.targetUsername);
                    if (targetUser) {
                        targetUserInfo = targetUser;
                    } else {
                        sendTip = '未找到该玩家';
                    }
                }

                // 根据频道类型加载消息
                switch (channel) {
                    case 'private':
                        if (query.targetUserId) {
                            const targetUserId = parseInt(query.targetUserId);
                            if (this.chat.db) {
                                targetUserInfo = this.chat.db.getUserById(targetUserId);
                                const privateMessages = this.chat.db.getChatMessages(50, 'private', this.id);
                                chatMessages = privateMessages.map(msg => ({
                                    id: msg.id,
                                    user: msg.username,
                                    userId: msg.user_id,
                                    targetUserId: msg.target_user_id,
                                    message: msg.message,
                                    channel: msg.type || 'private',
                                    timestamp: new Date(msg.created_at)
                                })).filter(msg =>
                                    (msg.userId === this.id && msg.targetUserId === targetUserId) ||
                                    (msg.userId === targetUserId && msg.targetUserId === this.id)
                                );
                            }
                        } else if (targetUserInfo) {
                            // 通过用户名找到的用户，加载与该用户的消息
                            const targetUserId = targetUserInfo.id;
                            if (this.chat.db) {
                                const privateMessages = this.chat.db.getChatMessages(50, 'private', this.id);
                                chatMessages = privateMessages.map(msg => ({
                                    id: msg.id,
                                    user: msg.username,
                                    userId: msg.user_id,
                                    targetUserId: msg.target_user_id,
                                    message: msg.message,
                                    channel: msg.type || 'private',
                                    timestamp: new Date(msg.created_at)
                                })).filter(msg =>
                                    (msg.userId === this.id && msg.targetUserId === targetUserId) ||
                                    (msg.userId === targetUserId && msg.targetUserId === this.id)
                                );
                            }
                        }
                        break;

                    case 'gang': {
                        const gangInfo = this.gang.getStatus();
                        if (gangInfo && gangInfo.id && this.chat.db) {
                            const allGangMessages = this.chat.db.getChatMessages(50, 'gang', this.id);
                            // 优先按gang_id过滤，若消息无gang_id则也显示（兼容旧数据）
                            chatMessages = allGangMessages
                                .filter(msg => !msg.gang_id || msg.gang_id === gangInfo.id)
                                .map(msg => ({
                                    id: msg.id,
                                    user: msg.username,
                                    userId: msg.user_id,
                                    message: msg.message,
                                    channel: msg.type || 'gang',
                                    timestamp: new Date(msg.created_at)
                                }));
                        }
                        break;
                    }

                    case 'team': {
                        const myTeam = this.team.getMyTeam(this.id);
                        if (myTeam && this.chat.db) {
                            const allTeamMessages = this.chat.db.getChatMessages(50, 'team', this.id);
                            chatMessages = allTeamMessages
                                .filter(msg => !msg.team_id || msg.team_id === myTeam.id)
                                .map(msg => ({
                                    id: msg.id,
                                    user: msg.username,
                                    userId: msg.user_id,
                                    message: msg.message,
                                    channel: msg.type || 'team',
                                    timestamp: new Date(msg.created_at)
                                }));
                        }
                        break;
                    }

                    default:
                        // 公共频道
                        if (this.chat.db) {
                            const publicMsgs = this.chat.db.getChatMessages(50, 'public');
                            chatMessages = publicMsgs.map(msg => ({
                                id: msg.id,
                                user: msg.username,
                                userId: msg.user_id,
                                message: msg.message,
                                channel: msg.type || 'public',
                                timestamp: new Date(msg.created_at)
                            }));
                        }
                }

                return {
                    chatMessages,
                    channel,
                    targetUser: targetUserInfo,
                    privateChatSessions,
                    sendTip
                };
            }
            case 'team':
                return TeamHandler.handleTeamRequest(this, query, config);
            case 'my-team':
                return TeamHandler.handleMyTeamRequest(this, query, config);
            case 'voyage':
                const sailing = this.sailing;
                return {
                    tip: '',
                    page,
                    ...config,
                    query,
                    user: this,
                    sailingStatus: sailing.getSailingStatus()
                };
            case 'task':
                const taskIndexParam = query.params ? parseInt(query.params) : null;
                let taskInfo = null;

                if (taskIndexParam !== null) {
                    const taskData = this.task.getTaskData(taskIndexParam);
                    if (taskData) {
                        taskInfo = {
                            ...taskData,
                            isAccepted: this.task.isTaskAccepted(taskIndexParam),
                            isCompleted: this.task.isTaskCompleted(taskIndexParam)
                        };
                    }
                }

                return {
                    tip: '',
                    page: 'task',
                    ...config,
                    query,
                    user: this,
                    taskInfo
                };
            case 'task-list':
                return {
                    tip: '',
                    page: 'task-list',
                    ...config,
                    query,
                    user: this
                };
            case 'npc-tasks':
                return {
                    tip: '',
                    page: 'npc-tasks',
                    ...config,
                    query,
                    user: this
                };
            case 'npc-task-direct':
                return {
                    tip: '',
                    page: 'npc-task-direct',
                    ...config,
                    query,
                    user: this
                };
            case 'task-detail':
                const taskDetailIndex = query.taskIndex ? parseInt(query.taskIndex) : null;
                let detailTaskInfo = null;

                if (taskDetailIndex !== null) {
                    const taskData = this.task.getTaskData(taskDetailIndex);
                    if (taskData) {
                        detailTaskInfo = {
                            ...taskData,
                            isAccepted: this.task.isTaskAccepted(taskDetailIndex),
                            isCompleted: this.task.isTaskCompleted(taskDetailIndex)
                        };
                    }
                }

                return {
                    tip: '',
                    page: 'task-detail',
                    ...config,
                    query,
                    user: this,
                    taskInfo: detailTaskInfo
                };
            // 帮会相关页面
            case 'my-gang':
                return {
                    tip: '',
                    page: 'my-gang',
                    ...config,
                    query,
                    user: this,
                    gangInfo: this.gang.getStatus(),
                    gangMembers: this.gang.getMembers(),
                    gangMembersCount: this.gang.getMembers().length
                };
            case 'gang-detail':
                // 获取帮会ID
                const gangId = query.id ? parseInt(query.id) : null;
                if (!gangId) {
                    return {
                        tip: '',
                        page: 'gang-detail',
                        ...config,
                        query,
                        user: this,
                        gang: null
                    };
                }

                // 检查用户是否是该帮会成员
                const userGang = this.gang.getStatus();
                const isMember = userGang && userGang.id === gangId;

                // 如果是自己的帮会，直接跳转到my-gang页面
                if (isMember) {
                    return {
                        tip: '',
                        page: 'my-gang',
                        ...config,
                        query,
                        user: this,
                        gangInfo: userGang,
                        gangMembers: this.gang.getMembers(),
                        gangMembersCount: this.gang.getMembers().length
                    };
                }

                // 获取帮会信息
                const targetGang = this.gang.db ? this.gang.db.getGangById(gangId) : null;
                const gangMembers = this.gang.db ? this.gang.db.getGangMembers(gangId) : [];

                return {
                    tip: '',
                    page: 'gang-detail',
                    ...config,
                    query,
                    user: this,
                    gang: targetGang,
                    gangMembers: gangMembers,
                    isMember: isMember
                };
            case 'gang-list':
                return {
                    tip: '',
                    page: 'gang-list',
                    ...config,
                    query,
                    user: this,
                    gangList: this.gang.getGangList()
                };
            case 'gang-store':
                return {
                    tip: '',
                    page: 'gang-store',
                    ...config,
                    query,
                    user: this,
                    gangInfo: this.gang.getStatus(),
                    storageItems: this.gang.getStorageItems()
                };
            case 'gang-store-deposit':
                return {
                    tip: '',
                    page: 'gang-store-deposit',
                    ...config,
                    query,
                    user: this,
                    gangInfo: this.gang.getStatus(),
                    storageItems: this.gang.getStorageItems(),
                    backpackItems: this.getBackpackItems()
                };
            case 'gang-member':
                return {
                    tip: '',
                    page: 'gang-member',
                    ...config,
                    query,
                    user: this,
                    gangInfo: this.gang.getStatus(),
                    gangMembers: this.gang.getMembers()
                };
            case 'gang-donation':
                return {
                    tip: '',
                    page: 'gang-donation',
                    ...config,
                    query,
                    user: this,
                    gangInfo: this.gang.getStatus(),
                    donationRecords: this.gang.getDonationRecords()
                };
            case 'gang-shop':
                return {
                    tip: '',
                    page: 'gang-shop',
                    ...config,
                    query,
                    user: this,
                    gangInfo: this.gang.getStatus(),
                    shopItems: this.gang.getShopItems()
                };
            case 'create-gang':
                return {
                    tip: '',
                    page: 'create-gang',
                    ...config,
                    query,
                    user: this,
                    gangInfo: this.gang.getStatus()
                };
            case 'role-status':
                // 处理角色状态页面
                const userId = query.userId;
                let targetUser = this;
                let targetGender = null;

                // 获取目标用户的性别
                const db = this.chat.db;
                if (db) {
                    const targetId = (userId && userId !== this.id) ? userId : this.id;
                    const userData = db.getUserById(targetId);
                    if (userData) {
                        targetGender = userData.gender;
                    }
                }

                // 如果查询参数中有userId且不等于当前用户ID，则查找其他用户
                if (userId && userId !== this.id) {
                    // 从数据库获取目标用户信息
                    if (db) {
                        const userData = db.getUserById(userId);
                        if (userData) {
                            // 创建目标用户实例
                            targetUser = new User(userData.nickname, userData.id, db);
                            // 恢复用户状态
                            const savedUserData = db.loadUserData(userId);
                            if (savedUserData) {
                                targetUser.restoreState(savedUserData);
                            }
                        }
                    }

                    // 返回角色状态页面数据（查看他人信息）
                    return {
                        tip: '',
                        page: 'role-status',
                        ...config,
                        query,
                        user: this, // 当前用户
                        targetUser: targetUser, // 目标用户
                        targetGender: targetGender || 'male',
                        isSelf: false // 标记不是查看自己的信息
                    };
                } else {
                    // 返回角色状态页面数据（查看自己信息）
                    return {
                        tip: '',
                        page: 'role-status',
                        ...config,
                        query,
                        user: this,
                        targetUser: this,
                        targetGender: targetGender || 'male',
                        isSelf: true // 标记是查看自己的信息
                    };
                }
            case 'friend':
                // 处理好友页面
                const action = query.action;
                const friendUserId = query.userId ? parseInt(query.userId) : null;
                let message = null;

                // 处理好友操作
                if (action && friendUserId) {
                    switch (action) {
                        case 'add':
                            const addResult = this.addFriend(friendUserId);
                            message = {type: addResult.success ? 'success' : 'error', text: addResult.message};
                            break;
                        case 'accept':
                            const acceptResult = this.acceptFriendRequest(friendUserId);
                            message = {type: acceptResult.success ? 'success' : 'error', text: acceptResult.message};
                            break;
                        case 'reject':
                            const rejectResult = this.rejectFriendRequest(friendUserId);
                            message = {type: rejectResult.success ? 'success' : 'error', text: rejectResult.message};
                            break;
                        case 'remove':
                            const removeResult = this.removeFriend(friendUserId);
                            message = {type: removeResult.success ? 'success' : 'error', text: removeResult.message};
                            break;
                    }
                }

                // 获取好友列表或好友申请列表
                const showRequests = query.show === 'requests';
                const friends = showRequests ? null : this.getFriends();
                const friendRequests = showRequests ? this.getFriendRequests() : null;

                return {
                    tip: '',
                    page: 'friend',
                    ...config,
                    query,
                    user: this,
                    friends,
                    friendRequests,
                    showRequests,
                    message
                };
            case 'pet':
                // 获取用户的宠物列表
                const pets = this.petManager.getPets();

                // 注入计算属性（经验曲线/天赋效果/攻击力等）
                let enrichedPets = pets.map(p => this.petManager.getPetDetail(p.id) || p);

                // 如果有选中的宠物，获取其详细信息
                let selectedPet = null;
                if (typeof query.petIndex !== 'undefined') {
                    const petIndex = parseInt(query.petIndex);
                    if (!isNaN(petIndex) && petIndex >= 0 && petIndex < enrichedPets.length) {
                        selectedPet = enrichedPets[petIndex];
                    }
                } else if (enrichedPets.length > 0) {
                    // 默认选择第一只宠物
                    selectedPet = enrichedPets[0];
                }

                return {
                    tip: '',
                    page: 'pet',
                    ...config,
                    query,
                    user: this,
                    pets: enrichedPets,
                    selectedPet
                };
            case 'pet-hatch':
                // 获取背包中各类宠物蛋数量
                const eggNames = ['宠物蛋', 'QQ宠物蛋', '远古宠物蛋', '远古双超宠物蛋', '高级宠物蛋'];
                const eggCounts = {};
                eggNames.forEach(name => {
                    eggCounts[name] = this.backpack.getItemsByType(20).filter(egg =>
                        egg.name === name).reduce((total, egg) => total + egg.num, 0);
                });
                const slotInfo = this.petManager.getPetSlotInfo();

                return {
                    tip: '',
                    page: 'pet-hatch',
                    ...config,
                    query,
                    user: this,
                    ...eggCounts,
                    slotInfo
                };
            case 'pet-skills':
                return {
                    tip: '',
                    page: 'pet-skills',
                    ...config,
                    query,
                    user: this,
                    level: this.play.level
                };
            case 'pet-tool':
                // 根据action参数确定显示的物品类型
                let items = [];
                if (query.action === 'feed') {
                    // 获取饲料类物品
                    items = this.backpack.getItemsByType(25);
                } else if (query.action === 'clean') {
                    // 获取清洁剂类物品
                    items = this.backpack.getItemsByType(26);
                } else if (query.action === 'grow') {
                    // 获取成长类物品（暂时为空，可以后续添加相关物品）
                    items = this.backpack.getItemsByType(27);
                } else {
                    // 获取所有宠物用品
                    items = this.backpack.getPetItems();
                }

                // 为每个物品添加索引信息
                items = items.map((item) => ({
                    ...item,
                    id: this.backpack.getItemById(item.id) ? item.id : null
                }));

                return {
                    tip: '',
                    page: 'pet-tool',
                    ...config,
                    query,
                    user: this,
                    items
                };

            // 坐骑系统（合并原重复 case：action 处理在前，随后返回完整页面渲染参数；
            // 原 switch 中靠后的第二个 case 'mount' 不可达，已删除）
            case 'mount':
                if (query.action === 'ride' && query.mount) {
                    const result = this.mount.ride(query.mount);
                    if (!result.success) {
                        return {
                            tip: result.message,
                            page: 'mount',
                            ...config,
                            query,
                            user: this,
                            level: this.play.level
                        };
                    }
                }
                if (query.action === 'dismount') {
                    this.mount.dismount();
                }
                return {
                    tip: '',
                    page: 'mount',
                    ...config,
                    query,
                    user: this,
                    level: this.play.level,
                    mountStatus: this.mount.getStatus(),
                    mountList: this.mount.getMountList()
                };

            // 羽翼系统（合并原重复 case：action 处理在前，随后返回完整页面渲染参数；
            // 原 switch 中靠后的第二个 case 'wing' 不可达，已删除）
            case 'wing':
                if (query.action === 'equip' && query.wing) {
                    const result = this.wing.equip(query.wing);
                    if (!result.success) {
                        return {
                            tip: result.message,
                            page: 'wing',
                            ...config,
                            query,
                            user: this,
                            level: this.play.level
                        };
                    }
                }
                if (query.action === 'unequip') {
                    this.wing.unequip();
                }
                return {
                    tip: '',
                    page: 'wing',
                    ...config,
                    query,
                    user: this,
                    level: this.play.level,
                    wingStatus: this.wing.getStatus(),
                    wingList: this.wing.getWingList()
                };

            // 随从系统
            case 'follower':
                if (query.action === 'recruit' && query.id) {
                    const result = this.follower.recruit(parseInt(query.id), query.quality);
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query,
                        user: this,
                        level: this.play.level
                    };
                }
                if (query.action === 'setState' && query.id && query.state) {
                    const result = this.follower.setState(query.id, query.state);
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query,
                        user: this,
                        level: this.play.level
                    };
                }
                if (query.action === 'abandon' && query.id) {
                    const result = this.follower.abandon(query.id);
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query,
                        user: this,
                        level: this.play.level
                    };
                }
                // 随从装备操作
                if (query.action === 'equip' && query.recruitId && query.slot) {
                    // 如果指定了 itemId，直接装备
                    if (query.itemId) {
                        const result = this.follower.equipItem(query.recruitId, query.itemId, query.slot);
                        return {
                            tip: result.tip,
                            page: 'follower',
                            ...config,
                            query: {},
                            user: this,
                            level: this.play.level
                        };
                    }
                    // 否则显示装备选择页
                    const followers = this.follower.getFollowers();
                    const follower = followers.find(f => f.recruit_id === query.recruitId);
                    // 根据槽位筛选可装备物品类型
                    const slotTypes = { weapon: [1], armor: [2, 3], accessory: [4, 5, 6] };
                    const allowedTypes = slotTypes[query.slot] || [];
                    const equippable = this.backpack.items.filter(i =>
                        allowedTypes.includes(i.type) && i.status === 1
                    );
                    return {
                        tip: '',
                        page: 'follower-equip-select',
                        ...config,
                        query,
                        user: this,
                        follower: follower,
                        slot: query.slot,
                        slotName: { weapon: '武器', armor: '防具', accessory: '饰品' }[query.slot],
                        equippableItems: equippable,
                        level: this.play.level
                    };
                }
                if (query.action === 'unequip' && query.recruitId && query.slot) {
                    const result = this.follower.unequipItem(query.recruitId, query.slot);
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query: {},
                        user: this,
                        level: this.play.level
                    };
                }
                // 随从精灵管理页面
                if (query.action === 'sprite' && query.recruitId) {
                    const followers = this.follower.getFollowers();
                    const follower = followers.find(f => f.recruit_id == query.recruitId);
                    const sprite = this.follower.getSprite(query.recruitId);
                    const SPRITE_MAX_LVL = { normal:20, excellent:30, elite:40, perfect:50, legend:50 };
                    const SPRITE_MAX_SLOTS = { normal:4, excellent:5, elite:6, perfect:8, legend:8 };
                    return {
                        tip: '',
                        page: 'follower-sprite',
                        ...config,
                        query,
                        user: this,
                        follower: follower,
                        sprite: sprite,
                        maxLevel: SPRITE_MAX_LVL[follower?.quality] || 20,
                        maxSlots: SPRITE_MAX_SLOTS[follower?.quality] || 4,
                        level: this.play.level
                    };
                }
                // 刷新招募池
                if (query.action === 'refreshPool') {
                    const result = this.follower.refreshPool();
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query: {},
                        user: this,
                        level: this.play.level
                    };
                }
                // 传承
                if (query.action === 'inherit' && query.sourceId && query.targetId) {
                    const result = this.follower.inherit(query.sourceId, query.targetId);
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query: {},
                        user: this,
                        level: this.play.level
                    };
                }
                // 精灵领悟技能
                if (query.action === 'enlighten' && query.recruitId) {
                    const result = this.follower.enlighten(query.recruitId);
                    // 返回精灵管理页面
                    const followers = this.follower.getFollowers();
                    const follower = followers.find(f => f.recruit_id == query.recruitId);
                    const sprite = this.follower.getSprite(query.recruitId);
                    const SPRITE_MAX_LVL = { normal:20, excellent:30, elite:40, perfect:50, legend:50 };
                    const SPRITE_MAX_SLOTS = { normal:4, excellent:5, elite:6, perfect:8, legend:8 };
                    return {
                        tip: result.tip,
                        page: 'follower-sprite',
                        ...config,
                        query: {},
                        user: this,
                        follower: follower,
                        sprite: sprite,
                        maxLevel: SPRITE_MAX_LVL[follower?.quality] || 20,
                        maxSlots: SPRITE_MAX_SLOTS[follower?.quality] || 4,
                        level: this.play.level
                    };
                }
                // 随魂兑换传说随从
                if (query.action === 'exchangeLegend') {
                    const result = this.follower.exchangeLegend();
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query: {},
                        user: this,
                        level: this.play.level
                    };
                }
                // 卷轴升级技能
                if (query.action === 'scrollUpgrade' && query.recruitId && query.skillId && query.scrollLevel) {
                    const result = this.follower.learnFromScroll(query.recruitId, query.skillId, parseInt(query.scrollLevel));
                    // 返回精灵管理页面
                    const followers = this.follower.getFollowers();
                    const follower = followers.find(f => f.recruit_id == query.recruitId);
                    const sprite = this.follower.getSprite(query.recruitId);
                    const SPRITE_MAX_LVL = { normal:20, excellent:30, elite:40, perfect:50, legend:50 };
                    const SPRITE_MAX_SLOTS = { normal:4, excellent:5, elite:6, perfect:8, legend:8 };
                    return {
                        tip: result.tip,
                        page: 'follower-sprite',
                        ...config,
                        query: {},
                        user: this,
                        follower: follower,
                        sprite: sprite,
                        maxLevel: SPRITE_MAX_LVL[follower?.quality] || 20,
                        maxSlots: SPRITE_MAX_SLOTS[follower?.quality] || 4,
                        level: this.play.level
                    };
                }
                // 培养（预览）
                if (query.action === 'train' && query.recruitId) {
                    const result = this.follower.train(query.recruitId);
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query: {},
                        user: this,
                        trainResult: result.success ? { recruitId: query.recruitId, gains: result.statGains, trainCount: result.trainCount, maxTrains: result.maxTrains } : null,
                        level: this.play.level
                    };
                }
                // 确认培养
                if (query.action === 'confirmTrain' && query.recruitId && query.atk && query.def && query.agi) {
                    const statGains = { attack: parseInt(query.atk), defense: parseInt(query.def), agility: parseInt(query.agi) };
                    const result = this.follower.confirmTrain(query.recruitId, statGains);
                    return {
                        tip: result.tip,
                        page: 'follower',
                        ...config,
                        query: {},
                        user: this,
                        level: this.play.level
                    };
                }
                return {
                    tip: '',
                    page: 'follower',
                    ...config,
                    query,
                    user: this,
                    level: this.play.level
                };

            // 卡片系统
            case 'card':
                return {
                    tip: '',
                    page: 'card',
                    ...config,
                    query,
                    user: this,
                    level: this.play.level
                };

            // 圣痕系统
            case 'holymark':
                return {
                    tip: '',
                    page: 'holymark',
                    ...config,
                    query,
                    user: this,
                    level: this.play.level
                };

            // 攻城系统
            case 'siege':
                return {
                    tip: '',
                    page: 'siege',
                    ...config,
                    query,
                    user: this,
                    level: this.play.level
                };

            // 婚姻系统相关页面
            case 'marriage':
                // 婚姻主页面
                const marriageInfo = this.getMarriageInfo();
                const receivedProposals = this.getReceivedMarriageProposals();
                const sentProposals = this.getSentMarriageProposals();
                const eligibleFriends = this.getEligibleFriendsForMarriage();
                const activeBanquets = this.chat.db ? this.getActiveBanquets() : [];

                return {
                    tip: '',
                    page: 'marriage',
                    ...config,
                    query,
                    user: this,
                    marriageInfo,
                    receivedProposals,
                    sentProposals,
                    eligibleFriends,
                    activeBanquets
                };



            case 'marriage-wedding':
                // 举办婚宴页面
                const userMarriageInfo = this.getMarriageInfo();
                if (!userMarriageInfo) {
                    return {
                        tip: '您尚未结婚，无法举办婚宴',
                        page: 'marriage',
                        ...config,
                        query,
                        user: this,
                        marriageInfo: null,
                        receivedProposals: this.getReceivedMarriageProposals(),
                        sentProposals: this.getSentMarriageProposals(),
                        eligibleFriends: this.getEligibleFriendsForMarriage()
                    };
                }

                return {
                    tip: '',
                    page: 'marriage-wedding',
                    ...config,
                    query,
                    user: this,
                    marriageInfo: userMarriageInfo
                };

            case 'marriage-divorce':
                // 强制离婚页面
                const divorceMarriageInfo = this.getMarriageInfo();
                if (!divorceMarriageInfo) {
                    return {
                        tip: '您尚未结婚，无法申请离婚',
                        page: 'marriage',
                        ...config,
                        query,
                        user: this,
                        marriageInfo: null,
                        receivedProposals: this.getReceivedMarriageProposals(),
                        sentProposals: this.getSentMarriageProposals(),
                        eligibleFriends: this.getEligibleFriendsForMarriage()
                    };
                }

                return {
                    tip: '',
                    page: 'marriage-divorce',
                    ...config,
                    query,
                    user: this,
                    marriageInfo: divorceMarriageInfo
                };

            case 'marriage-banquet':
                return {
                    tip: '',
                    page: 'marriage-banquet',
                    ...config,
                    query,
                    user: this,
                    activeBanquets: this.chat.db ? this.getActiveBanquets() : []
                };

            case 'marriage-proposal':
                // 求婚信息+发起求婚合并页面
                const allFriends = this.getFriends();
                const eligibleFriendsForProposal = allFriends.filter(friend => {
                    return !this.isUserMarried(friend.id) 
                        && !this.getMarriageProposalWith(friend.id);
                });

                return {
                    tip: '',
                    page: 'marriage-proposal',
                    ...config,
                    query,
                    user: this,
                    receivedProposals: this.getReceivedMarriageProposals(),
                    sentProposals: this.getSentMarriageProposals(),
                    friends: eligibleFriendsForProposal
                };

            case 'marriage-info':
                // 婚姻说明页面
                return {
                    tip: '',
                    page: 'marriage-info',
                    ...config,
                    query,
                    user: this
                };

            // 攻城系统页面
            case 'siege':
                return {
                    tip: '',
                    page: 'siege',
                    ...config,
                    query,
                    user: this,
                    siegeStatus: this.siege.getStatus(),
                    activeSieges: this.siege.getActiveSieges(),
                    mySieges: this.siege.getMySieges()
                };

            case 'fishing-tournament':
                // 钓鱼大赛页：注入模块状态（当前比赛/个人统计/排行榜）
                return {
                    tip: '',
                    page: 'fishing-tournament',
                    ...config,
                    query,
                    user: this,
                    activeTournament: this.fishingTournament.getActiveTournament() || null,
                    playerStats: this.fishingTournament.getPlayerStats(),
                    leaderboards: this.fishingTournament.getLeaderboard(),
                    tournamentHistory: this.fishingTournament.getTournamentHistory()
                };
            case 'team-dungeon':
                // 组队副本页：注入队伍与副本状态（可选 dungeonId 查看具体副本）
                const teamDungeonId = query.dungeonId ? Number(query.dungeonId) : null;
                return {
                    tip: '',
                    page: 'team-dungeon',
                    ...config,
                    query,
                    user: this,
                    myTeam: this.teamDungeon.getMyTeam(),
                    currentDungeon: teamDungeonId ? this.teamDungeon.getDungeonStatus(teamDungeonId) : null,
                    dungeonList: Object.keys(this.teamDungeon.dungeons).map(k => this.teamDungeon.getDungeonStatus(k))
                };

            case 'ranking':
                // 排行榜页面
                const rankingType = query.rankingType || 'level';
                const rankingData = this.ranking.getRanking(rankingType, 30);
                const rankingTypes = this.ranking.getRankingTypes();
                return {
                    tip: '',
                    page: 'ranking',
                    ...config,
                    query,
                    user: this,
                    rankingType,
                    rankingData,
                    rankingTypes
                };

            default:
                return {
                    tip: '',
                    page,
                    ...config,
                    query,
                    user: this
                };
        }
    }

    exec(type, params) {
        // 安全拦截：禁止通过 exec 反射调用下划线开头的私有方法（如 card._upgradePair）
        if (typeof type === 'string' && /(^|\.)_/.test(type)) return undefined;
        params = params || []
        let result;

        // 战斗前注入队伍/结婚/卡片加成
        if (type === 'monster.assault') {
            // 队伍加成
            const myTeam = this.team.getMyTeam(this.id);
            if (myTeam) {
                this.play.setTeamBonus(myTeam.members.length);
            }
            // 结婚加成
            const marriageInfo = this.getMarriageInfo ? this.getMarriageInfo() : null;
            if (marriageInfo) {
                this.play.setMarriageBonus(marriageInfo.intimacy || 0);
            }
        }

        // 进副本前注入队伍信息与婚姻状态，用于副本人数的软校验（建议组队提示）与情侣副本准入校验（软校验）
        if (type === 'trial.enterTrial') {
            // enterTrial(name, teamInfo, marriageInfo) 按位置取参，而 params 来自用户可控的 query 逗号切分（长度不限）。
            // 若不先收窄，params=情侣副本,x 会让 marriageInfo 位收到用户伪造值/team 对象，从而绕过未婚准入校验。
            // 故先把用户参数截断到该方法实际需要的 1 位（name），再追加带外参数。
            params = params.slice(0, 1);
            params.push(this.team.getMyTeam(this.id));
            params.push(this.getMarriageInfo() || null);
        }

        if (this[type]) {
            result = this[type](...params)
        } else {
            const [t1, t2] = type.split('.')
            result = this[t1]?.[t2]?.(...params)
        }
        // 组队副本发起后向公共聊天频道广播组队信息：
        // 成功→发起公告；人数不足→转为征集补员公告（点击即有反馈，避免静默失败）
        if (type === 'teamDungeon.createDungeon') {
            const dungeonName = typeof params[0] === 'string' ? params[0] : '';
            const myTeam = this.team.getMyTeam(this.id);
            const memberCount = myTeam ? (myTeam.members.length || 1) : 1;
            const joinLink = myTeam ? `/team?type=joinTeam&teamId=${myTeam.id}` : '';
            if (result && result.success) {
                this.sendChatMessage(`【组队副本】${this.nickname} 发起【${dungeonName}】挑战（${memberCount}人队伍），欢迎大家一起来！${joinLink}`);
            } else if (result && myTeam) {
                const need = parseInt((result.tip || '').match(/(\d+)人/)?.[1] || '0');
                if (need > 0) {
                    this.sendChatMessage(`【组队副本】${this.nickname} 的队伍【${myTeam.name}】挑战【${dungeonName}】，现有 ${memberCount}/${need} 人，缺员速来！${joinLink}`);
                }
            }
        }
        // 节日活动追踪
        if (this.holiday) {
            if (type === 'task.complete' || type === 'task.finish') this.holiday.recordTaskComplete();
            if (type === 'city.move' || type === 'city.walk' || type === 'insideMap.move') this.holiday.recordWalkStep();
            if (type === 'npc.talk' || type === 'npc.visit') this.holiday.recordNpcVisit();
            if (type === 'trial.complete' || type === 'trial.finish') this.holiday.recordTrialComplete();
        }
        return result;
    }

    getStatus() {
        return {
            nickname: this.nickname,
            id: this.id,
        };
    }

    // 获取完整的用户状态用于保存到数据库
    getFullState() {
        const res = {
            nickname: this.nickname,
            id: this.id,
            // 不再需要保存聊天消息，因为已经独立存储在数据库中
            chat: this.chat.getState(),
            // 不再需要保存队伍信息，因为已经独立存储在数据库中
            team: this.team.getState(),
            // 帮会信息通过数据库存储，不需要保存在用户状态中
            isAutoAttackEnabled: this.isAutoAttackEnabled,
        }
        const modalNames = ['backpack', 'equipment', 'play', 'city', 'monster', 'npc', 'task', 'medicineSettings', 'trial', 'petManager', 'sailing', 'mount', 'wing', 'follower', 'card', 'holymark', 'achievement', 'mountainFortress', 'holiday', 'fishingTournament', 'teamDungeon'];

        // 应用节假日倍率
        if (this.holiday) this.holiday.applyMultipliers();

        // 排除模块实例引用字段：这些是构造函数注入的活实例引用（如 monster.cardModule），
        // 序列化会丢失方法，恢复时会用纯数据对象覆盖活实例，导致 getCardBonus 等方法不存在而报错。
        // holymark 因键名恰在 modalNames 中已被跳过；followerModule/holidayModule 同理排除。
        const excludedKeys = ['db', 'fish', 'team', 'cardModule', 'followerModule', 'holidayModule', 'play', 'backpack', '_awakenModule'];
        modalNames.forEach(name => {
            const r = {}
            Object.keys(this[name]).forEach(key => {
                if (modalNames.includes(key) || excludedKeys.includes(key)) {
                    return
                }
                r[key] = this[name][key];
            })
            res[name] = r;
        });
        return res;
    }

    // 神父功能：祈祷（回满血）
    priest_pray() {
        // 检查是否有足够的铜币
        /*        if (this.play.copper < 1000) {
                    return {tip: '你的铜币不足1000，无法进行祈祷！'};
                }

                // 扣除费用
                this.play.copper -= 1000;*/

        // 执行功能
        const maxHealth = this.play.health;
        this.play.currentHealth = maxHealth;
        return {tip: '你进行了祈祷，生命值已完全恢复！'};
    }

    // 神父功能：忏悔（减少4点罪恶值）
    priest_repent() {
        // 检查是否有足够的铜币
        if (this.play.copper < 1000) {
            return {tip: '你的铜币不足1000，无法进行忏悔！'};
        }

        // 扣除费用
        this.play.copper -= 1000;

        // 这里使用reputation属性存储罪恶值
        const currentReputation = this.play.reputation;
        this.play.reputation = Math.max(0, currentReputation - 4);
        return {tip: '你进行了忏悔，罪恶值减少了4点！'};
    }

    // 女巫功能：占卜（增加5点幸运值，最多到70）
    witch_divine() {
        // 检查是否有足够的铜币
        if (this.play.copper < 1000) {
            return {tip: '你的铜币不足1000，无法进行占卜！'};
        }

        // 扣除费用
        this.play.copper -= 1000;

        const currentLuck = this.play.luck;
        if (currentLuck >= 70) {
            return {tip: '你的幸运值已经达到上限！'};
        }

        const newLuck = Math.min(70, currentLuck + 5);
        this.play.luck = newLuck;
        return {tip: `你进行了占卜，幸运值增加了${newLuck - currentLuck}点！`};
    }

    // 赌场功能：赌大小
    casino_dice() {
        // 检查是否有足够的铜币
        if (this.play.copper < 1000) {
            return {tip: '你的铜币不足1000，无法进行赌博！'};
        }

        // 扣除费用
        this.play.copper -= 1000;

        // 生成随机数1-6代表骰子点数
        const playerGuess = Math.floor(Math.random() * 6) + 1;
        const diceResult = Math.floor(Math.random() * 6) + 1;

        if (playerGuess === diceResult) {
            // 猜对了，赢得1银贝
            this.play.copper += 1000;
            return {tip: `骰子结果是${diceResult}点，你猜对了！赢得1银贝。`};
        } else {
            // 猜错了，输掉1银贝
            this.play.copper -= 1000;
            return {tip: `骰子结果是${diceResult}点，你猜错了！输掉1银贝。`};
        }
    }

    // 赌场功能：石头剪刀布
    casino_rps() {
        // 检查是否有足够的铜币
        if (this.play.copper < 1000) {
            return {tip: '你的铜币不足1000，无法进行赌博！'};
        }

        // 扣除费用
        this.play.copper -= 1000;

        // 生成玩家和庄家的选择（0=石头，1=剪刀，2=布）
        const playerChoice = Math.floor(Math.random() * 3);
        const bankerChoice = Math.floor(Math.random() * 3);

        const choices = ['石头', '剪刀', '布'];
        const playerChoiceText = choices[playerChoice];
        const bankerChoiceText = choices[bankerChoice];

        // 判断胜负
        if (playerChoice === bankerChoice) {
            // 平局
            return {tip: `你出了${playerChoiceText}，庄家出了${bankerChoiceText}，平局！`};
        } else if (
            (playerChoice === 0 && bankerChoice === 1) ||
            (playerChoice === 1 && bankerChoice === 2) ||
            (playerChoice === 2 && bankerChoice === 0)
        ) {
            // 玩家胜利
            this.play.copper += 1000;
            return {tip: `你出了${playerChoiceText}，庄家出了${bankerChoiceText}，你赢了！赢得1银贝。`};
        } else {
            // 玩家失败
            this.play.copper -= 1000;
            return {tip: `你出了${playerChoiceText}，庄家出了${bankerChoiceText}，你输了！输掉1银贝。`};
        }
    }

    // 从保存的数据中恢复用户状态
    restoreState(state) {
        if (!state) return;

        this.nickname = state.nickname;
        this.id = state.id;
        // 恢复自动攻击状态
        this.isAutoAttackEnabled = state.isAutoAttackEnabled || false;
        const modalNames = ['backpack', 'equipment', 'play', 'city', 'monster', 'npc', 'task', 'medicineSettings', 'trial', 'petManager', 'sailing', 'mount', 'wing', 'follower', 'card', 'holymark', 'achievement', 'mountainFortress', 'holiday', 'fishingTournament', 'teamDungeon'];
        // 与 getFullState 保持一致：跳过模块实例引用字段，避免用纯数据对象覆盖构造函数注入的活实例（否则 cardModule.getCardBonus 等方法丢失）
        const excludedKeys = ['db', 'fish', 'team', 'cardModule', 'followerModule', 'holidayModule'];
        modalNames.forEach(name => {
            if (state[name]) {
                Object.keys(state[name]).forEach(key => {
                    if (modalNames.includes(key) || excludedKeys.includes(key)) {
                        return
                    }
                    this[name][key] = state[name][key];
                })
            }
        });

        // 清洗历史脏数据：早期 bug 曾把 query 对象写入 monster.name，非字符串会导致 EJS 渲染崩溃
        if (this.monster && this.monster.name !== null && typeof this.monster.name !== 'string') {
            this.monster.name = null;
        }

        // 恢复聊天状态（消息将从数据库加载）
        if (state.chat) {
            this.chat.restoreState(state.chat);
        }

        // 恢复队伍状态（队伍信息将从数据库加载）
        if (state.team) {
            this.team.restoreState(state.team);
        }

        // 恢复任务状态
        if (state.task) {
            this.task.restoreState(state.task);
        }

        // 初始化帮会系统
        this.gang.init(this.id);
    }

    // 检查某用户是否已经结婚（和任何人）
    isUserMarried(userId) {
        const db = this.chat.db;
        if (!db) return false;
        const sql = `SELECT id FROM marriages WHERE (user1_id = ? OR user2_id = ?) AND status = 'married'`;
        return !!db.executeSQL(sql, [userId, userId], 'get');
    }

    // 获取装备强化等级对应的颜色和标记
    // 1-7级: 白橙黄绿蓝红紫 (纯色)
    // 8-15级: 银光→金光→虹光→星辰→混沌→不朽→创世→无上 (色+符+称号)
    getStrengthenDisplay(level) {
        if (!level || level <= 0) return null;
        const lv = Math.min(level, 15);
        // 数据源：config/strengthen.json（等级→{color, symbol, tag}，与原硬编码表逐项一致）
        return strengthenDisplayConfig[String(lv)];
    }

    // 婚姻系统相关方法
    // 获取可求婚的好友列表（亲密度≥700且对方未有伴侣）
    getEligibleFriendsForMarriage() {
        const db = this.chat.db;
        if (!db) return [];

        const friends = db.getFriends(this.id);

        const eligibleFriends = friends.filter(friend => {
            // 对方不能已婚（和任何人）
            if (this.isUserMarried(friend.id)) return false;
            // 不能有 pending 求婚
            if (this.getMarriageProposalWith(friend.id)) return false;
            return true;
        });

        return eligibleFriends;
    }

    // 发起求婚
    proposeMarriage(targetUserId) {
        const db = this.chat.db;
        if (!db) {
            return {success: false, tip: '数据库连接失败'};
        }

        // 检查是否已经是夫妻
        if (this.isMarriedTo(targetUserId)) {
            return {success: false, tip: '你们已经是夫妻了'};
        }

        // 检查对方是否已经结婚（和任何人）
        if (this.isUserMarried(targetUserId)) {
            return {success: false, tip: '对方已经结婚了'};
        }

        // 检查是否已经求婚
        const existingProposal = this.getMarriageProposalWith(targetUserId);
        if (existingProposal) {
            return {success: false, tip: '求婚申请已发送，请等待对方回应'};
        }

        // 创建求婚申请
        const sql = `
            INSERT INTO marriage_proposals (proposer_id, proposee_id, status, created_at)
            VALUES (?, ?, ?, ?)
        `;

        try {
            const result = db.executeSQL(sql, [this.id, targetUserId, 'pending', new Date().toISOString().replace('T',' ').substring(0,19)], 'run');
            return {success: result === true, tip: result ? '求婚申请已发送' : '求婚发送失败'};
        } catch (error) {
            console.error('求婚申请失败:', error);
            return {success: false, tip: '求婚申请发送失败'};
        }
    }

    // 获取收到的求婚申请
    getReceivedMarriageProposals() {
        const db = this.chat.db;
        if (!db) {
            return [];
        }

        const sql = `
            SELECT p.*, u.nickname as proposer_nickname
            FROM marriage_proposals p
                     JOIN users u ON p.proposer_id = u.id
            WHERE p.proposee_id = ?
              AND p.status = 'pending'
        `;

        return db.executeSQL(sql, [this.id], 'all');
    }

    // 获取发出的求婚申请
    getSentMarriageProposals() {
        const db = this.chat.db;
        if (!db) {
            return [];
        }

        const sql = `
            SELECT p.*, u.nickname as proposee_nickname
            FROM marriage_proposals p
                     JOIN users u ON p.proposee_id = u.id
            WHERE p.proposer_id = ?
              AND p.status = 'pending'
        `;

        return db.executeSQL(sql, [this.id], 'all');
    }

    // 检查两人是否已婚
    isMarriedTo(userId) {
        const db = this.chat.db;
        if (!db) {
            return false;
        }

        const sql = `
            SELECT *
            FROM marriages
            WHERE (user1_id = ? AND user2_id = ?)
               OR (user1_id = ? AND user2_id = ?)
                AND status = 'married'
        `;

        const result = db.executeSQL(sql, [this.id, userId, userId, this.id], 'get');
        return !!result;
    }

    // 获取与某人的求婚申请状态
    getMarriageProposalWith(userId) {
        const db = this.chat.db;
        if (!db) {
            return null;
        }

        const sql = `
            SELECT *
            FROM marriage_proposals
            WHERE ((proposer_id = ? AND proposee_id = ?) OR (proposer_id = ? AND proposee_id = ?))
              AND status = 'pending'
        `;

        return db.executeSQL(sql, [this.id, userId, userId, this.id], 'get');
    }

    // 接受求婚
    acceptMarriageProposal(proposalId) {
        const db = this.chat.db;
        if (!db) {
            return {success: false, tip: '数据库连接失败'};
        }

        // 获取求婚信息
        const proposalSql = `SELECT *
                             FROM marriage_proposals
                             WHERE id = ?
                               AND proposee_id = ?`;
        const proposal = db.executeSQL(proposalSql, [proposalId, this.id], 'get');

        if (!proposal) {
            return {success: false, tip: '求婚申请不存在'};
        }

        // 检查求婚是否已过期（24小时内有效）
        const createdTime = new Date(proposal.created_at);
        const now = new Date();
        const diffHours = (now - createdTime) / (1000 * 60 * 60);

        if (diffHours > 24) {
            // 标记为过期
            const expireSql = `UPDATE marriage_proposals
                               SET status = 'expired'
                               WHERE id = ?`;
            db.executeSQL(expireSql, [proposalId], 'run');
            return {success: false, tip: '求婚申请已过期'};
        }

        // 更新求婚状态为已接受
        const updateProposalSql = `UPDATE marriage_proposals
                                   SET status = 'accepted'
                                   WHERE id = ?`;
        db.executeSQL(updateProposalSql, [proposalId], 'run');

        // 创建婚姻关系
        const createMarriageSql = `
            INSERT INTO marriages (user1_id, user2_id, status, created_at)
            VALUES (?, ?, 'married', CURRENT_TIMESTAMP)
        `;
        db.executeSQL(createMarriageSql, [proposal.proposer_id, proposal.proposee_id], 'run');

        return {success: true, tip: '已接受求婚，恭喜你们成为夫妻！'};
    }

    // 拒绝求婚
    rejectMarriageProposal(proposalId) {
        const db = this.chat.db;
        if (!db) return {success: false, tip: '数据库连接失败'};

        const sql = `UPDATE marriage_proposals
                     SET status = 'rejected'
                     WHERE id = ?
                       AND proposee_id = ?`;
        const result = db.executeSQL(sql, [proposalId, this.id], 'run');

        if (result) return {success: true, tip: '已拒绝求婚申请'};
        else return {success: false, tip: '操作失败'};
    }

    // 获取婚姻信息
    getMarriageInfo() {
        const db = this.chat.db;
        if (!db) {
            return null;
        }

        const sql = `
            SELECT m.*,
                   u1.nickname as user1_nickname,
                   u2.nickname as user2_nickname
            FROM marriages m
                     JOIN users u1 ON m.user1_id = u1.id
                     JOIN users u2 ON m.user2_id = u2.id
            WHERE (m.user1_id = ? OR m.user2_id = ?)
              AND m.status = 'married'
        `;

        return db.executeSQL(sql, [this.id, this.id], 'get');
    }

    // 获取婚姻状态文本
    getMarriageStatus() {
        const marriageInfo = this.getMarriageInfo();
        if (!marriageInfo) {
            return '单身';
        }

        // 判断自己是user1还是user2，以确定配偶是谁
        if (marriageInfo.user1_id == this.id) {
            return '已婚(' + marriageInfo.user2_nickname + ')';
        } else {
            return '已婚(' + marriageInfo.user1_nickname + ')';
        }
    }

    // 申请离婚
    requestDivorce() {
        const db = this.chat.db;
        if (!db) return {success: false, tip: '数据库连接失败'};

        const marriageInfo = this.getMarriageInfo();
        if (!marriageInfo) return {success: false, tip: '您尚未结婚'};

        const sql = `UPDATE marriages SET status = 'divorced' WHERE id = ?`;
        const result = db.executeSQL(sql, [marriageInfo.id], 'run');

        if (result) return {success: true, tip: '已成功离婚'};
        else return {success: false, tip: '离婚申请失败'};
    }

    // 举办婚宴
    hostWedding() {
        const db = this.chat.db;
        if (!db) return { success: false, tip: '数据库连接失败' };
        const marriageInfo = this.getMarriageInfo();
        if (!marriageInfo) return { success: false, tip: '您尚未结婚' };

        const existing = db.executeSQL(
            `SELECT id FROM marriage_banquets WHERE host_id = ? AND status = 'active'`,
            [this.id], 'get'
        );
        if (existing) return { success: false, tip: '您已有进行中的婚宴' };

        let cost = 10;
        if (this.holiday && this.holiday.marriageFree) cost = 0;
        if (cost > 0 && this.play.gold < cost) return { success: false, tip: `需要${cost}金贝` };
        if (cost > 0) this.play.gold -= cost;

        db.executeSQL(
            `INSERT INTO marriage_banquets (marriage_id, host_id, status, guest_count, needed_guests, created_at)
             VALUES (?, ?, 'active', 0, 8, CURRENT_TIMESTAMP)`,
            [marriageInfo.id, this.id], 'run'
        );

        return { success: true, tip: cost > 0 ? `消耗${cost}金贝，婚宴已举办！` : '七夕结婚免费，婚宴已举办！' };
    }

    // 加入婚宴
    joinBanquet(banquetId) {
        const db = this.chat.db;
        if (!db) return { success: false, tip: '数据库连接失败' };
        const banquet = db.executeSQL(
            `SELECT * FROM marriage_banquets WHERE id = ? AND status = 'active'`, [banquetId], 'get'
        );
        if (!banquet) return { success: false, tip: '婚宴已结束' };

        const already = db.executeSQL(
            `SELECT id FROM banquet_guests WHERE banquet_id = ? AND user_id = ?`, [banquetId, this.id], 'get'
        );
        if (already) return { success: false, tip: '您已参加此婚宴' };

        db.executeSQL(`INSERT INTO banquet_guests (banquet_id, user_id) VALUES (?, ?)`, [banquetId, this.id], 'run');
        const cnt = banquet.guest_count + 1;
        db.executeSQL(`UPDATE marriage_banquets SET guest_count = ? WHERE id = ?`, [cnt, banquetId], 'run');

        if (cnt >= (banquet.needed_guests || 8)) {
            db.executeSQL(`UPDATE marriage_banquets SET status = 'completed' WHERE id = ?`, [banquetId], 'run');
            db.executeSQL(`UPDATE marriages SET wedding_date = CURRENT_TIMESTAMP WHERE id = ?`, [banquet.marriage_id], 'run');
            return { success: true, tip: '婚宴满8人，婚礼正式完成！🎉' };
        }
        return { success: true, tip: `已加入婚宴（${cnt}/8人）` };
    }

    // 获取进行中的婚宴列表
    getActiveBanquets() {
        const db = this.chat.db;
        if (!db) return [];
        return db.executeSQL(
            `SELECT b.*, u.nickname as host_nickname
             FROM marriage_banquets b JOIN users u ON b.host_id = u.id
             WHERE b.status = 'active' ORDER BY b.created_at DESC`,
            [], 'all'
        ) || [];
    }

    // 获取角色当前状态，优先级从高到低：打怪，钓鱼，副本，航行，正常
    getUserStatus() {
        // 检查是否在打怪
        if (this.monster.name) {
            return '打怪';
        }

        // 检查是否在钓鱼
        if (this.fish.fishingState) {
            return '钓鱼';
        }

        // 检查是否在副本（包括普通副本和航行副本）
        if (this.trial.isInTrial() || this.sailing.isInSailingFb()) {
            return '副本';
        }

        // 检查是否在航行
        if (this.sailing.sailingState) {
            return '航行';
        }

        // 正常状态
        return '正常';
    }

    // 邮件系统相关方法

    /**
     * 发送邮件
     * @param {number} receiverId - 接收者ID
     * @param {string} receiverName - 接收者名称
     * @param {string} subject - 邮件主题
     * @param {string} content - 邮件内容
     * @param {Array} items - 邮件附件物品列表
     * @returns {object} 发送结果
     */
    sendMail(receiverId, receiverName, subject, content, items = []) {
        const db = this.chat.db;
        if (!db) {
            return {success: false, message: '数据库连接失败'};
        }

        // 发送邮件
        const result = db.sendMail(
            this.id,
            this.nickname,
            receiverId,
            receiverName,
            subject,
            content,
            items
        );

        if (result) {
            return {success: true, message: '邮件发送成功'};
        } else {
            return {success: false, message: '邮件发送失败'};
        }
    }

    /**
     * 获取邮件列表
     * @param {number} limit - 限制返回的邮件数量
     * @returns {Array} 邮件列表
     */
    getMailList(limit = 50) {
        const db = this.chat.db;
        if (!db) {
            return [];
        }

        return db.getUserMails(this.id, limit);
    }

    /**
     * 获取邮件详情
     * @param {number} mailId - 邮件ID
     * @returns {object|null} 邮件详情
     */
    getMailDetail(mailId) {
        const db = this.chat.db;
        if (!db) {
            return null;
        }

        return db.getMailById(mailId, this.id);
    }

    /**
     * 标记邮件为已读
     * @param {number} mailId - 邮件ID
     * @returns {boolean} 是否标记成功
     */
    markMailAsRead(mailId) {
        const db = this.chat.db;
        if (!db) {
            return false;
        }

        return db.markMailAsRead(mailId, this.id);
    }

    /**
     * 领取邮件附件
     * @param {number} mailId - 邮件ID
     * @returns {object} 领取结果
     */
    claimMailItems(mailId) {
        const db = this.chat.db;
        if (!db) {
            return {success: false, message: '数据库连接失败'};
        }

        // 获取邮件详情
        const mail = db.getMailById(mailId, this.id);
        if (!mail) {
            return {success: false, message: '邮件不存在'};
        }

        // 检查是否已领取
        if (mail.is_claimed) {
            return {success: false, message: '附件已领取'};
        }

        // 将物品添加到背包
        if (mail.items && mail.items.length > 0) {
            mail.items.forEach(item => {
                this.backpack.addItem({
                    name: item.name,
                    type: item.type,
                    num: item.num,
                    info: item.info
                });
            });
        }

        // 标记为已领取
        const result = db.claimMailItems(mailId, this.id);
        if (result) {
            return {success: true, message: '附件领取成功'};
        } else {
            return {success: false, message: '附件领取失败'};
        }
    }

}
