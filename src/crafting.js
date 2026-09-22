/**
 * 制作系统 - 装备/物品製造、配方、大師等級
 */
import { craftingRecipes, tools } from '../config/index.js';

export default class Crafting {
    constructor(play, database) {
        this.play = play;
        this.db = database;
        this.craftingState = null;
        this.craftingSkill = {}; // 各職業製作技能
        this.masterLevel = 1;
        this.professions = {
            blacksmith: { name: '鍛造大師', maxLevel: 50, recipes: ['weapon', 'armor', 'accessory'] },
            alchemist: { name: '煉藥師', maxLevel: 50, recipes: ['potion', 'material'] },
            tailor: { name: '裁縫師', maxLevel: 50, recipes: ['cloth', 'accessory'] }
        };
    }

    // 获取玩家制作技能
    getCraftingSkill(profession) {
        if (!this.craftingSkill[profession]) {
            this.craftingSkill[profession] = { level: 1, exp: 0 };
        }
        return this.craftingSkill[profession];
    }

    // 获取製作配方
    getCraftingRecipes(profession) {
        const professionConfig = this.professions[profession];
        if (!professionConfig) return [];

        return craftingRecipes.filter(recipe => 
            recipe.profession === profession &&
            recipe.level <= (this.getCraftingSkill(profession).level + 10)
        );
    }

    // 学习新配方
    learnRecipe(recipeId) {
        const recipe = craftingRecipes.find(r => r.id === recipeId);
        if (!recipe) return { success: false, tip: '配方不存在' };

        if (!this.play.learnedRecipes) {
            this.play.learnedRecipes = [];
        }

        if (this.play.learnedRecipes.includes(recipeId)) {
            return { success: false, tip: '已学习该配方' };
        }

        if (this.play.level < recipe.requiredLevel) {
            return { success: false, tip: `需要等級${recipe.requiredLevel}才能學習` };
        }

        this.play.learnedRecipes.push(recipeId);
        return { success: true, tip: `學習配方【${recipe.name}】成功！` };
    }

    // 开始製作
    startCrafting(recipeId, profession) {
        const recipe = craftingRecipes.find(r => r.id === recipeId);
        if (!recipe) return { success: false, tip: '配方不存在' };
        if (recipe.profession !== profession) return { success: false, tip: '職業不匹配' };

        const skill = this.getCraftingSkill(profession);
        if (skill.level < recipe.minLevel) {
            return { success: false, tip: `製作等級不足，需要${recipe.minLevel}級` };
        }

        // 检查材料
        const missingMaterials = [];
        for (const material of recipe.materials) {
            const item = this.play.backpack.getItemByName(material.name);
            if (!item || item.num < material.count) {
                missingMaterials.push({ name: material.name, needed: material.count, have: item ? item.num : 0 });
            }
        }

        if (missingMaterials.length > 0) {
            const tip = missingMaterials.map(m => `${m.name}（缺少${m.needed - m.have}）`).join(', ');
            return { success: false, tip: `缺少材料：${tip}` };
        }

        // 消耗材料
        for (const material of recipe.materials) {
            const item = this.play.backpack.getItemByName(material.name);
            item.num -= material.count;
            if (item.num <= 0) {
                this.play.backpack.removeItem(item.id);
            }
        }

        // 開始製作狀態
        this.craftingState = {
            recipeId,
            profession,
            startTime: Date.now(),
            progress: 0,
            steps: recipe.steps || 3,
            currentStep: 0,
            chance: this.calculateSuccessChance(recipe, skill)
        };

        return {
            success: true,
            tip: `開始製作【${recipe.name}】，共${recipe.steps || 3}步驟`,
            recipe: recipe
        };
    }

    // 計算成功率
    calculateSuccessChance(recipe, skill) {
        let baseChance = 0.7;
        baseChance += (skill.level - 1) * 0.02;
        baseChance += (this.masterLevel - 1) * 0.01;

        // 工具品質影響
        const tool = this.getCraftingTool(recipe.profession);
        if (tool) {
            baseChance += tool.quality * 0.05;
        }

        // 專業技能加成
        const professionSkill = this.craftingSkill[recipe.profession];
        if (professionSkill && professionSkill.level > 1) {
            baseChance += professionSkill.level * 0.01;
        }

        return Math.min(0.95, baseChance);
    }

    // 获取製作工具
    getCraftingTool(profession) {
        // 從背包或裝備獲取
        const toolsConfig = tools[profession];
        if (!toolsConfig) return null;

        const toolItem = this.play.backpack.getItemsByType(toolsConfig.type);
        if (toolItem && toolItem.length > 0) {
            return toolItem[0];
        }
        return null;
    }

    // 進行製作步驟
    craftStep() {
        if (!this.craftingState) {
            return { success: false, tip: '未開始製作' };
        }

        const state = this.craftingState;
        const recipe = craftingRecipes.find(r => r.id === state.recipeId);
        if (!recipe) {
            this.craftingState = null;
            return { success: false, tip: '配方已失效' };
        }

        state.currentStep++;
        state.progress = state.currentStep / state.steps;

        // 每步成功率檢查
        const stepSuccess = Math.random() < state.chance;

        if (stepSuccess) {
            // 提升成功率（連續成功）
            state.chance = Math.min(0.95, state.chance + 0.02);
        } else {
            // 降低成功率（失敗）
            state.chance = Math.max(0.3, state.chance - 0.1);
        }

        // 檢查是否完成
        if (state.currentStep >= state.steps) {
            return this.finishCrafting();
        }

        return {
            success: true,
            tip: `製作進度${Math.round(state.progress * 100)}%，第${state.currentStep}/${state.steps}步`,
            currentStep: state.currentStep,
            totalSteps: state.steps
        };
    }

