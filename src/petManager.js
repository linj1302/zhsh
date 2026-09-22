import Pet, { PET_TYPES, EGG_PET_MAP } from './pet.js';
import { balance } from './formulas.js';

// 天赋名称映射
const TALENT_NAMES = ['平庸', '普通', '优良', '卓越', '传奇'];
const QUAL_NAMES = ['极差', '较差', '普通', '上佳', '超群'];

export default class PetManager {
    constructor(userId, database, backpack, play) {
        this.userId = userId;
        this.db = database;
        this.play = play;
        this.backpack = backpack;
    }

    // 获取用户的所有宠物
    getUserPets() {
        if (!this.db) return [];
        return this.db.getUserPets(this.userId);
    }

    /**
     * 获取最大宠物携带数量（默认3 + 迷你兽栏数量，最多3个兽栏每个+1）
     */
    getMaxPetSlots() {
        const miniPenCount = this.backpack.items
            .filter(i => i.name === '迷你兽栏' && i.num > 0)
            .reduce((sum, i) => sum + i.num, 0);
        return 3 + Math.min(miniPenCount, 3);
    }

    /**
     * 获取当前宠物数量和剩余槽位
     */
    getPetSlotInfo() {
        const current = this.getUserPets().length;
        const max = this.getMaxPetSlots();
        return { current, max, remaining: max - current };
    }

    // 添加新宠物
    addPet(petData) {
        if (!this.db) return false;
        return this.db.addPet(this.userId, petData);
    }

    // 更新宠物信息
    updatePet(petId, petData) {
        if (!this.db) return false;
        return this.db.updatePet(this.userId, petId, petData);
    }

    // 删除宠物
    removePet(petId) {
        if (!this.db) return false;
        return this.db.removePet(this.userId, petId);
    }

    // 根据ID获取特定宠物
    getPetById(petId) {
        if (!this.db) return null;
        return this.db.getPetById(this.userId, petId);
    }

    // 选择宠物（设置为出战状态）
    selectPet(petId) {
        if (!this.db) return false;
        return this.db.selectPet(this.userId, petId);
    }

    // 喂食宠物
    feedPet(petId, foodValue) {
        if (!this.db) return false;
        return this.db.feedPet(this.userId, petId, foodValue);
    }

    // 清洁宠物
    cleanPet(petId, cleanValue) {
        if (!this.db) return false;
        return this.db.cleanPet(this.userId, petId, cleanValue);
    }

    // 宠物成长
    growPet(petId, growValue) {
        if (!this.db) return false;
        return this.db.growPet(this.userId, petId, growValue);
    }

    // 获取用户宠物列表的方法
    getPets() {
        return this.getUserPets();
    }

    // 宠物孵化功能（支持多种蛋类型）
    hatch(eggType) {
        const backpack = this.backpack;

        // 检查宠物数量是否达到上限
        const slotInfo = this.getPetSlotInfo();
        if (slotInfo.remaining <= 0) {
            return { success: false, tip: `宠物栏已满（${slotInfo.current}/${slotInfo.max}），请先丢弃不需要的宠物或使用迷你兽栏扩容` };
        }

        // 蛋种类映射：eggType -> 蛋名称
        const eggNameMap = {
            'normal': '宠物蛋',
            'qq': 'QQ宠物蛋',
            'ancient': '远古宠物蛋',
            'ancient_super': '远古双超宠物蛋',
            'advanced': '高级宠物蛋'
        };
        const eggName = eggNameMap[eggType] || '宠物蛋';

        // 查找背包中的宠物蛋
        const eggs = backpack.getItemsByType(20).filter(item => item.name === eggName);
        const totalEggs = eggs.reduce((sum, egg) => sum + egg.num, 0);
        if (totalEggs < 1) {
            return { success: false, tip: `你的${eggName}数量不足，无法孵化` };
        }

        // 消耗宠物蛋
        const egg = eggs[0];
        backpack.removeItem(egg.id);

        // 根据蛋类型确定可孵出的宠物列表
        const petTypes = EGG_PET_MAP[eggType] || EGG_PET_MAP['normal'];

        // 随机选择一个宠物类型
        const randomIndex = Math.floor(Math.random() * petTypes.length);
        const petType = petTypes[randomIndex];

        // 创建新宠物
        const newPet = Pet.hatchFromEgg(eggType, petType);
        // 注入背包引用（用于魔纹果实检测）
        newPet.setBackpackRef(this.backpack);
        const petData = newPet.getStatus();

        // 添加宠物到数据库
        const petId = this.addPet(petData);

        if (petId) {
            return {
                success: true,
                tip: `恭喜你成功孵化出一只${petType}！（${PET_TYPES[petType]?.desc || ''}）当前宠物 ${slotInfo.current + 1}/${slotInfo.max}`
            };
        } else {
            return {
                success: false,
                tip: "孵化失败，请重试"
            };
        }
    }

