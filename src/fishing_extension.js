/**
 * 钓鱼系统扩展 - 钓鱼装备、技巧、钓鱼技能
 */
import Fish from './fish.js';
import { fish as fishConfig } from '../config/index.js';

export default class FishingExtension {
    constructor(fish, play) {
        this.fish = fish;
        this.play = play;
        this.fishingSkills = {}; // 钓鱼技能
        this.fishingEquipment = {}; // 钓鱼装备统计
        this.fishCaught = {}; // 钓鱼记录
        this.waterQuality = {}; // 水质影响
    }

    // 获取钓鱼技能
    getFishingSkills() {
        return {
            basicCast: { id: 1, name: '基本投竿', description: '基础的投竿技巧', level: 1, exp: 0, maxLevel: 10, effect: { castDistance: 10 } },
            preciseCast: { id: 2, name: '精准投竿', description: '提高投竿精度', level: 1, exp: 0, maxLevel: 15, effect: { accuracy: 0.1 } },
            quickReel: { id: 3, name: '快速收线', description: '快速收回鱼线', level: 1, exp: 0, maxLevel: 12, effect: { reelSpeed: 1.2 } },
            heavyLure: { id: 4, name: '重型诱饵', description: '使用重型诱饵吸引大鱼', level: 5, exp: 0, maxLevel: 20, effect: { bigFishChance: 0.15 } },
            sensitiveRod: { id: 5, name: '灵敏鱼竿', description: '更灵敏地感知鱼咬钩', level: 8, exp: 0, maxLevel: 18, effect: { biteDetection: 0.2 } },
            patientWaiting: { id: 6, name: '耐心等待', description: '等待更长时间 increases success rate', level: 3, exp: 0, maxLevel: 15, effect: { waitSuccessBonus: 0.05 } },
            lureMastery: { id: 7, name: '诱饵大师', description: '熟练使用各种诱饵', level: 10, exp: 0, maxLevel: 25, effect: { baitEffectiveness: 0.3 } },
            nightFishing: { id: 8, name: '夜钓技巧', description: '在夜间钓鱼的特殊技巧', level: 15, exp: 0, maxLevel: 20, effect: { nightBonus: 0.25 } },
            deepWater: { id: 9, name: '深水钓鱼', description: '在深水区域钓鱼', level: 12, exp: 0, maxLevel: 20, effect: { deepWaterChance: 0.2 } },
            expertTechnique: { id: 10, name: '专家技巧', description: '钓鱼专家的综合技巧', level: 20, exp: 0, maxLevel: 30, effect: { allSkillsBonus: 0.15 } }
        };
    }

    // 获取玩家钓鱼技能等级
    getFishingSkillLevel(skillId) {
        const skills = this.fishingSkills;
        if (!skills[skillId]) {
            return 0;
        }
        return skills[skillId].level;
    }

    // 提升钓鱼技能
    improveFishingSkill(skillId, expAmount) {
        const skills = this.getFishingSkills();
        const skill = skills[skillId];
        
        if (!skill) return { success: false, tip: '技能不存在' };

        if (!this.fishingSkills[skillId]) {
            this.fishingSkills[skillId] = { level: 1, exp: 0 };
        }

        const current = this.fishingSkills[skillId];
        current.exp += expAmount;

        // 检查是否升级
        const expNeeded = skill.level * 100;
        if (current.exp >= expNeeded && current.level < skill.maxLevel) {
            current.level++;
            current.exp -= expNeeded;
            return {
                success: true,
                tip: `钓鱼技能【${skill.name}】提升至${current.level}级！`,
                skill: current,
                leveledUp: true
            };
        }

        return {
            success: true,
            tip: `钓鱼技能【${skill.name}】获得${expAmount}经验，当前${current.level}级`,
            skill: current,
            leveledUp: false
        };
    }

