import * as config from '../config/index.js';
import {getGoodsByName} from './goods.js';

const allTasks = config.tasks;
config.trial.forEach((v, i) => {
    v.index = i + 2000
    allTasks.push([v])
})
export default class Task {
    constructor(backpack, city, play) {
        this.backpack = backpack;
        this.completedTasks = {}; // 存储已完成任务的索引，使用对象替代Set
        this.acceptedTasks = {};  // 存储已接受但未完成的任务索引，使用对象替代Set
        this.killCounts = {}; // 存储击杀怪物的数量，格式: {怪物名称: 击杀数量}
        this.city = city;
        this.play = play;
    }


    //使用引路蜂
    useGuideBee({taskId}) {
        const allTasks = config.tasks.flat();
        const task = allTasks.find(t => t.index == taskId);
        if (!task) {
            throw new Error("任务不存在");
        }

        // 检查背包是否有引路蜂
        const hasGuideBee = this.backpack.hasItem("引路蜂", 1);
        if (!hasGuideBee) {
            throw new Error("背包中没有引路蜂");
        }

        // 判断任务状态：已完成未提交，还是未完成
        const isTaskAccepted = this.isTaskAccepted(taskId);
        const isTaskCompleted = this.isTaskCompleted(taskId);

        let targetLocation = null;

        if (isTaskAccepted && !isTaskCompleted) {
            // 任务已接受但未完成
            if (this.isTaskCompletable(taskId) && task.submitLocation) {
                targetLocation = task.submitLocation;
            } else if (task.targetAddress) {
                targetLocation = task.targetAddress.split(',')[0];
            }
        } else if (isTaskCompleted) {
            // 任务已完成，跳转到提交地点
            if (task.submitLocation) {
                targetLocation = task.submitLocation;
            }
        }

        // 消耗一个引路蜂
        this.backpack.removeItemByName("引路蜂");

        // 执行传送
        if (targetLocation) {
            this.city.moveLocation(targetLocation);
        }
    }

    /**
     * 接受任务
     * @param {string|number} taskIndex - 任务索引
     */
    acceptTask(taskIndex) {
        const taskIndexNum = parseInt(taskIndex);
        const taskData = this.getTaskData(taskIndexNum);
        if (!taskData) {
            throw new Error(`任务不存在: ${taskIndex}`);
        }

        // 检查玩家等级是否满足任务要求
        if (taskData.level && this.play.level < taskData.level) {
            throw new Error(`等级不足，需要等级${taskData.level}`);
        }

        // 检查前置任务是否已完成
        const series = this.getTaskSeries(taskIndexNum);
        const prevTaskIndex = this.getPrevTaskInSeries(taskIndexNum, series);
        if (prevTaskIndex !== null && !this.isTaskCompleted(prevTaskIndex)) {
            throw new Error('请先完成前置任务');
        }

        // 硬守卫：已接取未完成的任务不可重复 acceptTask（否则打怪任务会被重置 killCounts 丢进度，
        // 送物品任务会重复往背包发任务物品；调用方 npc-task-direct.ejs/task.ejs 均消费 throw 风格）
        if (this.isTaskAccepted(taskIndexNum) && !this.isTaskCompleted(taskIndexNum)) {
            throw new Error('任务已接取，无需重复接取');
        }

        // 如果是打怪任务，清空之前的击杀数
        if (taskData.taskType === '打怪') {
            const targetNames = taskData.targetName.split(',');
            for (let i = 0; i < targetNames.length; i++) {
                const targetName = targetNames[i].trim();
                this.killCounts[targetName] = 0;
            }
        }

        // 标记任务为已接受，使用对象替代Set
        this.acceptedTasks[taskIndexNum] = true;

        // 如果任务类型是送物品，往背包加上对应数量的送的物品
        if (taskData.taskType === '送物品') {
            const targetNames = taskData.targetName.split(',');
            const quantities = taskData.quantity.toString().split(',');

            for (let i = 0; i < targetNames.length; i++) {
                const targetName = targetNames[i].trim();
                const requiredQuantity = parseInt(quantities[i]);

                // 创建物品并添加到背包
                const item = getGoodsByName(targetName, requiredQuantity);

                this.backpack.addItem(item);
            }
        }

        if (taskData.taskType === '对话') {
            return {
                tip: taskData.receiveDialog,
                page: 'tip'
            };
        }

        return {
            tip: taskData.receiveDialog,
            page: 'tip'
        };
    }

