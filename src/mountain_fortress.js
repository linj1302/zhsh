/**
 * 山寨系统模块
 * 包含农场和练功房两大功能
 * 农场：三块地种植作物，7天成熟，过期枯萎
 * 练功房：使用练功娃练功，200级后不增加经验
 */

// 作物成熟时间（分钟）
const CROP_MATURE_MINUTES = 8640; // 7天

// 作物配置
const CROP_CONFIGS = [
    {
        id: 'wheat',
        name: '小麦',
        icon: '🌾',
        growTime: CROP_MATURE_MINUTES,
        harvestCopper: 500,
        harvestExp: 50,
        description: '基础作物，稳定产出'
    },
    {
        id: 'corn',
        name: '玉米',
        icon: '🌽',
        growTime: CROP_MATURE_MINUTES,
        harvestCopper: 800,
        harvestExp: 80,
        description: '普通作物，产量略高'
    },
    {
        id: 'tomato',
        name: '番茄',
        icon: '🍅',
        growTime: CROP_MATURE_MINUTES,
        harvestCopper: 1200,
        harvestExp: 120,
        description: '经济作物，收益可观'
    },
    {
        id: 'ginseng',
        name: '人参',
        icon: '🌿',
        growTime: CROP_MATURE_MINUTES,
        harvestCopper: 3000,
        harvestExp: 300,
        description: '珍贵药材，价值不菲'
    }
];

// 练功房配置
const TRAINING_ROOM_CONFIG = {
    defaultDoll: {
        id: 'wild_ball_man',
        name: '野球草人',
        description: '基础练功娃，开通练功房时赠送',
        expPerMinute: 10
    },
    maxLevel: 200,
    baseExpGain: 10,
    friendExpBonus: 1.5
};

export default class MountainFortress {
    constructor(userId, database, play, backpack) {
        this.userId = userId;
        this.db = database;
        this.play = play;
        this.backpack = backpack;

        this.farmPlots = [
            { index: 0, cropId: null, plantedAt: null, status: 'empty' },
            { index: 1, cropId: null, plantedAt: null, status: 'empty' },
            { index: 2, cropId: null, plantedAt: null, status: 'empty' }
        ];

        this.trainingRoom = {
            opened: false,
            dolls: [],
            isTraining: false,
            trainingStartedAt: null,
            trainingLocation: 'own',
            trainingFriendId: null,
            totalTrainingMinutes: 0
        };
    }

    openTrainingRoom() {
        if (this.trainingRoom.opened) {
            return { success: false, tip: '练功房已经开通' };
        }
        this.trainingRoom.opened = true;
        this.trainingRoom.dolls.push({ ...TRAINING_ROOM_CONFIG.defaultDoll, obtainedAt: Date.now() });
        return {
            success: true,
            tip: `练功房开通成功！获得练功娃【${TRAINING_ROOM_CONFIG.defaultDoll.name}】`
        };
    }

    getCropConfigs() {
        return CROP_CONFIGS;
    }

    plantCrop(plotIndex, cropId) {
        plotIndex = parseInt(plotIndex);
        if (isNaN(plotIndex) || plotIndex < 0 || plotIndex > 2) {
            return { success: false, tip: '无效的地块编号' };
        }

        const crop = CROP_CONFIGS.find(c => c.id === cropId);
        if (!crop) {
            return { success: false, tip: '无效的作物' };
        }

        const plot = this.farmPlots[plotIndex];
        if (plot.status !== 'empty') {
            return { success: false, tip: '该地块已有作物，请先收获或清理' };
        }

        const seedCost = Math.floor(crop.harvestCopper * 0.2);
        if (this.play.copper < seedCost) {
            return { success: false, tip: `铜币不足，需要${seedCost}铜币购买种子` };
        }

        this.play.copper -= seedCost;

        plot.cropId = cropId;
        plot.plantedAt = Date.now();
        plot.status = 'growing';

        return {
            success: true,
            tip: `在地块${plotIndex + 1}种植了${crop.name}，预计${Math.floor(CROP_MATURE_MINUTES / 1440)}天后成熟`
        };
    }

