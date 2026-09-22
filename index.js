import express from 'express';
import session from 'express-session';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import * as config from './config/index.js'
import User from './src/user.js'
import UserDatabase from './src/database.js'
import requireContext from './requireContext.cjs'
import { initDatabaseTables } from './src/database_migrations.js';
import { validateConfigs, printReport } from './src/validate-config.js';

const app = express();
// 支持 PORT 环境变量（默认 3000），便于另起端口验证新代码而不影响已运行的服务（软改进）
const port = Number(process.env.PORT) || 3000;

// 数据库初始化前先校验数值配置（失败仅打印警告，不阻塞启动）
try {
    const configCheckResult = validateConfigs();
    printReport(configCheckResult);
    if (!configCheckResult.ok) {
        console.warn('[config] 配置校验存在失败项，详见上方报告（不阻塞启动）');
    }
} catch (err) {
    console.warn('[config] 配置校验执行异常，跳过校验:', err.message);
}

// 初始化数据库
const db = new UserDatabase();

// 等待数据库初始化完成后创建表
db.init().then(() => {
    initDatabaseTables(db);
}).catch(err => {
    console.error('数据库初始化失败:', err);
});

// 配置会话
app.use(session({
    secret: 'zhsh_game_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {secure: false, maxAge: 24 * 60 * 60 * 1000} // 24小时
}));

const files = (
    typeof require !== "undefined" ? require.context : requireContext
)("./views", true, /\.ejs$/);

function getFile(path) {
    if (!path.startsWith(".")) {
        path = './' + path;
    }
    return files(path + ".ejs") || "-";
}

app.render = function render(name, options, callback) {
    const fileName = name;
    callback(
        null,
        ejs.render(getFile(name), options, {
            fileName,
            includer(p) {
                return {
                    template: getFile(p),
                };
            },
        })
    );
};
ejs.fileLoader = (name) => {
    return getFile(name);
};
// 静态资源收窄至 public/（避免暴露 user_data.db、src/、config/ 等）；
// 用 fileURLToPath 取绝对路径，避免依赖进程工作目录（Windows 下正确解析盘符）
const publicDir = fileURLToPath(new URL('./public', import.meta.url));
app.use(express.static(publicDir));

// 静态文件路径守卫：带扩展名的请求不是游戏页面（页面均为无扩展名短名），
// 未被上方 express.static 命中即直接 404，防止被下方 /:page 通配路由拦截渲染为登录页，
// 也避免这类请求触发 requireAuth 的数据库加载/用户缓存写入（含 LRU 污染）
app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && /\.[^./\\]+$/.test(req.path)) {
        res.status(404).end();
        return;
    }
    next();
});

// 添加解析请求体的中间件
app.use(express.urlencoded({extended: true}));
app.use(express.json());

// 用户缓存：上限 200，LRU 淘汰（普通对象 + 访问顺序数组实现，不使用 Map/Set）
export function createUserCache(limit) {
    const cache = {};
    const order = []; // 访问顺序：下标 0 为最久未用
    return {
        get(id) {
            if (!(id in cache)) return undefined;
            const idx = order.indexOf(id);
            if (idx !== -1) order.splice(idx, 1);
            order.push(id);
            return cache[id];
        },
        set(id, value) {
            if (!(id in cache) && order.length >= limit) {
                // 超限淘汰最久未用条目
                const oldest = order.shift();
                delete cache[oldest];
            }
            const idx = order.indexOf(id);
            if (idx !== -1) order.splice(idx, 1);
            order.push(id);
            cache[id] = value;
        },
        has(id) {
            return id in cache;
        },
        size() {
            return order.length;
        }
    };
}
const USER_CACHE_LIMIT = 200;
const userCache = createUserCache(USER_CACHE_LIMIT);
// 检查用户是否已登录的中间件
const requireAuth = (req, res, next) => {
    const userId = req.session?.userId;
    if (userId) {
        const currentUser = db.getUserById(userId);
        // 缓存命中：直接复用实例，跳过无用的 db.loadUserData 调用
        const cachedUser = userCache.get(currentUser.id);
        if (cachedUser) {
            req.user = cachedUser;
            req.user.avatar = currentUser.avatar; // 添加用户头像
            next();
            return;
        }
        // 缓存未命中：动态加载当前登录用户的数据
        const savedUserData = db.loadUserData(currentUser.id);
        // 在请求对象中创建用户实例
        if (savedUserData) {
            // 如果数据库中有保存的用户数据，则加载它
            req.user = new User(currentUser.nickname, currentUser.id, db);
            req.user.avatar = currentUser.avatar; // 添加用户头像
            req.user.restoreState(savedUserData);
        } else {
            // 否则创建新用户
            req.user = new User(currentUser.nickname, currentUser.id, db);
            req.user.avatar = currentUser.avatar; // 添加用户头像
        }
        // 缓存用户实例（超过上限 200 时淘汰最久未用条目）
        userCache.set(currentUser.id, req.user);
        next();
    } else {
        res.redirect('/login');
    }
};