    /**
     * 提交任务
     * @param {string|number} taskIndex - 任务索引
     */
    submitTask(taskIndex) {
        const taskIndexNum = parseInt(taskIndex);
        const taskData = this.getTaskData(taskIndexNum);
        if (!taskData) {
            throw new Error(`任务不存在: ${taskIndex}`);
        }

        // 检查任务是否已被接受
        if (!this.isTaskAccepted(taskIndexNum)) {
            throw new Error('任务尚未接受');
        }

        // 硬守卫：已完成的任务不可重复提交（否则 completeTask 会无条件重复发奖，可无限刷奖励）
        if (this.isTaskCompleted(taskIndexNum)) {
            return {
                tip: '该任务已完成，无法重复提交',
                page: 'tip'
            };
        }

        // 检查任务是否已完成
        if (!this.isTaskCompleted(taskIndexNum)) {
            // 根据任务类型检查完成条件
            switch (taskData.taskType) {
                case '打怪':
                    // 处理多个目标怪物的情况
                {
                    const targetNames = taskData.targetName.split(',');
                    const quantities = taskData.quantity.toString().split(',');

                    // 两段式（对照下方“收集/送物品”分支写法）：第一遍只做校验并收集待扣物品，
                    // 全部目标通过后再第二遍统一扣除。避免“先扣第1个目标碎片→第2个目标不足 throw”
                    // 导致玩家白白损失物品。
                    const toRemove = [];

                    // 检查是否所有怪物都满足击杀数量
                    for (let i = 0; i < targetNames.length; i++) {
                        const targetName = targetNames[i].trim();
                        const requiredQuantity = parseInt(quantities[i]);
                        const killCount = this.killCounts[targetName] || 0;

                        // 副本目标可能混合“打怪”与“收集”（如新大陆副本的碎片、贝河精魄），
                        // 收集类目标以背包实际数量判定，避免因 killCounts 恒为 0 而导致结算不可达。
                        // 纯打怪任务的怪物名不会在背包中，checkCollectTask 返回 false，行为不变。
                        const killOk = this.checkKillTask(targetName, requiredQuantity);
                        const collectOk = this.checkCollectTask(targetName, requiredQuantity);
                        if (!killOk && !collectOk) {
                            throw new Error(`尚未击杀足够数量的${targetName} (${killCount}/${requiredQuantity})`);
                        }
                        // 命中收集判定的目标要消耗对应物品，防副本碎片跨次保留、重进本瞬间满进度；
                        // 纯击杀达标（killOk）的目标不扣物。此处仅登记，待全部校验通过后统一扣除。
                        if (!killOk && collectOk) {
                            toRemove.push([targetName, requiredQuantity]);
                        }
                    }

                    // 全部目标校验通过后统一扣除。用 removeItemByName（按物品名查找）而非
                    // this.removeItem→backpack.removeItem（后者按 id 匹配，背包 id 是 base36 唯一串，
                    // 与物品名永不相等 → 静默 no-op，一件都扣不掉）。
                    for (let i = 0; i < toRemove.length; i++) {
                        this.backpack.removeItemByName(toRemove[i][0], toRemove[i][1]);
                    }
                }
                    break;
                case '收集':
                case '送物品':
                case '运货':
                    // 处理多个目标物品的情况
                {
                    const targetNames = taskData.targetName.split(',');
                    const quantities = taskData.quantity.toString().split(',');

                    // 检查是否所有物品都满足条件
                    for (let i = 0; i < targetNames.length; i++) {
                        const targetName = targetNames[i].trim();
                        const requiredQuantity = parseInt(quantities[i]);
                        const currentCount = this.getItemCount(targetName);

                        if (!this.checkDeliveryTask(targetName, requiredQuantity)) {
                            const taskTypeName = taskData.taskType === '收集' ? '收集' :
                                taskData.taskType === '送物品' ? '送达' : '运输';
                            throw new Error(`尚未${taskTypeName}足够的${targetName} (${currentCount}/${requiredQuantity})`);
                        }
                    }

                    // 移除所有需要的物品
                    for (let i = 0; i < targetNames.length; i++) {
                        const targetName = targetNames[i].trim();
                        const requiredQuantity = parseInt(quantities[i]);
                        this.removeItem(targetName, requiredQuantity);
                    }
                }
                    break;
                case '对话':
                    break;
                default:
                    throw new Error(`未知任务类型: ${taskData.taskType}`);
            }
        }

        // 完成任务并给予奖励
        this.completeTask(taskIndexNum);

        return {
            tip: taskData.submitDialog,
            page: 'tip'
        };
    }