    harvestCrop(plotIndex) {
        plotIndex = parseInt(plotIndex);
        if (isNaN(plotIndex) || plotIndex < 0 || plotIndex > 2) {
            return { success: false, tip: '无效的地块编号' };
        }

        const plot = this.farmPlots[plotIndex];
        const now = Date.now();

        if (plot.status === 'empty') {
            return { success: false, tip: '该地块没有作物' };
        }

        const crop = CROP_CONFIGS.find(c => c.id === plot.cropId);
        if (!crop) {
            plot.status = 'empty';
            plot.cropId = null;
            plot.plantedAt = null;
            return { success: false, tip: '作物数据异常，已自动清理' };
        }

        const elapsedMinutes = (now - plot.plantedAt) / 60000;
        const matureMinutes = crop.growTime;

        if (elapsedMinutes < matureMinutes) {
            const remaining = Math.ceil(matureMinutes - elapsedMinutes);
            const remainingHours = Math.floor(remaining / 60);
            const remainingMinutes = remaining % 60;
            return {
                success: false,
                tip: `${crop.name}尚未成熟，还需${remainingHours}小时${remainingMinutes}分钟`
            };
        }

        const wiltTime = matureMinutes + 1440;
        if (elapsedMinutes > wiltTime) {
            plot.status = 'empty';
            plot.cropId = null;
            plot.plantedAt = null;
            return {
                success: false,
                tip: `${crop.name}已经枯萎了！需要清理地块重新种植`
            };
        }

        this.play.addCopper(crop.harvestCopper);
        this.play.addExp(crop.harvestExp);

        plot.status = 'empty';
        plot.cropId = null;
        plot.plantedAt = null;

        return {
            success: true,
            tip: `收获了${crop.name}！获得${crop.harvestCopper}铜币和${crop.harvestExp}经验`
        };
    }

    clearPlot(plotIndex) {
        plotIndex = parseInt(plotIndex);
        if (isNaN(plotIndex) || plotIndex < 0 || plotIndex > 2) {
            return { success: false, tip: '无效的地块编号' };
        }

        const plot = this.farmPlots[plotIndex];
        if (plot.status === 'empty') {
            return { success: false, tip: '该地块已经是空的' };
        }

        plot.status = 'empty';
        plot.cropId = null;
        plot.plantedAt = null;

        return { success: true, tip: `已清理地块${plotIndex + 1}` };
    }

    getPlotStatus(plotIndex) {
        const plot = this.farmPlots[plotIndex];
        if (!plot || plot.status === 'empty') {
            return { status: 'empty', label: '空地', icon: '🟫' };
        }

        const crop = CROP_CONFIGS.find(c => c.id === plot.cropId);
        const now = Date.now();
        const elapsedMinutes = (now - plot.plantedAt) / 60000;
        const matureMinutes = CROP_CONFIGS.find(c => c.id === plot.cropId)?.growTime || CROP_MATURE_MINUTES;
        const wiltTime = matureMinutes + 1440;

        if (elapsedMinutes > wiltTime) {
            return { status: 'wilted', label: '枯萎', icon: '🥀', cropName: crop?.name || '未知' };
        }

        if (elapsedMinutes >= matureMinutes) {
            return { status: 'mature', label: '成熟可收', icon: '✅', cropName: crop?.name || '未知' };
        }

        const remaining = matureMinutes - elapsedMinutes;
        const remainingHours = Math.floor(remaining / 60);
        const remainingMinutes = Math.floor(remaining % 60);

        return {
            status: 'growing',
            label: '生长中',
            icon: crop?.icon || '🌱',
            cropName: crop?.name || '未知',
            remainingHours,
            remainingMinutes
        };
    }

    startOwnTraining() {
        if (!this.trainingRoom.opened) {
            return { success: false, tip: '请先开通练功房' };
        }
        if (this.trainingRoom.dolls.length === 0) {
            return { success: false, tip: '没有练功娃可用' };
        }
        if (this.play.level >= TRAINING_ROOM_CONFIG.maxLevel) {
            return { success: false, tip: '已达到200级，练功房不再提供经验' };
        }

        if (this.trainingRoom.isTraining) {
            this._settleTraining();
        }

        this.trainingRoom.isTraining = true;
        this.trainingRoom.trainingStartedAt = Date.now();
        this.trainingRoom.trainingLocation = 'own';
        this.trainingRoom.trainingFriendId = null;

        return { success: true, tip: '开始在自己的练功房练功' };
    }