    // 获取钓鱼装备统计
    getFishingEquipmentStats() {
        const rods = this.fish.getRods();
        const baits = this.fish.getBaits();
        const equipmentStats = {
            rods: [],
            baits: [],
            totalEquipment: rods.length + baits.length
        };

        rods.forEach(rod => {
            const rodInfo = this.getRodStats(rod);
            equipmentStats.rods.push({
                id: rod.id,
                name: rod.name,
                info: rodInfo
            });
        });

        baits.forEach(bait => {
            const baitInfo = this.getBaitStats(bait);
            equipmentStats.baits.push({
                id: bait.id,
                name: bait.name,
                info: baitInfo
            });
        });

        return equipmentStats;
    }

    // 获取鱼竿统计
    getRodStats(rod) {
        // 鱼竿基础属性
        const baseStats = {
            castDistance: 50,
            durability: 100,
            sensitivity: 5,
            lureWeight: 10
        };

        // 根据鱼竿品质调整
        if (rod.info && rod.info.quality) {
            const qualityMultiplier = {
                '普通': 1.0,
                '优良': 1.2,
                '精良': 1.5,
                '传说': 2.0
            };
            const mult = qualityMultiplier[rod.info.quality] || 1.0;
            baseStats.castDistance *= mult;
            baseStats.sensitivity *= mult;
            baseStats.lureWeight *= mult;
        }

        // 根据鱼竿等级调整
        if (rod.info && rod.info.level) {
            baseStats.durability += rod.info.level * 10;
            baseStats.castDistance += rod.info.level * 2;
        }

        return baseStats;
    }

    // 获取鱼饵统计
    getBaitStats(bait) {
        const baseStats = {
            attractiveness: 50, // 吸引力
            effectDuration: 30, // 效果持续时间（分钟）
            targetFish: 'all', // 目标鱼类
            rarityBoost: 0 // 稀有度提升
        };

        if (bait.info && bait.info.type) {
            switch (bait.info.type) {
                case 'earthworm':
                    baseStats.attractiveness = 60;
                    baseStats.targetFish = 'common';
                    break;
                case 'artificial':
                    baseStats.attractiveness = 70;
                    baseStats.targetFish = 'uncommon';
                    break;
                case 'special':
                    baseStats.attractiveness = 90;
                    baseStats.targetFish = 'rare';
                    baseStats.rarityBoost = 0.2;
                    break;
                case 'premium':
                    baseStats.attractiveness = 95;
                    baseStats.targetFish = 'epic';
                    baseStats.rarityBoost = 0.35;
                    break;
                case 'legend':
                    baseStats.attractiveness = 100;
                    baseStats.targetFish = 'all';
                    baseStats.rarityBoost = 0.5;
                    break;
            }
        }

        return baseStats;
    }

    // 获取水质影响
    getWaterQuality(location) {
        // 默认水质
        const defaultQuality = {
            clarity: 1.0, // 清澈度
            oxygen: 1.0, // 氧气含量
            temperature: 'normal', // 水温
            pollution: 0, // 污染度
            fishActivity: 1.0 // 鱼活动度
        };

        // 根据位置调整水质
        if (location && location[0] && location[1]) {
            const lat = location[0];
            const lon = location[1];

            // 热带海域
            if (lat < -20) {
                return {
                    ...defaultQuality,
                    temperature: 'warm',
                    fishActivity: 1.2,
                    clarity: 0.9
                };
            }

            // 寒冷海域
            if (lat > 60) {
                return {
                    ...defaultQuality,
                    temperature: 'cold',
                    fishActivity: 0.8,
                    oxygen: 1.3
                };
            }

            // 河流
            if (Math.abs(lat) < 30 && Math.abs(lon) < 30) {
                return {
                    ...defaultQuality,
                    clarity: 0.7,
                    fishActivity: 1.1,
                    pollution: 0.1
                };
            }

            // 深海
            // 根据深度计算（简化）
            const depth = Math.abs(lat) + Math.abs(lon);
            if (depth > 100) {
                return {
                    ...defaultQuality,
                    clarity: 0.5,
                    oxygen: 0.8,
                    fishActivity: 0.6,
                    temperature: 'cold'
                };
            }
        }

        return defaultQuality;
    }

