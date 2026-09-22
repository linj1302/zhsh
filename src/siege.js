/**
 * 攻城系统模块
 * 实现攻城战发起、参与、胜负判定等功能
 */

export default class Siege {
    constructor(database, userId, gang) {
        this.db = database;
        this.userId = userId;
        this.gang = gang;
    }

    canInitiateSiege() {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        const gangInfo = this.gang.getStatus();
        if (!gangInfo || !gangInfo.id) {
            return { success: false, message: '你需要先加入帮会' };
        }

        const isLeader = gangInfo.leader_id === this.userId;
        const isDeputy = gangInfo.deputy_id === this.userId;
        
        if (!isLeader && !isDeputy) {
            return { success: false, message: '只有帮主和帮副可以发起攻城' };
        }

        const members = this.gang.getMembers();
        if (members.length < 20) {
            return { 
                success: false, 
                message: `帮会人数不足，需要至少 20 人（当前${members.length}人）` 
            };
        }

        const onlineCount = this.getOnlineGangMembers(gangInfo.id);
        if (onlineCount < 10) {
            return { 
                success: false, 
                message: `在线人数不足，需要至少 10 人在线（当前${onlineCount}人）` 
            };
        }

        const currentTime = new Date();
        const hour = currentTime.getHours();
        
        const isMorningTime = hour >= 12 && hour < 14;
        const isNightTime = hour >= 20 && hour < 22;
        
        if (!isMorningTime && !isNightTime) {
            return { 
                success: false, 
                message: '当前不是攻城时间（12:00-14:00 或 20:00-22:00）' 
            };
        }

        const userData = db.loadUserData(this.userId);
        if (!userData || userData.play.showSilver < 10) {
            return { success: false, message: '银贝不足，需要 10 银' };
        }

        return { success: true, onlineCount };
    }

    initiateSiege(targetCity) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        const canInitiateResult = this.canInitiateSiege();
        if (!canInitiateResult.success) {
            return canInitiateResult;
        }

        const gangInfo = this.gang.getStatus();

        const lastSiege = this.getLastSiegeForCity(targetCity);
        if (lastSiege) {
            const endTime = new Date(lastSiege.end_time);
            const now = new Date();
            const diffHours = (now - endTime) / (1000 * 60 * 60);
            
            if (diffHours < 1) {
                return { 
                    success: false, 
                    message: `该城市处于冷却期，还需${Math.ceil(1 - diffHours)}小时` 
                };
            }
        }

        const userData = db.loadUserData(this.userId);
        userData.play.addCopper(-10 * 1000);

        const sql = `
            INSERT INTO siege_wars (attacker_gang_id, defender_city, start_time, status)
            VALUES (?, ?, CURRENT_TIMESTAMP, 'gathering')
        `;

