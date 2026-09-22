/** 烹饪系统 - 食谱制作、美食 buff */
import { cookingRecipes } from '../config/index.js';

export default class Cooking {
    constructor(play) {
        this.play = play;
        this.cookingState = null; // 烹饪状态
    }

    // 获取可用的食材
    getIngredients() {
        const items = this.play.backpack.getStatus().items;
        const ingredients = items.filter(item => 
            item.info && item.info.category === 'ingredient'
        );
        return ingredients;
    }

    // 获取可用的调味品
    getSeasonings() {
        const items = this.play.backpack.getStatus().items;
        const seasonings = items.filter(item => 
            item.info && item.info.category === 'seasoning'
        );
        return seasonings;
    }

    // 获取所有食谱
    getRecipes() {
        return cookingRecipes;
    }

    // 获取玩家已学会的食谱
    getLearnedRecipes() {
        if (!this.play.learnedRecipes) {
            this.play.learnedRecipes = [];
        }
        return this.play.learnedRecipes;
    }

    // 学习新食谱（通过NPC或任务）
    learnRecipe(recipeId) {
        const recipe = cookingRecipes.find(r => r.id === recipeId);
        if (!recipe) {
            return { success: false, tip: '食谱不存在' };
        }
        
        if (!this.play.learnedRecipes) {
            this.play.learnedRecipes = [];
        }
        
        if (this.play.learnedRecipes.includes(recipeId)) {
            return { success: false, tip: '已经学会该食谱' };
        }
        
        this.play.learnedRecipes.push(recipeId);
        return { success: true, tip: `成功学会【${recipe.name}】食谱！` };
    }

    // 检查是否可以烹饪指定食谱
    canCook(recipeId) {
        const recipe = cookingRecipes.find(r => r.id === recipeId);
        if (!recipe) return null;
        
        const ingredients = this.getIngredients();
        const seasonings = this.getSeasonings();
        
        const missingIngredients = recipe.ingredients.filter(
            ing => !ingredients.some(i => i.info.name === ing.name && i.num >= ing.count)
        );
        
        const missingSeasonings = recipe.seasoning ? 
            seasonings.filter(s => s.info.name === recipe.seasoning.name && s.num < 1) : [];
        
        return {
            recipe,
            canCook: missingIngredients.length === 0 && missingSeasonings.length === 0,
            missingIngredients,
            missingSeasonings
        };
    }

    // 开始烹饪
    startCooking(recipeId) {
        const check = this.canCook(recipeId);
        if (!check) {
            return { success: false, tip: '食谱不存在' };
        }
        if (!check.canCook) {
            let tip = '缺少食材：';
            if (check.missingIngredients.length > 0) {
                tip += check.missingIngredients.map(i => i.name + '×' + i.count).join(', ');
            }
            if (check.missingSeasonings.length > 0) {
                tip += '；缺少调味：' + check.missingSeasonings.map(s => s.name).join(', ');
            }
            return { success: false, tip };
        }
        
        this.cookingState = {
            recipeId,
            startTime: Date.now(),
            stepsCompleted: 0
        };
        
        return { success: true, tip: '开始烹饪...' };
    }