    // 计算钓鱼成功率（考虑装备和技能）
    calculateFishingSuccessRate(location, bait, rod) {
        // 基础成功率
        let baseRate = 0.6;

        // 水质影响
        const waterQuality = this.getWaterQuality(location);
        baseRate *= waterQuality.fishActivity;

        // 鱼竿影响
        const rodStats = this.getRodStats(rod);
        baseRate += (rodStats.sensitivity / 100) * 0.2;

        // 鱼饵影响
        const baitStats = this.getBaitStats(bait);
        baseRate += baitStats.attractiveness / 100 * 0.3;
        baseRate += baitStats.rarityBoost * 0.1;

        // 技能影响
        const skills = this.fish.player?.fishingSkills || this.fishingSkills;
        if (skills) {
            const basicCastLevel = skills.basicCast?.level || 0;
            const preciseCastLevel = skills.preciseCast?.level || 0;
            const patientWaitingLevel = skills.patientWaiting?.level || 0;

            baseRate += basicCastLevel * 0.01;
            baseRate += preciseCastLevel * 0.015;
            baseRate += patientWaitingLevel * 0.005;
        }

        // 限制在0.1到0.95之间
        return Math.max(0.1, Math.min(0.95, baseRate));
    }

    // 记录钓鱼
    recordCatch(fish) {
        const fishId = fish.name;
        
        if (!this.fishCaught[fishId]) {
            this.fishCaught[fishId] = {
                count: 0,
                totalWeight: 0,
                largest: 0,
                firstCatch: Date.now()
            };
        }

        const record = this.fishCaught[fishId];
        record.count++;
        record.totalWeight += fish.weight || 0;
        if (fish.weight > record.largest) {
            record.largest = fish.weight;
        }

        return record;
    }

    // 获取钓鱼统计
    getFishingStats() {
        const totalFish = Object.keys(this.fishCaught).length;
        const totalCatches = Object.values(this.fishCaught).reduce((sum, r) => sum + r.count, 0);
        const totalWeight = Object.values(this.fishCaught).reduce((sum, r) => sum + r.totalWeight, 0);

        const uniqueFish = Object.keys(this.fishCaught).length;
        const largestFish = Object.values(this.fishCaught).reduce((max, r) => 
            r.largest > max ? r.largest : max, 0);

        const averageWeight = totalCatches > 0 ? totalWeight / totalCatches : 0;

        return {
            totalFish: totalCatches,
            uniqueFishSpecies: uniqueFish,
            totalWeight: Math.round(totalWeight),
            largestFish: largestFish,
            averageWeight: Math.round(averageWeight),
            fishingSkill: this.fish.player?.fishingSkill || 0,
            rodEquipped: this.fish.getRods().length > 0 ? this.fish.getRods()[0].name : '无',
            baitEquipped: this.fish.getBaits().length > 0 ? this.fish.getBaits()[0].name : '无'
        };
    }

    // 获取稀有鱼类钓鱼概率提升（钓鱼技能加成）
    getRareFishBonus() {
        const skills = this.fish.player?.fishingSkills || this.fishingSkills;
        
        let bonus = 0;
        if (skills.heavyLure?.level) {
            bonus += skills.heavyLure.level * 0.02;
        }
        if (skills.expertTechnique?.level) {
            bonus += skills.expertTechnique.level * 0.01;
        }
        if (skills.deepWater?.level) {
            bonus += skills.deepWater.level * 0.015;
        }

        return Math.min(bonus, 0.5);
    }

    // 夜间钓鱼加成
    getNightFishingBonus() {
        const skills = this.fish.player?.fishingSkills || this.fishingSkills;
        if (skills.nightFishing?.level) {
            return skills.nightFishing.level * 0.03;
        }
        return 0;
    }

    // 获取钓鱼经验
    getFishingExp(fishRarity, fishWeight) {
        const expTable = {
            'common': 10,
            'uncommon': 25,
            'rare': 50,
            'epic': 100
        };

        const baseExp = expTable[fishRarity] || 10;
        const weightExp = Math.floor(fishWeight / 10);
        
        return baseExp + weightExp;
    }

