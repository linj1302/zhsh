import fs from 'fs';
import initSqlJs from 'sql.js';
import Pet from './pet.js';
import multiavatar from '@multiavatar/multiavatar';
import * as formulas from './formulas.js';

class UserDatabase {
    constructor(dbPath = './user_data.db') {
        // 确保数据库文件所在目录存在
        const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
        if (dir && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }

        this.dbPath = dbPath;
        this.init();
    }

    async init() {
        try {
            let params = {};
            if (typeof require !== 'undefined') {
                const file = await import('sql.js/dist/sql-wasm.wasm');
                params.locateFile = () => file.default;
            }
            // 初始化SQL.js
            const SQL = await initSqlJs(params);

            // 如果数据库文件存在，加载它；否则创建新数据库
            if (fs.existsSync(this.dbPath)) {
                const filebuffer = fs.readFileSync(this.dbPath);
                this.db = new SQL.Database(filebuffer);
            } else {
                this.db = new SQL.Database();
            }

            // 创建用户数据表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS user_data
                (
                    user_id
                    INTEGER
                    PRIMARY
                    KEY,
                    data
                    TEXT
                    NOT
                    NULL,
                    updated_at
                    DATETIME
                    DEFAULT
                    CURRENT_TIMESTAMP
                );
            `);

            // 创建用户账户表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS users
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    username
                    TEXT
                    UNIQUE
                    NOT
                    NULL,
                    password
                    TEXT
                    NOT
                    NULL,
                    nickname
                    TEXT
                    NOT
                    NULL,
                    gender
                    TEXT
                    DEFAULT
                    'male',
                    avatar
                    TEXT,
                    created_at
                    DATETIME
                    DEFAULT
                    CURRENT_TIMESTAMP
                );
            `);

            // 创建聊天消息表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS chat_messages
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    user_id
                    INTEGER
                    NOT
                    NULL,
                    username
                    TEXT
                    NOT
                    NULL,
                    message
                    TEXT
                    NOT
                    NULL,
                    type
                    TEXT
                    DEFAULT
                    'public',
                    target_user_id
                    INTEGER,
                    gang_id
                    INTEGER,
                    team_id
                    INTEGER,
                    created_at
                    DATETIME
                    DEFAULT
                    CURRENT_TIMESTAMP
                );
            `);

            // 创建队伍表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS teams
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY,
                    name
                    TEXT
                    NOT
                    NULL,
                    type
                    TEXT
                    NOT
                    NULL,
                    target
                    TEXT,
                    leader_id
                    INTEGER
                    NOT
                    NULL,
                    leader_name
                    TEXT
                    NOT
                    NULL,
                    leader_level
                    INTEGER
                    NOT
                    NULL,
                    members
                    TEXT
                    NOT
                    NULL, -- JSON格式存储成员列表
                    created_at
                    DATETIME
                    DEFAULT
                    CURRENT_TIMESTAMP
                );
            `);

            // 创建帮会表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS gangs
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    name
                    TEXT
                    UNIQUE
                    NOT
                    NULL,
                    level
                    INTEGER
                    DEFAULT
                    1,
                    fund
                    INTEGER
                    DEFAULT
                    0,
                    notice
                    TEXT
                    DEFAULT
                    '',
                    max_members
                    INTEGER
                    DEFAULT
                    50,
                    created_at
                    DATETIME
                    DEFAULT
                    CURRENT_TIMESTAMP
                );
            `);

            // 创建帮会成员表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS gang_members
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    gang_id
                    INTEGER
                    NOT
                    NULL,
                    user_id
                    INTEGER
                    NOT
                    NULL,
                    username
                    TEXT
                    NOT
                    NULL,
                    role
                    TEXT
                    DEFAULT
                    'member', -- member, elder, leader
                    contribution
                    INTEGER
                    DEFAULT
                    0,
                    joined_at
                    DATETIME
                    DEFAULT
                    CURRENT_TIMESTAMP,
                    FOREIGN
                    KEY
                (
                    gang_id
                ) REFERENCES gangs
                (
                    id
                )
                    );
            `);

            // 创建帮会仓库表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS gang_storage
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    gang_id
                    INTEGER
                    NOT
                    NULL,
                    item_name
                    TEXT
                    NOT
                    NULL,
                    item_level
                    INTEGER
                    DEFAULT
                    1,
                    item_info
                    TEXT,
                    quantity
                    INTEGER
                    DEFAULT
                    1,
                    FOREIGN
                    KEY
                (
                    gang_id
                ) REFERENCES gangs
                (
                    id
                )
                    );
            `);

            // 创建帮会捐献记录表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS gang_donations
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    gang_id
                    INTEGER
                    NOT
                    NULL,
                    user_id
                    INTEGER
                    NOT
                    NULL,
                    username
                    TEXT
                    NOT
                    NULL,
                    donation_type
                    TEXT
                    NOT
                    NULL, -- silver, gold, token
                    amount
                    INTEGER
                    NOT
                    NULL,
                    contribution
                    INTEGER
                    NOT
                    NULL,
                    donated_at
                    DATETIME
                    DEFAULT
                    CURRENT_TIMESTAMP,
                    FOREIGN
                    KEY
                (
                    gang_id
                ) REFERENCES gangs
                (
                    id
                )
                    );
            `);

            // 创建好友关系表
            this.executeSQL(`
                CREATE TABLE IF NOT EXISTS friends
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    user_id
                    INTEGER
                    NOT
                    NULL,
                    friend_id
                    INTEGER
                    NOT
                    NULL,
                    status
                    TEXT
                    DEFAULT
                    'accepted', -- accepted, pending
                    created_at
                    DATETIME
                    DEFAULT
                    CURRENT_TIMESTAMP,
                    FOREIGN
                    KEY
                (
                    user_id
                ) REFERENCES users
                (
                    id
                ),
                    FOREIGN KEY
                (
                    friend_id
                ) REFERENCES users
                (
                    id
                )
                    );
            `);

            // 初始化宠物表
            this.initPetsTable();

            // 初始化婚姻表
            this.initMarriageTable();

            // 初始化邮件表
            this.initMailTable();

            // 保存初始化后的数据库
            this.saveDatabase();
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    // 初始化宠物表
    initPetsTable() {
        const createPetsTable = `
            CREATE TABLE IF NOT EXISTS pets
            (
                id
                INTEGER
                PRIMARY
                KEY
                AUTOINCREMENT,
                user_id
                INTEGER,
                name
                TEXT
                NOT
                NULL,
                type
                TEXT
                NOT
                NULL,
                level
                INTEGER
                DEFAULT
                1,
                exp
                INTEGER
                DEFAULT
                0,
                hunger
                INTEGER
                DEFAULT
                1000,
                cleanliness
                INTEGER
                DEFAULT
                1000,
                mood
                INTEGER
                DEFAULT
                1000,
                qualification
                TEXT
                DEFAULT
                '普通',
                talent
                TEXT
                DEFAULT
                '普通',
                is_fighting
                BOOLEAN
                DEFAULT
                FALSE,
                is_bound
                BOOLEAN
                DEFAULT
                FALSE,
                skills
                TEXT
                DEFAULT
                '[]',
                description
                TEXT
                DEFAULT
                '',
                created_at
                DATETIME
                DEFAULT
                CURRENT_TIMESTAMP
            );
        `;

        try {
            this.executeSQL(createPetsTable);
        } catch (error) {
            console.error('Failed to create pets table:', error);
        }
    }

    // 初始化婚姻表
    initMarriageTable() {
        // 创建求婚申请表
        const createProposalsTable = `
            CREATE TABLE IF NOT EXISTS marriage_proposals
            (
                id
                INTEGER
                PRIMARY
                KEY
                AUTOINCREMENT,
                proposer_id
                INTEGER
                NOT
                NULL,
                proposee_id
                INTEGER
                NOT
                NULL,
                status
                TEXT
                DEFAULT
                'pending', -- pending, accepted, rejected, expired
                created_at
                DATETIME
                DEFAULT
                CURRENT_TIMESTAMP,
                FOREIGN
                KEY
            (
                proposer_id
            ) REFERENCES users
            (
                id
            ),
                FOREIGN KEY
            (
                proposee_id
            ) REFERENCES users
            (
                id
            )
                );
        `;

        // 创建婚姻关系表
        const createMarriagesTable = `
            CREATE TABLE IF NOT EXISTS marriages
            (
                id
                INTEGER
                PRIMARY
                KEY
                AUTOINCREMENT,
                user1_id
                INTEGER
                NOT
                NULL,
                user2_id
                INTEGER
                NOT
                NULL,
                wedding_hall
                TEXT,
                wedding_date
                DATETIME,
                status
                TEXT
                DEFAULT
                'married', -- married, divorced
                created_at
                DATETIME
                DEFAULT
                CURRENT_TIMESTAMP,
                FOREIGN
                KEY
            (
                user1_id
            ) REFERENCES users
            (
                id
            ),
                FOREIGN KEY
            (
                user2_id
            ) REFERENCES users
            (
                id
            )
                );
        `;

        // 创建婚礼表
        const createWeddingTable = `
            CREATE TABLE IF NOT EXISTS marriage_banquets
            (
                id
                INTEGER
                PRIMARY
                KEY
                AUTOINCREMENT,
                marriage_id
                INTEGER
                NOT
                NULL,
                host_id
                INTEGER
                NOT
                NULL,
                status
                TEXT
                DEFAULT
                'active',
                guest_count
                INTEGER
                DEFAULT
                0,
                needed_guests
                INTEGER
                DEFAULT
                8,
                created_at
                DATETIME
                DEFAULT
                CURRENT_TIMESTAMP
            );
        `;

        // 创建婚礼宾客表
        const createBanquetGuestsTable = `
            CREATE TABLE IF NOT EXISTS banquet_guests
            (
                id
                INTEGER
                PRIMARY
                KEY
                AUTOINCREMENT,
                banquet_id
                INTEGER
                NOT
                NULL,
                user_id
                INTEGER
                NOT
                NULL,
                joined_at
                DATETIME
                DEFAULT
                CURRENT_TIMESTAMP,
                UNIQUE(banquet_id, user_id)
            );
        `;

        try {
            this.executeSQL(createProposalsTable);
            this.executeSQL(createMarriagesTable);
            this.executeSQL(createWeddingTable);
            this.executeSQL(createBanquetGuestsTable);
        } catch (error) {
            console.error('Failed to create marriage tables:', error);
        }
    }

    // 初始化邮件表
    initMailTable() {
        // 创建邮件表
        const createMailsTable = `
            CREATE TABLE IF NOT EXISTS mails
            (
                id
                INTEGER
                PRIMARY
                KEY
                AUTOINCREMENT,
                sender_id
                INTEGER
                NOT
                NULL,
                sender_name
                TEXT
                NOT
                NULL,
                receiver_id
                INTEGER
                NOT
                NULL,
                receiver_name
                TEXT
                NOT
                NULL,
                subject
                TEXT
                NOT
                NULL,
                content
                TEXT
                NOT
                NULL,
                items
                TEXT,      -- JSON格式存储物品列表
                is_read
                BOOLEAN
                DEFAULT
                FALSE,
                is_claimed
                BOOLEAN
                DEFAULT
                FALSE,
                created_at
                DATETIME
                DEFAULT
                CURRENT_TIMESTAMP,
                FOREIGN
                KEY
            (
                sender_id
            ) REFERENCES users
            (
                id
            ),
                FOREIGN KEY
            (
                receiver_id
            ) REFERENCES users
            (
                id
            )
                );
        `;

        try {
            this.executeSQL(createMailsTable);
        } catch (error) {
            console.error('Failed to create mails table:', error);
        }
    }

    // 批量操作：抑制 saveDatabase 全量写盘（beginBatch/endBatch 成对调用，endBatch 归零时统一落盘一次）
    beginBatch() {
        this._batchDepth = (this._batchDepth || 0) + 1;
    }

    endBatch() {
        this._batchDepth = Math.max(0, (this._batchDepth || 1) - 1);
        if (this._batchDepth === 0) {
            // 观测性：单次批量抑制落盘次数过多时告警一次（不强制落盘，避免破坏事务语义）
            if ((this._suppressedSaves || 0) > 500) {
                console.warn(`[database] 单次批量抑制落盘 ${this._suppressedSaves} 次，已统一落盘一次`);
            }
            this._suppressedSaves = 0;
            this.saveDatabase();
        }
    }

    // 保存数据库到文件
    saveDatabase() {
        if (this._batchDepth > 0) {
            this._suppressedSaves = (this._suppressedSaves || 0) + 1;
            return;
        }
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    // 执行SQL操作的方法
    // 安全地处理SQL参数，将undefined转换为null
    _prepareSafeParams(params) {
        if (!params || params.length === 0) {
            return [];
        }
        return params.map(param => param === undefined ? null : param);
    }

    executeSQL(sql, params = [], mode = 'run') {
        try {

            // 安全处理参数
            const safeParams = this._prepareSafeParams(params);

            if (mode === 'run' || mode === 'exec') {
                // 执行修改操作
                this.db.run(sql, safeParams);
                // 保存数据库
                this.saveDatabase();
                return true;
            } else if (mode === 'get') {
                // 获取单行数据
                const stmt = this.db.prepare(sql);
                // 绑定参数
                stmt.bind(safeParams);

                let result = null;
                // 使用step和getAsObject获取对象格式的结果
                if (stmt.step()) {
                    result = stmt.getAsObject();
                }

                stmt.free();
                return result || null;
            } else if (mode === 'all') {
                // 获取所有数据
                const stmt = this.db.prepare(sql);
                stmt.bind(safeParams);

                const results = [];
                // 循环获取所有结果，使用getAsObject确保对象格式
                while (stmt.step()) {
                    const row = stmt.getAsObject();
                    results.push(row);
                }

                stmt.free();
                return results;
            }
        } catch (error) {
            console.error('SQL执行错误:', error);
            throw error;
        }
    }

    /**
     * 保存用户数据
     * @param {number} userId - 用户ID
     * @param {object} userData - 用户数据对象
     */
    saveUserData(userId, userData) {
        // 确保userData包含updated_at字段
        userData.updated_at = new Date().toISOString();
        
        const data = JSON.stringify(userData);
        const sql = `
            INSERT
            OR REPLACE INTO user_data (user_id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `;
        this.executeSQL(sql, [userId, data], 'run');
    }

    /**
     * 读取用户数据
     * @param {number} userId - 用户ID
     * @returns {object|null} 用户数据对象，如果不存在则返回null
     */
    loadUserData(userId) {
        const sql = 'SELECT data FROM user_data WHERE user_id = ?';
        const row = this.executeSQL(sql, [userId], 'get');

        if (row) {
            try {
                return JSON.parse(row.data);
            } catch (e) {
                console.error('Error parsing user data:', e);
                return null;
            }
        }

        return null;
    }

    /**
     * 用户注册
     * @param {string} username - 用户账号
     * @param {string} password - 用户密码
     * @param {string} nickname - 用户昵称
     * @param {string} gender - 用户性别
     * @returns {object|null} 注册成功的用户信息
     */
    registerUser(username, password, nickname, gender = 'male') {
        try {
            // 生成用户头像
            const avatarSvg = multiavatar(username);

            const sql = `
                INSERT INTO users (username, password, nickname, gender, avatar)
                VALUES (?, ?, ?, ?, ?)
            `;

            this.executeSQL(sql, [username, password, nickname, gender, avatarSvg], 'run');

            // 直接通过用户名查询刚创建的用户信息（更可靠的方式）
            const userSql = 'SELECT * FROM users WHERE username = ?';
            const userInfo = this.executeSQL(userSql, [username], 'get');
            return userInfo;
        } catch (error) {
            console.error('用户注册失败:', error);
            return null;
        }
    }

    /**
     * 用户登录验证
     * @param {string} username - 用户账号
     * @param {string} password - 用户密码
     * @returns {object|null} 验证成功的用户信息
     */
    authenticateUser(username, password) {
        const sql = `
            SELECT *
            FROM users
            WHERE username = ?
              AND password = ?
        `;
        return this.executeSQL(sql, [username, password], 'get');
    }

    /**
     * 根据用户ID获取用户信息
     * @param {number} userId - 用户ID
     * @returns {object|null} 用户信息
     */
    getUserById(userId) {
        const sql = 'SELECT * FROM users WHERE id = ?';
        return this.executeSQL(sql, [userId], 'get');
    }

    /**
     * 根据用户名获取用户信息
     * @param {string} username - 用户名
     * @returns {object|null} 用户信息
     */
    getUserByUsername(username) {
        const sql = 'SELECT * FROM users WHERE username = ?';
        return this.executeSQL(sql, [username], 'get');
    }

    /**
     * 保存聊天消息
     * @param {number} userId - 用户ID
     * @param {string} username - 用户名
     * @param {string} message - 消息内容
     * @param {string} channel - 聊天频道 (public, private, gang, team)
     * @param {number} targetUserId - 目标用户ID（用于私聊）
     * @param {number} gangId - 帮会ID（用于帮会聊天）
     * @param {number} teamId - 队伍ID（用于队伍聊天）
     */
    saveChatMessage(userId, username, message, channel = 'public', targetUserId = null, gangId = null, teamId = null) {
        const sql = `
            INSERT INTO chat_messages (user_id, username, message, type, target_user_id, gang_id, team_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        this.executeSQL(sql, [userId, username, message, channel, targetUserId, gangId, teamId], 'run');
    }

    /**
     * 获取用户参与的私聊会话列表
     * @param {number} userId - 当前用户ID
     * @returns {Array} 私聊会话列表
     */
    getPrivateChatSessions(userId) {
        if (!userId) {
            return []; // 没有提供用户ID
        }
        
        const sql = `
            SELECT DISTINCT 
                CASE 
                    WHEN user_id = ? THEN target_user_id 
                    ELSE user_id 
                END as partner_id
            FROM chat_messages 
            WHERE type = 'private' 
              AND (user_id = ? OR target_user_id = ?)
        `;
        
        const sessions = this.executeSQL(sql, [userId, userId, userId], 'all');
        
        // 获取用户信息
        return sessions.map(session => {
            return this.getUserById(session.partner_id);
        }).filter(user => user !== null);
    }

    /**
     * 获取聊天消息
     * @param {number} limit - 限制返回的消息数量
     * @param {string} channel - 聊天频道 (public, private, gang, team)
     * @param {number} userId - 当前用户ID
     * @returns {Array} 聊天消息数组
     */
    getChatMessages(limit = 50, channel = 'public', userId = null) {
        let sql, params;
        
        switch(channel) {
            case 'private':
                // 私聊需要特殊处理，只获取与当前用户相关的私聊消息
                if (!userId) {
                    return []; // 没有提供用户ID，无法查看私聊消息
                }
                
                sql = `
                    SELECT *
                    FROM chat_messages
                    WHERE type = 'private' 
                      AND (user_id = ? OR target_user_id = ?)
                    ORDER BY created_at DESC LIMIT ?
                `;
                params = [userId, userId, limit];
                break;
                
            case 'gang':
                // 帮会聊天需要检查用户是否在帮会中
                if (!userId) {
                    return []; // 没有提供用户ID，无法查看帮会聊天
                }
                
                // 检查用户是否在帮会中
                const userGang = this.getUserGang(userId);
                if (!userGang) {
                    return []; // 用户不在帮会中，无法查看帮会聊天
                }
                
                sql = `
                    SELECT *
                    FROM chat_messages
                    WHERE type = 'gang' AND gang_id = ?
                    ORDER BY created_at DESC LIMIT ?
                `;
                params = [userGang.id, limit];
                break;
                
            case 'team':
                // 队伍聊天需要检查用户是否在队伍中
                if (!userId) {
                    return []; // 没有提供用户ID，无法查看队伍聊天
                }
                
                // 检查用户是否在队伍中
                const userTeams = this.getTeams();
                const userTeam = userTeams.find(team => 
                    team.members.some(member => member.id === userId)
                );
                
                if (!userTeam) {
                    return []; // 用户不在队伍中，无法查看队伍聊天
                }
                
                sql = `
                    SELECT *
                    FROM chat_messages
                    WHERE type = 'team' AND team_id = ?
                    ORDER BY created_at DESC LIMIT ?
                `;
                params = [userTeam.id, limit];
                break;
                
            default:
                // 公共频道或其他默认频道
                sql = `
                    SELECT *
                    FROM chat_messages
                    WHERE type = ?
                    ORDER BY created_at DESC LIMIT ?
                `;
                params = [channel, limit];
        }
        
        return this.executeSQL(sql, params, 'all');
    }

    /**
     * 保存队伍信息
     * @param {object} team - 队伍对象
     */
    saveTeam(team) {
        const members = JSON.stringify(team.members);
        const sql = `
            INSERT INTO teams (id, name, type, target, leader_id, leader_name, leader_level, members, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        this.executeSQL(sql, [
            team.id,
            team.name,
            team.type,
            team.target,
            team.leader.id,
            team.leader.name,
            team.leader.level,
            members
        ], 'run');
    }

    /**
     * 更新队伍信息
     * @param {object} team - 队伍对象
     */
    updateTeam(team) {
        const members = JSON.stringify(team.members);
        const sql = `
            UPDATE teams
            SET name         = ?,
                type         = ?,
                target       = ?,
                leader_id    = ?,
                leader_name  = ?,
                leader_level = ?,
                members      = ?
            WHERE id = ?
        `;
        this.executeSQL(sql, [
            team.name,
            team.type,
            team.target,
            team.leader.id,
            team.leader.name,
            team.leader.level,
            members,
            team.id
        ], 'run');
    }

    /**
     * 删除队伍
     * @param {number} teamId - 队伍ID
     */
    deleteTeam(teamId) {
        const sql = 'DELETE FROM teams WHERE id = ?';
        this.executeSQL(sql, [teamId], 'run');
    }

    /**
     * 获取所有队伍
     * @returns {Array} 队伍数组
     */
    getTeams() {
        const sql = 'SELECT * FROM teams ORDER BY created_at DESC';
        const rows = this.executeSQL(sql, [], 'all');

        // 转换数据格式
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type,
            target: row.target,
            leader: {
                id: row.leader_id,
                name: row.leader_name,
                level: row.leader_level
            },
            members: JSON.parse(row.members),
            createdAt: new Date(row.created_at)
        }));
    }

    // 帮会相关方法

    /**
     * 创建帮会
     * @param {string} name - 帮会名称
     * @param {number} leaderId - 帮主用户ID
     * @param {string} leaderName - 帮主用户名
     * @returns {object|null} 创建的帮会信息
     */
    createGang(name, leaderId, leaderName) {
        try {
            // 创建帮会
            const gangSql = `INSERT INTO gangs (name)
                             VALUES (?);`;
            this.executeSQL(gangSql, [name], 'run');

            // 通过帮会名称查询刚创建的帮会信息（更可靠的方式）
            const newGang = this.getGangByName(name);
            const gangId = newGang ? newGang.id : null;
            if (!gangId) {
                throw new Error('无法获取创建的帮会ID');
            }


            // 添加帮主
            const memberSql = `
                INSERT INTO gang_members (gang_id, user_id, username, role)
                VALUES (?, ?, ?, 'leader');
            `;
            this.executeSQL(memberSql, [gangId, leaderId, leaderName], 'run');

            // 更新帮会最大成员数
            const updateSql = `
                UPDATE gangs
                SET max_members = 50 + (level - 1) * 10
                WHERE id = ?;
            `;
            this.executeSQL(updateSql, [gangId], 'run');

            return this.getGangById(gangId);
        } catch (error) {
            console.error('创建帮会失败:', error);
            return null;
        }
    }

    /**
     * 根据ID获取帮会信息
     * @param {number} gangId - 帮会ID
     * @returns {object|null} 帮会信息
     */
    getGangById(gangId) {
        const sql = 'SELECT * FROM gangs WHERE id = ?';
        return this.executeSQL(sql, [gangId], 'get');
    }

    /**
     * 根据名称获取帮会信息
     * @param {string} name - 帮会名称
     * @returns {object|null} 帮会信息
     */
    getGangByName(name) {
        const sql = 'SELECT * FROM gangs WHERE name = ?';
        return this.executeSQL(sql, [name], 'get');
    }

    /**
     * 获取所有帮会列表
     * @returns {Array} 帮会列表
     */
    getGangList() {
        const sql = 'SELECT * FROM gangs ORDER BY level DESC, fund DESC';
        return this.executeSQL(sql, [], 'all');
    }

    /**
     * 添加帮会成员
     * @param {number} gangId - 帮会ID
     * @param {number} userId - 用户ID
     * @param {string} username - 用户名
     * @returns {boolean} 是否添加成功
     */
    addGangMember(gangId, userId, username) {
        const sql = `
            INSERT INTO gang_members (gang_id, user_id, username, role)
            VALUES (?, ?, ?, 'member');
        `;

        try {
            this.executeSQL(sql, [gangId, userId, username], 'run');
            return true;
        } catch (error) {
            console.error('添加帮会成员失败:', error);
            return false;
        }
    }

    /**
     * 获取帮会成员列表
     * @param {number} gangId - 帮会ID
     * @returns {Array} 成员列表
     */
    getGangMembers(gangId) {
        const sql = `
            SELECT *
            FROM gang_members
            WHERE gang_id = ?
            ORDER BY CASE role
                         WHEN 'leader' THEN 1
                         WHEN 'elder' THEN 2
                         ELSE 3
                         END,
                     contribution DESC;
        `;
        return this.executeSQL(sql, [gangId], 'all');
    }

    /**
     * 获取用户所在的帮会
     * @param {number} userId - 用户ID
     * @returns {object|null} 帮会信息
     */
    getUserGang(userId) {
        const sql = `
            SELECT g.*, m.role, m.contribution
            FROM gangs g
                     JOIN gang_members m ON g.id = m.gang_id
            WHERE m.user_id = ?;
        `;
        return this.executeSQL(sql, [userId], 'get');
    }

    /**
     * 移除帮会成员
     * @param {number} gangId - 帮会ID
     * @param {number} userId - 用户ID
     * @returns {boolean} 是否移除成功
     */
    removeGangMember(gangId, userId) {
        const sql = `
            DELETE
            FROM gang_members
            WHERE gang_id = ?
              AND user_id = ?;
        `;

        const result = this.executeSQL(sql, [gangId, userId], 'run');
        return result;
    }

    /**
     * 添加物品到帮会仓库
     * @param {number} gangId - 帮会ID
     * @param {string} itemName - 物品名称
     * @param {number} itemLevel - 物品等级
     * @param {string} itemInfo - 物品详细信息（JSON字符串）
     * @returns {boolean} 是否添加成功
     */
    addItemToGangStorage(gangId, itemName, itemLevel, itemInfo = null) {
        const sql = `
            INSERT INTO gang_storage (gang_id, item_name, item_level, item_info)
            VALUES (?, ?, ?, ?);
        `;

        try {
            this.executeSQL(sql, [gangId, itemName, itemLevel, itemInfo], 'run');
            return true;
        } catch (error) {
            console.error('添加物品到帮会仓库失败:', error);
            return false;
        }
    }

    /**
     * 从帮会仓库移除物品
     * @param {number} storageId - 仓库物品ID
     * @param {number} gangId - 帮会ID
     * @returns {boolean} 是否移除成功
     */
    removeItemFromGangStorage(storageId, gangId) {
        const sql = `
            DELETE
            FROM gang_storage
            WHERE id = ?
              AND gang_id = ?;
        `;

        const result = this.executeSQL(sql, [storageId, gangId], 'run');
        return result;
    }

    /**
     * 获取帮会仓库物品列表
     * @param {number} gangId - 帮会ID
     * @returns {Array} 物品列表
     */
    getGangStorageItems(gangId) {
        const sql = `
            SELECT *
            FROM gang_storage
            WHERE gang_id = ?
            ORDER BY item_level DESC, item_name ASC;
        `;
        const items = this.executeSQL(sql, [gangId], 'all');

        // 解析物品信息
        return items.map(item => {
            if (item.item_info) {
                try {
                    item.item_info = JSON.parse(item.item_info);
                } catch (e) {
                    console.error('解析物品信息失败:', e);
                }
            }
            return item;
        });
    }

    /**
     * 根据ID获取帮会仓库中的单个物品
     * @param {number} itemId - 物品ID
     * @param {number} gangId - 帮会ID
     * @returns {object|null} 物品信息
     */
    getGangStorageItemById(itemId, gangId) {
        const sql = `
            SELECT *
            FROM gang_storage
            WHERE id = ?
              AND gang_id = ?;
        `;
        const item = this.executeSQL(sql, [itemId, gangId], 'get');

        // 解析物品信息
        if (item && item.item_info) {
            try {
                item.item_info = JSON.parse(item.item_info);
            } catch (e) {
                console.error('解析物品信息失败:', e);
            }
        }

        return item;
    }

    /**
     * 记录帮会捐献
     * @param {number} gangId - 帮会ID
     * @param {number} userId - 用户ID
     * @param {string} username - 用户名
     * @param {string} donationType - 捐献类型
     * @param {number} amount - 捐献数量
     * @param {number} contribution - 获得的贡献值
     * @returns {boolean} 是否记录成功
     */
    recordGangDonation(gangId, userId, username, donationType, amount, contribution) {
        try {
            // 记录捐献
            const donationSql = `
                INSERT INTO gang_donations
                    (gang_id, user_id, username, donation_type, amount, contribution)
                VALUES (?, ?, ?, ?, ?, ?);
            `;
            this.executeSQL(donationSql, [gangId, userId, username, donationType, amount, contribution], 'run');

            // 更新帮会资金
            const fundSql = `
                UPDATE gangs
                SET fund = fund + ?
                WHERE id = ?;
            `;
            this.executeSQL(fundSql, [amount, gangId], 'run');

            // 更新用户贡献
            const contributionSql = `
                UPDATE gang_members
                SET contribution = contribution + ?
                WHERE gang_id = ?
                  AND user_id = ?;
            `;
            this.executeSQL(contributionSql, [contribution, gangId, userId], 'run');

            return true;
        } catch (error) {
            console.error('记录帮会捐献失败:', error);
            return false;
        }
    }

    /**
     * 获取帮会捐献记录
     * @param {number} gangId - 帮会ID
     * @param {number} limit - 限制返回的记录数量
     * @returns {Array} 捐献记录列表
     */
    getGangDonations(gangId, limit = 10) {
        const sql = `
            SELECT *
            FROM gang_donations
            WHERE gang_id = ?
            ORDER BY donated_at DESC LIMIT ?;
        `;
        return this.executeSQL(sql, [gangId, limit], 'all');
    }

    /**
     * 添加好友申请
     * @param {number} userId - 用户ID
     * @param {number} friendId - 好友ID
     * @returns {boolean} 是否添加成功
     */
    addFriendRequest(userId, friendId) {
        // 检查是否已经是好友
        const checkSql = `
            SELECT *
            FROM friends
            WHERE (user_id = ? AND friend_id = ?)
               OR (user_id = ? AND friend_id = ?);
        `;
        const existing = this.executeSQL(checkSql, [userId, friendId, friendId, userId], 'get');

        if (existing) {
            return false; // 已经是好友或有申请
        }

        // 添加好友申请（设置为pending状态）
        const sql = `
            INSERT INTO friends (user_id, friend_id, status)
            VALUES (?, ?, 'pending');
        `;

        try {
            this.executeSQL(sql, [userId, friendId], 'run');
            return true;
        } catch (error) {
            console.error('添加好友申请失败:', error);
            return false;
        }
    }

    /**
     * 接受好友申请
     * @param {number} userId - 用户ID（接受申请的人）
     * @param {number} friendId - 好友ID（发起申请的人）
     * @returns {boolean} 是否接受成功
     */
    acceptFriendRequest(userId, friendId) {
        try {
            // 更新申请状态为accepted
            const updateSql = `
                UPDATE friends
                SET status = 'accepted'
                WHERE user_id = ?
                  AND friend_id = ?;
            `;
            this.executeSQL(updateSql, [friendId, userId], 'run');

            // 添加反向好友关系
            const insertSql = `
                INSERT INTO friends (user_id, friend_id, status)
                VALUES (?, ?, 'accepted');
            `;
            this.executeSQL(insertSql, [userId, friendId], 'run');

            return true;
        } catch (error) {
            console.error('接受好友申请失败:', error);
            return false;
        }
    }

    /**
     * 拒绝好友申请或删除好友
     * @param {number} userId - 用户ID
     * @param {number} friendId - 好友ID
     * @returns {boolean} 是否删除成功
     */
    removeFriend(userId, friendId) {
        const sql = `
            DELETE
            FROM friends
            WHERE (user_id = ? AND friend_id = ?)
               OR (user_id = ? AND friend_id = ?);
        `;

        const result = this.executeSQL(sql, [userId, friendId, friendId, userId], 'run');
        return result;
    }

    /**
     * 获取好友列表
     * @param {number} userId - 用户ID
     * @returns {Array} 好友列表
     */
    getFriends(userId) {
        const sql = `
            SELECT u.id, u.username, u.nickname, u.avatar, f.status, f.created_at
            FROM friends f
                     JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = ?
              AND f.status = 'accepted'
            ORDER BY f.created_at DESC;
        `;
        return this.executeSQL(sql, [userId], 'all');
    }

    /**
     * 获取好友申请列表
     * @param {number} userId - 用户ID
     * @returns {Array} 好友申请列表
     */
    getFriendRequests(userId) {
        const sql = `
            SELECT u.id, u.username, u.nickname, u.avatar, f.created_at
            FROM friends f
                     JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = ?
              AND f.status = 'pending'
            ORDER BY f.created_at DESC;
        `;
        return this.executeSQL(sql, [userId], 'all');
    }

    // 获取用户的所有宠物
    getUserPets(userId) {
        try {
            const sql = 'SELECT * FROM pets WHERE user_id = ?';
            const pets = this.executeSQL(sql, [userId], 'all');

            // 解析技能数组，并创建Pet对象以使用getter方法计算属性
            return pets.map(petData => {
                const pet = new Pet(petData.name, petData.type);
                pet.id = petData.id;  // 添加这行，确保Pet对象有id属性
                pet.level = petData.level;
                pet.exp = petData.exp;
                pet.hunger = petData.hunger;
                pet.cleanliness = petData.cleanliness;
                pet.mood = petData.mood;
                pet.qualification = petData.qualification;
                pet.talent = petData.talent;
                pet.talentLocked = petData.talent_locked === 1;
                pet.qualLocked = petData.qual_locked === 1;
                pet.nameSet = petData.name_set === 1;
                pet.isFighting = petData.is_fighting === 1;
                pet.isBound = petData.is_bound === 1;
                pet.skills = JSON.parse(petData.skills || '[]');
                pet.innateSkills = JSON.parse(petData.innate_skills || '[]');
                pet.usedSkillPoints = petData.used_skill_points || 0;
                return pet;
            });
        } catch (error) {
            console.error('Failed to get user pets:', error);
            return [];
        }
    }

    // 添加新宠物
    addPet(userId, petData) {
        try {
            const sql = `
                INSERT INTO pets (user_id, name, type, level, exp, hunger, cleanliness, mood,
                                  qualification, talent,
                                  is_fighting, is_bound, skills, innate_skills, used_skill_points, description,
                                  talent_locked, qual_locked, name_set)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;

            if (!petData.name) {
                petData.name = petData.type || '未知宠物';
            }

            this.executeSQL(sql, [
                userId,
                petData.name,
                petData.type,
                petData.level || 1,
                petData.exp || 0,
                petData.hunger || 1000,
                petData.cleanliness || 1000,
                petData.mood || 1000,
                petData.qualification || '普通',
                petData.talent || '普通',
                petData.isFighting ? 1 : 0,
                petData.isBound ? 1 : 0,
                JSON.stringify(petData.skills || []),
                JSON.stringify(petData.innateSkills || []),
                petData.usedSkillPoints || 0,
                petData.description || '',
                petData.talentLocked ? 1 : 0,
                petData.qualLocked ? 1 : 0,
                petData.nameSet ? 1 : 0
            ], 'run');

            // 查询用户的最新宠物ID（更可靠的方式）
            const latestPet = this.executeSQL(
                'SELECT id FROM pets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                [userId],
                'get'
            );
            const petId = latestPet ? latestPet.id : null;
            return petId;
        } catch (error) {
            console.error('Failed to add pet:', error);
            return false;
        }
    }

    // 更新宠物信息
    updatePet(userId, petId, petData) {
        try {
            const sql = `
                UPDATE pets
                SET name              = ?,
                    level             = ?,
                    exp               = ?,
                    hunger            = ?,
                    cleanliness       = ?,
                    mood              = ?,
                    qualification     = ?,
                    talent            = ?,
                    is_fighting       = ?,
                    is_bound          = ?,
                    skills            = ?,
                    innate_skills     = ?,
                    used_skill_points = ?,
                    description       = ?,
                    talent_locked     = ?,
                    qual_locked       = ?,
                    name_set          = ?
                WHERE id = ?
                  AND user_id = ?;
            `;

            const result = this.executeSQL(sql, [
                petData.name,
                petData.level,
                petData.exp,
                petData.hunger,
                petData.cleanliness,
                petData.mood,
                petData.qualification,
                petData.talent,
                petData.isFighting ? 1 : 0,
                petData.isBound ? 1 : 0,
                JSON.stringify(petData.skills || []),
                JSON.stringify(petData.innateSkills || []),
                petData.usedSkillPoints || 0,
                petData.description,
                petData.talentLocked ? 1 : 0,
                petData.qualLocked ? 1 : 0,
                petData.nameSet ? 1 : 0,
                petId,
                userId
            ], 'run');

            return result;
        } catch (error) {
            console.error('Failed to update pet:', error);
            return false;
        }
    }

    // 删除宠物
    removePet(userId, petId) {
        try {
            const sql = 'DELETE FROM pets WHERE id = ? AND user_id = ?';
            const result = this.executeSQL(sql, [petId, userId], 'run');
            return result;
        } catch (error) {
            console.error('Failed to remove pet:', error);
            return false;
        }
    }

    // 根据ID获取特定宠物
    getPetById(userId, petId) {
        try {
            const sql = 'SELECT * FROM pets WHERE id = ? AND user_id = ?';
            const petData = this.executeSQL(sql, [petId, userId], 'get');

            if (petData) {
                // 创建Pet对象以使用getter方法计算属性
                const pet = new Pet(petData.name, petData.type);
                pet.level = petData.level;
                pet.exp = petData.exp;
                pet.hunger = petData.hunger;
                pet.cleanliness = petData.cleanliness;
                pet.mood = petData.mood;
                pet.qualification = petData.qualification;
                pet.talent = petData.talent;
                pet.talentLocked = petData.talent_locked === 1;
                pet.qualLocked = petData.qual_locked === 1;
                pet.nameSet = petData.name_set === 1;
                pet.isFighting = petData.is_fighting === 1;
                pet.isBound = petData.is_bound === 1;
                pet.skills = JSON.parse(petData.skills || '[]');
                pet.innateSkills = JSON.parse(petData.innate_skills || '[]');
                pet.usedSkillPoints = petData.used_skill_points || 0;
                return pet;
            }

            return null;
        } catch (error) {
            console.error('Failed to get pet by id:', error);
            return null;
        }
    }

    // 选择宠物（设置为出战状态）
    selectPet(userId, petId) {
        try {
            // 先将所有宠物设为非出战状态
            const unsetSql = 'UPDATE pets SET is_fighting = 0 WHERE user_id = ?';
            this.executeSQL(unsetSql, [userId], 'run');

            // 再将指定宠物设为出战状态
            const setSql = 'UPDATE pets SET is_fighting = 1 WHERE id = ? AND user_id = ?';
            const result = this.executeSQL(setSql, [petId, userId], 'run');

            return result;
        } catch (error) {
            console.error('Failed to select pet:', error);
            return false;
        }
    }

    // 喂食宠物
    feedPet(userId, petId, foodValue) {
        try {
            const sql = 'UPDATE pets SET hunger = MIN(1000, hunger + ?) WHERE id = ? AND user_id = ?';
            const result = this.executeSQL(sql, [foodValue, petId, userId], 'run');
            return result;
        } catch (error) {
            console.error('Failed to feed pet:', error);
            return false;
        }
    }

    // 清洁宠物
    cleanPet(userId, petId, cleanValue) {
        try {
            const sql = 'UPDATE pets SET cleanliness = MIN(1000, cleanliness + ?) WHERE id = ? AND user_id = ?';
            const result = this.executeSQL(sql, [cleanValue, petId, userId], 'run');
            return result;
        } catch (error) {
            console.error('Failed to clean pet:', error);
            return false;
        }
    }

    // 宠物成长
    growPet(userId, petId, growValue) {
        try {
            // 获取宠物当前状态
            const pet = this.getPetById(userId, petId);
            if (!pet) return false;

            // 检查饱食度和清洁度是否足够
            if (pet.hunger <= 0 || pet.cleanliness <= 0) {
                return {success: false, message: "宠物饥饿或清洁度不足，无法成长"};
            }

            // 消耗饱食度和清洁度
            const updateStmt = `
                UPDATE pets
                SET hunger      = MAX(0, hunger - 50),
                    cleanliness = MAX(0, cleanliness - 50)
                WHERE id = ?
                  AND user_id = ?;
            `;

            this.executeSQL(updateStmt, [petId, userId], 'run');

            // 增加经验
            const newExp = pet.exp + growValue;

            // 检查是否升级
            let leveledUp = false;
            let oldLevel = pet.level;
            let exp = newExp;
            let level = pet.level;

            // 计算升级所需经验: 200, 300, 400, 500...（公式集中于 src/formulas.js + config/balance.json）
            while (true) {
                // 计算当前等级升到下一级所需的经验
                const expNeeded = formulas.petExpToNext(level); // 200, 300, 400...

                // 如果当前经验足够升级
                if (exp >= expNeeded) {
                    level++;
                    exp -= expNeeded;
                    leveledUp = true;
                    continue;
                }
                break;
            }

            // 更新宠物经验和等级
            const updateLevelStmt = 'UPDATE pets SET exp = ?, level = ? WHERE id = ? AND user_id = ?';
            this.executeSQL(updateLevelStmt, [exp, level, petId, userId], 'run');

            if (level > oldLevel) {
                return {
                    success: true,
                    message: `宠物成长成功，升级到${level}级！`,
                    leveledUp: true
                };
            }

            return {
                success: true,
                message: "宠物成长成功",
                leveledUp: false
            };
        } catch (error) {
            console.error('Failed to grow pet:', error);
            return {success: false, message: "宠物成长失败"};
        }
    }

    // 邮件系统相关方法

    /**
     * 发送邮件
     * @param {number} senderId - 发送者ID
     * @param {string} senderName - 发送者名称
     * @param {number} receiverId - 接收者ID
     * @param {string} receiverName - 接收者名称
     * @param {string} subject - 邮件主题
     * @param {string} content - 邮件内容
     * @param {Array} items - 邮件附件物品列表
     * @returns {boolean} 是否发送成功
     */
    sendMail(senderId, senderName, receiverId, receiverName, subject, content, items = []) {
        try {
            const sql = `
                INSERT INTO mails (sender_id, sender_name, receiver_id, receiver_name, subject, content, items)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            const itemsJson = JSON.stringify(items);
            this.executeSQL(sql, [senderId, senderName, receiverId, receiverName, subject, content, itemsJson], 'run');
            return true;
        } catch (error) {
            console.error('发送邮件失败:', error);
            return false;
        }
    }

    /**
     * 获取用户邮件列表
     * @param {number} userId - 用户ID
     * @param {number} limit - 限制返回的邮件数量
     * @returns {Array} 邮件列表
     */
    getUserMails(userId, limit = 50) {
        try {
            const sql = `
                SELECT *
                FROM mails
                WHERE receiver_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;
            
            const mails = this.executeSQL(sql, [userId, limit], 'all');
            
            // 解析物品列表
            return mails.map(mail => {
                if (mail.items) {
                    try {
                        mail.items = JSON.parse(mail.items);
                    } catch (e) {
                        console.error('解析邮件物品失败:', e);
                        mail.items = [];
                    }
                } else {
                    mail.items = [];
                }
                return mail;
            });
        } catch (error) {
            console.error('获取用户邮件列表失败:', error);
            return [];
        }
    }

    /**
     * 标记邮件为已读
     * @param {number} mailId - 邮件ID
     * @param {number} userId - 用户ID
     * @returns {boolean} 是否标记成功
     */
    markMailAsRead(mailId, userId) {
        try {
            const sql = `
                UPDATE mails
                SET is_read = TRUE
                WHERE id = ?
                  AND receiver_id = ?
            `;
            
            this.executeSQL(sql, [mailId, userId], 'run');
            return true;
        } catch (error) {
            console.error('标记邮件为已读失败:', error);
            return false;
        }
    }

    /**
     * 根据ID获取邮件详情
     * @param {number} mailId - 邮件ID
     * @param {number} userId - 用户ID
     * @returns {object|null} 邮件详情
     */
    getMailById(mailId, userId) {
        try {
            const sql = `
                SELECT *
                FROM mails
                WHERE id = ?
                  AND receiver_id = ?
            `;
            
            const mail = this.executeSQL(sql, [mailId, userId], 'get');
            
            if (mail) {
                // 解析物品列表
                if (mail.items) {
                    try {
                        mail.items = JSON.parse(mail.items);
                    } catch (e) {
                        console.error('解析邮件物品失败:', e);
                        mail.items = [];
                    }
                } else {
                    mail.items = [];
                }
            }
            
            return mail;
        } catch (error) {
            console.error('获取邮件详情失败:', error);
            return null;
        }
    }

    /**
     * 领取邮件附件
     * @param {number} mailId - 邮件ID
     * @param {number} userId - 用户ID
     * @returns {boolean} 是否领取成功
     */
    claimMailItems(mailId, userId) {
        try {
            const sql = `
                UPDATE mails
                SET is_claimed = TRUE
                WHERE id = ?
                  AND receiver_id = ?
                  AND is_claimed = FALSE
            `;
            
            const result = this.executeSQL(sql, [mailId, userId], 'run');
            return result.changes > 0; // 如果有变化，说明更新成功
        } catch (error) {
            console.error('领取邮件附件失败:', error);
            return false;
        }
    }
}

export default UserDatabase;