    // 烹饪完成（消耗时间或添加完成动作）
    finishCooking() {
        if (!this.cookingState) {
            return { success: false, tip: '没有进行中的烹饪' };
        }
        
        const recipe = cookingRecipes.find(r => r.id === this.cookingState.recipeId);
        if (!recipe) {
            this.cookingState = null;
            return { success: false, tip: '食谱已失效' };
        }
        
        // 消耗食材
        recipe.ingredients.forEach(ing => {
            const item = this.play.backpack.getStatus().items.find(
                i => i.info && i.info.name === ing.name
            );
            if (item) {
                item.num -= ing.count;
                if (item.num <= 0) {
                    this.play.backpack.removeItem(item.id);
                }
            }
        });
        
        // 消耗调味品
        if (recipe.seasoning) {
            const seasoning = this.play.backpack.getStatus().items.find(
                i => i.info && i.info.name === recipe.seasoning.name
            );
            if (seasoning) {
                seasoning.num -= 1;
                if (seasoning.num <= 0) {
                    this.play.backpack.removeItem(seasoning.id);
                }
            }
        }
        
        // 根据质量确定结果
        const quality = this.calculateQuality();
        const resultItem = this.createFoodItem(recipe, quality);
        
        // 添加到背包
        this.play.backpack.addItem(resultItem);
        
        this.cookingState = null;
        
        return {
            success: true,
            tip: `烹饪完成！【${recipe.name}】质量：${quality.name}，美味度：${quality.tasteBonus}`,
            item: resultItem
        };
    }

    // 计算烹饪质量
    calculateQuality() {
        // 基础质量：随机因素 + 玩家烹饪熟练度
        const baseQuality = Math.random();
        const playerSkill = this.getCookingSkill() || 0;
        
        // 使用调味品可提升质量
        const qualityBoost = this.cookingState && this.getSeasonings().length > 0 ? 0.1 : 0;
        
        const total = baseQuality + playerSkill * 0.1 + qualityBoost;
        
        if (total >= 0.9) return { name: '完美', tasteBonus: 50, color: 2067639 };
        if (total >= 0.7) return { name: '优良', tasteBonus: 30, color: 65011 };
        if (total >= 0.4) return { name: '普通', tasteBonus: 15, color: 16772950 };
        return { name: '劣质', tasteBonus: 5, color: 128 };
    }

    // 获取玩家烹饪熟练度
    getCookingSkill() {
        if (!this.play.cookingSkill) {
            this.play.cookingSkill = 0;
        }
        return this.play.cookingSkill;
    }

    // 提升烹饪熟练度
    improveCookingSkill() {
        if (!this.play.cookingSkill) {
            this.play.cookingSkill = 0;
        }
        this.play.cookingSkill += 1;
        return this.play.cookingSkill;
    }

    // 创建食物物品
    createFoodItem(recipe, quality) {
        const now = Date.now();
        return {
            name: recipe.name,
            type: 22, // 食物类型
            num: 1,
            status: 1,
            id: now,
            info: {
                name: recipe.name,
                type: 22,
                category: 'food',
                cookedAt: now,
                quality: quality.name,
                tasteBonus: quality.tasteBonus,
                recipeId: recipe.id,
                color: quality.color,
                expireAt: now + recipe.shelfLife * 24 * 60 * 60 * 1000,
                attributes: recipe.attributes
            }
        };
    }

    // 食用食物
    eatFood(foodId) {
        const food = this.play.backpack.getItemById(foodId);
        if (!food || food.info.category !== 'food') {
            return { success: false, tip: '不是食物' };
        }
        
        // 检查是否过期
        if (food.info.expireAt && food.info.expireAt < Date.now()) {
            return { success: false, tip: '食物已过期，无法食用' };
        }
        
        // 应用美味度 buff
        const tasteBonus = food.info.tasteBonus || 0;
        this.play.addExp(tasteBonus); // 吃食物获得经验
        
        // 恢复体力
        const healAmount = 50 + tasteBonus * 2;
        this.play.currentHealth = Math.min(
            this.play.health,
            this.play.currentHealth + healAmount
        );
        
        // 提升烹饪熟练度（如果是自己烹饪的）
        if (food.info.cookerId === this.play.id) {
            this.improveCookingSkill();
        }
        
        this.play.backpack.removeItem(foodId);
        
        return {
            success: true,
            tip: `食用【${food.info.name}】，恢复${healAmount}体力，获得${tasteBonus}经验`
        };
    }

    // 获取食物列表
    getFoodItems() {
        const items = this.play.backpack.getStatus().items;
        return items.filter(item => item.info && item.info.category === 'food');
    }
}
