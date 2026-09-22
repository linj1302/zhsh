/**
 * 钓鱼竞技场系统 - 钓鱼锦标赛、排行榜、奖励
 */
import { fish as fishConfig } from '../config/index.js';

export default class FishingTournament {
    // 注：play 实例不携带 id/昵称，由构造器传入（保持原有两参兼容，新参可选）
    constructor(play, fish, userId = null, nickname = '') {
        this.play = play;
        this.fish = fish;
        this.userId = userId;
        this.nickname = nickname;
        this.tournaments = {}; // 活跃的比赛
        this.records = {}; // 钓鱼记录
        this.leaderboard = {}; // 排行榜
    }

    // 当前玩家 id（兼容旧写法 this.play.id）
    _getPlayerId() {
        return this.userId !== null ? this.userId : this.play.id;
    }

    // 当前玩家昵称（兼容旧写法 this.play.nickname）
    _getPlayerName() {
        return this.nickname || this.play.nickname || '无名渔夫';
    }

    // 获取当前比赛
    getActiveTournament() {
        const now = Date.now();
        const tournaments = Object.values(this.tournaments);
        return tournaments.find(t => t.startTime <= now && now <= t.endTime);
    }

    // 创建比赛
    createTournament(name, duration, prize) {
        const tournament = {
            id: Date.now(),
            name,
            startTime: Date.now(),
            endTime: Date.now() + duration * 24 * 60 * 60 * 1000, // 持续天数
            prize,
            participants: [],
            records: [],
            status: 'active'
        };
        
        this.tournaments[tournament.id] = tournament;
        return tournament;
    }

    // 报名参加比赛
    registerTournament(tournamentId) {
        const tournament = this.tournaments[tournamentId];
        if (!tournament) {
            return { success: false, tip: '比赛不存在' };
        }
        if (tournament.status !== 'active') {
            return { success: false, tip: '比赛已结束' };
        }
        if (tournament.participants.includes(this._getPlayerId())) {
            return { success: false, tip: '已经报名过了' };
        }
        
        // 检查报名资格（等级要求）
        if (tournament.levelRequirement && this.play.level < tournament.levelRequirement) {
            return { success: false, tip: `需要等级${tournament.levelRequirement}才能参加` };
        }
        
        tournament.participants.push(this._getPlayerId());
        return { success: true, tip: `成功报名【${tournament.name}】` };
    }

    // 钓鱼记录
    recordCatch(fishName, weight, quality, tournamentId = null) {
        const record = {
            id: Date.now(),
            userId: this._getPlayerId(),
            userName: this._getPlayerName(),
            fishName,
            weight,
            quality,
            timestamp: Date.now(),
            tournamentId
        };
        
        // 保存记录
        const playerId = this._getPlayerId();
        if (!this.records[playerId]) {
            this.records[playerId] = [];
        }
        this.records[playerId].push(record);
        // 存档膨胀控制：每人只保留最新 200 条钓鱼记录（旧的从头部截断）
        if (this.records[playerId].length > 200) {
            this.records[playerId].splice(0, this.records[playerId].length - 200);
        }
        
        // 如果是比赛，添加比赛记录
        if (tournamentId) {
            const tournament = this.tournaments[tournamentId];
            if (tournament) {
                tournament.records.push(record);
            }
        }
        
        // 更新排行榜
        this.updateLeaderboard(record);
        
        return record;
    }

    // 更新排行榜
    updateLeaderboard(record) {
        const key = record.fishName;
        if (!this.leaderboard[key]) {
            this.leaderboard[key] = [];
        }
        
        this.leaderboard[key].push(record);
        this.leaderboard[key].sort((a, b) => b.weight - a.weight);
        
        // 只保留前10名
        if (this.leaderboard[key].length > 10) {
            this.leaderboard[key] = this.leaderboard[key].slice(0, 10);
        }
    }

    // 获取排行榜
    getLeaderboard(fishName) {
        if (!fishName) {
            // 获取所有排行榜
            return Object.entries(this.leaderboard).map(([name, records]) => ({
                fishName: name,
                topRecord: records[0]
            })).sort((a, b) => (b.topRecord?.weight || 0) - (a.topRecord?.weight || 0));
        }
        
        return this.leaderboard[fishName] || [];
    }

    // 获取玩家的钓鱼统计
    getPlayerStats() {
        const records = this.records[this._getPlayerId()] || [];
        
        if (records.length === 0) {
            return {
                totalCatch: 0,
                rareCatch: 0,
                totalWeight: 0,
                bestFish: null
            };
        }
        
        const totalCatch = records.length;
        const rareCatch = records.filter(r => r.quality >= 3).length;
        const totalWeight = records.reduce((sum, r) => sum + r.weight, 0);
        const bestFish = records.reduce((best, r) => r.weight > (best?.weight || 0) ? r : best, null);
        
        return { totalCatch, rareCatch, totalWeight, bestFish };
    }

