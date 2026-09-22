/**
 * 农场系统扩展 - 新作物、作物进化、多人协作
 */
import { crops } from '../config/index.js';

export default class FarmExtension {
    constructor(farm) {
        this.farm = farm;
        this.cropEvolutions = []; // 作物进化配方
        this.fieldBoosters = {}; // 领域buff
        this.coopCrops = {}; // 共享作物
    }

    // 获取可种植的作物
    getPlantableCrops(soilQuality) {
        return crops.filter(crop => {
            if (crop.minSoilQuality && soilQuality < crop.minSoilQuality) {
                return false;
            }
            return true;
        });
    }

    // 获取作物进化配方
    getCropEvolutions() {
        return [
            {
                from: '小麦',
                to: '金麦',
                requirements: { level: 10, water: 3, fertilizer: 2 },
                effects: { harvestBonus: 0.5, sellPrice: 2 }
            },
            {
                from: '番茄',
                to: '圣番茄',
                requirements: { level: 15, water: 5, fertilizer: 3 },
                effects: { healPower: 1.5, tasteBonus: 10 }
            },
            {
                from: '胡萝卜',
                to: '金色胡萝卜',
                requirements: { level: 20, water: 4, fertilizer: 3 },
                effects: { growthSpeed: 1.2, sellPrice: 1.5 }
            }
        ];
    }

    // 检查作物是否可以进化
    canEvolveCrop(cropName, field) {
        const evolutions = this.getCropEvolutions();
        const evolution = evolutions.find(e => e.from === cropName);
        
        if (!evolution) return { canEvolve: false, reason: '此作物无法进化' };
        
        const requirements = evolution.requirements;
        const fieldData = field.getFieldData ? field.getFieldData() : field;
        
        if (fieldData.waterLevel < requirements.water) {
            return { canEvolve: false, reason: `需要水分${requirements.water}，当前${fieldData.waterLevel}` };
        }
        
        if (fieldData.fertilizerLevel < requirements.fertilizer) {
            return { canEvolve: false, reason: `需要肥料${requirements.fertilizer}，当前${fieldData.fertilizerLevel}` };
        }
        
        return { canEvolve: true, evolution, cropName };
    }

    // 进化作物
    evolveCrop(cropName, fieldId) {
        const field = this.farm.getFieldById(fieldId);
        if (!field) return { success: false, tip: '地块不存在' };
        
        const check = this.canEvolveCrop(cropName, field);
        if (!check.canEvolve) {
            return { success: false, tip: check.reason };
        }
        
        const evolution = check.evolution;
        const crops = field.crops || [];
        const cropIndex = crops.findIndex(c => c.name === cropName);
        
        if (cropIndex === -1) return { success: false, tip: '作物不存在' };
        
        // 进化
        const newCropName = evolution.to;
        crops[cropIndex].name = newCropName;
        crops[cropIndex].evolved = true;
        crops[cropIndex].evolutionLevel = (crops[cropIndex].evolutionLevel || 0) + 1;
        
        // 应用进化效果
        if (evolution.effects.harvestBonus) {
            crops[cropIndex].harvestBonus = (crops[cropIndex].harvestBonus || 0) + evolution.effects.harvestBonus;
        }
        if (evolution.effects.sellPrice) {
            crops[cropIndex].sellPriceMultiplier = (crops[cropIndex].sellPriceMultiplier || 1) * evolution.effects.sellPrice;
        }
        
        return {
            success: true,
            tip: `【${cropName}】进化为【${newCropName}】！`
        };
    }

