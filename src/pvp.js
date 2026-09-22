/**
 * PVP 对战系统 - 玩家对战、积分系统、匹配系统
 */
export default class PVP {
    constructor(play, database) {
        this.play = play;
        this.db = database;
        this.duels = {}; // 进行中的对战
        this.matchHistory = {}; // 匹配历史
        this.ranking = {}; // 排行榜
        this.tickets = {}; // 挑战票
    }

    // 创建对战邀请
    createDuelInvitation(opponentId, duelType = 'normal') {
        const myId = this.play.id;
        if (myId === opponentId) {
            return { success: false, tip: '不能与自己对战' };
        }

        // 检查是否已经有进行中的对战
        const existingDuel = this.getActiveDuel(myId);
        if (existingDuel) {
            return { success: false, tip: '已有进行中的对战' };
        }

        const duel = {
            id: Date.now(),
            type: duelType,
            challengerId: myId,
            challengerName: this.play.nickname,
            opponentId,
            opponentName: this.getPlayerName(opponentId),
            startTime: Date.now(),
            status: 'pending', // pending, accepted, declined, expired
            timeLimit: 10 * 60 * 1000, // 10分钟有效期
            round: 0,
            rounds: [],
            winner: null
        };

        this.duels[duel.id] = duel;

        // 发送通知
        this.sendNotification(opponentId, {
            type: 'duel_invitation',
            title: 'PVP对战邀请',
            content: `玩家【${this.play.nickname}】向你发起了对战挑战`,
            duelId: duel.id,
            timestamp: Date.now()
        });

        return {
            success: true,
            tip: `对战邀请已发送给【${this.getPlayerName(opponentId)}】`,
            duelId: duel.id,
            expiresAt: Date.now() + duel.timeLimit
        };
    }

    // 获取玩家名称
    getPlayerName(playerId) {
        // 从缓存或数据库获取
        return `玩家${playerId}`;
    }

    // 获取进行中的对战
    getActiveDuel(playerId) {
        return Object.values(this.duels).find(d =>
            d.status === 'pending' && 
            (d.challengerId === playerId || d.opponentId === playerId)
        );
    }

    // 接受对战邀请
    acceptDuel(duelId) {
        const duel = this.duels[duelId];
        if (!duel) return { success: false, tip: '对战不存在' };

        if (duel.opponentId !== this.play.id) {
            return { success: false, tip: '这不是你的对战邀请' };
        }

        if (duel.status !== 'pending') {
            return { success: false, tip: '对战状态异常' };
        }

        const elapsed = Date.now() - duel.startTime;
        if (elapsed > duel.timeLimit) {
            return { success: false, tip: '邀请已过期' };
        }

        duel.status = 'accepted';
        duel.acceptedAt = Date.now();

        // 通知挑战者
        this.sendNotification(duel.challengerId, {
            type: 'duel_accepted',
            title: '对战已接受',
            content: `玩家【${duel.opponentName}】接受了你的对战挑战`,
            duelId: duel.id,
            timestamp: Date.now()
        });

        return {
            success: true,
            tip: '对战已接受，准备开始对战',
            duelId: duel.id
        };
    }

    // 拒绝对战邀请
    declineDuel(duelId) {
        const duel = this.duels[duelId];
        if (!duel) return { success: false, tip: '对战不存在' };

        if (duel.opponentId !== this.play.id) {
            return { success: false, tip: '这不是你的对战邀请' };
        }

        duel.status = 'declined';
        duel.declinedAt = Date.now();

        // 通知挑战者
        this.sendNotification(duel.challengerId, {
            type: 'duel_declined',
            title: '对战被拒绝',
            content: `玩家【${duel.opponentName}】拒绝了你的对战挑战`,
            duelId: duel.id,
            timestamp: Date.now()
        });

        return { success: true, tip: '对战已拒绝' };
    }

