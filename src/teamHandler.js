class TeamHandler {
    // 处理队伍页面请求
    static handleTeamRequest(user, query, config) {
        const { type, teamId, page = 1 } = query;
        let mergeObj = {};

        // 处理队伍操作
        if (type) {
            switch (type) {
                case 'createTeam':
                    // 检查用户是否已经在队伍中
                    const existingTeam = user.getMyTeam();
                    if (existingTeam) {
                        mergeObj.tip = '您已经在队伍中，无法创建新队伍';
                    } else {
                        user.createTeam();
                        mergeObj.tip = '队伍创建成功';
                    }
                    break;
                case 'joinTeam':
                    if (teamId) {
                        const result = user.joinTeam(parseInt(teamId));
                        if (result.error) {
                            mergeObj.tip = result.error;
                        } else {
                            mergeObj.tip = '成功加入队伍';
                        }
                    }
                    break;
                case 'leaveTeam':
                    if (teamId) {
                        const result = user.leaveTeam(parseInt(teamId));
                        // 透传 team.js 的结果提示（队长退队含自动转让/自动解散信息）
                        mergeObj.tip = result.error || result.tip || '成功退出队伍';
                    }
                    break;
                case 'disbandTeam':
                    if (teamId) {
                        const result = user.disbandTeam(parseInt(teamId));
                        if (result.error) {
                            mergeObj.tip = result.error;
                        } else {
                            mergeObj.tip = '队伍已解散';
                        }
                    }
                    break;
            }
        }

        // 获取队伍列表
        const teamsData = user.getTeams(parseInt(page));
        const myTeam = user.getMyTeam();

        return {
            page: 'team',
            ...config,
            query,
            user: user,
            teams: teamsData.teams,
            teamTotal: teamsData.total,
            teamPage: teamsData.page,
            teamTotalPages: teamsData.totalPages,
            myTeam: myTeam,
            ...mergeObj
        };
    }

    // 处理我的队伍页面请求
    static handleMyTeamRequest(user, query, config) {
        // 获取我的队伍
        const myTeam = user.getMyTeam();

        return {
            page: 'my-team',
            ...config,
            query,
            user: user,
            myTeam: myTeam
        };
    }
}

export default TeamHandler;