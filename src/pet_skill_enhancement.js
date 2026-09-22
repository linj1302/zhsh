/**
 * 宠物技能强化系统 - 技能点管理、天赋解锁、技能进阶
 */
import Pet from './pet.js';

export default class PetSkillEnhancement {
    constructor(petManager) {
        this.petManager = petManager;
        // 技能进阶配方
        this.skillUpgradeRecipes = {
            '利刃': { upgradeTo: '精准利刃', requirements: { level: 15, skillPoints: 3 }, effects: { attackBonus: '+5% → +10%' } },
            '御敌': { upgradeTo: '坚甲御敌', requirements: { level: 15, skillPoints: 3 }, effects: { defenseBonus: '+5% → +10%' } },
            '轻身': { upgradeTo: '疾速轻身', requirements: { level: 15, skillPoints: 3 }, effects: { agilityBonus: '+20 → +35' } },
            '振幅': { upgradeTo: '浩荡振幅', requirements: { level: 15, skillPoints: 3 }, effects: { moraleBonus: '+20 → +35' } },
            '怒吼': { upgradeTo: '狂怒怒吼', requirements: { level: 25, skillPoints: 5 }, effects: { allStatsBonus: '+10% → +20%' } },
            '威压': { upgradeTo: '恐怖威压', requirements: { level: 25, skillPoints: 5 }, effects: { debuffChance: '20% → 35%' } },
        };
    }

    // 获取可用技能点
    getAvailableSkillPoints(pet) {
        const maxPoints = pet.talentConfig.maxSkillPoints;
        const usedPoints = pet.usedSkillPoints || 0;
        return Math.max(0, maxPoints - usedPoints);
    }

    // 学习新技能（需要消耗技能点）
    learnSkill(pet, skillId) {
        const petInstance = this.petManager.getPetById(pet.id || pet);
        if (!petInstance) {
            return { success: false, tip: '宠物不存在' };
        }

        const skill = Pet.PET_SKILLS.find(s => s.id === skillId);
        if (!skill) {
            return { success: false, tip: '技能不存在' };
        }

        if (petInstance.skills.find(s => s.id === skillId)) {
            return { success: false, tip: '已学习该技能' };
        }

        const availablePoints = this.getAvailableSkillPoints(petInstance);
        if (availablePoints < skill.skillCost) {
            return { success: false, tip: `技能点不足，需要${skill.skillCost}点，当前可用${availablePoints}点` };
        }

        // 检查等级要求
        if (petInstance.level < this.getSkillLevelRequirement(skillId)) {
            return { success: false, tip: `需要等级${this.getSkillLevelRequirement(skillId)}才能学习` };
        }

        // 学习技能
        petInstance.skills.push({
            id: skill.id,
            name: skill.name,
            type: skill.type,
            desc: skill.desc,
            level: 1,
            mastered: false,
            learnedAt: Date.now()
        });

        petInstance.usedSkillPoints += skill.skillCost;

        return {
            success: true,
            tip: `成功学习技能【${skill.name}】，消耗${skill.skillCost}技能点`,
            skill: petInstance.skills[petInstance.skills.length - 1]
        };
    }

    // 获取技能等级要求
    getSkillLevelRequirement(skillId) {
        const requirements = {
            1: 5, 2: 5, 3: 8, 4: 8, 5: 10, 6: 10, 7: 12, 8: 12,
            9: 5, 10: 5, 11: 8, 12: 8, 13: 50, 14: 20, 15: 20, 16: 20
        };
        return requirements[skillId] || 1;
    }

    // 技能强化（提升技能等级）
    enhanceSkill(pet, skillId) {
        const petInstance = this.petManager.getPetById(pet.id || pet);
        if (!petInstance) {
            return { success: false, tip: '宠物不存在' };
        }

        const skillIndex = petInstance.skills.findIndex(s => s.id === skillId);
        if (skillIndex === -1) {
            return { success: false, tip: '未学习该技能' };
        }

        const skill = petInstance.skills[skillIndex];
        if (skill.level >= 5) {
            return { success: false, tip: '技能已达到最高强化级别' };
        }

        const enhanceCost = skill.level * 2; // 每级强化消耗2倍技能点
        if (petInstance.usedSkillPoints < enhanceCost) {
            return { success: false, tip: `技能点不足，需要${enhanceCost}点` };
        }

        petInstance.skills[skillIndex].level += 1;
        petInstance.skills[skillIndex].mastered = skill.level >= 3;

        return {
            success: true,
            tip: `技能【${skill.name}】强化至${skill.level}级`,
            skill: petInstance.skills[skillIndex]
        };
    }