    // 开始对战
    startDuel(duelId) {
        const duel = this.duels[duelId];
        if (!duel) return { success: false, tip: '对战不存在' };

        if (duel.status !== 'accepted') {
            return { success: false, tip: '对战未就绪' };
        }

        duel.status = 'active';
        duel.startedAt = Date.now();
        duel.round = 1;

        // 初始化回合
        duel.rounds = [{
            round: 1,
            challengerAttack: 0,
            challengerDefense: 0,
            opponentAttack: 0,
            opponentDefense: 0,
            actions: [],
            result: null
        }];

        return {
            success: true,
            tip: '对战开始！',
            duelId: duel.id,
            round: duel.round
        };
    }

    // 计算对战伤害
    calculateDuelDamage(attacker, defender, isCrit = false) {
        const baseAttack = attacker.attack || 100;
        const baseDefense = defender.defense || 50;
        
        const randomFactor = 0.8 + Math.random() * 0.4;
        const defenseReduction = baseDefense * (0.5 + Math.random() * 0.3);
        
        let damage = Math.floor((baseAttack * randomFactor) - defenseReduction);
        
        if (isCrit) {
            damage = Math.floor(damage * 2);
        }

        return {
            damage: Math.max(1, damage),
            isCrit,
            critChance: 0.1
        };
    }

    // 玩家进攻
    playerAttack(duelId, targetId) {
        const duel = this.duels[duelId];
        if (!duel) return { success: false, tip: '对战不存在' };

        if (duel.status !== 'active') {
            return { success: false, tip: '对战未开始' };
        }

        const myId = this.play.id;
        if (duel.challengerId !== myId && duel.opponentId !== myId) {
            return { success: false, tip: '你不在这个对战中' };
        }

        const currentRound = duel.rounds[duel.round - 1];
        if (!currentRound) return { success: false, tip: '回合不存在' };

        const isChallenger = duel.challengerId === myId;
        const opponent = isChallenger ? duel.opponentId : duel.challengerId;

        const attacker = this.getPlayerStats(myId);
        const defender = this.getPlayerStats(opponent);

        const { damage, isCrit } = this.calculateDuelDamage(attacker, defender);

        // 记录攻击
        currentRound.actions.push({
            actorId: myId,
            action: 'attack',
            damage,
            isCrit,
            timestamp: Date.now()
        });

        // 更新对方HP
        this.updatePlayerHP(opponent, -damage);

        // 计算是否反击
        const counterAttackChance = 0.3;
        let counterDamage = 0;
        let counterCrit = false;

        if (Math.random() < counterAttackChance) {
            const { damage: cd, isCrit: cc } = this.calculateDuelDamage(defender, attacker);
            counterDamage = cd;
            counterCrit = cc;

            // 记录反击
            currentRound.actions.push({
                actorId: opponent,
                action: 'counterattack',
                damage: counterDamage,
                isCrit: counterCrit,
                timestamp: Date.now()
            });

            this.updatePlayerHP(myId, -counterDamage);
        }

        // 检查是否有人失败
        const myHP = this.getPlayerHP(myId);
        const opponentHP = this.getPlayerHP(opponent);

        let result = null;
        if (myHP <= 0) {
            result = {
                winner: opponent,
                loser: myId,
                reason: 'HP归零'
            };
        } else if (opponentHP <= 0) {
            result = {
                winner: myId,
                loser: opponent,
                reason: 'HP归零'
            };
        }

        if (result) {
            duel.status = 'completed';
            duel.winner = result.winner;
            currentRound.result = result;
        } else {
            // 下一回合
            duel.round++;
            duel.rounds.push({
                round: duel.round,
                challengerAttack: 0,
                challengerDefense: 0,
                opponentAttack: 0,
                opponentDefense: 0,
                actions: [],
                result: null
            });
        }

        return {
            success: true,
            tip: isCrit ? `命中！造成${damage}伤害！` : `造成${damage}伤害`,
            damage,
            isCrit,
            counterDamage > 0 ? { tip: `对方反击！受到${counterDamage}伤害`, counterDamage } : null,
            result,
            currentRound: duel.round,
            myHP,
            opponentHP
        };
    }

    // 获取玩家统计（简化）
    getPlayerStats(playerId) {
        // 从数据库或缓存获取
        return { attack: 100, defense: 50 };
    }

    // 获取玩家HP
    getPlayerHP(playerId) {
        // 从数据库获取
        return 1000;
    }

    // 更新玩家HP
    updatePlayerHP(playerId, amount) {
        // 更新数据库中的HP
    }