    // 获取钓鱼装备升级建议
    getEquipmentUpgradeSuggestion() {
        const rods = this.fish.getRods();
        const baits = this.fish.getBaits();

        if (rods.length === 0) {
            return { type: 'rod', suggestion: '建议购买或制作鱼竿' };
        }

        const currentRod = rods.reduce((best, rod) => {
            const rodStats = this.getRodStats(rod);
            const bestStats = best ? this.getRodStats(best) : { castDistance: 0 };
            return rodStats.castDistance > bestStats.castDistance ? rod : best;
        }, null);

        if (currentRod && currentRod.info && currentRod.info.quality === '普通') {
            return { 
                type: 'rod', 
                suggestion: `当前鱼竿【${currentRod.name}】品质较低，建议升级到优良以上`,
                current: currentRod.name,
                recommended: '优良钓竿'
            };
        }

        if (baits.length === 0) {
            return { type: 'bait', suggestion: '建议购买或制作鱼饵' };
        }

        const currentBait = baits.reduce((best, bait) => {
            const baitStats = this.getBaitStats(bait);
            const bestStats = best ? this.getBaitStats(best) : { attractiveness: 0 };
            return baitStats.attractiveness > bestStats.attractiveness ? bait : best;
        }, null);

        if (currentBait && currentBait.info && currentBait.info.type === 'earthworm') {
            return { 
                type: 'bait', 
                suggestion: `当前鱼饵【${currentBait.name}】效果一般，建议使用人工鱼饵或特殊鱼饵`,
                current: currentBait.name,
                recommended: '人工鱼饵'
            };
        }

        return { type: 'none', suggestion: '装备良好，继续钓鱼吧！' };
    }

    // 获取钓鱼技巧提示
    getFishingTips() {
        const tips = [
            '使用重型诱饵更容易钓到大鱼',
            '在水质清澈的地方钓鱼成功率更高',
            '夜间钓鱼时可以使用夜钓技巧获得加成',
            '耐心等待比频繁收放线更有效',
            '根据目标鱼类选择合适的鱼饵',
            '深水区域可能有稀有鱼类',
            '鱼竿灵敏度越高越容易发现鱼咬钩',
            '不同鱼饵对不同鱼类有不同的吸引力',
            '_castDistance_越远能覆盖更多水域',
            '定期更换鱼饵可以吸引不同种类的鱼'
        ];

        const currentLocation = this.fish.fishingState?.location;
        if (currentLocation) {
            const waterQuality = this.getWaterQuality(currentLocation);
            if (waterQuality.temperature === 'cold') {
                tips.push('冷水区域适合钓冰鱼，注意保暖');
            } else if (waterQuality.temperature === 'warm') {
                tips.push('温暖水域适合钓热带鱼，多准备蛾眉虫');
            }
        }

        return tips;
    }

    // 检查是否可以升级钓鱼装备
    checkEquipmentUpgrade(equipmentId, newEquipment) {
        // 检查装备是否需要升级
        const currentRod = this.fish.getRods().find(r => r.id === equipmentId);
        if (!currentRod) return { canUpgrade: false, reason: '装备不存在' };

        const currentStats = this.getRodStats(currentRod);
        const newStats = this.getRodStats({ ...newEquipment, info: newEquipment.info });

        const improvements = [];
        if (newStats.castDistance > currentStats.castDistance) {
            improvements.push(`投掷距离+${Math.round((newStats.castDistance - currentStats.castDistance) / currentStats.castDistance * 100)}%`);
        }
        if (newStats.sensitivity > currentStats.sensitivity) {
            improvements.push(`灵敏度+${Math.round((newStats.sensitivity - currentStats.sensitivity) / currentStats.sensitivity * 100)}%`);
        }
        if (newStats.lureWeight > currentStats.lureWeight) {
            improvements.push(`诱饵重量+${Math.round((newStats.lureWeight - currentStats.lureWeight) / currentStats.lureWeight * 100)}%`);
        }

        return {
            canUpgrade: improvements.length > 0,
            improvements,
            currentStats,
            newStats
        };
    }