    /**
     * 获取指定NPC可接取的任务
     * @param {string} npcName - NPC名称
     * @returns {Array} 可接取的任务列表
     */
    getAvailableTasksForNpc(npcName) {
        // 处理二维数组的任务结构
        const availableTasks = [];

        for (const taskGroup of allTasks) {
            // 在每个任务组中查找可接任务
            const groupTasks = taskGroup.filter(task => {
                // 任务未完成且接取NPC匹配
                if (this.isTaskCompleted(task.index) || (npcName && task.receiveNpc !== npcName)) {
                    return false;
                }

                // 检查玩家等级是否满足任务要求
                if (task.level && this.play.level < task.level) {
                    return false;
                }
                //检查玩家等级是否满足任务要求"100-210级"
                if (task.levelRequirement) {
                    const levelReq = task.levelRequirement;
                    const levels = levelReq.replace('级', '').split('-').map(Number);
                    if ((levels[0] && this.play.level < levels[0]) || (levels[1] && this.play.level > levels[1])) {
                        return false;
                    }
                }

                // 如果任务已被接受（但未完成），则不应再显示在可接取列表中
                if (this.isTaskAccepted(task.index)) {
                    return false;
                }

                // 检查系列任务的前置条件
                const series = this.getTaskSeries(task.index);
                const prevTaskIndex = this.getPrevTaskInSeries(task.index, series);

                // 如果没有前置任务，则可以接取
                if (prevTaskIndex === null) {
                    return true;
                }

                // 如果有前置任务，则前置任务必须已完成
                return this.isTaskCompleted(prevTaskIndex);
            });

            // 将该组中的可接任务添加到结果中
            availableTasks.push(...groupTasks);
        }

        return availableTasks;
    }

    /**
     * 获取指定NPC可提交的任务
     * @param {string} npcName - NPC名称
     * @returns {Array} 可提交的任务列表
     */
    getSubmittableTasksForNpc(npcName) {
        // 处理二维数组的任务结构
        const submittableTasks = [];

        for (const taskGroup of allTasks) {
            // 在每个任务组中查找可提交任务
            const groupTasks = taskGroup.filter(task => {
                // 任务未完成但已被接受，且提交NPC匹配
                return !this.isTaskCompleted(task.index) &&
                    this.isTaskAccepted(task.index) &&
                    task.submitNpc === npcName;
            });

            // 将该组中的可提交任务添加到结果中
            submittableTasks.push(...groupTasks);
        }

        return submittableTasks;
    }