    // 宠物喂食功能
    feed(itemId) {
        const backpack = this.backpack;
        // 查找物品
        const item = backpack.getItemById(itemId);
        if (!item) {
            return {success: false, tip: "无效的物品"};
        }

        // 检查物品类型是否为宠物饲料
        if (item.type !== 25) {
            return {success: false, tip: "该物品不能用于喂食宠物"};
        }

        // 检查物品数量
        if (item.num <= 0) {
            return {success: false, tip: "物品数量不足"};
        }

        // 减少物品数量
        backpack.removeItem(item.id);

        // 获取当前选中的宠物
        const pets = this.getUserPets();
        const selectedPet = pets.find(pet => pet.isFighting) || pets[0];

        if (!selectedPet) {
            return {success: false, tip: "没有选中的宠物"};
        }

        // 喂食宠物
        const feedValue = item.info.add || 0;
        const success = this.feedPet(selectedPet.id, feedValue);

        if (success) {
            return {
                success: true,
                tip: `使用了${item.name}，宠物饱食度增加${feedValue}`
            };
        } else {
            return {success: false, tip: "喂食失败"};
        }
    }

    // 宠物清洁功能
    clean(itemId) {
        const backpack = this.backpack;
        // 查找物品
        const item = backpack.getItemById(itemId);
        if (!item) {
            return {success: false, tip: "无效的物品"};
        }

        // 检查物品类型是否为宠物清洁剂
        if (item.type !== 26) {
            return {success: false, tip: "该物品不能用于清洁宠物"};
        }

        // 检查物品数量
        if (item.num <= 0) {
            return {success: false, tip: "物品数量不足"};
        }

        // 减少物品数量
        backpack.removeItem(item.id);

        // 获取当前选中的宠物
        const pets = this.getUserPets();
        const selectedPet = pets.find(pet => pet.isFighting) || pets[0];

        if (!selectedPet) {
            return {success: false, tip: "没有选中的宠物"};
        }

        // 清洁宠物
        const cleanValue = item.info.add || 0;
        const success = this.cleanPet(selectedPet.id, cleanValue);

        if (success) {
            return {
                success: true,
                tip: `使用了${item.name}，宠物清洁度增加${cleanValue}`
            };
        } else {
            return {success: false, tip: "清洁失败"};
        }
    }

    // 使用道具（喂食、清洁等）
    use(itemId) {
        // 获取背包
        const backpack = this.backpack;

        // 查找物品
        const item = backpack.getItemById(itemId);
        if (!item) {
            return {success: false, tip: "无效的物品"};
        }

        // 根据物品类型决定使用方式
        if (item.type === 25) {
            // 宠物饲料
            return this.feed(item.id);
        } else if (item.type === 26) {
            // 宠物清洁剂
            return this.clean(item.id);
        } else if (item.type === 27) {
            // 宠物成长
            return this.grow(item.id);
        } else {
            return {success: false, tip: "该物品不能用于宠物"};
        }
    }

    // 宠物成长功能
    grow(itemId) {
        const backpack = this.backpack;
        // 查找物品
        const item = backpack.getItemById(itemId);
        if (!item) {
            return {success: false, tip: "无效的物品"};
        }

        // 检查物品类型是否为宠物成长道具
        if (item.type !== 27) {
            return {success: false, tip: "该物品不能用于宠物成长"};
        }

        // 检查物品数量
        if (item.num <= 0) {
            return {success: false, tip: "物品数量不足"};
        }

        // 减少物品数量
        backpack.removeItem(item.id);

        // 获取当前选中的宠物
        const pets = this.getUserPets();
        const selectedPet = pets.find(pet => pet.isFighting) || pets[0];

        if (!selectedPet) {
            return {success: false, tip: "没有选中的宠物"};
        }

        // 成长宠物（成长道具为旧量级设计，按 balance.petExp.petGrowthItemMultiplier 折算，恢复存量道具价值）
        const growthMultiplier = (balance.petExp && balance.petExp.petGrowthItemMultiplier) || 1;
        const growValue = (item.info.add || 0) * growthMultiplier;
        const result = this.growPet(selectedPet.id, growValue);

        if (result && result.success) {
            return {success: true, tip: result.message};
        } else {
            return {success: false, tip: result ? result.message : "成长失败"};
        }
    }