    // 获取钓鱼技能升级建议
    getSkillUpgradeSuggestion() {
        const skills = this.getFishingSkills();
        const currentSkills = this.fishingSkills;

        const suggestions = [];

        for (const [skillId, skill] of Object.entries(skills)) {
            const currentLevel = currentSkills[skillId]?.level || 0;
            
            if (currentLevel < skill.maxLevel) {
                // 计算升级收益
                const currentBonus = this.calculateSkillBonus(skillId, currentLevel);
                const nextBonus = this.calculateSkillBonus(skillId, currentLevel + 1);
                const gain = nextBonus - currentBonus;

                if (gain > 0) {
                    suggestions.push({
                        skillId: parseInt(skillId),
                        skillName: skill.name,
                        currentLevel,
                        nextLevel: currentLevel + 1,
                        maxLevel: skill.maxLevel,
                        gain: gain,
                        description: skill.description
                    });
                }
            }
        }

        // 按照收益排序
        suggestions.sort((a, b) => b.gain - a.gain);

        return suggestions.slice(0, 5);
    }

    // 计算技能加成
    calculateSkillBonus(skillId, level) {
        const skills = this.getFishingSkills();
        const skill = skills[skillId];

        if (!skill) return 0;

        const effect = skill.effect;
        if (!effect) return 0;

        switch (Object.keys(effect)[0]) {
            case 'castDistance':
                return effect.castDistance * level * 0.1;
            case 'accuracy':
                return effect.accuracy * level;
            case 'reelSpeed':
                return effect.reelSpeed * level * 0.05;
            case 'bigFishChance':
                return effect.bigFishChance * level * 0.02;
            case 'biteDetection':
                return effect.biteDetection * level * 0.03;
            case 'waitSuccessBonus':
                return effect.waitSuccessBonus * level * 0.01;
            case 'baitEffectiveness':
                return effect.baitEffectiveness * level * 0.03;
            case 'nightBonus':
                return effect.nightBonus * level * 0.02;
            case 'deepWaterChance':
                return effect.deepWaterChance * level * 0.02;
            case 'allSkillsBonus':
                return effect.allSkillsBonus * level * 0.01;
            default:
                return 0;
        }
    }

    // 获取钓鱼技能经验
    addFishingExp(fishRarity, fishWeight) {
        const exp = this.getFishingExp(fishRarity, fishWeight);
        
        // 增加基础钓鱼技能
        if (!this.fishingSkills.basicCast) {
            this.fishingSkills.basicCast = { level: 1, exp: 0 };
        }
        this.fishingSkills.basicCast.exp += exp;

        // 根据稀有度增加相应技能经验
        if (fishRarity === 'rare' || fishRarity === 'epic') {
            if (!this.fishingSkills.preciseCast) {
                this.fishingSkills.preciseCast = { level: 1, exp: 0 };
            }
            this.fishingSkills.preciseCast.exp += exp * 2;
        }

        if (fishWeight > 50) {
            if (!this.fishingSkills.heavyLure) {
                this.fishingSkills.heavyLure = { level: 1, exp: 0 };
            }
            this.fishingSkills.heavyLure.exp += exp * 1.5;
        }

        // 检查升级
        const upgradedSkills = [];
        for (const [skillId, skillData] of Object.entries(this.fishingSkills)) {
            const skill = this.getFishingSkills()[skillId];
            if (skill && skillData.exp >= skill.level * 100) {
                if (skillData.level < skill.maxLevel) {
                    skillData.level++;
                    skillData.exp -= skill.level * 100;
                    upgradedSkills.push(skill.name);
                }
            }
        }

        return {
            exp,
            upgradedSkills,
            totalExp: Object.values(this.fishingSkills).reduce((sum, s) => sum + s.exp, 0)
        };
    }
}