    startFriendTraining(friendId) {
        friendId = parseInt(friendId);
        if (!this.trainingRoom.opened) {
            return { success: false, tip: '请先开通练功房' };
        }
        if (this.trainingRoom.dolls.length === 0) {
            return { success: false, tip: '没有练功娃可用' };
        }
        if (this.play.level >= TRAINING_ROOM_CONFIG.maxLevel) {
            return { success: false, tip: '已达到200级，练功房不再提供经验' };
        }
        if (!friendId) {
            return { success: false, tip: '请选择好友' };
        }

        if (this.db) {
            const sql = `SELECT COUNT(*) as count FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'`;
            const result = this.db.executeSQL(sql, [this.userId, friendId], 'get');
            if (!result || result.count === 0) {
                return { success: false, tip: '只能到好友的练功房练功' };
            }
        }

        if (this.trainingRoom.isTraining) {
            this._settleTraining();
        }

        this.trainingRoom.isTraining = true;
        this.trainingRoom.trainingStartedAt = Date.now();
        this.trainingRoom.trainingLocation = 'friend';
        this.trainingRoom.trainingFriendId = friendId;

        return { success: true, tip: '开始在好友的练功房打坐练功' };
    }

    stopTraining() {
        if (!this.trainingRoom.isTraining) {
            return { success: false, tip: '当前未在练功' };
        }

        const result = this._settleTraining();
        this.trainingRoom.isTraining = false;
        this.trainingRoom.trainingStartedAt = null;
        return result;
    }

    _settleTraining() {
        if (!this.trainingRoom.trainingStartedAt) {
            return { success: true, tip: '无练功记录' };
        }

        const now = Date.now();
        const elapsedMs = now - this.trainingRoom.trainingStartedAt;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);

        if (elapsedMinutes <= 0) {
            return { success: true, tip: '练功时间太短，未获得经验' };
        }

        let expMultiplier = 1;
        if (this.trainingRoom.trainingLocation === 'friend') {
            expMultiplier = TRAINING_ROOM_CONFIG.friendExpBonus;
        }

        const doll = this.trainingRoom.dolls[0];
        const baseExpPerMinute = doll ? doll.expPerMinute : TRAINING_ROOM_CONFIG.baseExpGain;
        const totalExp = Math.floor(elapsedMinutes * baseExpPerMinute * expMultiplier);

        if (this.play.level >= TRAINING_ROOM_CONFIG.maxLevel) {
            this.trainingRoom.totalTrainingMinutes += elapsedMinutes;
            return {
                success: true,
                tip: `练功${elapsedMinutes}分钟，但等级已达上限，不再获得经验`,
                expGained: 0,
                minutes: elapsedMinutes
            };
        }

        this.play.addExp(totalExp);
        this.trainingRoom.totalTrainingMinutes += elapsedMinutes;

        return {
            success: true,
            tip: `练功${elapsedMinutes}分钟，获得${totalExp}经验${this.trainingRoom.trainingLocation === 'friend' ? '（好友加成）' : ''}`,
            expGained: totalExp,
            minutes: elapsedMinutes
        };
    }

    getFriendList() {
        if (!this.db) return [];
        const sql = `SELECT f.friend_id as id, u.nickname FROM friends f JOIN users u ON f.friend_id = u.id WHERE f.user_id = ? AND f.status = 'accepted'`;
        return this.db.executeSQL(sql, [this.userId], 'all') || [];
    }

    getStatus() {
        const plots = [
            this.getPlotStatus(0),
            this.getPlotStatus(1),
            this.getPlotStatus(2)
        ];

        let trainingProgress = null;
        if (this.trainingRoom.isTraining && this.trainingRoom.trainingStartedAt) {
            const elapsedMinutes = Math.floor((Date.now() - this.trainingRoom.trainingStartedAt) / 60000);
            trainingProgress = {
                elapsedMinutes,
                location: this.trainingRoom.trainingLocation,
                friendId: this.trainingRoom.trainingFriendId,
                friendName: null
            };

            if (this.trainingRoom.trainingFriendId && this.db) {
                const friend = this.db.getUserById(this.trainingRoom.trainingFriendId);
                if (friend) {
                    trainingProgress.friendName = friend.nickname;
                }
            }
        }

        return {
            farmPlots: plots,
            cropConfigs: CROP_CONFIGS,
            trainingRoom: {
                opened: this.trainingRoom.opened,
                dolls: this.trainingRoom.dolls,
                isTraining: this.trainingRoom.isTraining,
                trainingProgress,
                totalTrainingMinutes: this.trainingRoom.totalTrainingMinutes,
                maxLevel: TRAINING_ROOM_CONFIG.maxLevel,
                baseExpGain: TRAINING_ROOM_CONFIG.baseExpGain,
                friendExpBonus: TRAINING_ROOM_CONFIG.friendExpBonus
            },
            currentLevel: this.play.level,
            friends: this.getFriendList()
        };
    }
}