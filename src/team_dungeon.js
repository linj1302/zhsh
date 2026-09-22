/**
 * 团队副本系统 - 多人组队挑战boss
 *
 * 依赖说明：
 * - team: src/team.js 实例，实际 API 为 getMyTeam(userId)（返回 {leader, members:[{id,name,level}]}）
 * - config: trial.json 无 minMembers/bossHp/rewards 字段，由 playerRequirement/boss 等级推导
 */
import { trial as trialConfig } from '../config/index.js';

export default class TeamDungeon {
    constructor(team, database, userId) {
        this.team = team;
        this.db = database;
        this.userId = userId;
        this.dungeons = {}; // 活跃副本
        this.items = {}; // 奖励物品
    }

    // 获取我的队伍（不存在时返回 null）
    getMyTeam() {
        return this.team.getMyTeam(this.userId) || null;
    }

    // 获取团队成员（兼容旧方法名）
    getTeamMembers() {
        const myTeam = this.getMyTeam();
        return myTeam ? myTeam.members : [];
    }

    // 从 playerRequirement（如 "7人"）解析最低人数，无法解析时默认 2 人
    _parseMinMembers(playerRequirement) {
        const m = String(playerRequirement || '').match(/(\d+)\s*人/);
        return m ? Number(m[1]) : 2;
    }

    // 创建团队副本（dungeonId 为副本名，如 "基德的宝藏"）
    createDungeon(dungeonId, requiredLevel) {
        const dungeon = trialConfig.find(d => d.name === dungeonId);
        if (!dungeon) {
            return { success: false, tip: '副本不存在' };
        }

        const myTeam = this.getMyTeam();
        if (!myTeam) {
            return { success: false, tip: '请先创建或加入队伍' };
        }

        const minMembers = this._parseMinMembers(dungeon.playerRequirement);
        if (myTeam.members.length < minMembers) {
            return { success: false, tip: `需要至少${minMembers}人组队` };
        }

        // Boss 数值由副本档位推导（等级取 playerRequirement 下限或 boss 名称对应档，无配置时默认 100）
        const levelMatch = String(dungeon.levelRequirement || '').match(/(\d+)/);
        const bossLevel = Number(levelMatch ? levelMatch[1] : 100);
        const bossHp = Math.max(50000, bossLevel * bossLevel * 10);

        const dungeonInstance = {
            id: Date.now(),
            dungeonId,
            leaderId: myTeam.leader ? myTeam.leader.id : this.userId,
            members: myTeam.members.map(m => ({
                userId: m.id,
                nickname: m.name,
                level: m.level || 1,
                attack: Math.max(100, (m.level || 1) * 50),
                defense: Math.max(50, (m.level || 1) * 25),
                health: Math.max(1000, (m.level || 1) * 100),
                currentHealth: Math.max(1000, (m.level || 1) * 100)
            })),
            hp: bossHp,
            maxHp: bossHp,
            bossLevel,
            bossDefense: Math.floor(bossLevel * 5),
            bossAttack: Math.floor(bossLevel * 30),
            status: 'active',
            startTime: Date.now(),
            attacked: false,
            turns: 0,
            loot: dungeon.prize || {}
        };

        this.dungeons[dungeonInstance.id] = dungeonInstance;

        return {
            success: true,
            tip: `成功创建【${dungeon.name}】副本，等待队员加入`,
            dungeonId: dungeonInstance.id
        };
    }

    // 加入副本
    joinDungeon(dungeonId) {
        const dungeon = this.dungeons[dungeonId];
        if (!dungeon) {
            return { success: false, tip: '副本不存在' };
        }
        
        if (dungeon.status !== 'active') {
            return { success: false, tip: '副本已结束' };
        }
        
        const userId = this.userId;
        if (dungeon.members.find(m => String(m.userId) === String(userId))) {
            return { success: false, tip: '已经在副本中' };
        }

        const myTeam = this.getMyTeam();
        const member = myTeam ? myTeam.members.find(m => m.id === userId) : null;
        if (!member) {
            return { success: false, tip: '你不在队伍中' };
        }

        dungeon.members.push({
            userId,
            nickname: member.name,
            level: member.level || 1,
            attack: Math.max(100, (member.level || 1) * 50),
            defense: Math.max(50, (member.level || 1) * 25),
            health: Math.max(1000, (member.level || 1) * 100),
            currentHealth: Math.max(1000, (member.level || 1) * 100)
        });
        
        return { success: true, tip: '成功加入副本' };
    }

