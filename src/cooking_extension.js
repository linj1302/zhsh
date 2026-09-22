/**
 * 烹饪系统扩展 - 食谱任务、烹饪等级、烹饪成就、烹饪比赛
 */
import Cooking from './cooking.js';
import { cookingRecipes } from '../config/index.js';

export default class CookingExtension {
    constructor(cooking, play) {
        this.cooking = cooking;
        this.play = play;
        this.cookingTasks = {}; // 烹饪任务
        this.cookingAchievements = {}; // 烹饪成就记录
        this.cookingRanking = {}; // 烹饪排行
        this.foodBuffStack = {}; // 食物 buff 叠加
    }

    // 获取烹饪任务
    getCookingTasks() {
        const tasks = [
            { id: 1, name: '新手厨师', description: '烹饪5道普通质量的食物', requirement: { dishesCooked: 5, minQuality: '普通' }, reward: { exp: 200, copper: 100 }, progress: 0 },
            { id: 2, name: '美食家', description: '烹饪10道优良质量以上的食物', requirement: { dishesCooked: 10, minQuality: '优良' }, reward: { exp: 500, copper: 300, item: '精良厨刀' }, progress: 0 },
            { id: 3, name: '大厨', description: '烹饪5道完美质量的食物', requirement: { dishesCooked: 5, minQuality: '完美' }, reward: { exp: 1000, copper: 500, item: '厨师袍' }, progress: 0 },
            { id: 4, name: '百味大师', description: '烹饪50道不同类型的食物', requirement: { uniqueDishes: 50 }, reward: { exp: 2000, copper: 1000, item: '传说级食谱' }, progress: 0 },
            { id: 5, name: '火候掌控', description: '连续10次烹饪不失败', requirement: { consecutiveSuccess: 10 }, reward: { exp: 1500, copper: 750 }, progress: 0 }
        ];

        // 计算任务进度
        tasks.forEach(task => {
            task.progress = this.calculateTaskProgress(task);
        });

        return tasks;
    }

    // 计算任务进度
    calculateTaskProgress(task) {
        const foodItems = this.cooking.getFoodItems();
        const learnedRecipes = this.cooking.getLearnedRecipes();

        switch (task.id) {
            case 1:
                return foodItems.filter(f => f.info.quality === '普通').length;
            case 2:
                return foodItems.filter(f => ['优良', '完美'].includes(f.info.quality)).length;
            case 3:
                return foodItems.filter(f => f.info.quality === '完美').length;
            case 4:
                const uniqueDishes = new Set(foodItems.map(f => f.info.recipeId));
                return uniqueDishes.size;
            case 5:
                // 连续成功次数 - 从最近的食物计算
                const recentFoods = foodItems.sort((a, b) => b.info.cookedAt - a.info.cookedAt);
                let consecutive = 0;
                for (const food of recentFoods) {
                    if (food.info.quality && food.info.quality !== '劣质') {
                        consecutive++;
                    } else {
                        break;
                    }
                }
                return consecutive;
            default:
                return 0;
        }
    }

    // 检查任务是否完成
    checkTaskComplete(taskId) {
        const tasks = this.getCookingTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        return task.progress >= task.requirement.dishesCooked || 
               (task.requirement.uniqueDishes && task.progress >= task.requirement.uniqueDishes) ||
               (task.requirement.consecutiveSuccess && task.progress >= task.requirement.consecutiveSuccess);
    }

    // 领取任务奖励
    claimTaskReward(taskId) {
        const tasks = this.getCookingTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return { success: false, tip: '任务不存在' };
        if (!this.checkTaskComplete(taskId)) {
            return { success: false, tip: '任务未完成' };
        }
        if (this.cookingAchievements[taskId]) {
            return { success: false, tip: '奖励已领取' };
        }

        // 领取奖励
        if (task.reward.exp) {
            this.play.addExp(task.reward.exp);
        }
        if (task.reward.copper) {
            this.play.addCopper(task.reward.copper);
        }
        if (task.reward.item) {
            this.addItemToBackpack(task.reward.item);
        }

        this.cookingAchievements[taskId] = {
            completedAt: Date.now(),
            taskId: taskId
        };

        return {
            success: true,
            tip: `任务【${task.name}】完成，获得${task.reward.exp}经验，${task.reward.copper}铜币`,
            reward: task.reward
        };
    }

    // 添加物品到背包
    addItemToBackpack(itemName) {
        const itemConfig = {
            '精良厨刀': { name: '精良厨刀', type: 14, num: 1, info: { level: 30, attack: 50, defense: 20 } },
            '厨师袍': { name: '厨师袍', type: 2, num: 1, info: { level: 40, defense: 100, agility: 20 } },
            '传说级食谱': { name: '传说级食谱', type: 22, num: 1, info: { name: '传说级食谱', type: 22, category: 'recipe' } }
        };

        const item = itemConfig[itemName];
        if (item) {
            this.play.backpack.addItem(item);
            return true;
        }
        return false;
    }