    /**
     * 获取指定NPC已接收未完成的任务
     * @param {string} npcName - NPC名称
     * @returns {Array} 已接收未完成的任务
     */
    getReceiveTasksForNpc(npcName) {
        const receiveTasks = [];

        for (const taskGroup of allTasks) {
            const groupTasks = taskGroup.filter(task => {
                return !this.isTaskCompleted(task.index) &&
                    this.isTaskAccepted(task.index) &&
                    task.receiveNpc === npcName;
            });

            // 将该组中的可提交任务添加到结果中
            receiveTasks.push(...groupTasks);
        }

        return receiveTasks;
    }

    /**
     * 检查任务是否已被接受
     * @param {string|number} taskIndex - 任务索引
     * @returns {boolean} 是否已接受
     */
    isTaskAccepted(taskIndex) {
        const taskIndexNum = parseInt(taskIndex);
        // 如果任务已完成，则也被接受
        if (this.isTaskCompleted(taskIndexNum)) {
            return true;
        }

        // 检查是否在已接受任务列表中，使用对象替代Set
        return !!this.acceptedTasks[taskIndexNum];
    }

    /**
     * 检查任务是否已完成
     * @param {string|number} taskIndex - 任务索引
     * @returns {boolean} 是否已完成
     */
    isTaskCompleted(taskIndex) {
        const taskIndexNum = parseInt(taskIndex);
        // 使用对象替代Set
        return !!this.completedTasks[taskIndexNum];
    }

    /**
     * 检查击杀任务完成情况
     * @param {string} targetName - 目标怪物名称
     * @param {number} quantity - 需要击杀的数量
     * @returns {boolean} 是否完成
     */
    checkKillTask(targetName, quantity) {
        return (this.killCounts[targetName] || 0) >= quantity;
    }

    /**
     * 检查收集任务完成情况
     * @param {string} itemName - 物品名称
     * @param {number} quantity - 需要收集的数量
     * @returns {boolean} 是否完成
     */
    checkCollectTask(itemName, quantity) {
        return this.backpack.hasItem(itemName, quantity);
    }

    /**
     * 检查送物品任务完成情况
     * @param {string} itemName - 物品名称
     * @param {number} quantity - 数量
     * @returns {boolean} 是否完成
     */
    checkDeliveryTask(itemName, quantity) {
        return this.backpack.hasItem(itemName, quantity);
    }

    /**
     * 检查运货任务完成情况
     * @returns {boolean} 是否完成
     */
    checkTransportTask() {
        // 运货任务检查逻辑
        // 暂时返回true
        return true;
    }

    /**
     * 检查任务是否已完成所有条件但尚未提交
     * @param {string|number} taskIndex - 任务索引
     * @returns {boolean} 是否已完成所有条件
     */
    isTaskCompletable(taskIndex) {
        const taskIndexNum = parseInt(taskIndex);
        const taskData = this.getTaskData(taskIndexNum);
        if (!taskData) {
            return false;
        }

        // 检查任务是否已被接受
        if (!this.isTaskAccepted(taskIndexNum)) {
            return false;
        }

        // 检查任务是否已完成
        if (this.isTaskCompleted(taskIndexNum)) {
            return false;
        }

        // 根据任务类型检查完成条件
        switch (taskData.taskType) {
            case '打怪':
                // 处理多个目标怪物的情况
            {
                const targetNames = taskData.targetName.split(',');
                const quantities = taskData.quantity.toString().split(',');

                // 检查是否所有怪物都满足击杀数量
                for (let i = 0; i < targetNames.length; i++) {
                    const targetName = targetNames[i].trim();
                    const requiredQuantity = parseInt(quantities[i]);
                    // 与 submitTask 保持一致：副本混合目标中的收集类物品以背包数量判定
                    if (!this.checkKillTask(targetName, requiredQuantity) &&
                        !this.checkCollectTask(targetName, requiredQuantity)) {
                        return false;
                    }
                }
                return true;
            }
            case '收集':
            case '送物品':
            case '运货':
                // 处理多个目标物品的情况
            {
                const targetNames = taskData.targetName.split(',');
                const quantities = taskData.quantity.toString().split(',');

                // 检查是否所有物品都满足条件
                for (let i = 0; i < targetNames.length; i++) {
                    const targetName = targetNames[i].trim();
                    const requiredQuantity = parseInt(quantities[i]);
                    if (!this.checkDeliveryTask(targetName, requiredQuantity)) {
                        return false;
                    }
                }
                return true;
            }
            case '对话':
                // 对话任务默认已完成
                return true;
            default:
                return false;
        }
    }