    // 让宠物休息
    rest() {
        // 获取当前选中的宠物
        const pets = this.getUserPets();
        const selectedPet = pets.find(pet => pet.isFighting);

        if (!selectedPet) {
            return {success: false, tip: "没有正在出战的宠物"};
        }

        // 更新宠物状态为休息（isFighting = false）
        const success = this.updatePet(selectedPet.id, {...selectedPet, isFighting: false});

        if (success) {
            return {success: true, tip: `${selectedPet.name}已进入休息状态`};
        } else {
            return {success: false, tip: "操作失败"};
        }
    }

    // 让宠物出战
    fight(index) {
        // 获取所有宠物
        const pets = this.getUserPets();

        if (pets.length === 0) {
            return {success: false, tip: "你还没有宠物"};
        }

        // 查找当前出战的宠物
        const fightingPet = pets.find(pet => pet.isFighting);

        // 如果已经有出战的宠物，先让它休息
        if (fightingPet) {
            this.updatePet(fightingPet.id, {...fightingPet, isFighting: false});
        }

        // 选择第一只宠物出战（或者可以选择特定的宠物）
        const petToFight = pets[index || 0];
        const success = this.updatePet(petToFight.id, {...petToFight, isFighting: true});

        if (success) {
            return {success: true, tip: `${petToFight.name}已出战`};
        } else {
            return {success: false, tip: "操作失败"};
        }
    }

    // 绑定/解绑宠物
    toggleBind() {
        // 获取当前选中的宠物
        const pets = this.getUserPets();
        const selectedPet = pets.find(pet => pet.isFighting) || pets[0];

        if (!selectedPet) {
            return {success: false, tip: "没有选中的宠物"};
        }

        // 切换绑定状态
        const newBindState = !selectedPet.isBound;
        const success = this.updatePet(selectedPet.id, {...selectedPet, isBound: newBindState});

        if (success) {
            const action = newBindState ? "绑定" : "解除绑定";
            return {success: true, tip: `已${action}${selectedPet.name}`};
        } else {
            return {success: false, tip: "操作失败"};
        }
    }

    // 丢弃宠物
    discard(petId) {
        const pets = this.getUserPets();
        let selectedPet = null;

        if (petId) {
            selectedPet = pets.find(p => p.id === parseInt(petId) || p.id === petId);
        } else {
            selectedPet = pets.find(pet => pet.isFighting) || pets[0];
        }

        if (!selectedPet) {
            return {success: false, tip: "没有选中的宠物"};
        }

        // 删除宠物
        const success = this.removePet(selectedPet.id);

        if (success) {
            return {success: true, tip: `已丢弃${selectedPet.name}`};
        } else {
            return {success: false, tip: "丢弃失败"};
        }
    }

    // ====== 新增强功能 ======

    resetQualification(petId) {
        const pets = this.getUserPets();
        const pet = petId ? pets.find(p => p.id === parseInt(petId)) :
            (pets.find(p => p.isFighting) || pets[0]);
        if (!pet) return { success: false, tip: '没有选中的宠物' };

        if (pet.qualLocked) return { success: false, tip: '资历已锁定，不能重置' };

        const resetItem = this.backpack.items.find(i => i.name === '资历重置符' && i.status === 1 && i.num > 0);
        if (resetItem) {
            this.backpack.removeItem(resetItem.id);
        } else if (this.play.gold >= 3) {
            this.play.gold -= 3;
        } else {
            return { success: false, tip: '需要3金贝或资历重置符' };
        }

        const tempPet = new Pet(pet.name, pet.type);
        Object.assign(tempPet, pet);
        const oldQual = pet.qualification;
        const newQual = tempPet.resetQualification();
        this.updatePet(pet.id, { ...pet, qualification: newQual });

        return { success: true, tip: `${pet.name}资历从「${oldQual}」→「${newQual}」` };
    }