        try {
            const result = db.executeSQL(sql, [gangInfo.id, targetCity], 'run');
            const siegeId = db.getLastInsertRowid();

            return {
                success: true,
                message: `成功发起对${targetCity}的攻城战！集合时间 300 秒`,
                siegeId: siegeId,
                gatherTime: 300
            };
        } catch (error) {
            console.error('发起攻城失败:', error);
            return { success: false, message: '发起攻城失败' };
        }
    }

    joinSiege(siegeId) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        const siege = this.getSiegeById(siegeId);
        if (!siege) {
            return { success: false, message: '攻城战不存在' };
        }

        if (siege.status !== 'gathering' && siege.status !== 'fighting') {
            return { success: false, message: '攻城战正在进行或已结束' };
        }

        const isAlreadyJoined = this.isParticipant(siegeId, this.userId);
        if (isAlreadyJoined) {
            return { success: false, message: '你已经参与了这场攻城战' };
        }

        const insertSql = `
            INSERT INTO siege_participants (siege_id, user_id, state)
            VALUES (?, ?, 'fighting')
        `;

        try {
            db.executeSQL(insertSql, [siegeId, this.userId], 'run');
            return { 
                success: true, 
                message: '成功加入攻城战！请在集合时间内到达城市' 
            };
        } catch (error) {
            console.error('加入攻城战失败:', error);
            return { success: false, message: '加入失败' };
        }
    }

    getSiegeById(siegeId) {
        const db = this.db;
        if (!db) {
            return null;
        }

        const sql = `
            SELECT s.*, g.name as gang_name
            FROM siege_wars s
            LEFT JOIN gangs g ON s.attacker_gang_id = g.id
            WHERE s.id = ?
        `;

        return db.executeSQL(sql, [siegeId], 'get');
    }

    getLastSiegeForCity(city) {
        const db = this.db;
        if (!db) {
            return null;
        }

        const sql = `
            SELECT *
            FROM siege_wars
            WHERE defender_city = ?
            ORDER BY start_time DESC
            LIMIT 1
        `;

        return db.executeSQL(sql, [city], 'get');
    }

    getOnlineGangMembers(gangId) {
        const db = this.db;
        if (!db) {
            return 0;
        }

        const members = this.gang.getMembers();
        const currentTime = Date.now();
        
        let onlineCount = 0;
        for (const member of members) {
            const memberData = db.loadUserData(member.user_id);
            if (memberData && memberData.updated_at) {
                const lastActive = new Date(memberData.updated_at).getTime();
                if (currentTime - lastActive < 300000) {
                    onlineCount++;
                }
            }
        }

        return onlineCount;
    }

    isParticipant(siegeId, userId) {
        const db = this.db;
        if (!db) {
            return false;
        }

        const sql = `
            SELECT *
            FROM siege_participants
            WHERE siege_id = ? AND user_id = ?
        `;

        const result = db.executeSQL(sql, [siegeId, userId], 'get');
        return !!result;
    }

    leaveSiege(siegeId) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        const sql = `
            UPDATE siege_participants
            SET state = 'retreated'
            WHERE siege_id = ? AND user_id = ?
        `;

        db.executeSQL(sql, [siegeId, this.userId], 'run');
        return { 
            success: true, 
            message: '你已离开攻城战（不战而退）' 
        };
    }

    siegeBattle(siegeId, damageDealt) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        db.executeSQL(`
            UPDATE siege_participants
            SET damage_dealt = damage_dealt + ?
            WHERE siege_id = ? AND user_id = ?
        `, [damageDealt, siegeId, this.userId], 'run');

        return { 
            success: true, 
            message: `你对守军造成了${damageDealt}点伤害！` 
        };
    }

    endSiege(siegeId, result) {
        const db = this.db;
        if (!db) {
            return { success: false, message: '数据库连接失败' };
        }

        const sql = `
            UPDATE siege_wars
            SET end_time = CURRENT_TIMESTAMP, status = 'ended', result = ?
            WHERE id = ?
        `;

        db.executeSQL(sql, [result, siegeId], 'run');

        if (result === 'attack_win') {
            this.awardSiegeVictory(siegeId);
        }

        return { 
            success: true, 
            message: result === 'attack_win' ? '攻城成功！' : '攻城失败' 
        };
    }

    awardSiegeVictory(siegeId) {
        const db = this.db;
        if (!db) {
            return;
        }

        const participants = db.executeSQL(`
            SELECT *
            FROM siege_participants
            WHERE siege_id = ? AND state = 'fighting'
        `, [siegeId], 'all');

        for (const participant of participants) {
            const userData = db.loadUserData(participant.user_id);
            if (userData && userData.play) {
                userData.play.addExp(50000);
                userData.play.addCopper(50 * 1000);
            }
        }
    }

    getActiveSieges() {
        const db = this.db;
        if (!db) {
            return [];
        }

        const sql = `
            SELECT s.*, g.name as gang_name
            FROM siege_wars s
            LEFT JOIN gangs g ON s.attacker_gang_id = g.id
            WHERE s.status IN ('gathering', 'fighting')
            ORDER BY s.start_time DESC
        `;

        return db.executeSQL(sql, [], 'all') || [];
    }

    getMySieges() {
        const db = this.db;
        if (!db) {
            return [];
        }

        const sql = `
            SELECT s.*, p.state as my_state, p.damage_dealt
            FROM siege_wars s
            LEFT JOIN siege_participants p ON s.id = p.siege_id AND p.user_id = ?
            ORDER BY s.start_time DESC
            LIMIT 10
        `;

        return db.executeSQL(sql, [this.userId], 'all') || [];
    }

    getStatus() {
        const activeSieges = this.getActiveSieges();
        const mySieges = this.getMySieges();

        return {
            activeSieges: activeSieges,
            mySieges: mySieges,
            canInitiate: this.canInitiateSiege()
        };
    }
}