    // 完成製作
    finishCrafting() {
        if (!this.craftingState) {
            return { success: false, tip: '未開始製作' };
        }

        const state = this.craftingState;
        const recipe = craftingRecipes.find(r => r.id === state.recipeId);
        this.craftingState = null;

        // 最終成功率
        const isSuccess = Math.random() < state.chance;

        if (isSuccess) {
            // 製作成功
            const qualityRoll = Math.random();
            let quality;
            if (qualityRoll > 0.85) quality = '完美';
            else if (qualityRoll > 0.6) quality = '優良';
            else if (qualityRoll > 0.3) quality = '普通';
            else quality = '劣質';

            const resultItem = {
                name: recipe.result.name,
                type: recipe.result.type,
                num: 1,
                info: {
                    ...recipe.result.info,
                    quality,
                    craftedBy: this.play.id,
                    craftedAt: Date.now(),
                    level: recipe.result.level || 1
                }
            };

            this.play.backpack.addItem(resultItem);

            // 獲得製作經驗
            this.addCraftingExp(recipe.profession, recipe.expReward);

            return {
                success: true,
                tip: `製作成功！獲得【${recipe.result.name}】（${quality}品質）`,
                item: resultItem,
                quality
            };
        } else {
            // 製作失敗 - 部分材料損失
            const lossChance = recipe.lossChance || 0.3;
            if (Math.random() < lossChance) {
                return {
                    success: false,
                    tip: '製作失敗，部分材料損失！',
                    failed: true
                };
            }

            // 完全失敗，但材料不損失
            return {
                success: false,
                tip: '製作失敗，但材料未損失，可重試',
                failed: true
            };
        }
    }

    // 添加製作經驗
    addCraftingExp(profession, exp) {
        const skill = this.getCraftingSkill(profession);
        skill.exp += exp;

        // 檢查升級
        const expNeeded = skill.level * 100;
        if (skill.exp >= expNeeded) {
            skill.exp -= expNeeded;
            skill.level++;

            // 提升大師等級
            this.masterLevel = Math.max(this.masterLevel, skill.level);

            return { leveledUp: true, newLevel: skill.level };
        }

        return { leveledUp: false };
    }

    // 获取製作統計
    getCraftingStats() {
        const stats = {
            professions: {},
            totalCrafts: 0,
            successRate: 0,
            masterLevel: this.masterLevel
        };

        for (const profession of Object.keys(this.craftingSkill)) {
            const skill = this.craftingSkill[profession];
            stats.professions[profession] = {
                level: skill.level,
                exp: skill.exp,
                professionName: this.professions[profession].name
            };
            stats.totalCrafts += skill.level;
        }

        return stats;
    }

    // 获取未學習配方
    getUnlearnedRecipes() {
        const learned = this.play.learnedRecipes || [];
        return craftingRecipes.filter(r => !learned.includes(r.id));
    }

    // 获取技能樹
    getCraftingSkillTree() {
        return {
            blacksmith: {
                nodes: [
                    { id: 'basic_forging', name: '基礎鍛造', unlocked: true, requires: null },
                    { id: 'advanced_forging', name: '進階鍛造', unlocked: false, requires: 'basic_forging', requiresLevel: 15 },
                    { id: 'master_forging', name: '大師鍛造', unlocked: false, requires: 'advanced_forging', requiresLevel: 30 },
                    { id: 'legendary_forging', name: '傳說鍛造', unlocked: false, requires: 'master_forging', requiresLevel: 45 }
                ]
            },
            alchemist: {
                nodes: [
                    { id: 'basic_alchemy', name: '基礎煉藥', unlocked: true, requires: null },
                    { id: 'advanced_alchemy', name: '進階煉藥', unlocked: false, requires: 'basic_alchemy', requiresLevel: 15 },
                    { id: 'master_alchemy', name: '大師煉藥', unlocked: false, requires: 'advanced_alchemy', requiresLevel: 30 },
                    { id: 'legendary_alchemy', name: '傳說煉藥', unlocked: false, requires: 'master_alchemy', requiresLevel: 45 }
                ]
            },
            tailor: {
                nodes: [
                    { id: 'basic_tailoring', name: '基礎裁縫', unlocked: true, requires: null },
                    { id: 'advanced_tailoring', name: '進階裁縫', unlocked: false, requires: 'basic_tailoring', requiresLevel: 15 },
                    { id: 'master_tailoring', name: '大師裁縫', unlocked: false, requires: 'advanced_tailoring', requiresLevel: 30 },
                    { id: 'legendary_tailoring', name: '傳說裁縫', unlocked: false, requires: 'master_tailoring', requiresLevel: 45 }
                ]
            }
        };
    }
}