    // 获取烹饪成就
    getCookingAchievements() {
        const achievements = [
            { id: 1, name: '第一次烹饪', description: '完成第一次烹饪', requirement: { dishesCooked: 1 }, reward: { exp: 50 } },
            { id: 2, name: '烹饪新手', description: '烹饪10道食物', requirement: { dishesCooked: 10 }, reward: { exp: 200, copper: 100 } },
            { id: 3, name: '烹饪学徒', description: '烹饪50道食物', requirement: { dishesCooked: 50 }, reward: { exp: 500, copper: 300 } },
            { id: 4, name: '烹饪大师', description: '烹饪100道食物', requirement: { dishesCooked: 100 }, reward: { exp: 1000, copper: 500 } },
            { id: 5, name: '完美厨师', description: '烹饪10道完美食物', requirement: { perfectDishes: 10 }, reward: { exp: 1500, copper: 800, item: '厨师之星' } },
            { id: 6, name: '百菜之王', description: '烹饪100种不同食物', requirement: { uniqueDishes: 100 }, reward: { exp: 3000, copper: 1500 } },
            { id: 7, name: '火候大师', description: '完美烹饪率达到50%', requirement: { perfectRate: 0.5 }, reward: { exp: 2000, copper: 1000 } }
        ];

        // 计算成就进度
        achievements.forEach(achievement => {
            achievement.progress = this.calculateAchievementProgress(achievement);
            achievement.completed = this.cookingAchievements[achievement.id] !== undefined;
        });

        return achievements;
    }

    // 计算成就进度
    calculateAchievementProgress(achievement) {
        const foodItems = this.cooking.getFoodItems();

        if (achievement.id === 1) {
            return foodItems.length > 0 ? 1 : 0;
        }
        if (achievement.id === 2) {
            return Math.min(foodItems.length, 10);
        }
        if (achievement.id === 3) {
            return Math.min(foodItems.length, 50);
        }
        if (achievement.id === 4) {
            return Math.min(foodItems.length, 100);
        }
        if (achievement.id === 5) {
            return foodItems.filter(f => f.info.quality === '完美').length;
        }
        if (achievement.id === 6) {
            return new Set(foodItems.map(f => f.info.recipeId)).size;
        }
        if (achievement.id === 7) {
            const perfectCount = foodItems.filter(f => f.info.quality === '完美').length;
            return foodItems.length > 0 ? perfectCount / foodItems.length : 0;
        }
        return 0;
    }

    // 获取烹饪排行
    getCookingRanking() {
        // 从本地存储或服务器获取排行
        const ranking = [
            { rank: 1, playerName: '大厨小明', dishesCooked: 500, perfectDishes: 50, level: 80 },
            { rank: 2, playerName: '美食家小红', dishesCooked: 450, perfectDishes: 45, level: 75 },
            { rank: 3, playerName: '厨艺牛牛', dishesCooked: 400, perfectDishes: 40, level: 70 },
            { rank: 4, playerName: '烹饪天才', dishesCooked: 350, perfectDishes: 35, level: 65 },
            { rank: 5, playerName: '烧菜高手', dishesCooked: 300, perfectDishes: 30, level: 60 }
        ];

        // 添加当前玩家排名
        const playerDishes = this.cooking.getFoodItems().length;
        const playerPerfect = this.cooking.getFoodItems().filter(f => f.info.quality === '完美').length;
        
        const playerRank = {
            rank: this.calculatePlayerRank(playerDishes, playerPerfect),
            playerName: this.play.nickname,
            dishesCooked: playerDishes,
            perfectDishes: playerPerfect,
            level: this.play.level
        };

        return {
            topPlayers: ranking,
            playerRank: playerRank,
            totalPlayers: ranking.length + 1
        };
    }

    // 计算玩家排名
    calculatePlayerRank(dishesCooked, perfectDishes) {
        const ranking = [
            { dishesCooked: 500, perfectDishes: 50 },
            { dishesCooked: 450, perfectDishes: 45 },
            { dishesCooked: 400, perfectDishes: 40 },
            { dishesCooked: 350, perfectDishes: 35 },
            { dishesCooked: 300, perfectDishes: 30 }
        ];

        for (let i = 0; i < ranking.length; i++) {
            if (dishesCooked >= ranking[i].dishesCooked && perfectDishes >= ranking[i].perfectDishes) {
                return i + 1;
            }
        }
        return ranking.length + 1;
    }