    // 攻击Boss
    attackBoss(dungeonId, memberId) {
        const dungeon = this.dungeons[dungeonId];
        if (!dungeon) {
            return { success: false, tip: '副本不存在' };
        }
        
        if (dungeon.status !== 'active') {
            return { success: false, tip: '副本已结束' };
        }
        
        // 前端反射调用的 params 均为字符串，与 userId（数字）比较前需转换（禁止改公开方法名，仅内部兼容）
        const member = dungeon.members.find(m => String(m.userId) === String(memberId));
        if (!member) {
            return { success: false, tip: '你不在副本中' };
        }
        
        if (member.currentHealth <= 0) {
            return { success: false, tip: '你已死亡，无法攻击' };
        }
        
        // 计算伤害
        const baseDamage = Math.floor(member.attack * (0.8 + Math.random() * 0.4));
        const defenseReduction = Math.floor(dungeon.bossDefense * Math.random());
        const damage = Math.max(1, baseDamage - defenseReduction);
        
        dungeon.hp -= damage;
        dungeon.attacked = true;
        
        // Boss反击
        const bossAttack = Math.floor(dungeon.bossAttack * (0.7 + Math.random() * 0.6));
        member.currentHealth = Math.max(0, member.currentHealth - bossAttack);
        
        // 检查玩家是否死亡
        const deadMembers = dungeon.members.filter(m => m.currentHealth <= 0);
        if (deadMembers.length > dungeon.members.length / 2) {
            dungeon.status = 'failed';
            // 失败结算后清理副本条目，防止 dungeons 只增不减造成内存/存档膨胀（页面无已结束副本的依赖）
            delete this.dungeons[dungeonId];
            return {
                success: false,
                tip: `团队过半死亡，副本失败`,
                damage,
                bossAttack,
                deadMembers: deadMembers.length
            };
        }
        
        // 检查Boss是否被击败
        if (dungeon.hp <= 0) {
            dungeon.status = 'completed';
            const rewards = this.generateLoot(dungeon);
            // 胜利结算后清理副本条目，防止 dungeons 只增不减造成内存/存档膨胀（页面无已结束副本的依赖）
            delete this.dungeons[dungeonId];
            
            return {
                success: true,
                tip: `Boss被击败！获得奖励：${rewards.map(r => r.name).join(', ')}`,
                damage,
                bossAttack,
                rewards
            };
        }
        
        dungeon.turns++;
        
        return {
            success: true,
            tip: `造成${damage}伤害，Boss回复${bossAttack}伤害`,
            damage,
            bossAttack,
            hp: dungeon.hp,
            turns: dungeon.turns
        };
    }

    // 治疗队友（前端反射传入字符串参数，需校验治疗量与成员存在性，避免 NaN/负数污染血量存档）
    healMember(dungeonId, healerId, targetId, healAmount) {
        const amount = Number(healAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { success: false, tip: '治疗量无效' };
        }

        const dungeon = this.dungeons[dungeonId];
        if (!dungeon) {
            return { success: false, tip: '副本不存在' };
        }
        
        if (dungeon.status !== 'active') {
            return { success: false, tip: '副本已结束' };
        }

        const healer = dungeon.members.find(m => String(m.userId) === String(healerId));
        if (!healer) {
            return { success: false, tip: '你不在副本中' };
        }

        const target = dungeon.members.find(m => String(m.userId) === String(targetId));
        if (!target) {
            return { success: false, tip: '治疗目标不在副本中' };
        }
        
        if (healer.currentHealth <= 0 || target.currentHealth <= 0) {
            return { success: false, tip: '玩家已死亡' };
        }
        
        const actualHeal = Math.min(amount, target.health - target.currentHealth);
        target.currentHealth = Math.min(target.health, target.currentHealth + actualHeal);
        
        return {
            success: true,
            tip: `治疗了${target.nickname}${actualHeal}点生命`
        };
    }

    // 生成战利品（将副本 prize 如 {经验, 铜贝} 转为可读奖励列表）
    generateLoot(dungeon) {
        const rewards = [];
        const loot = dungeon.loot || {};

        if (Array.isArray(loot)) {
            // 兼容旧结构：[{name, dropRate, num}]
            loot.forEach(item => {
                if (!item || item.dropRate === undefined || Math.random() < item.dropRate) {
                    rewards.push({
                        name: item && item.name,
                        type: item && item.type,
                        num: (item && item.num) || 1,
                        info: item && item.info
                    });
                }
            });
        } else {
            Object.keys(loot).forEach(key => {
                rewards.push({ name: key, num: Number(loot[key]) || 0 });
            });
        }

        return rewards;
    }

    // 离开副本（安全离开）
    leaveDungeon(dungeonId) {
        const dungeon = this.dungeons[dungeonId];
        if (!dungeon) {
            return { success: false, tip: '副本不存在' };
        }
        
        const userId = this.userId;
        const memberIndex = dungeon.members.findIndex(m => String(m.userId) === String(userId));
        if (memberIndex === -1) {
            return { success: false, tip: '你不在副本中' };
        }
        
        dungeon.members.splice(memberIndex, 1);
        
        if (dungeon.members.length < 2) {
            dungeon.status = 'cancelled';
            // 副本已取消，清理条目防止存档膨胀（无页面依赖残留数据）
            delete this.dungeons[dungeonId];
        }
        
        return { success: true, tip: '已安全离开副本' };
    }

    // 销毁副本实例
    destroyDungeon(dungeonId) {
        delete this.dungeons[dungeonId];
    }

    // 获取副本状态
    getDungeonStatus(dungeonId) {
        const dungeon = this.dungeons[dungeonId];
        if (!dungeon) return null;
        
        return {
            id: dungeon.id,
            dungeonId: dungeon.dungeonId,
            status: dungeon.status,
            hp: dungeon.hp,
            maxHp: dungeon.maxHp,
            turns: dungeon.turns,
            members: dungeon.members.length,
            leader: dungeon.leaderId
        };
    }
}