    // 发送通知
    sendNotification(userId, notification) {
        if (this.db) {
            this.db.addNotification(userId, notification);
        }
    }

    // 获取对战统计
    getDuelStats() {
        const myId = this.play.id;
        const duels = this.matchHistory[myId] || [];

        const wins = duels.filter(d => d.winner === myId).length;
        const losses = duels.filter(d => d.loser === myId).length;
        const winRate = duels.length > 0 ? Math.round((wins / duels.length) * 100) : 0;

        return {
            totalDuels: duels.length,
            wins,
            losses,
            winRate,
            currentStreak: this.getCurrentStreak(myId),
            bestStreak: this.getBestStreak(myId),
            totalDamageDealt: this.calculateTotalDamage(myId),
            totalDamageReceived: this.calculateTotalReceivedDamage(myId)
        };
    }

    // 获取当前胜率
    getCurrentStreak(playerId) {
        const duels = (this.matchHistory[playerId] || []).sort((a, b) => b.timestamp - a.timestamp);
        let streak = 0;

        for (const duel of duels) {
            if (duel.winner === playerId) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    // 获取最佳胜率
    getBestStreak(playerId) {
        const duels = this.matchHistory[playerId] || [];
        let best = 0;
        let current = 0;

        duels.sort((a, b) => a.timestamp - b.timestamp);

        for (const duel of duels) {
            if (duel.winner === playerId) {
                current++;
                best = Math.max(best, current);
            } else {
                current = 0;
            }
        }

        return best;
    }

    // 计算总伤害
    calculateTotalDamage(playerId) {
        const duels = this.matchHistory[playerId] || [];
        let total = 0;

        duels.forEach(duel => {
            duel.rounds.forEach(round => {
                round.actions.filter(a => a.actorId === playerId).forEach(action => {
                    total += action.damage;
                });
            });
        });

        return total;
    }

    // 计算总受伤
    calculateTotalReceivedDamage(playerId) {
        const duels = this.matchHistory[playerId] || [];
        let total = 0;

        duels.forEach(duel => {
            duel.rounds.forEach(round => {
                round.actions.filter(a => a.actorId !== playerId).forEach(action => {
                    total += action.damage;
                });
            });
        });

        return total;
    }

    // 获取PVP排行榜
    getRanking(limit = 10) {
        const ranking = Object.entries(this.ranking)
            .sort((a, b) => b[1].wins - a[1].wins)
            .slice(0, limit)
            .map(([playerId, stats]) => ({
                rank: 0, // 需要计算
                playerId,
                playerName: stats.name,
                wins: stats.wins,
                losses: stats.losses,
                winRate: stats.winRate,
                totalDuels: stats.totalDuels
            }));

        ranking.forEach((p, index) => {
            p.rank = index + 1;
        });

        return ranking;
    }

    // 消灭对战
    cleanupDuel(duelId) {
        delete this.duels[duelId];

        // 记录到历史
        if (this.duels[duelId]) {
            const duel = this.duels[duelId];
            if (!this.matchHistory[duel.challengerId]) {
                this.matchHistory[duel.challengerId] = [];
            }
            if (!this.matchHistory[duel.opponentId]) {
                this.matchHistory[duel.opponentId] = [];
            }

            this.matchHistory[duel.challengerId].push({
                duelId,
                opponentId: duel.opponentId,
                opponentName: duel.opponentName,
                winner: duel.winner,
                loser: duel.loser,
                timestamp: duel.startedAt,
                rounds: duel.rounds.length
            });

            this.matchHistory[duel.opponentId].push({
                duelId: duel.id,
                opponentId: duel.challengerId,
                opponentName: duel.challengerName,
                winner: duel.winner === duel.challengerId ? duel.challengerId : duel.opponentId,
                loser: duel.winner === duel.challengerId ? duel.opponentId : duel.challengerId,
                timestamp: duel.startedAt,
                rounds: duel.rounds.length
            });
        }
    }

    // 获取PVP积分
    getPVPPoints() {
        const stats = this.getDuelStats();
        const points = stats.wins * 10 + stats.totalDamageDealt * 0.1;
        return Math.floor(points);
    }
}