    // 获取技能进阶配方
    getSkillUpgradeRecipe(skillName) {
        return this.skillUpgradeRecipes[skillName] || null;
    }

    // 技能进阶（需要特殊条件）
    upgradeSkill(pet, skillName) {
        const petInstance = this.petManager.getPetById(pet.id || pet);
        if (!petInstance) {
            return { success: false, tip: '宠物不存在' };
        }

        const recipe = this.getSkillUpgradeRecipe(skillName);
        if (!recipe) {
            return { success: false, tip: '该技能无法进阶' };
        }

        // 检查技能是否已达到强化条件（等级3以上）
        const skill = petInstance.skills.find(s => s.name === skillName);
        if (!skill || skill.level < 3) {
            return { success: false, tip: `需要将${skillName}强化至3级后才能进阶` };
        }

        // 检查进阶条件
        if (petInstance.level < recipe.requirements.level) {
            return { success: false, tip: `需要等级${recipe.requirements.level}才能进阶` };
        }

        if ((petInstance.usedSkillPoints || 0) < recipe.requirements.skillPoints) {
            return { success: false, tip: `需要${recipe.requirements.skillPoints}技能点用于进阶` };
        }

        // 执行进阶
        petInstance.skills = petInstance.skills.map(s => {
            if (s.name === skillName) {
                return {
                    ...s,
                    name: recipe.upgradeTo,
                    upgraded: true,
                    upgradeEffects: recipe.effects
                };
            }
            return s;
        });

        // 消耗技能点
        petInstance.usedSkillPoints -= recipe.requirements.skillPoints;

        return {
            success: true,
            tip: `技能【${skillName}】成功进阶为【${recipe.upgradeTo}】！`,
            skill: petInstance.skills.find(s => s.name === recipe.upgradeTo)
        };
    }

    // 获取宠物技能列表（含可学习技能）
    getSkillList(pet) {
        const learnedSkills = pet.skills || [];
        const innateSkills = pet.innateSkills || [];

        // 可学习的后天技能
        const learnableSkills = Pet.PET_SKILLS.filter(skill => {
            const isLearned = learnedSkills.find(s => s.id === skill.id);
            const isInnate = innateSkills.find(s => s.id === skill.id);
            return !isLearned && !isInnate && this.getSkillLevelRequirement(skill.id) <= pet.level;
        });

        return {
            learned: learnedSkills.map(s => ({
                ...s,
                cost: this.getEnhancementCost(s.level),
                maxLevel: 5
            })),
            innate: innateSkills.map(s => ({
                ...s
            })),
            learnable: learnableSkills.map(s => ({
                ...s,
                levelRequirement: this.getSkillLevelRequirement(s.id),
                cost: s.skillCost,
                available: this.getAvailableSkillPoints(pet) >= s.skillCost
            })),
            availablePoints: this.getAvailableSkillPoints(pet),
            totalPoints: pet.talentConfig.maxSkillPoints
        };
    }

    // 获取强化消耗
    getEnhancementCost(skillLevel) {
        return skillLevel * 2;
    }

    // 重置技能点（消耗道具）
    resetSkillPoints(pet, resetItem) {
        const petInstance = this.petManager.getPetById(pet.id || pet);
        if (!petInstance) {
            return { success: false, tip: '宠物不存在' };
        }

        // 检查重置道具
        const bag = petInstance.owner?.backpack;
        if (!bag || !bag.getItem || bag.getItem(resetItem)?.num <= 0) {
            return { success: false, tip: '重置道具不足' };
        }

        // 重置技能点
        petInstance.usedSkillPoints = 0;

        // 移除已学习的后天技能（保留先天技能）
        petInstance.skills = petInstance.skills.filter(s => s.innate);

        // 消耗道具
        bag.removeItem(resetItem);

        return {
            success: true,
            tip: '技能点已重置，可重新分配',
            remainingPoints: petInstance.talentConfig.maxSkillPoints
        };
    }
}
