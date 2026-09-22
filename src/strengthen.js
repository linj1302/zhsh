export default class Strengthen {
    /**
     * 计算强化消耗和成功率
     * @param {number} currentLevel - 当前强化等级
     * @param {number} [equipLevel] - 装备等级（影响消耗）
     * @returns {object} 包含消耗和成功率的对象
     */
    calculateStrengthenCost(currentLevel, equipLevel) {
        const eLv = equipLevel || 1;
        let successRate = 100;
        let costCoins = 0;
        let costMaterials = [];

        // 消耗公式：基础消耗 * (1 + 装备等级/50) * 强化等级倍率
        const equipFactor = 1 + eLv / 50;

        if (currentLevel < 3) {
            // 1-3级：低消耗，高成功率
            costCoins = Math.floor(Math.pow(2, currentLevel) * 1000 * equipFactor);
            successRate = 100 - (currentLevel * 3);
        } else if (currentLevel < 6) {
            // 4-6级：中等消耗
            costCoins = Math.floor(Math.pow(2, currentLevel) * 2000 * equipFactor);
            successRate = 90 - ((currentLevel - 3) * 8);
            costMaterials.push({name: "龙泉水", count: 1});
        } else if (currentLevel < 9) {
            // 7-9级：高消耗
            costCoins = Math.floor(Math.pow(2, currentLevel) * 5000 * equipFactor);
            successRate = 75 - ((currentLevel - 6) * 5);
            costMaterials.push({name: "龙泉水", count: 1});
            costMaterials.push({name: "正龙泉水", count: 1});
        } else if (currentLevel < 12) {
            // 10-12级：极高消耗
            costCoins = Math.floor(Math.pow(2, currentLevel) * 10000 * equipFactor);
            successRate = 60 - ((currentLevel - 9) * 8);
            costMaterials.push({name: "龙泉水", count: 2});
            costMaterials.push({name: "正龙泉水", count: 2});
        } else {
            // 13-15级：最高消耗
            costCoins = Math.floor(Math.pow(2, currentLevel) * 20000 * equipFactor);
            successRate = 40 - ((currentLevel - 12) * 10);
            costMaterials.push({name: "龙泉水", count: 3});
            costMaterials.push({name: "正龙泉水", count: 3});
        }

        // 成功率最低不低于10%
        successRate = Math.max(10, successRate);

        return {
            successRate,
            costCoins,
            costMaterials
        };
    }

    /**
     * 执行强化操作
     * @param {object} item - 装备对象
     * @param {object} play - 玩家对象
     * @param {object} backpack - 背包对象
     * @returns {object} 强化结果
     */
    doStrengthen(item, play, backpack) {
        const currentLevel = item.info.strengthenLevel || 0;
        const equipLevel = item.info.level || item.level || 1;

        // 检查是否可以强化
        if (currentLevel >= 15) {
            return {
                success: false,
                message: "装备已达到最高强化等级！",
                code: "MAX_LEVEL"
            };
        }

        // 计算消耗（传入装备等级）
        const costInfo = this.calculateStrengthenCost(currentLevel, equipLevel);

        // 检查铜币是否足够，不足时尝试用银贝/金贝补足
        const totalCopper = play.copper || 0;
        if (totalCopper < costInfo.costCoins) {
            if (play.gold > 0) {
                const goldNeeded = Math.ceil((costInfo.costCoins - totalCopper) / 1000);
                if (play.gold >= goldNeeded) {
                    play.gold -= goldNeeded;
                    play.copper += goldNeeded * 1000;
                    this._lastGoldConverted = goldNeeded;
                }
            }
        }
        
        if ((play.copper || 0) < costInfo.costCoins) {
            const silver = Math.floor((play.copper || 0) / 1000);
            const copper = (play.copper || 0) % 1000;
            let msg = '铜币不足！';
            if (silver > 0) msg += ` 当前拥有${silver}银贝${copper > 0 ? copper + '铜币' : ''}`;
            if (play.gold > 0) msg += ` 和${play.gold}金贝`;
            msg += `，但强化需要${costInfo.costCoins}铜币`;
            return {
                success: false,
                message: msg,
                code: 'INSUFFICIENT_COINS'
            };
        }

        // 检查材料是否足够
        for (const material of costInfo.costMaterials) {
            if (!backpack.hasItem(material.name, material.count)) {
                return {
                    success: false,
                    message: "材料不足：" + material.name,
                    code: "INSUFFICIENT_MATERIAL"
                };
            }
        }

        // 判断是否强化成功
        const isSuccess = Math.random() * 100 < costInfo.successRate;

        if (isSuccess) {
            // === 强化成功：扣除全部消耗 ===
            play.copper -= costInfo.costCoins;
            if (play.copper < 0) play.copper = 0;
            for (const material of costInfo.costMaterials) {
                for (let i = 0; i < material.count; i++) {
                    backpack.removeItem(material.name);
                }
            }

            if (!item.info.strengthenLevel) {
                item.info.strengthenLevel = 0;
            }
            item.info.strengthenLevel++;

            // 强化会改变装备属性：使 equipProperty 版本缓存失效
            if (play && play.equipment && typeof play.equipment.bumpVersion === 'function') {
                play.equipment.bumpVersion();
            }

            let resultMsg = '强化成功！装备 ' + item.name + ' 现在是 +' + item.info.strengthenLevel + ' 级。';
            
            if (this._lastGoldConverted) {
                resultMsg += ' (自动兑换' + this._lastGoldConverted + '金贝补足强化费用)';
                this._lastGoldConverted = 0;
            }

            // 6级开始可能出现异常属性
            let abnormalAttr = null;
            if (item.info.strengthenLevel >= 6) {
                if (Math.random() < 0.2) {
                    if (!item.info.abnormalAttrs) {
                        item.info.abnormalAttrs = [];
                    }

                    const abnormalStatusEffects = [
                        { name: "slowInflict", displayName: "迟缓攻" },
                        { name: "weakInflict", displayName: "虚弱攻" },
                        { name: "curseInflict", displayName: "诅咒攻" },
                        { name: "depressedInflict", displayName: "沮丧攻" },
                        { name: "poisonInflict", displayName: "毒攻" },
                        { name: "paralysisInflict", displayName: "麻痹攻" }
                    ];
                    
                    const selectedEffect = abnormalStatusEffects[Math.floor(Math.random() * abnormalStatusEffects.length)];
                    const effectValue = Math.floor(Math.random() * 5) + 1;

                    abnormalAttr = {
                        name: selectedEffect.name,
                        displayName: selectedEffect.displayName,
                        value: effectValue
                    };

                    item.info.abnormalAttrs.push(abnormalAttr);
                    resultMsg += ` 并且获得了异常属性加成: ${selectedEffect.displayName}+${effectValue}！`;
                }
            }

            return {
                success: true,
                message: resultMsg,
                abnormalAttr: abnormalAttr,
                newLevel: item.info.strengthenLevel
            };
        } else {
            // === 强化失败：只损失部分原料，NPC返还部分，装备不损失不降级 ===
            // 扣除50%消耗
            const actualCost = Math.floor(costInfo.costCoins * 0.5);
            play.copper -= actualCost;
            if (play.copper < 0) play.copper = 0;

            // 材料扣除50%（向下取整至少扣1个）
            for (const material of costInfo.costMaterials) {
                const loseCount = Math.max(1, Math.floor(material.count * 0.5));
                for (let i = 0; i < loseCount; i++) {
                    backpack.removeItem(material.name);
                }
            }

            // NPC返还30%（以铜币形式）
            const npcReturn = Math.floor(costInfo.costCoins * 0.3);
            if (npcReturn > 0) {
                play.copper += npcReturn;
            }

            let failMsg = '强化失败！装备 ' + item.name + ' 强化等级未提升。';
            failMsg += ` 消耗了${actualCost}铜币`;
            if (npcReturn > 0) {
                failMsg += `，NPC返还了${npcReturn}铜币`;
            }
            failMsg += '。';

            this._lastGoldConverted = 0;

            return {
                success: false,
                message: failMsg,
                code: 'STRENGTHEN_FAILED',
                npcReturn: npcReturn
            };
        }
    }

    /**
     * 获取装备强化属性加成
     * 规则：
     * - 每级+体力
     * - 3级开始增加攻防敏
     * - 10级后体力值 = 装备等级 * 10，攻防敏 +20%
     * @param {object} item - 装备对象
     * @returns {object} 属性加成对象
     */
    getStrengthenAttributes(item) {
        const attributes = {
            attack: 0,
            defense: 0,
            agility: 0,
            morale: 0,
            health: 0
        };

        if (item.info.strengthenLevel) {
            const sl = item.info.strengthenLevel;
            const equipLevel = item.info.level || item.level || 1;

            // 每级+体力（基础：sl * 2）
            attributes.health += sl * 2;

            // 3级开始增加攻防敏
            if (sl >= 3) {
                const bonusLevels = sl - 2; // 从3级开始算的有效等级数
                attributes.attack += bonusLevels;
                attributes.defense += bonusLevels;
                attributes.agility += Math.floor(bonusLevels / 2);
                attributes.morale += Math.floor(bonusLevels / 3);
            }

            // 10级后额外加成：体力=装备等级*10，攻防敏+20%
            if (sl >= 10) {
                // 体力额外加成
                attributes.health += equipLevel * 10;
                // 攻防敏+20%
                attributes.attack = Math.floor(attributes.attack * 1.2);
                attributes.defense = Math.floor(attributes.defense * 1.2);
                attributes.agility = Math.floor(attributes.agility * 1.2);
            }
        }

        // 计算异常属性加成（兼容旧版本）
        if (item.info.abnormalAttrs) {
            for (const attr of item.info.abnormalAttrs) {
                switch (attr.name) {
                    case "攻击+":
                        attributes.attack += attr.value;
                        break;
                    case "防御+":
                        attributes.defense += attr.value;
                        break;
                    case "敏捷+":
                        attributes.agility += attr.value;
                        break;
                    case "士气+":
                        attributes.morale += attr.value;
                        break;
                    case "生命+":
                        attributes.health += attr.value;
                        break;
                }
            }
        }

        return attributes;
    }
}