    // 获取比赛排名
    getTournamentRank(tournamentId) {
        const tournament = this.tournaments[tournamentId];
        if (!tournament) {
            return null;
        }
        
        const playerId = this._getPlayerId();
        const playerRecords = tournament.records.filter(r => String(r.userId) === String(playerId));
        const playerTotalWeight = playerRecords.reduce((sum, r) => sum + r.weight, 0);
        
        // 计算所有玩家的总重量
        const playerStats = {};
        tournament.records.forEach(r => {
            if (!playerStats[r.userId]) {
                playerStats[r.userId] = { totalWeight: 0, count: 0 };
            }
            playerStats[r.userId].totalWeight += r.weight;
            playerStats[r.userId].count++;
        });
        
        // 排序
        const sorted = Object.entries(playerStats)
            .map(([userId, stats]) => ({ userId, ...stats }))
            .sort((a, b) => b.totalWeight - a.totalWeight);
        
        const rank = sorted.findIndex(p => String(p.userId) === String(playerId)) + 1;
        
        return {
            rank,
            totalPlayers: sorted.length,
            playerWeight: playerTotalWeight,
            firstPlaceWeight: sorted[0]?.totalWeight || 0
        };
    }

    // 领取比赛奖励
    claimPrize(tournamentId) {
        const tournament = this.tournaments[tournamentId];
        if (!tournament) {
            return { success: false, tip: '比赛不存在' };
        }
        
        const rankInfo = this.getTournamentRank(tournamentId);
        // rank 为 0 表示无成绩（findIndex 未命中），不能作为名次绕过校验；仅前三名可领
        if (!rankInfo || rankInfo.rank < 1 || rankInfo.rank > 3) {
            return { success: false, tip: '只有前三名才能获得奖励' };
        }
        
        // 幂等领奖：领过奖励的玩家在 tournament 上标记（随存档序列化），防止重复领取（不用 Map，用普通对象）
        if (!tournament.claimed) {
            tournament.claimed = {};
        }
        if (tournament.claimed[this._getPlayerId()]) {
            return { success: false, tip: '你已经领取过该比赛的奖励' };
        }
        
        // 领取奖励
        const prize = tournament.prize && tournament.prize[rankInfo.rank - 1];
        if (prize) {
            if (prize.type === 'copper') {
                this.play.addCopper(prize.amount);
            } else if (prize.type === 'item') {
                this.play.backpack.addItem(prize.item);
            } else if (prize.type === 'exp') {
                this.play.addExp(prize.amount);
            }
        }
        
        // 标记已领取（放在实际发放后，避免发放异常时误锁）
        tournament.claimed[this._getPlayerId()] = true;
        
        return {
            success: true,
            tip: `获得【${tournament.name}】${rankInfo.rank}名奖励：${prize ? (prize.amount || (prize.item && prize.item.name) || '神秘奖励') : '参与奖'}`,
            prize
        };
    }

    // 获取玩家的比赛历史
    getTournamentHistory() {
        const tournaments = Object.values(this.tournaments)
            .filter(t => t.status === 'completed' || t.endTime < Date.now())
            .sort((a, b) => b.endTime - a.endTime);
        
        return tournaments.map(t => {
            const rankInfo = this.getTournamentRank(t.id);
            return {
                id: t.id,
                name: t.name,
                endTime: t.endTime,
                rank: rankInfo?.rank || '-',
                prize: rankInfo && rankInfo.rank <= 3 && t.prize ? t.prize[rankInfo.rank - 1] : null,
                // 是否已领取奖励（供往期大赛区域展示领奖入口，与 claimPrize 的幂等标记一致）
                claimed: !!(t.claimed && t.claimed[this._getPlayerId()])
            };
        });
    }

    // 每日钓鱼成就
    checkDailyAchievement() {
        const stats = this.getPlayerStats();
        const today = new Date().toDateString();
        const todayRecords = (this.records[this._getPlayerId()] || []).filter(r => 
            new Date(r.timestamp).toDateString() === today
        );
        
        if (todayRecords.length >= 50) {
            return {
                achieved: true,
                tip: '每日钓鱼达人：今天钓了50条鱼！',
                bonus: { type: 'copper', amount: 100 }
            };
        }
        
        if (todayRecords.some(r => r.weight > 100)) {
            return {
                achieved: true,
                tip: '大鱼之王：今天钓到了一条100斤以上的大鱼！',
                bonus: { type: 'exp', amount: 500 }
            };
        }
        
        return { achieved: false };
    }
}