    rerollTalent(petId) {
        const pets = this.getUserPets();
        const pet = petId ? pets.find(p => p.id === parseInt(petId)) :
            (pets.find(p => p.isFighting) || pets[0]);
        if (!pet) return { success: false, tip: '没有选中的宠物' };

        if (pet.talentLocked) return { success: false, tip: '天赋已锁定，不能重随' };

        const talentItem = this.backpack.items.find(i => i.name === '天赋丹' && i.status === 1 && i.num > 0);
        if (talentItem) {
            this.backpack.removeItem(talentItem.id);
        } else if (this.play.gold >= 5) {
            this.play.gold -= 5;
        } else {
            return { success: false, tip: '需要5金贝或天赋丹' };
        }

        const tempPet = new Pet(pet.name, pet.type);
        Object.assign(tempPet, pet);
        const oldTalent = pet.talent;
        const newTalent = tempPet.resetTalent();
        this.updatePet(pet.id, { ...pet, talent: newTalent });

        return { success: true, tip: `${pet.name}天赋从「${oldTalent}」→「${newTalent}」` };
    }

    gainBattleExp(petId, baseExp) {
        const pets = this.getUserPets();
        const pet = pets.find(p => p.id === parseInt(petId) || p.id === petId);
        if (!pet) return null;

        const tempPet = new Pet(pet.name, pet.type);
        Object.assign(tempPet, pet);
        tempPet.setBackpackRef(this.backpack);
        const result = tempPet.addExp(baseExp);
        // 保存更新后的等级、经验、以及领悟的新技能
        const updateData = { ...pet, level: tempPet.level, exp: tempPet.exp };
        if (result.unlockedSkills && result.unlockedSkills.length > 0) {
            updateData.skills = tempPet.skills;
        }
        this.updatePet(pet.id, updateData);
        return result;
    }

    addPetExp(petId, amount) {
        return this.gainBattleExp(petId, amount);
    }

    /**
     * 宠物改名（默认名免费，第二次1金贝）
     */
    renamePet(petId, newName) {
        if (!newName || newName.trim().length === 0) {
            return { success: false, tip: '名字不能为空' };
        }
        const trimmed = newName.trim();
        if (trimmed.length > 8) return { success: false, tip: '名字最多8个字' };

        const pets = this.getUserPets();
        const pet = petId ? pets.find(p => p.id === parseInt(petId) || p.id === petId) :
            (pets.find(p => p.isFighting) || pets[0]);
        if (!pet) return { success: false, tip: '没有选中的宠物' };

        // 同名不扣
        if (pet.name === trimmed) return { success: false, tip: '名字与当前相同' };

        // 如果已经改名过（nameSet=true），需要1金贝
        if (pet.nameSet) {
            if (this.play.gold < 1) return { success: false, tip: '需要1金贝' };
            this.play.gold -= 1;
        }

        this.updatePet(pet.id, { ...pet, name: trimmed, nameSet: true });
        return { success: true, tip: `改名成功：${pet.name} → ${trimmed}` + (pet.nameSet ? '（消耗1金贝）' : '') };
    }

    /**
     * 切换天赋锁定
     */
    toggleTalentLock(petId) {
        const pets = this.getUserPets();
        const pet = petId ? pets.find(p => p.id === parseInt(petId) || p.id === petId) :
            (pets.find(p => p.isFighting) || pets[0]);
        if (!pet) return { success: false, tip: '没有选中的宠物' };

        const newLock = !pet.talentLocked;
        this.updatePet(pet.id, { ...pet, talentLocked: newLock });
        return { success: true, tip: `天赋已${newLock ? '🔒锁定' : '🔓解锁'}` };
    }

    /**
     * 切换资历锁定
     */
    toggleQualLock(petId) {
        const pets = this.getUserPets();
        const pet = petId ? pets.find(p => p.id === parseInt(petId) || p.id === petId) :
            (pets.find(p => p.isFighting) || pets[0]);
        if (!pet) return { success: false, tip: '没有选中的宠物' };

        const newLock = !pet.qualLocked;
        this.updatePet(pet.id, { ...pet, qualLocked: newLock });
        return { success: true, tip: `资历已${newLock ? '🔒锁定' : '🔓解锁'}` };
    }