// 添加全局变量到所有模板
app.use((req, res, next) => {
    res.locals.jewel = config.jewel;
    // 将当前登录用户信息添加到模板变量中
    if (req.session && req.session.user) {
        res.locals.currentUser = req.session.user;
    }
    next();
});

// 登录页面路由
app.get('/login', (req, res) => {
    // 如果用户已经登录，重定向到主页面
    if (req.session.userId) {
        res.redirect('/main');
        return;
    }
    res.render('pages/login');
});

// 注册页面路由
app.get('/register', (req, res) => {
    // 如果用户已经登录，重定向到主页面
    if (req.session.userId) {
        res.redirect('/main');
        return;
    }
    res.render('pages/register');
});

// 处理注册请求
app.post('/register', async (req, res) => {
    const {username, password, nickname, gender} = req.body;

    // 检查必填字段
    if (!username || !password || !nickname) {
        return res.render('pages/register', {errorMessage: '请填写所有必填字段'});
    }

    // 检查用户名是否已存在
    if (db.getUserByUsername(username)) {
        return res.render('pages/register', {errorMessage: '该账号已存在，请选择其他账号'});
    }

    // 注册用户
    const newUser = db.registerUser(username, password, nickname, gender);

    if (newUser) {
        // 注册成功，重定向到登录页面
        res.redirect('/login');
    } else {
        // 注册失败
        res.render('pages/register', {errorMessage: '注册失败，请稍后重试'});
    }
});

// 处理登录请求
app.post('/login', (req, res) => {
    const {username, password} = req.body;

    // 检查必填字段
    if (!username || !password) {
        return res.render('pages/login', {errorMessage: '请填写账号和密码'});
    }

    // 验证用户
    const user = db.authenticateUser(username, password);

    if (user) {
        // 登录成功，设置会话
        req.session.userId = user.id;
        req.session.user = user;
        res.redirect('/main');
    } else {
        // 登录失败
        res.render('pages/login', {errorMessage: '账号或密码错误'});
    }
});

