class Team {
    constructor(database) {
        this.db = database;
        this.teams = []; // 内存中的队伍列表
        this.loadTeamsFromDB(); // 从数据库加载队伍信息
    }

    // 从数据库加载队伍信息
    loadTeamsFromDB() {
        try {
            if (this.db) {
                this.teams = this.db.getTeams();
            }
        } catch (error) {
            console.error('加载队伍信息失败:', error);
            this.teams = [];
        }
    }

    // 创建队伍
    createTeam(leader, teamName, teamType, target) {
        const team = {
            id: Date.now(), // 使用时间戳作为队伍ID
            name: teamName || '队伍' + (this.teams.length + 1),
            type: teamType || '普通',
            target: target || '',
            leader: {
                id: leader.id,
                name: leader.nickname,
                level: leader.play.level,
                status: '在线'
            },
            members: [{
                id: leader.id,
                name: leader.nickname,
                level: leader.play.level,
                status: '在线'
            }],
            createdAt: new Date()
        };

        this.teams.push(team);

        // 保存到数据库
        try {
            if (this.db) {
                this.db.saveTeam(team);
            }
        } catch (error) {
            console.error('保存队伍信息失败:', error);
        }

        return team;
    }

    // 加入队伍
    joinTeam(userId, username, level, teamId) {
        // 同 leaveTeam：先同步最新成员列表，避免脏内存误判“已在队伍中”或漏判满员
        this.loadTeamsFromDB();
        const team = this.teams.find(t => t.id === teamId);
        if (!team) {
            return { error: '队伍不存在' };
        }

        // 检查队伍是否已满（最大5人）
        if (team.members.length >= 5) {
            return { error: '队伍已满' };
        }

        // 检查是否已经在队伍中
        if (team.members.some(member => member.id === userId)) {
            return { error: '您已在队伍中' };
        }

        const newMember = {
            id: userId,
            name: username,
            level: level,
            status: '在线'
        };

        team.members.push(newMember);

        // 更新数据库
        try {
            if (this.db) {
                this.db.updateTeam(team);
            }
        } catch (error) {
            console.error('更新队伍信息失败:', error);
        }

        return { success: true, team: team };
    }

    // 退出队伍
    leaveTeam(userId, teamId) {
        // 每次改动前重读数据库：各用户持有独立 Team 实例，他人最近的加入/转让未必已同步到本实例内存，
        // 脏数据会使队长转让误判“仅剩队长”而错误解散队伍
        this.loadTeamsFromDB();
        const team = this.teams.find(t => t.id === teamId);
        if (!team) {
            return { error: '队伍不存在' };
        }

        // 从成员列表中移除
        const memberIndex = team.members.findIndex(member => member.id === userId);
        if (memberIndex === -1) {
            return { error: '您不在该队伍中' };
        }

        team.members.splice(memberIndex, 1);

        // 队长退队：自动转让队长给最早入队的剩余成员；仅剩队长时直接解散队伍
        let tip = '成功退出队伍';
        if (team.leader.id === userId) {
            if (team.members.length === 0) {
                const teamIndex = this.teams.indexOf(team);
                this.teams.splice(teamIndex, 1);
                try {
                    if (this.db) {
                        this.db.deleteTeam(teamId);
                    }
                } catch (error) {
                    console.error('删除队伍信息失败:', error);
                }
                return { success: true, tip: '队伍已解散' };
            }
            const newLeader = team.members[0];
            team.leader = { id: newLeader.id, name: newLeader.name, level: newLeader.level, status: newLeader.status || '在线' };
            tip = `已退出队伍，队长转让给 ${newLeader.name}`;
        }

        // 更新数据库
        try {
            if (this.db) {
                this.db.updateTeam(team);
            }
        } catch (error) {
            console.error('更新队伍信息失败:', error);
        }

        return { success: true, tip: tip };
    }

    // 解散队伍
    disbandTeam(userId, teamId) {
        // 同 leaveTeam：先同步数据库最新状态再校验队长权限
        this.loadTeamsFromDB();
        const teamIndex = this.teams.findIndex(t => t.id === teamId);
        if (teamIndex === -1) {
            return { error: '队伍不存在' };
        }

        const team = this.teams[teamIndex];

        // 只有队长可以解散队伍
        if (team.leader.id !== userId) {
            return { error: '只有队长可以解散队伍' };
        }

        // 从内存中移除
        this.teams.splice(teamIndex, 1);

        // 从数据库中删除
        try {
            if (this.db) {
                this.db.deleteTeam(teamId);
            }
        } catch (error) {
            console.error('删除队伍信息失败:', error);
        }

        return { success: true };
    }

    // 获取队伍列表
    getTeams(page = 1, pageSize = 10) {
        // 重新从数据库加载所有队伍，确保获取最新的数据
        this.loadTeamsFromDB();
        
        // 分页处理
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedTeams = this.teams.slice(startIndex, endIndex);
        
        return {
            teams: paginatedTeams,
            total: this.teams.length,
            page: page,
            totalPages: Math.ceil(this.teams.length / pageSize)
        };
    }

    // 获取我的队伍
    getMyTeam(userId) {
        // 重读数据库：本实例内存可能落后于其他队员的入队/转让/解散操作，
        // 页面按 leader.id 判断队长身份，脏数据会展错退出/解散按钮
        this.loadTeamsFromDB();
        const team = this.teams.find(t => 
            t.members.some(member => member.id === userId)
        );
        return team || null;
    }

    // 获取完整状态用于保存到数据库
    getState() {
        // 队伍信息已经独立存储在数据库中
        return {};
    }

    // 从保存的数据中恢复状态
    restoreState(state) {
        // 队伍信息已经从数据库加载
    }
}

export default Team;