    getPetDetail(petId) {
        const pets = this.getUserPets();
        const pet = petId ? pets.find(p => p.id === parseInt(petId) || p.id === petId) :
            (pets.find(p => p.isFighting) || pets[0]);
        if (!pet) return null;

        const tempPet = new Pet(pet.name, pet.type);
        Object.assign(tempPet, pet);
        tempPet.setBackpackRef(this.backpack);
        return {
            ...pet,
            expToNextLevel: tempPet.expToNextLevel,
            talentConfig: tempPet.talentConfig,
            talentLocked: pet.talentLocked || false,
            qualLocked: pet.qualLocked || false,
            nameSet: pet.nameSet || false,
            attack: tempPet.attack,
            defense: tempPet.defense,
            agility: tempPet.agility,
            maxSkillPoints: tempPet.maxSkillPoints,
            remainingSkillPoints: tempPet.remainingSkillPoints,
            maxLearnableSkills: tempPet.maxLearnableSkills,
            nextUnlockLevel: Math.ceil(((pet.level || 1) + 1) / 5) * 5,
            availableSkills: tempPet.getAvailableSkills(),
            allSkillDefs: Pet.getSkillDefinitions(),
            innateSkills: pet.innateSkills || [],
            usedSkillPoints: pet.usedSkillPoints || 0,
            petTypeInfo: Pet.getPetTypeInfo(pet.type),
            slotInfo: this.getPetSlotInfo()
        };
    }

    /**
     * 获取宠物管理页面状态
     */
    getStatus() {
        const pets = this.getUserPets();
        const slotInfo = this.getPetSlotInfo();
        return {
            pets: pets.map(p => {
                const tempPet = new Pet(p.name, p.type);
                Object.assign(tempPet, p);
                tempPet.setBackpackRef(this.backpack);
                return {
                    ...p,
                    attack: tempPet.attack,
                    defense: tempPet.defense,
                    agility: tempPet.agility,
                    expToNextLevel: tempPet.expToNextLevel,
                    petTypeInfo: Pet.getPetTypeInfo(p.type),
                    skillCount: (p.innateSkills || []).length + (p.skills || []).length,
                    maxLearnableSkills: tempPet.maxLearnableSkills,
                };
            }),
            slotInfo,
            eggTypes: Object.keys(EGG_PET_MAP),
            eggPetMap: EGG_PET_MAP,
            petTypes: PET_TYPES,
        };
    }

    /**
     * 宠物学习技能
     */
    learnSkill(petId, skillId) {
        const pets = this.getUserPets();
        const pet = pets.find(p => p.id === parseInt(petId) || p.id === petId);
        if (!pet) return { success: false, tip: '宠物不存在' };

        const tempPet = new Pet(pet.name, pet.type);
        // 复制所有状态到临时对象
        tempPet.level = pet.level;
        tempPet.exp = pet.exp;
        tempPet.hunger = pet.hunger;
        tempPet.cleanliness = pet.cleanliness;
        tempPet.mood = pet.mood;
        tempPet.qualification = pet.qualification;
        tempPet.talent = pet.talent;
        tempPet.talentLocked = pet.talentLocked;
        tempPet.qualLocked = pet.qualLocked;
        tempPet.nameSet = pet.nameSet;
        tempPet.isFighting = pet.isFighting;
        tempPet.isBound = pet.isBound;
        tempPet.skills = Array.isArray(pet.skills) ? [...pet.skills] : [];
        tempPet.innateSkills = Array.isArray(pet.innateSkills) ? [...pet.innateSkills] : [];
        tempPet.usedSkillPoints = pet.usedSkillPoints || 0;

        const result = tempPet.learnSkill(parseInt(skillId));
        if (!result.success) return { success: false, tip: result.message };

        const updatedData = {
            ...pet,
            hunger: tempPet.hunger,
            cleanliness: tempPet.cleanliness,
            skills: tempPet.skills,
            innateSkills: tempPet.innateSkills,
            usedSkillPoints: tempPet.usedSkillPoints
        };
        this.updatePet(pet.id, updatedData);
        return { success: true, tip: result.message };
    }
}