    /**
     * 移除物品
     * @param {string} itemName - 物品名称
     * @param {number} quantity - 数量
     */
    removeItem(itemName, quantity) {
        this.backpack.removeItem(itemName, quantity);
    }

    /**
     * 完成任务
     * @param {string|number} taskIndex - 任务索引
     */
    completeTask(taskIndex) {
        const taskIndexNum = parseInt(taskIndex);
        const taskData = this.getTaskData(taskIndexNum);
        this.play.addPrize(taskData.prize);
        this.completedTasks[taskIndexNum] = true;
        delete this.acceptedTasks[taskIndexNum]; // 从已接受列表中移除
    }

    /**
     * 记录击杀怪物
     * @param {string} monsterName - 怪物名称
     */
    recordKill(monsterName) {
        if (!this.killCounts[monsterName]) {
            this.killCounts[monsterName] = 0;
        }
        this.killCounts[monsterName]++;
    }

    /**
     * 获取物品数量
     * @param {string} itemName - 物品名称
     * @returns {number} 物品数量
     */
    getItemCount(itemName) {
        let totalCount = 0;
        const items = this.backpack.items;

        // 遍历背包中的所有物品
        for (const item of items) {
            // 查找匹配名称的物品
            if (item.name === itemName) {
                // 累加物品数量（对于非装备类物品）
                if (item.type !== 1) {
                    totalCount += item.num;
                } else {
                    // 对于装备类物品，每个装备计为1个
                    totalCount += 1;
                }
            }
        }

        return totalCount;
    }

    /**
     * 获取任务进度
     * @param {object} task - 任务对象
     * @returns {string} 任务进度字符串，格式如"偷矿者 (3/6)" 或 "收集任务 (物品1 2/5, 物品2 1/3)"
     */
    getTaskProgress(task) {
        if (!task) return '';

        // 根据任务类型返回相应的进度信息
        switch (task.taskType) {
            case '打怪':
                // 处理多个目标怪物的情况
            {
                const targetNames = task.targetName.split(',');
                const quantities = task.quantity.toString().split(',');

                if (targetNames.length > 1 && quantities.length === targetNames.length) {
                    // 多个怪物的情况
                    const progressItems = [];
                    for (let i = 0; i < targetNames.length; i++) {
                        const targetName = targetNames[i].trim();
                        const requiredQuantity = parseInt(quantities[i]);
                        // 与 submitTask/isTaskCompletable 保持一致：副本碎片类目标以背包数量判定，
                        // 取 killCounts 与 getItemCount 的较大值，避免进度恒显示 0/N 却能提交（返回结构不变）
                        const killCount = Math.max(this.killCounts[targetName] || 0, this.getItemCount(targetName));
                        progressItems.push(`${targetName} ${killCount}/${requiredQuantity}`);
                    }
                    return `${task.name} (${progressItems.join(', ')})`;
                } else {
                    // 单个怪物的情况
                    const targetName = task.targetName;
                    const requiredQuantity = parseInt(task.quantity);
                    // 与 submitTask/isTaskCompletable 保持一致：副本碎片类目标以背包数量判定，
                    // 取 killCounts 与 getItemCount 的较大值，避免进度恒显示 0/N 却能提交（返回结构不变）
                    const killCount = Math.max(this.killCounts[targetName] || 0, this.getItemCount(targetName));
                    return `${task.name} (${killCount}/${requiredQuantity})`;
                }
            }
            case '收集':
            case '送物品':
            case '运货':
                // 处理多个目标物品的情况
            {
                const targetNames = task.targetName.split(',');
                const quantities = task.quantity.toString().split(',');

                if (targetNames.length > 1 && quantities.length === targetNames.length) {
                    // 多个物品的情况
                    const progressItems = [];
                    for (let i = 0; i < targetNames.length; i++) {
                        const targetName = targetNames[i].trim();
                        const requiredQuantity = parseInt(quantities[i]);
                        const currentCount = this.getItemCount(targetName);
                        progressItems.push(`${targetName} ${currentCount}/${requiredQuantity}`);
                    }
                    return `${task.name} (${progressItems.join(', ')})`;
                } else {
                    // 单个物品的情况
                    const targetName = task.targetName;
                    const requiredQuantity = parseInt(task.quantity);
                    const currentCount = this.getItemCount(targetName);
                    return `${task.name} (${currentCount}/${requiredQuantity})`;
                }
            }
            default:
                // 对于没有明确进度的任务类型（如对话），只返回任务名
                return
        }
    }