    // 食物 buff 叠加系统
    applyFoodBuff(foodItem) {
        if (!foodItem.info.attributes) return;

        const player = this.play;
        const buffs = foodItem.info.attributes;

        // 存储 buff 叠加信息
        if (!this.foodBuffStack[player.id]) {
            this.foodBuffStack[player.id] = {
                attackBuff: 0,
                defenseBuff: 0,
                agilityBuff: 0,
                moraleBuff: 0,
                healthRegen: 0,
                expBonus: 0,
                copperBonus: 0,
                buffEndTime: 0
            };
        }

        const stack = this.foodBuffStack[player.id];

        // 应用 buff 叠加
        if (buffs.attackBonus) {
            stack.attackBuff += buffs.attackBonus;
        }
        if (buffs.defenseBonus) {
            stack.defenseBuff += buffs.defenseBonus;
        }
        if (buffs.agilityBonus) {
            stack.agilityBuff += buffs.agilityBonus;
        }
        if (buffs.moraleBonus) {
            stack.moraleBuff += buffs.moraleBonus;
        }
        if (buffs.healthRegen) {
            stack.healthRegen += buffs.healthRegen;
        }
        if (buffs.expBonus) {
            stack.expBonus += buffs.expBonus;
        }
        if (buffs.copperBonus) {
            stack.copperBonus += buffs.copperBonus;
        }

        // 设置 buff 结束时间（默认30分钟）
        stack.buffEndTime = Date.now() + (foodItem.info.attributes.buffDuration || 30) * 60 * 1000;

        // 应用到玩家统计
        player.attackStat += buffs.attackBonus || 0;
        player.defenseStat += buffs.defenseBonus || 0;
        player.agilityStat += buffs.agilityBonus || 0;

        return {
            success: true,
            tip: `获得食物 buff：攻击+${buffs.attackBonus || 0}，防御+${buffs.defenseBonus || 0}，持续30分钟`,
            buffs: stack
        };
    }

    // 获取当前食物 buff
    getCurrentFoodBuff() {
        const playerId = this.play.id;
        const stack = this.foodBuffStack[playerId];

        if (!stack) return null;

        // 检查 buff 是否过期
        if (Date.now() > stack.buffEndTime) {
            this.removeFoodBuff();
            return null;
        }

        return {
            attackBuff: stack.attackBuff,
            defenseBuff: stack.defenseBuff,
            agilityBuff: stack.agilityBuff,
            moraleBuff: stack.moraleBuff,
            healthRegen: stack.healthRegen,
            expBonus: stack.expBonus,
            copperBonus: stack.copperBonus,
            remainingTime: Math.ceil((stack.buffEndTime - Date.now()) / 1000)
        };
    }

    // 移除食物 buff
    removeFoodBuff() {
        const playerId = this.play.id;
        const stack = this.foodBuffStack[playerId];

        if (!stack) return;

        // 移除玩家身上的 buff
        this.play.attackStat -= stack.attackBuff;
        this.play.defenseStat -= stack.defenseBuff;
        this.play.agilityStat -= stack.agilityBuff;

        delete this.foodBuffStack[playerId];
    }

    // 获取烹饪统计
    getCookingStats() {
        const foodItems = this.cooking.getFoodItems();
        const qualityCounts = {
            完美: foodItems.filter(f => f.info.quality === '完美').length,
            优良: foodItems.filter(f => f.info.quality === '优良').length,
            普通: foodItems.filter(f => f.info.quality === '普通').length,
            劣质: foodItems.filter(f => f.info.quality === '劣质').length
        };

        const totalTaste = foodItems.reduce((sum, f) => sum + (f.info.tasteBonus || 0), 0);

        return {
            totalDishes: foodItems.length,
            qualityCounts,
            totalTaste,
            averageTaste: foodItems.length > 0 ? Math.round(totalTaste / foodItems.length) : 0,
            perfectRate: foodItems.length > 0 ? Math.round(qualityCounts.完美 / foodItems.length * 100) : 0,
            cookingSkill: this.cooking.getCookingSkill(),
            learnedRecipes: this.cooking.getLearnedRecipes().length
        };
    }

    // 烹饪比赛系统
    startCookingCompetition(competitionId) {
        const competition = this.getCompetition(competitionId);
        if (!competition) {
            return { success: false, tip: '比赛不存在' };
        }

        if (Date.now() > competition.startTime + competition.duration * 60 * 60 * 1000) {
            return { success: false, tip: '比赛已结束' };
        }

        // 报名参赛
        this.cookingTasks[`competition_${competitionId}`] = {
            competitionId,
            joinedAt: Date.now(),
            dishesCooked: 0,
            perfectDishes: 0
        };

        return { success: true, tip: `成功报名【${competition.name}】烹饪比赛` };
    }

    // 获取比赛信息
    getCompetition(competitionId) {
        const competitions = this.getCompetitions();
        return competitions.find(c => c.id === competitionId);
    }

    // 获取所有比赛
    getCompetitions() {
        return [
            { id: 1, name: '周末美食大赛', description: '烹饪最美味的食物', startTime: Date.now(), duration: 48, prize: { first: { exp: 2000, copper: 1000 }, second: { exp: 1000, copper: 500 }, third: { exp: 500, copper: 200 } } },
            { id: 2, name: '创意料理大赛', description: '创作独特的料理', startTime: Date.now() + 3600000, duration: 24, prize: { first: { exp: 1500, copper: 800, item: '创意奖杯' }, second: { exp: 800, copper: 400 }, third: { exp: 400, copper: 200 } } }
        ];
    }
}
