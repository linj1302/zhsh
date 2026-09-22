// 宠物进化系统扩展
import Pet from './pet.js';

export class PetEvolution {
    constructor(petManager) {
        this.petManager = petManager;
        // 进化配方
        this.evolutionRecipes = [
            { from: '暗狼', to: '影狼', requirement: { level: 10, talent: '上佳' } },
            { from: '龙猫', to: '云龙猫', requirement: { level: 15, talent: '普通' } },
            { from: '月虎', to: '银月虎', requirement: { level: 20, talent: '上佳' } },
            { from: '霸熊', to: '金霸熊', requirement: { level: 25, talent: '普通' } },
            { from: '圣龙', to: '神圣圣龙', requirement: { level: 30, talent: '上佳' } },
            { from: '麒麟', to: '瑞麒麟', requirement: { level: 35, talent: '无比聪慧' } }
        ];
    }

    // 获取可进化的宠物
    getEvolvablePets() {
        const pets = this.petManager.getPets();
        return pets.filter(pet => {
            const recipe = this.evolutionRecipes.find(r => r.from === pet.type);
            if (!recipe) return false;
            return pet.level >= recipe.requirement.level;
        });
    }

    // 检查宠物是否可以进化
    canEvolve(pet) {
        const recipe = this.evolutionRecipes.find(r => r.from === pet.type);
        if (!recipe) return { canEvolve: false, reason: '此宠物无法进化' };
        
        if (pet.level < recipe.requirement.level) {
            return { canEvolve: false, reason: `需要等级${recipe.requirement.level}，当前${pet.level}级` };
        }
        
        if (recipe.requirement.talent) {
            const talentRank = ['极差', '较差', '普通', '上佳', '无比聪慧'];
            const petTalentRank = talentRank.indexOf(pet.talent);
            const requiredTalentRank = talentRank.indexOf(recipe.requirement.talent);
            if (petTalentRank < requiredTalentRank) {
                return { canEvolve: false, reason: `需要天赋${recipe.requirement.talent}，当前${pet.talent}` };
            }
        }
        
        // 检查是否已经进化过
        if (pet.evolvedTo) {
            return { canEvolve: false, reason: '已经进化过了' };
        }
        
        return { canEvolve: true, recipe };
    }

    // 进化宠物
    evolve(petId, evolutionStone) {
        const pet = this.petManager.getPetById(petId);
        if (!pet) {
            return { success: false, tip: '宠物不存在' };
        }
        
        const check = this.canEvolve(pet);
        if (!check.canEvolve) {
            return { success: false, tip: check.reason };
        }
        
        // 检查进化石
        const stoneInBag = this.petManager.getPlay().backpack.getItemById(evolutionStone);
        if (!stoneInBag || stoneInBag.num <= 0) {
            return { success: false, tip: '进化石不足' };
        }
        
        // 消耗进化石
        stoneInBag.num--;
        if (stoneInBag.num <= 0) {
            this.petManager.getPlay().backpack.removeItem(stoneInBag.id);
        }
        
        // 执行进化
        const recipe = check.recipe;
        const newType = recipe.to;
        const oldType = pet.type;
        
        pet.type = newType;
        pet.evolvedTo = newType;
        pet.evolutionLevel = (pet.evolutionLevel || 0) + 1;
        
        // 进化后获得属性提升
        pet.exp = Math.floor(pet.exp * 0.8); // 降速
        
        return {
            success: true,
            tip: `【${pet.name}】成功进化为【${newType}】！`,
            pet: {
                oldType,
                newType,
                level: pet.level,
                attack: pet.attack,
                defense: pet.defense,
                agility: pet.agility
            }
        };
    }

    // 获取进化配方
    getEvolutionRecipes() {
        return this.evolutionRecipes.map(recipe => ({
            ...recipe,
            evolvedPet: this.getEvolvedPetInfo(recipe.to)
        }));
    }

    // 获取进化后的宠物信息
    getEvolvedPetInfo(type) {
        const petTypes = {
            '影狼': { attackBonus: 1.3, defenseBonus: 1.1, agilityBonus: 1.2, desc: '黑暗中的猎手' },
            '云龙猫': { attackBonus: 1.2, defenseBonus: 1.2, agilityBonus: 1.1, desc: '云间遨游的龙猫' },
            '银月虎': { attackBonus: 1.1, defenseBonus: 1.3, agilityBonus: 1.4, desc: '银月之力的虎' },
            '金霸熊': { attackBonus: 1.4, defenseBonus: 1.4, agilityBonus: 0.9, desc: '金色霸权的熊' },
            '神圣圣龙': { attackBonus: 1.5, defenseBonus: 1.2, agilityBonus: 1.3, desc: '神圣之力的龙' },
            '瑞麒麟': { attackBonus: 1.3, defenseBonus: 1.5, agilityBonus: 1.4, desc: '瑞气满满的麒麟' }
        };
        
        return petTypes[type] || null;
    }
}