    /**
     * 获取任务数据
     * @param {string|number} taskIndex - 任务索引
     * @returns {object|null} 任务数据
     */
    getTaskData(taskIndex) {
        // 导入任务数据
        const taskIndexNum = parseInt(taskIndex);

        // 遍历二维数组查找任务
        for (const taskGroup of allTasks) {
            const task = taskGroup.find(task => task.index === taskIndexNum);
            if (task) {
                return task;
            }
        }

        return null;
    }

    /**
     * 获取任务所属系列
     * @param {string|number} taskIndex - 任务索引
     * @returns {number} 系列编号 (1, 2, 3, 4)
     */
    getTaskSeries(taskIndex) {
        const taskIndexNum = parseInt(taskIndex);

        // 查找任务所属的组
        let groupIndex = 0;
        for (let i = 0; i < allTasks.length; i++) {
            const taskGroup = allTasks[i];
            const task = taskGroup.find(t => t.index === taskIndexNum);
            if (task) {
                groupIndex = i;
                break;
            }
        }

        // 每个任务文件（任务组）对应一个系列
        return groupIndex + 1;
    }

    /**
     * 获取系列中的前置任务
     * @param {string|number} taskIndex - 当前任务索引
     * @param {number} series - 系列编号
     * @returns {number|null} 前置任务索引，如果没有则返回null
     */
    getPrevTaskInSeries(taskIndex, series) {
        const taskIndexNum = parseInt(taskIndex);

        // 确保系列索引有效
        if (series < 1 || series > allTasks.length) {
            return null;
        }

        // 获取该系列（任务组）中的任务
        const taskGroup = allTasks[series - 1];

        // 在组内查找任务索引
        let taskPosition = -1;
        for (let i = 0; i < taskGroup.length; i++) {
            if (taskGroup[i].index === taskIndexNum) {
                taskPosition = i;
                break;
            }
        }

        // 如果是组内的第一个任务，则没有前置任务
        if (taskPosition === 0) {
            return null;
        }

        // 返回前一个任务的索引
        if (taskPosition > 0) {
            return taskGroup[taskPosition - 1].index;
        }

        return null;
    }

    /**
     * 获取所有任务
     * @returns {Array} 所有任务的数组
     */
    getAllTasks() {
        // 将二维数组扁平化为一维数组
        return allTasks.flat();
    }

    /**
     * 获取任务状态
     */
    getStatus() {
        return {
            completedTasks: this.completedTasks,
            acceptedTasks: this.acceptedTasks,
            killCounts: this.killCounts
        };
    }

    /**
     * 恢复任务状态
     * @param {object} state - 状态对象
     */
    restoreState(state) {
        if (state && state.completedTasks) {
            this.completedTasks = {...state.completedTasks};
        }
        if (state && state.acceptedTasks) {
            this.acceptedTasks = {...state.acceptedTasks};
        }
        if (state && state.killCounts) {
            this.killCounts = {...state.killCounts};
        }
    }
}