// 登出路由
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/:page', requireAuth, (req, res) => {
    const page = req.params.page;
    const query = req.query;
    const {type} = query;
    let mergeObj = {}

    try {
        // 处理聊天消息发送（任意页面顶栏均可发送）
        if (type === 'sendChatMessage') {
            const {message, channel = 'public', chatChannel} = query;
            const backChannel = chatChannel || channel || 'public';
            let targetUserId = null;
            if (message) {
                // 检查权限
                let canSend = true;

                switch (channel) {
                    case 'gang':
                        // 检查用户是否有帮会
                        const gangInfo = req.user.gang.getStatus();
                        if (!gangInfo || !gangInfo.id) {
                            canSend = false;
                        }
                        break;

                    case 'team':
                        // 检查用户是否有队伍
                        const teamInfo = req.user.team.getMyTeam(req.user.id);
                        if (!teamInfo) {
                            canSend = false;
                        }
                        break;

                    case 'private':
                        // 私聊需要目标用户ID
                        if (query.targetUserId) {
                            targetUserId = parseInt(query.targetUserId);
                        } else {
                            canSend = false;
                        }
                        break;
                }

                // 获取帮会或队伍ID
                let gangId = null;
                let teamId = null;

                if (channel === 'gang') {
                    const gangInfo = req.user.gang.getStatus();
                    gangId = gangInfo ? gangInfo.id : null;
                } else if (channel === 'team') {
                    const teamInfo = req.user.team.getMyTeam(req.user.id);
                    teamId = teamInfo ? teamInfo.id : null;
                }

                if (canSend) {
                    req.user.chat.sendMessage(
                        req.user.nickname,
                        req.user.id,
                        message,
                        channel,
                        targetUserId,
                        gangId,
                        teamId
                    );
                }
            }
            // 重定向回当前页面（保留页面参数，刷新顶栏消息）
            const backQuery = {...query};
            // 聊天页需保留完整聊天上下文（频道、私聊对象）；其他页面剔除聊天相关参数
            const stripKeys = page === 'chat'
                ? ['type', 'message', 'chatChannel']
                : ['type', 'message', 'channel', 'chatChannel', 'targetUserId', 'targetUsername'];
            stripKeys.forEach(k => delete backQuery[k]);
            backQuery.chatChannel = backChannel;
            const backQs = Object.keys(backQuery).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(backQuery[k])}`).join('&');
            return res.redirect(`/${page}${backQs ? '?' + backQs : ''}`);
        }

        // 处理频道切换
        if (page === 'chat' && type === 'channel') {
            const {channel = 'public'} = query;
            // 检查权限
            let canAccess = true;

            switch (channel) {
                case 'gang':
                    // 检查用户是否有帮会
                    const gangInfo = req.user.gang.getStatus();
                    if (!gangInfo || !gangInfo.id) {
                        canAccess = false;
                    }
                    break;

                case 'team':
                    // 检查用户是否有队伍
                    const teamInfo = req.user.team.getMyTeam(req.user.id);
                    if (!teamInfo) {
                        canAccess = false;
                    }
                    break;
            }

            if (canAccess) {
                return res.redirect(`/chat?channel=${channel}`);
            } else {
                // 如果没有权限，重定向到公共频道
                return res.redirect('/chat?channel=public');
            }
        }

        // 处理发送物品
        if (page === 'select-item' && type === 'sendItem') {
            const {targetUserId} = query;
            const {itemId, itemName, itemType, itemInfo, quantity} = req.query;
            
            if (targetUserId && itemId) {
                // 获取目标用户信息
                const targetUser = db.getUserById(targetUserId);
                if (targetUser) {
                    // 从发送方背包中移除物品
                    const item = req.user.backpack.getItemById(itemId);
                    if (item) {
                        // 防流转死物品：卡片物品不可通过邮件赠送
                        if (item.info && item.info.cardId) {
                            mergeObj = {
                                tip: '卡片不可赠送'
                            };
                        } else {
                            const qty = parseInt(quantity) || 1;
                            if (item.num >= qty) {
                                // 移除物品
                                for (let i = 0; i < qty; i++) {
                                    req.user.backpack.removeItem(itemId);
                                }

                                // 创建邮件附件
                                const attachment = [{
                                    name: itemName,
                                    type: parseInt(itemType),
                                    num: qty,
                                    info: itemInfo ? JSON.parse(itemInfo) : {}
                                }];

                                // 发送邮件
                                const mailResult = req.user.sendMail(
                                    targetUserId,
                                    targetUser.nickname,
                                    '物品赠送',
                                    `${req.user.nickname} 给你发送了物品`,
                                    attachment
                                );

                                mergeObj = {
                                    tip: mailResult.message
                                };
                            } else {
                                mergeObj = {
                                    tip: '物品数量不足'
                                };
                            }
                        }
                    } else {
                        mergeObj = {
                            tip: '物品不存在'
                        };
                    }
                } else {
                    mergeObj = {
                        tip: '目标用户不存在'
                    };
                }
            }
        }

        // 处理领取邮件附件
        if (page === 'mail-detail' && type === 'claimItems') {
            const {mailId} = query;
            if (mailId) {
                const {message} = req.user.claimMailItems(parseInt(mailId));
                mergeObj = {
                    tip: message
                }
            }
        }

        // 处理婚姻系统的GET请求（链接点击）
        if (page === 'marriage' && type) {
            let marriageResult = null;
            switch (type) {
                case 'propose':
                    const targetUserId = req.query.targetUserId;
                    if (targetUserId) {
                        marriageResult = req.user.proposeMarriage(parseInt(targetUserId));
                    }
                    break;
                case 'acceptProposal':
                    const proposalId = req.query.proposalId;
                    if (proposalId) {
                        marriageResult = req.user.acceptMarriageProposal(parseInt(proposalId));
                    }
                    break;
                case 'rejectProposal':
                    const rejectProposalId = req.query.proposalId;
                    if (rejectProposalId) {
                        marriageResult = req.user.rejectMarriageProposal(parseInt(rejectProposalId));
                    }
                    break;
                case 'requestDivorce':
                    marriageResult = req.user.requestDivorce();
                    break;
                case 'hostWedding':
                    marriageResult = req.user.hostWedding();
                    break;
                case 'joinBanquet':
                    const banquetId = req.query.banquetId;
                    if (banquetId) {
                        marriageResult = req.user.joinBanquet(parseInt(banquetId));
                    }
                    break;
            }
            if (marriageResult) {
                mergeObj = { mergedFromExec: marriageResult };
            }
        }

        // 只有在不是特殊页面或者type不为空时才执行exec
        if (type && !['team', 'my-team', 'chat', 'marriage'].includes(page)) {
            let params = (query.params || '').split(',').filter(Boolean);
            if (!params.length) {
                params.push(query)
            }
            // 宠物改名：把表单的newname追加到params
            if (type === 'petManager.renamePet' && query.newname) {
                params.push(decodeURIComponent(query.newname))
            }
            const execResult = req.user.exec(type, params)
            // 仅当 exec 有返回值时才覆盖，避免吞掉前置守卫设置的 tip（如"卡片不可赠送"）
            if (execResult !== undefined) {
                mergeObj = execResult
            }
            // 结束钓鱼后自动跳转到航行页（仅当从钓鱼页点击"返回航行"时）
            if (type === 'fish.clear' && query.returnTo === 'voyage') {
                return res.redirect('/voyage');
            }
        }

        // 处理特殊页面
        const renderParams = req.user.handleSpecialPage(page, query, config);
        // 全局聊天栏数据（每个页面都加载，支持顶栏内切换频道）
        const globalChat = req.user.getGlobalChatBar(query.chatChannel || 'public');
        mergeObj = {
            tip: '',
            page,
            ...config,
            ...renderParams,
            ...mergeObj,
            query,
            user: req.user,
            globalChat
        }

        // 婚姻操作结果注入 tip
        if (mergeObj.mergedFromExec) {
            mergeObj.tip = mergeObj.mergedFromExec.tip || '';
            delete mergeObj.mergedFromExec;
        }

        // 处理物品选择页面
        if (page === 'select-item') {
            const targetUserId = query.targetUserId;
            if (targetUserId) {
                const targetUser = db.getUserById(targetUserId);
                if (targetUser) {
                    mergeObj.targetUser = targetUser;
                }
            }
        }

        // 处理邮件列表页面
        if (page === 'mail-list') {
            mergeObj.mails = req.user.getMailList();
        }

        // 处理邮件详情页面
        if (page === 'mail-detail') {
            const mailId = query.mailId;
            if (mailId) {
                mergeObj.mail = req.user.getMailDetail(parseInt(mailId));
                // 标记为已读
                if (mergeObj.mail) {
                    req.user.markMailAsRead(parseInt(mailId));
                }
            }
        }

        if (page === 'online-users') {
            // 处理在线用户页面
            const onlineUsers = req.user.getOnlineUsersInLocation();
            const currentUserCity = req.user.city._city;
            const currentUserPosition = req.user.city._position;

            mergeObj = {
                ...mergeObj,
                onlineUsers: onlineUsers,
                currentCity: currentUserCity,
                currentPosition: currentUserPosition
            };
        }
        // 在每次请求后保存用户数据到数据库
        db.saveUserData(req.user.id, req.user.getFullState());
        // 检查用户当前状态并根据状态限制访问特定页面
        const userStatus = req.user.getUserStatus();

        let redirectPage = mergeObj.page
        // 根据状态限制页面访问
        if (userStatus === '打怪' && ['fishing', 'trial', 'trial-map', 'voyage', 'main'].includes(redirectPage)) {
            // 打怪状态不能进入钓鱼、副本、航行及main页面，跳转到attack页面
            return res.redirect('/attack');
        }

        if (userStatus === '钓鱼' && ['attack', 'trial', 'trial-map', 'voyage', 'main', 'attack-win'].includes(redirectPage)) {
            // 钓鱼状态不能进入打怪、副本、航行及main页面，跳转到fishing页面
            return res.redirect('/fishing');
        }

        if (userStatus === '副本' && ['fishing', 'voyage', 'main'].includes(redirectPage)) {
            // 副本状态不能进入钓鱼、航行及main页面，跳转到trial-map页面
            return res.redirect('/trial-map');
        }

        if (userStatus === '航行' && redirectPage === 'main') {
            // 航行状态不能进入main页面，跳转到voyage页面
            return res.redirect('/voyage');
        }
        res.render('template', mergeObj);
    } catch (error) {
        // 在每次请求后保存用户数据到数据库
        db.saveUserData(req.user.id, req.user.getFullState());

        res.render('template', {
            tip: error.message,
            page,
            ...config,
            query,
            user: req.user,
            ...mergeObj
        });
    }
});

// 处理POST请求
app.post('/:page', requireAuth, (req, res) => {
    const page = req.params.page;
    const query = req.query;
    const {type} = query;
    let mergeObj = {}

    try {
        // 检查用户当前状态并根据状态限制访问特定页面
        const userStatus = req.user.getUserStatus();

        // 根据状态限制页面访问
        if (userStatus === '打怪' && ['fishing', 'trial', 'trial-map', 'voyage', 'main', 'attack-win'].includes(page)) {
            // 打怪状态不能进入钓鱼、副本、航行及main页面，跳转到attack页面
            return res.redirect('/attack');
        }

        if (userStatus === '钓鱼' && ['attack', 'trial', 'trial-map', 'voyage', 'main', 'attack-win'].includes(page)) {
            // 钓鱼状态不能进入打怪、副本、航行及main页面，跳转到fishing页面
            return res.redirect('/fishing');
        }

        if (userStatus === '副本' && ['fishing', 'voyage', 'main'].includes(page)) {
            // 副本状态不能进入钓鱼、航行及main页面，跳转到trial-map页面
            return res.redirect('/trial-map');
        }

        if (userStatus === '航行' && page === 'main') {
            // 航行状态不能进入main页面，跳转到voyage页面
            return res.redirect('/voyage');
        }

        // 处理创建帮会的POST请求
        if (page === 'my-gang' && type === 'createGang') {
            const gangName = req.body.gangName;
            if (gangName) {
                mergeObj = req.user.createGang(gangName);
            }
        }

        // 处理退出帮会请求
        if (type === 'leaveGang') {
            mergeObj = req.user.leaveGang();
        }

        // 处理婚姻系统的POST请求
        if (page === 'marriage') {
            switch (type) {
                case 'propose':
                    const targetUserId = req.query.targetUserId;
                    if (targetUserId) {
                        mergeObj = { mergedFromExec: req.user.proposeMarriage(parseInt(targetUserId)) };
                    }
                    break;
                case 'acceptProposal':
                    const proposalId = req.query.proposalId;
                    if (proposalId) {
                        mergeObj = { mergedFromExec: req.user.acceptMarriageProposal(parseInt(proposalId)) };
                    }
                    break;
                case 'rejectProposal':
                    const rejectProposalId = req.query.proposalId;
                    if (rejectProposalId) {
                        mergeObj = { mergedFromExec: req.user.rejectMarriageProposal(parseInt(rejectProposalId)) };
                    }
                    break;
                case 'requestDivorce':
                    mergeObj = { mergedFromExec: req.user.requestDivorce() };
                    break;
                case 'hostWedding':
                    mergeObj = { mergedFromExec: req.user.hostWedding() };
                    break;
                case 'joinBanquet':
                    const banquetId = req.query.banquetId;
                    if (banquetId) {
                        mergeObj = { mergedFromExec: req.user.joinBanquet(parseInt(banquetId)) };
                    }
                    break;
            }
        }

        // 在每次请求后保存用户数据到数据库
        db.saveUserData(req.user.id, req.user.getFullState());

        // 处理特殊页面
        const renderParams = req.user.handleSpecialPage(page, query, config);
        const globalChat = req.user.getGlobalChatBar(query.chatChannel || 'public');
        // 婚姻操作结果提示透出到 tip
        const execTip = mergeObj && mergeObj.mergedFromExec ? mergeObj.mergedFromExec.tip : '';
        const finalTip = execTip || renderParams.tip || '';
        res.render('template', {tip: finalTip, ...renderParams, ...mergeObj, globalChat, user: req.user, page, ...config, query});
    } catch (error) {
        // 在每次请求后保存用户数据到数据库
        db.saveUserData(req.user.id, req.user.getFullState());

        res.render('template', {
            tip: error.message,
            page,
            ...config,
            query,
            user: req.user,
            ...mergeObj
        });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});