    // 设置领域boost
    setFieldBooster(fieldId, boosterType, activatorId) {
        const field = this.farm.getFieldById(fieldId);
        if (!field) return { success: false, tip: '地块不存在' };
        
        const boosters = {
            'water_boost': { name: '水资源丰富', effect: { waterLevel: 2 }, duration: 3600000 },
            'fertilizer_boost': { name: '肥力充沛', effect: { fertilizerLevel: 2 }, duration: 3600000 },
            'growth_boost': { name: '生长加速', effect: { growthSpeed: 1.5 }, duration: 7200000 }
        };
        
        const booster = boosters[boosterType];
        if (!booster) return { success: false, tip: '无效的加速类型' };
        
        field.boosters = field.boosters || [];
        field.boosters.push({
            type: boosterType,
            name: booster.name,
            effect: booster.effect,
            activatorId,
            activatedAt: Date.now(),
            expiresAt: Date.now() + booster.duration
        });
        
        return { success: true, tip: `应用了【${booster.name}】，有效期${booster.duration/3600000}小时` };
    }

    // 检查领域buff是否过期
    checkExpiredBoosters() {
        const now = Date.now();
        const fields = this.farm.getFields();
        
        fields.forEach(field => {
            if (field.boosters) {
                field.boosters = field.boosters.filter(b => b.expiresAt > now);
            }
        });
    }

    // 共享作物（邻里帮助）
    shareCrop(fieldId, cropName, amount) {
        const field = this.farm.getFieldById(fieldId);
        if (!field) return { success: false, tip: '地块不存在' };
        
        const crops = field.crops || [];
        const crop = crops.find(c => c.name === cropName);
        
        if (!crop) return { success: false, tip: '作物不存在' };
        if (crop.harvestCount >= crop.harvestLimit) {
            return { success: false, tip: '作物已收获完毕' };
        }
        
        // 减少原始作物数量，增加共享作物
        const actualAmount = Math.min(amount, crop.harvestLimit - crop.harvestCount);
        crop.harvestCount += actualAmount;
        
        // 创建共享作物
        const sharedCrop = {
            fieldId,
            ownerId: field.ownerId,
            cropName,
            amount: actualAmount,
            sharedAt: Date.now()
        };
        
        if (!this.coopCrops[sharedCrop.ownerId]) {
            this.coopCrops[sharedCrop.ownerId] = [];
        }
        this.coopCrops[sharedCrop.ownerId].push(sharedCrop);
        
        return {
            success: true,
            tip: `共享了${actualAmount}个【${cropName}】`,
            sharedCrop
        };
    }

    // 获取可领取的共享作物
    getAvailableShares(playerId) {
        const shares = [];
        const fields = this.farm.getFields();
        
        fields.forEach(field => {
            const fieldShares = this.coopCrops[field.ownerId];
            if (fieldShares) {
                fieldShares.forEach(share => {
                    if (share.ownerId !== playerId) {
                        shares.push(share);
                    }
                });
            }
        });
        
        return shares;
    }

    // 领取共享作物
    takeShare(shareId) {
        for (const ownerId in this.coopCrops) {
            const shares = this.coopCrops[ownerId];
            const shareIndex = shares.findIndex(s => s.fieldId === shareId);
            
            if (shareIndex !== -1) {
                const share = shares[shareIndex];
                shares.splice(shareIndex, 1);
                
                return {
                    success: true,
                    tip: `获得了${share.amount}个【${share.cropName}】`,
                    crop: share
                };
            }
        }
        
        return { success: false, tip: '共享作物不存在' };
    }

    // 200级后特殊功能
    getPostLevel200Features() {
        return [
            { name: '心法修炼', description: '提升特殊技能熟练度', unlockLevel: 200 },
            { name: '潜能开发', description: '增加角色潜能点', unlockLevel: 210 },
            { name: '灵力冥想', description: '恢复魔素，每天3次', unlockLevel: 220 },
            { name: '武魂契合', description: '提升宠物契合度', unlockLevel: 230 }
        ];
    }

    // 检查是否解锁200级功能
    checkLevel200Unlock(play) {
        const features = this.getPostLevel200Features();
        const unlocked = features.filter(f => play.level >= f.unlockLevel);
        
        if (unlocked.length > 0) {
            return {
                hasUnlocked: true,
                features: unlocked.map(f => f.name),
                tip: `已解锁：${unlocked.map(f => f.name).join('、')}`
            };
        }
        
        return { hasUnlocked: false };
    }
}
