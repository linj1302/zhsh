import {getGoodsByName, getLevelGoods} from "./goods.js";
import Pet from "./pet.js";
import * as config from '../config/index.js';
import * as formulas from './formulas.js';

export default class Monster {
    constructor(play, city, backpack, task, petManager, followerModule, holidayModule, holymarkModule, cardModule) {
        this.play = play;
        this.city = city;
        this.backpack = backpack;
        this.task = task;
        this.petManager = petManager;
        this.followerModule = followerModule;
        this.holidayModule = holidayModule;
        this.holymark = holymarkModule;
        this.cardModule = cardModule;
        
        // BOSS 标记（id 45=船副本BOSS, 6=任务BOSS, 55=副本BOSS）
        this._isBoss = false;
        
        // 怪物基础属性
        this.name = null;
        this.level = 1;
        this.id = null;
        this.outPrice = 500;
        
        // 战斗属性
        this._health = 0;
        this.currentHealth = 0;
        this._attack = 0;
        this._maxAttack = 0;
        this._defense = 0;
        this._agility = 0;
        
        // 掉落相关
        this.goods = [];           // 装备掉落列表
        this.monsterGoods = [];    // 物品掉落列表
        this.winGoods = [];        // 胜利后实际掉落的物品
        this.winName = null;
        this.exp = 0;
        this.copper = 0;
        
        // 异常状态属性
        this.statusEffects = {
            slow: false,
            weak: false,
            curse: false,
            depressed: false,
            poison: 0,
            paralysis: false
        };

        // 抗性属性
        this.resistances = {
            slow: 0,
            weak: 0,
            curse: 0,
            depressed: 0,
            poison: 0,
            paralysis: 0
        };

        // 造成异常状态的百分比属性
        this.inflictStatusChances = {
            slow: 0,
            weak: 0,
            curse: 0,
            depressed: 0,
            poison: 0,
            paralysis: 0
        };
    }

    getRandomBetween(min, max) {
        // 强制转为数字，防止字符串拼接导致 NaN 伤害
        min = Number(min);
        max = Number(max);
        if (isNaN(min) || isNaN(max) || min > max) return min || 0;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 计算战斗伤害
     * @param {Object} attacker - 攻击者属性 {attack, maxAttack, defense, agility}
     * @param {Object} defender - 防御者属性 {attack, maxAttack, defense, agility}
     * @returns {Object} 包含伤害值和是否暴击
     */
    calculateDamage(attacker, defender) {
        const attack = this.getRandomBetween(attacker.attack, attacker.maxAttack);
        // 基础伤害公式：攻击力 * (1 - 防御减伤率)（公式集中于 src/formulas.js + config/balance.json）
        let damage = formulas.calcDamage(attack, defender.defense);

        // 敏捷影响：每 10 点敏捷差增加 1% 伤害
        const agilityDiff = attacker.agility - defender.agility;
        const agilityBonus = 1 + Math.max(-0.3, Math.min(0.3, agilityDiff / 1000));
        damage *= agilityBonus;

        // 暴击判定：15% 基础暴击率 + 每 50 点敏捷差增加 1%
        const critChance = 0.15 + Math.max(0, agilityDiff / 5000);
        const isCritical = Math.random() < critChance;

        if (isCritical) {
            damage *= 2; // 暴击伤害翻倍
        }

        // 确保最小伤害为 1（NaN 也兜底）
        damage = Math.max(1, Math.round(damage) || 0);

        return {
            damage,
            isCritical
        };
    }

    /**
     * 撤退方法
     * @returns {Object} 撤退结果
     */
    out() {
        this.name = null;
        this.play.addCopper(this.outPrice);
        return {
            tip: '撤退成功',
            page: 'tip',
        };
    }

    /**
     * 拾取掉落物品
     * @param {number} index - 物品索引
     */
    pickUp(index) {
        const good = this.winGoods.splice(index, 1)?.[0];
        if (!good) {
            return;
        }
        this.backpack.addItem(good);
    }

    /**
     * 攻击怪物
     * @param {string} name - 怪物名称
     * @param {number} level - 怪物等级
     * @returns {Object} 战斗结果
     */
    assault(name, level) {
        this.outPrice = 500;

        // 防护：无 params 的攻击请求会把 query 对象作为 name 传入（见 index.js exec 分发）。
        // 若此时无进行中的战斗（如刚击杀/撤退后刷新页面），会把对象写入 this.name 导致渲染报错，
        // 非字符串入参且无战斗时直接提示重新选择怪物。
        if (typeof name !== 'string' || !name) {
            if (!this.name) {
                return {tip: '请先选择要攻击的怪物', page: 'tip'};
            }
            name = this.name;
        }

        // 如果是新战斗，初始化怪物
        if (!this.name) {
            // 尝试从城市缓存中获取怪物
            const cachedMonsters = this.city.getMonsterCache(this.play);
            let cachedMonster = null;
            
            // 查找匹配的怪物
            if (cachedMonsters && cachedMonsters.length > 0) {
                cachedMonster = cachedMonsters.find(monster => monster.name === name);
            }

            this.name = name;
            
            // 如果从缓存中找到了怪物，使用缓存中的等级和 ID
            if (cachedMonster) {
                this.level = Math.max(1, cachedMonster.level);
                this.id = cachedMonster.id; // 保存怪物 ID，用于后续从缓存中删除
                
                // 从缓存中移除该怪物（表示已经被选中战斗）
                this.city.removeDefeatedMonster(cachedMonster.id);
            } else {
                this.level = Math.max(1, level || 1);
                this.id = null;
            }

            // 获取怪物类型并设置属性
            const monsterType = this._getMonsterType(name);
            this._monsterType = monsterType; // 保存类型用于经验/铜贝计算
            this._setMonsterStats(monsterType);

            // 使用名称查询 monsterDrops 来获取装备掉落
            this.goods = [];
            if (config.monsterDrops && config.monsterDrops[name]) {
                // 从 monsterDrops 中获取该怪物的掉落装备
                const monsterDropItems = config.monsterDrops[name];
                this.goods = monsterDropItems.map(itemName => {
                    return getGoodsByName(itemName, 1);
                });
            } else {
                // 如果在 monsterDrops 中找不到，则使用原来的等级匹配方式
                this.goods = getLevelGoods(this.level);
            }

            // 获取怪物掉落物品
            const items = config.monsterItems[name];
            if (items?.length) {
                this.monsterGoods = items.map(item => getGoodsByName(item, 1));
            } else {
                this.monsterGoods = [];
            }
            
            this.exp = formulas.calcMonsterExp(this.level, this._monsterType);
            this.copper = formulas.calcMonsterCopper(this.level, this._monsterType);
            this.winGoods = [];
            this.winName = null;

            // 重置异常状态
            this.statusEffects = {
                slow: false,
                weak: false,
                curse: false,
                depressed: false,
                poison: 0,
                paralysis: false
            };

            // 重置抗性
            this.resistances = {
                slow: 0,
                weak: 0,
                curse: 0,
                depressed: 0,
                poison: 0,
                paralysis: 0
            };

            // 重置异常状态施加概率
            this.inflictStatusChances = {
                slow: 0,
                weak: 0,
                curse: 0,
                depressed: 0,
                poison: 0,
                paralysis: 0
            };
            
            // 根据怪物类型设置异常属性和抗性
            this._setStatusPropertiesByType(monsterType);

            // 返回初始化结果，提示玩家战斗开始
            return {
                tip: `你向 ${this.name}（${this.level}级）发起了攻击！`,
                page: 'attack',
                battleLog: [`你向 ${this.name}（${this.level}级）发起了攻击！`]
            };
        }

        // 战斗日志
        const battleLog = [];

        // 将卡片加成注入玩家属性
        if (this.cardModule) {
            const cardBonuses = this.cardModule.getCardBonus();
            this.play.setCardBonus(cardBonuses);
        }
        // 队伍加成（每位队友 +5% 攻防）
        if (this.followerModule) {
            // 使用: followerModule is available but team data is separate.
            // The team/marriage data is accessed through the play setters
            // which were already set before this call in user.js or index.js script
        }

        // 处理玩家的状态效果
        const playerEffectsLog = this.play.processStatusEffects();
        if (playerEffectsLog && playerEffectsLog.length > 0) {
            battleLog.push(...playerEffectsLog);
        }

        // 检查玩家是否被麻痹
        const isPlayerParalyzed = this.play.isParalyzed();
        if (isPlayerParalyzed) {
            battleLog.push("你受到麻痹效果影响，无法行动！");
        }

        // 检查玩家诅咒效果
        const isPlayerCursed = this.play.checkCurseEffect();
        if (isPlayerCursed) {
            battleLog.push("你受到诅咒效果影响，受到了来自自身的伤害！");
        }

        // 玩家攻击怪物（如果玩家未被麻痹）
        let playerDamage = {damage: 0, isCritical: false};
        if (!isPlayerParalyzed && this.currentHealth > 0) {
            playerDamage = this.calculateDamage(this.play, this);
            this.currentHealth = Math.max(0, this.currentHealth - playerDamage.damage);

            // 根据玩家的异常状态施加概率尝试给怪物施加异常状态
            if (this.play.inflictStatusChances) {
                this.applyStatusEffectsFromAttacker(this.play.inflictStatusChances, this);
            }

            if (playerDamage.isCritical) {
                battleLog.push(`你对 ${this.name} 造成了 ${playerDamage.damage} 点暴击伤害！`);
            } else {
                battleLog.push(`你对 ${this.name} 造成了 ${playerDamage.damage} 点伤害`);
            }
        }

        // 宠物攻击怪物（如果宠物存在且怪物还活着）
        let petDamage = {damage: 0, isCritical: false};
        let petSkillResult = null;
        const fightingPet = this.petManager?.getUserPets()?.find(pet => pet.isFighting);

        if (fightingPet && this.currentHealth > 0) {
            // 创建临时宠物对象用于计算属性
            const pet = new Pet(fightingPet.name, fightingPet.type);
            Object.assign(pet, fightingPet);

            // 宠物技能发动
            petSkillResult = pet.useBattleSkill(this, battleLog);

            // 宠物攻击属性（含技能buff加成）
            let petAtk = pet.attack;
            let petMaxAtk = pet.attack;
            let petDef = pet.defense;
            let petAgi = pet.agility;

            if (petSkillResult?.bonus) {
                petAtk += (petSkillResult.bonus.attackBuff || 0);
                petDef += (petSkillResult.bonus.defenseBuff || 0);
                petAgi += (petSkillResult.bonus.agilityBuff || 0);
                // 怪物debuff：debuffAll降低怪物全属性
                if (petSkillResult.bonus.monsterDebuffAll) {
                    this._attack = Math.floor(this._attack * (1 - petSkillResult.bonus.monsterDebuffAll));
                    this._defense = Math.floor(this._defense * (1 - petSkillResult.bonus.monsterDebuffAll));
                    this._agility = Math.floor(this._agility * (1 - petSkillResult.bonus.monsterDebuffAll));
                }
                if (petSkillResult.bonus.monsterDefBreak) {
                    this._defense = Math.max(1, this._defense - petSkillResult.bonus.monsterDefBreak);
                }
            }

            // 计算宠物伤害
            petDamage = this.calculateDamage({
                attack: petAtk,
                maxAttack: petAtk,
                defense: petDef,
                agility: petAgi
            }, this);

            // 嗜血：吸血效果
            if (petSkillResult?.bonus?.healthToRestore) {
                this.play.currentHealth = Math.min(
                    this.play.health,
                    this.play.currentHealth + petSkillResult.bonus.healthToRestore
                );
                battleLog.push(`${pet.name} 用【${petSkillResult.skillName}】吸取了 ${petSkillResult.bonus.healthToRestore} 点生命！`);
            }

            this.currentHealth = Math.max(0, this.currentHealth - petDamage.damage);

            // 宠物只会造成伤害和异常状态，不会被攻击
            // 根据宠物的异常状态施加概率尝试给怪物施加异常状态
            const petInflictChances = {
                slow: 0.05,
                weak: 0.05,
                curse: 0.05,
                depressed: 0.05,
                poison: 0.05,
                paralysis: 0.05
            };
            this.applyStatusEffectsFromAttacker(petInflictChances, this);

            if (petDamage.isCritical) {
                battleLog.push(`${pet.name} 对 ${this.name} 造成了 ${petDamage.damage} 点暴击伤害！`);
            } else {
                battleLog.push(`${pet.name} 对 ${this.name} 造成了 ${petDamage.damage} 点伤害`);
            }

            // 士气 buff 加给玩家
            if (petSkillResult?.bonus?.moraleBuff) {
                this.play._morale += petSkillResult.bonus.moraleBuff;
            }

        }

        // 随从攻击怪物（如果出战随从存在且怪物还活着）
        let followerDamage = {damage: 0, isCritical: false};
        try {
            const fightingFollower = this.followerModule?.getFightingFollower?.();
            if (fightingFollower && this.currentHealth > 0) {
                const recruitId = fightingFollower.recruit_id || fightingFollower.recruitId;
                const equipStats = this.followerModule.getEquipmentStats?.(recruitId) || {};
                const followerAtk = (fightingFollower.stats?.attack || 0) + (equipStats.attack || 0);
                const followerDef = (fightingFollower.stats?.defense || 0) + (equipStats.defense || 0);
                const followerAgi = (fightingFollower.stats?.agility || 0) + (equipStats.agility || 0);

                if (followerAtk > 0) {
                    followerDamage = this.calculateDamage({
                        attack: followerAtk,
                        maxAttack: followerAtk,
                        defense: followerDef,
                        agility: followerAgi
                    }, this);

                    this.currentHealth = Math.max(0, this.currentHealth - followerDamage.damage);

                    if (followerDamage.isCritical) {
                        battleLog.push(`${fightingFollower.name} 对 ${this.name} 造成了 ${followerDamage.damage} 点暴击伤害！`);
                    } else {
                        battleLog.push(`${fightingFollower.name} 对 ${this.name} 造成了 ${followerDamage.damage} 点伤害`);
                    }
                }
            }
        } catch (e) {
            // 随从模块版本不兼容时静默降级
        }

        // 处理怪物的状态效果
        const monsterEffectsLog = this.processStatusEffects();
        if (monsterEffectsLog && monsterEffectsLog.length > 0) {
            battleLog.push(...monsterEffectsLog);
        }

        // 检查怪物是否被麻痹
        const isMonsterParalyzed = this.isParalyzed();
        if (isMonsterParalyzed) {
            battleLog.push(`${this.name} 受到麻痹效果影响，无法行动！`);
        }

        // 检查怪物诅咒效果
        const isMonsterCursed = this.checkCurseEffect();
        if (isMonsterCursed) {
            battleLog.push(`${this.name} 受到诅咒效果影响，受到了来自自身的伤害！`);
        }

        // 怪物攻击玩家（如果怪物未被麻痹且玩家还活着）
        let monsterDamage = {damage: 0, isCritical: false};
        if (!isMonsterParalyzed && this.play.currentHealth > 0 && this.currentHealth > 0) {
            monsterDamage = this.calculateDamage(this, this.play);
            this.play.currentHealth = Math.max(0, this.play.currentHealth - monsterDamage.damage);

            // 根据怪物的异常状态施加概率尝试给玩家施加异常状态
            this.applyStatusEffectsFromAttacker(this.inflictStatusChances, this.play);

            if (monsterDamage.isCritical) {
                battleLog.push(`${this.name} 对你造成了 ${monsterDamage.damage} 点暴击伤害！`);
            } else {
                battleLog.push(`${this.name} 对你造成了 ${monsterDamage.damage} 点伤害`);
            }
        }

        // 检查是否需要自动使用体力宝（放在所有攻击动作之后）
        // 只有玩家还活着时才使用体力宝
        if (this.play.currentHealth > 0) {
            const maxHealth = this.play.health;
            const currentHealth = this.play.currentHealth;
            const healthPercentage = currentHealth / maxHealth;

            // 如果体力低于 50%，尝试自动使用体力宝
            if (healthPercentage < 0.5) {
                const useResult = this.play.useStaminaItem();
                if (useResult.success) {
                    battleLog.push(useResult.tip);
                }
            }
        }

        // 战斗结果判定
        if (this.play.currentHealth <= 0) {
            const monsterName = this.name;
            this.name = null;
            this.play.currentHealth = 1;

            // 副本内战败：像正常“离开副本”一样回到该副本入口(receiveLocation)并清理副本数据，
            // 而不是被 resetCity 传回威尼斯福利院。levelTrial 依赖 city._city 仍是副本名，
            // 故必须在 resetCity 之前处理；仅非副本态才 resetCity（船副本走 sailing 路径，不在此列）。
            const inTrial = this.trial && this.trial.isInTrial && this.trial.isInTrial();
            if (inTrial) {
                this.trial.levelTrial();
            } else {
                this.city.resetCity();
            }

            // 添加丢失所有市场商品
            let lostSupplies = 0;
            const marketGoods = this.backpack.getItemsByType(11);
            marketGoods.forEach(item => {
                // 累计丢失的市场商品数量
                lostSupplies += item.num;
                // 从背包中移除所有市场商品
                while (item.num > 0) {
                    this.backpack.removeItem(item.id, item.num);
                }
            });

            // 战败并不扣除铜贝（原模板“丢失铜贝:500”为假文案）；士气损失来自“沮丧”异常状态，
            // 与 play.js morale getter 中沮丧惩罚(-5)保持一致，未沮丧则为 0。
            const moraleLoss = (this.play.statusEffects && this.play.statusEffects.depressed) ? 5 : 0;

            return {
                tip: '你被击败了',
                page: 'attack-loss',
                monsterName,
                lostSupplies,
                moraleLoss
            };
        }

        // 怪物死亡
        if (this.currentHealth <= 0) {
            this.winName = this.name;
            this.play.addExp(this.exp);
            this.play.addCopper(this.copper);
            this.name = null;

            // 从城市缓存中移除被击败的怪物
            if (this.id) {
                this.city.removeDefeatedMonster(this.id);
            }

            // 计算掉落物品
            this.winGoods = [];

            // 装备掉落：20% 概率掉落 1 个装备
            if (this.goods?.length && Math.random() < 0.2) {
                // 根据权重选择装备，低等级装备高概率，高等级装备低概率，套装装备极低概率
                const weightedEquipment = this._getWeightedEquipment(this.goods);
                if (weightedEquipment) {
                    this.winGoods.push(weightedEquipment);
                }
            }

            // 物品掉落：每个物品 40% 概率掉落
            if (this.monsterGoods?.length) {
                for (const item of this.monsterGoods) {
                    if (Math.random() < 0.4) {
                        this.winGoods.push(item);
                    }
                }
            }

            // 记录物品掉落（节日活动追踪）
            try { if (this.winGoods.length > 0 && this.holidayModule) this.holidayModule.recordItemDrop(); } catch(e) {}

            // 备份掉落清单用于播报（在自动拾取清空前）
            this._dropDisplay = this.winGoods.map(g => ({ name: g.name }));

            // 百宝箱自动拾取
            if (this.play && this.play.autoPickup && this.winGoods.length > 0) {
                const autoPicked = [];
                while (this.winGoods.length > 0) {
                    const good = this.winGoods.pop();
                    this.backpack.addItem(good);
                    autoPicked.push(good.name);
                }
                this._autoPickupNote = '百宝箱自动拾取了: ' + autoPicked.join('、');
            }

            // 宠物胜利经验结算（战斗胜利后获得：怪物经验量 × 配置比例）
            let petExpResult = null;
            try {
                const winFightingPet = this.petManager?.getUserPets()?.find(p => p.isFighting);
                if (winFightingPet && this.petManager) {
                    // 宠物经验比例从 balance.json 读取（petExp.battleGainRatio），默认为 0.5
                    const petBattleRatio = (formulas.balance.petExp && formulas.balance.petExp.battleGainRatio) || 0.5;
                    petExpResult = this.petManager.gainBattleExp(winFightingPet.id, Math.floor(this.exp * petBattleRatio));
                    if (petExpResult?.leveledUp) {
                        battleLog.push(`${winFightingPet.name} 升级到了 Lv.${petExpResult.newLevel}！`);
                    }

                    // 宠物疗伤技能：胜利后恢复主人10%最大体力
                    try {
                        const healPet = new Pet(winFightingPet.name, winFightingPet.type);
                        Object.assign(healPet, winFightingPet);
                        const healAmt = healPet.applyPostBattleHeal(this.play);
                        if (healAmt > 0) {
                            battleLog.push(`${winFightingPet.name} 使用【疗伤】恢复了玩家 ${healAmt} 点体力！`);
                        }
                    } catch(e) {}
                }
            } catch(e) {}

            // 随从胜利经验结算（战斗胜利后获得：怪物经验量 × 配置比例，默认0.3）
            let followerExpResult = null;
            try {
                const fightingFollower = this.followerModule?.getFightingFollower?.();
                if (fightingFollower && this.followerModule) {
                    const recruitId = fightingFollower.recruit_id || fightingFollower.recruitId;
                    const followerGainRatio = (formulas.balance.followerExp && formulas.balance.followerExp.battleGainRatio) || 0.3;
                    const followerExpAmount = Math.floor(this.exp * followerGainRatio);
                    followerExpResult = this.followerModule.addExp(recruitId, followerExpAmount);
                    if (followerExpResult?.leveled) {
                        battleLog.push(`${fightingFollower.name} 升级到了 ${followerExpResult.newLevel} 级！`);
                    }
                }
            } catch(e) {
                // 随从模块版本不兼容时静默降级
            }

            // 圣痕掉落检查
            let holyMarkDropResult = null;
            try {
                const holyModule = this.holymark;
                if (holyModule) {
                    // 20% 概率掉落圣痕（击杀 Boss 类怪物提升至 35%）
                    const dropChance = this._isBoss ? 0.35 : 0.20;
                    if (Math.random() < dropChance) {
                        holyMarkDropResult = holyModule.collectRandom(this._isBoss);
                        if (holyMarkDropResult?.success) {
                            battleLog.push('✨ 获得了圣痕：' + holyMarkDropResult.tip);
                        }
                    }
                }
            } catch(e) { console.error('圣痕掉落失败:', e); }

            // 卡片掉落检查
            let cardDropResult = null;
            try {
                if (this.cardModule) {
                    // 普通怪物 10% 概率，Boss 25%
                    const cardDropChance = this._isBoss ? 0.25 : 0.10;
                    if (Math.random() < cardDropChance) {
                        cardDropResult = this.cardModule.collectRandom(this._isBoss);
                        if (cardDropResult?.success) {
                            battleLog.push('🃏 获得卡片：' + cardDropResult.tip);
                        }
                    }
                }
            } catch(e) { console.error('卡片掉落失败:', e); }

            // 记录击杀怪物（用于任务系统）
            this.task.recordKill(this.winName);
            // 副本目标进度：若玩家处于副本内，递增对应“打怪”目标（trialData.targets.current）
            try { if (this.trial && this.trial._recordMonsterKill) this.trial._recordMonsterKill(this.winName); } catch (e) { console.error('副本击杀记录失败:', e); }
            // 记录节日活动击杀
            try { if (this.holidayModule) { this.holidayModule.recordMonsterKill(this.isTeam); this.holidayModule.recordBattle(true, this.isTeam); } } catch(e) {}

            return {
                page: 'attack-win',
                battleLog: battleLog,
                winGoods: this.winGoods,
                petExpResult: petExpResult,
                followerExpResult: followerExpResult,
                cardDropResult: cardDropResult,
                holyMarkDropResult: holyMarkDropResult
            };
        }

        // 节日活动记录战斗（未击杀回合）
        try { if (this.holidayModule) this.holidayModule.recordBattle(false, this.isTeam); } catch(e) {}

        // 返回战斗日志和伤害统计
        return {
            page: 'attack',
            battleLog: battleLog,
            playerDamage: playerDamage.damage,
            petDamage: petDamage.damage,
            petSkillResult: petSkillResult,
            followerDamage: followerDamage.damage,
            monsterDamage: monsterDamage.damage
        };
    }

    /**
     * 获取怪物类型
     * @param {string} name - 怪物名称
     * @returns {number} 怪物类型
     */
    _getMonsterType(name) {
        const {shipNpc, monsters, fbNpc} = config;
        const city = this.city._city;
        const position = this.city._position;

        // 检查是否是船副本怪物
        if (shipNpc[city] && shipNpc[city][position]) {
            const shipMonster = shipNpc[city][position].find(monster => monster.name === name);
            if (shipMonster) {
                return shipMonster.type;
            }
        }

        // 检查是否是副本怪物
        if (fbNpc[city] && fbNpc[city][position]) {
            const fbMonster = fbNpc[city][position].find(monster => monster.name === name);
            if (fbMonster) {
                return fbMonster.type;
            }
        }

        // 检查是否是普通怪物
        if (monsters[city] && monsters[city][position]) {
            const normalMonster = monsters[city][position].find(monster => monster.name === name);
            if (normalMonster) {
                return normalMonster.type;
            }
        }

        // 默认返回普通怪物类型
        return 5;
    }

    /**
     * 根据怪物类型设置属性
     * 属性从小到大是 5 < 40 < 50 < 45 < 6 < 55
     * @param {number} type - 怪物类型
     */
    _setMonsterStats(type) {
        // 检查是否是植物 (3) 或矿物 (4) 类型怪物
        if (type === 3 || type === 4) {
            // 固定攻击力为 1
            this._attack = 1;
            this._maxAttack = 1;
            
            // 固定防御力为 10000
            this._defense = 10000;
            
            // 血量在 200-500 之间，根据等级线性增长
            const minHealth = 200;
            const maxHealth = 500;
            const minLevel = 1;
            const maxLevel = 210;
            
            // 计算血量，等级越高血量越高
            this.health = Math.floor(minHealth + (maxHealth - minHealth) * (this.level - minLevel) / (maxLevel - minLevel));
            this.currentHealth = this.health;
            
            // 敏捷度设为 1
            this.agility = 1;
            return;
        }

        // 基础属性值
        let baseHealth = 50;
        let baseAttack = 8;
        let baseMaxAttack = 12;
        let baseDefense = 8;
        let baseAgility = 5;

        // 增量值（每级增加）
        let healthIncrement = 20;
        let attackIncrement = 4;
        let maxAttackIncrement = 6;
        let defenseIncrement = 3;
        let agilityIncrement = 2;

        // 根据怪物类型调整属性倍数
        let multiplier = 1.0;
        switch (type) {
            case 40: // 船副本怪物
                multiplier = 1.5;
                break;
            case 50: // 副本怪
                multiplier = 2.0;
                break;
            case 45: // 船副本 boss
                multiplier = 2.5;
                break;
            case 6: // 任务 boss
                multiplier = 3.0;
                break;
            case 55: // 副本 boss
                multiplier = 3.5;
                break;
            case 5: // 普通怪物
            default:
                multiplier = 1.0;
                break;
        }

        // BOSS 类怪物（45, 6, 55）血量额外乘以 5
        let healthMultiplier = multiplier;
        if ([45, 6, 55].includes(type)) {
            healthMultiplier = multiplier * 5;
            this._isBoss = true;
        }

        // 应用倍数调整基础值
        baseHealth *= healthMultiplier;
        baseAttack *= multiplier;
        baseMaxAttack *= multiplier;
        baseDefense *= multiplier;
        baseAgility *= multiplier;

        // 应用倍数调整增量值
        healthIncrement *= healthMultiplier;
        attackIncrement *= multiplier;
        maxAttackIncrement *= multiplier;
        defenseIncrement *= multiplier;
        agilityIncrement *= multiplier;

        // 计算最终属性
        this._health = this._calculateStat(baseHealth, healthIncrement);
        this.currentHealth = this.health;
        this._attack = this._calculateStat(baseAttack, attackIncrement);
        this._maxAttack = this._calculateStat(baseMaxAttack, maxAttackIncrement);
        this._defense = this._calculateStat(baseDefense, defenseIncrement);
        this._agility = this._calculateStat(baseAgility, agilityIncrement);
    }
    
    /**
     * 根据怪物类型设置异常属性和抗性
     * @param {number} type - 怪物类型
     */
    _setStatusPropertiesByType(type) {
        // 检查是否是植物 (3) 或矿物 (4) 类型怪物
        if (type === 3 || type === 4) {
            // 植物和矿物类型怪物：高抗性，0 异常
            this._setHighResistanceLowInfliction();
            return;
        }
        
        // 根据怪物类型设置异常属性和抗性
        if ([5, 40, 50].includes(type)) {
            // 普通怪：两种属性都偏低
            this._setLowResistanceAndInfliction(type);
        } else if ([6, 45, 55].includes(type)) {
            // BOSS：两种属性都高
            this._setHighResistanceAndInfliction(type);
        }
    }
    
    /**
     * 设置高抗性低异常属性（植物和矿物类型）
     */
    _setHighResistanceLowInfliction() {
        // 高抗性，范围在 0-80% 之间，每个有高有低
        this.resistances.slow = parseFloat(this._getRandomHighValue(0.4, 0.8).toFixed(4));
        this.resistances.weak = parseFloat(this._getRandomHighValue(0.3, 0.8).toFixed(4));
        this.resistances.curse = parseFloat(this._getRandomHighValue(0.5, 0.8).toFixed(4));
        this.resistances.depressed = parseFloat(this._getRandomHighValue(0.4, 0.8).toFixed(4));
        this.resistances.poison = parseFloat(this._getRandomHighValue(0.6, 0.8).toFixed(4));
        this.resistances.paralysis = parseFloat(this._getRandomHighValue(0.5, 0.8).toFixed(4));
        
        // 0 异常属性
        this.inflictStatusChances.slow = 0;
        this.inflictStatusChances.weak = 0;
        this.inflictStatusChances.curse = 0;
        this.inflictStatusChances.depressed = 0;
        this.inflictStatusChances.poison = 0;
        this.inflictStatusChances.paralysis = 0;
    }
    
    /**
     * 设置低抗性和低异常属性（普通怪物）
     * @param {number} type - 怪物类型
     */
    _setLowResistanceAndInfliction(type) {
        // 抗性设置：5 < 40 < 50，范围在 0-40% 之间
        let minValue = 0; let maxValue = 0.4;
        if (type === 5) {
            minValue = 0;
            maxValue = 0.2;
        } else if (type === 40) {
            minValue = 0.1;
            maxValue = 0.3;
        } else if (type === 50) {
            minValue = 0.2;
            maxValue = 0.4;
        }
        
        this.resistances.slow = parseFloat(this._getRandomValueByLevel(minValue, maxValue).toFixed(4));
        this.resistances.weak = parseFloat(this._getRandomValueByLevel(minValue, maxValue).toFixed(4));
        this.resistances.curse = parseFloat(this._getRandomValueByLevel(minValue, maxValue).toFixed(4));
        this.resistances.depressed = parseFloat(this._getRandomValueByLevel(minValue, maxValue).toFixed(4));
        this.resistances.poison = parseFloat(this._getRandomValueByLevel(minValue, maxValue).toFixed(4));
        this.resistances.paralysis = parseFloat(this._getRandomValueByLevel(minValue, maxValue).toFixed(4));
        
        // 异常属性设置：范围在 0-40% 之间
        this.inflictStatusChances.slow = parseFloat(this._getRandomValueByLevel(0, 0.4).toFixed(4));
        this.inflictStatusChances.weak = parseFloat(this._getRandomValueByLevel(0, 0.4).toFixed(4));
        this.inflictStatusChances.curse = parseFloat(this._getRandomValueByLevel(0, 0.4).toFixed(4));
        this.inflictStatusChances.depressed = parseFloat(this._getRandomValueByLevel(0, 0.4).toFixed(4));
        this.inflictStatusChances.poison = parseFloat(this._getRandomValueByLevel(0, 0.4).toFixed(4));
        this.inflictStatusChances.paralysis = parseFloat(this._getRandomValueByLevel(0, 0.4).toFixed(4));
    }
    
    /**
     * 设置高抗性和高异常属性（BOSS）
     * @param {number} type - 怪物类型
     */
    _setHighResistanceAndInfliction(type) {
        // 抗性设置：6 < 45 < 55，范围在 0-80% 之间
        let minResist = 0; let maxResist = 0.8;
        if (type === 6) {
            minResist = 0;
            maxResist = 0.5;
        } else if (type === 45) {
            minResist = 0.2;
            maxResist = 0.7;
        } else if (type === 55) {
            minResist = 0.4;
            maxResist = 0.8;
        }
        
        this.resistances.slow = parseFloat(this._getRandomValueByLevel(minResist, maxResist).toFixed(4));
        this.resistances.weak = parseFloat(this._getRandomValueByLevel(minResist, maxResist).toFixed(4));
        this.resistances.curse = parseFloat(this._getRandomValueByLevel(minResist, maxResist).toFixed(4));
        this.resistances.depressed = parseFloat(this._getRandomValueByLevel(minResist, maxResist).toFixed(4));
        this.resistances.poison = parseFloat(this._getRandomValueByLevel(minResist, maxResist).toFixed(4));
        this.resistances.paralysis = parseFloat(this._getRandomValueByLevel(minResist, maxResist).toFixed(4));
        
        // 异常属性设置：范围在 0-80% 之间，BOSS 最高 80%，其他怪物最高 40%
        let minInflict = 0, maxInflict = 0.8;
        if (type === 6) {
            minInflict = 0;
            maxInflict = 0.5;
        } else if (type === 45) {
            minInflict = 0.2;
            maxInflict = 0.7;
        } else if (type === 55) {
            minInflict = 0.4;
            maxInflict = 0.8;
        }
        
        this.inflictStatusChances.slow = parseFloat(this._getRandomValueByLevel(minInflict, maxInflict).toFixed(4));
        this.inflictStatusChances.weak = parseFloat(this._getRandomValueByLevel(minInflict, maxInflict).toFixed(4));
        this.inflictStatusChances.curse = parseFloat(this._getRandomValueByLevel(minInflict, maxInflict).toFixed(4));
        this.inflictStatusChances.depressed = parseFloat(this._getRandomValueByLevel(minInflict, maxInflict).toFixed(4));
        this.inflictStatusChances.poison = parseFloat(this._getRandomValueByLevel(minInflict, maxInflict).toFixed(4));
        this.inflictStatusChances.paralysis = parseFloat(this._getRandomValueByLevel(minInflict, maxInflict).toFixed(4));
    }
    
    /**
     * 根据等级获取随机值，等级越高值越高
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 随机值
     */
    _getRandomValueByLevel(min, max) {
        // 根据等级计算比例，等级 1-210 映射到 0-1
        const levelRatio = (this.level - 1) / 209;
        // 基础值为最小值，随着等级提升逐渐增加
        const baseValue = min;
        // 等级加成部分，随着等级提升逐渐接近最大值
        const levelBonus = (max - min) * levelRatio;
        // 最终值在 min 和 max 之间，且随等级递增
        let value = baseValue + levelBonus;
        // 添加一些随机性，但不偏离等级趋势
        value += (Math.random() - 0.5) * (max - min) * 0.2;
        // 确保值在范围内
        return Math.max(min, Math.min(max, value));
    }
    
    /**
     * 获取高随机值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 随机值
     */
    _getRandomHighValue(min, max) {
        // 根据等级计算比例，等级 1-210 映射到 0-1
        const levelRatio = (this.level - 1) / 209;
        // 基础值为最小值，随着等级提升逐渐增加
        const baseValue = min;
        // 等级加成部分，随着等级提升逐渐接近最大值
        const levelBonus = (max - min) * levelRatio;
        // 最终值在 min 和 max 之间，且随等级递增
        let value = baseValue + levelBonus;
        // 添加一些随机性，但整体偏高
        value += Math.random() * (max - min) * 0.3;
        // 确保值在范围内
        return Math.max(min, Math.min(max, value));
    }

    _calculateStat(base, increment) {
        // 怪物属性成长（含 ±10% 随机抖动，公式集中于 src/formulas.js + config/balance.json）
        return formulas.monsterStat(base, increment, this.level);
    }

    _getWeightedEquipment(equipmentList) {
        if (!equipmentList || equipmentList.length === 0) {
            return null;
        }

        // 创建带权重的装备列表
        const weightedEquipments = equipmentList.map(item => {
            // 获取装备实际信息
            let equipmentInfo = null;
            let itemName = null;
            
            // 判断 item 是字符串还是对象
            if (typeof item === 'string') {
                itemName = item;
                // 从 config.equipment 中获取装备信息
                equipmentInfo = config.equipment[itemName];
            } else if (item && typeof item === 'object') {
                itemName = item.name;
                equipmentInfo = item.info || config.equipment[itemName];
            }

            // 如果是套装装备（以 + 开头或者在 sets 配置中），设置极低权重
            if (itemName && (itemName.startsWith('+') || this._isSetEquipment(itemName))) {
                return {
                    item: item,
                    weight: 1  // 极低权重，确保套装装备稀有性
                };
            }

            // 根据装备等级设置权重，实现 70% 低级装备，29% 高级装备的分布
            let weight = 70; // 默认权重（低级装备）
            if (equipmentInfo && equipmentInfo.level) {
                const level = equipmentInfo.level;
                // 根据等级调整权重，使高级装备有较低但合理的权重
                // 1-30 级装备保持高权重 (70)
                // 31-100 级装备权重逐渐降低到约 30
                // 101-210 级装备权重逐渐降低到 29（不低于 29）
                if (level > 30 && level <= 100) {
                    // 31-100 级装备权重从 70 逐渐降低到 30
                    weight = Math.max(30, 70 - Math.floor((level - 30) * (40 / 70)));
                } else if (level > 100) {
                    // 101-210 级装备权重从 30 逐渐降低到 29
                    weight = Math.max(29, 30 - Math.floor((level - 100) * (1 / 110)));
                }
            }

            return {
                item: item,
                weight: weight
            };
        });

        // 计算总权重
        const totalWeight = weightedEquipments.reduce((sum, equip) => sum + equip.weight, 0);

        // 根据权重随机选择装备
        let random = Math.random() * totalWeight;
        for (const equip of weightedEquipments) {
            random -= equip.weight;
            if (random <= 0) {
                // 如果 item 是字符串，需要转换为 Goods 对象
                if (typeof equip.item === 'string') {
                    return getGoodsByName(equip.item, 1);
                }
                return equip.item;
            }
        }

        // 如果没有选中任何装备，则返回列表中的第一个
        const firstItem = equipmentList[0];
        if (typeof firstItem === 'string') {
            return getGoodsByName(firstItem, 1);
        }
        return firstItem;
    }

    _isSetEquipment(itemName) {
        // 检查装备是否属于套装
        for (const setName in config.sets) {
            const set = config.sets[setName];
            if (set.items && set.items.includes(itemName)) {
                return true;
            }
        }
        return false;
    }

    // 获取考虑异常状态的生命值
    get health() {
        return this._health;
    }

    set health(value) {
        this._health = value;
    }

    // 获取考虑异常状态的敏捷值
    get agility() {
        let agility = this._agility;

        // 缓慢状态减少 10% 敏捷
        if (this.statusEffects.slow) {
            agility = Math.floor(agility * 0.9);
        }

        return agility;
    }

    set agility(value) {
        this._agility = value;
    }

    // 获取考虑异常状态的攻击力
    get attack() {
        let attack = this._attack;

        // 虚弱状态减少 10% 攻击力
        if (this.statusEffects.weak) {
            attack = Math.floor(attack * 0.9);
        }

        return attack;
    }

    set attack(value) {
        this._attack = value;
    }

    // 获取考虑异常状态的最大攻击力
    get maxAttack() {
        let maxAttack = this._maxAttack;

        // 虚弱状态减少 10% 最大攻击力
        if (this.statusEffects.weak) {
            maxAttack = Math.floor(maxAttack * 0.9);
        }

        return maxAttack;
    }

    set maxAttack(value) {
        this._maxAttack = value;
    }

    // 获取考虑异常状态的防御力
    get defense() {
        let defense = this._defense;

        // 沮丧状态减少 10% 防御力
        if (this.statusEffects.depressed) {
            defense = Math.floor(defense * 0.9);
        }

        return defense;
    }

    set defense(value) {
        this._defense = value;
    }

    // 应用异常状态的方法
    applyStatusEffect(effectName, target) {
        switch (effectName) {
            case 'slow':
                if (Math.random() > target.resistances.slow) {
                    target.statusEffects.slow = true;
                    return true;
                }
                break;
            case 'weak':
                if (Math.random() > target.resistances.weak) {
                    target.statusEffects.weak = true;
                    return true;
                }
                break;
            case 'curse':
                if (Math.random() > target.resistances.curse) {
                    target.statusEffects.curse = true;
                    return true;
                }
                break;
            case 'depressed':
                if (Math.random() > target.resistances.depressed) {
                    target.statusEffects.depressed = true;
                    return true;
                }
                break;
            case 'poison':
                if (Math.random() > target.resistances.poison) {
                    target.statusEffects.poison = 3; // 持续 3 回合
                    return true;
                }
                break;
            case 'paralysis':
                if (Math.random() > target.resistances.paralysis) {
                    target.statusEffects.paralysis = true;
                    return true;
                }
                break;
        }
        return false;
    }

    // 根据攻击者的异常状态施加概率给目标施加异常状态
    applyStatusEffectsFromAttacker(attackerChances, target) {
        const appliedEffects = [];
        Object.keys(attackerChances).forEach(status => {
            if (attackerChances[status] > 0 && Math.random() < attackerChances[status]) {
                const applied = this.applyStatusEffect(status, target);
                if (applied) {
                    appliedEffects.push(status);
                }
            }
        });

        return appliedEffects;
    }

    // 处理每回合的状态效果
    processStatusEffects() {
        const effectsLog = [];

        // 处理中毒状态
        if (this.statusEffects.poison > 0) {
            const poisonDamage = Math.floor(this.health * 0.1);
            this.currentHealth = Math.max(0, this.currentHealth - poisonDamage);
            effectsLog.push(`${this.name} 受到中毒效果影响，损失了 10% 当前生命值`);
            this.statusEffects.poison--;

            if (this.statusEffects.poison === 0) {
                effectsLog.push(`${this.name} 的中毒状态已解除`);
            }
        }

        // 清除临时麻痹状态
        if (this.statusEffects.paralysis) {
            this.statusEffects.paralysis = false;
            effectsLog.push(`${this.name} 的麻痹状态已解除`);
        }

        return effectsLog;
    }

    // 检查是否被麻痹
    isParalyzed() {
        if (this.statusEffects.paralysis) {
            // 50% 概率无法行动
            return Math.random() < 0.5;
        }
        return false;
    }

    // 检查诅咒效果
    checkCurseEffect() {
        if (this.statusEffects.curse) {
            // 10% 概率对自己造成 5% 最大 HP 的伤害
            if (Math.random() < 0.1) {
                const curseDamage = Math.floor(this.health * 0.05);
                this.currentHealth = Math.max(0, this.currentHealth - curseDamage);
                return true;
            }
        }
        return false;
    }

    getStatus() {
        return {
            winGoods: this.winGoods,
            goods: this.goods,
            winName: this.winName,
            exp: this.exp,
            copper: this.copper,
            level: this.level,
            name: this.name,
            currentHealth: this.currentHealth,
            health: this.health,
            attack: this.attack,
            maxAttack: this.maxAttack,
            defense: this.defense,
            agility: this.agility,
            statusEffects: this.statusEffects,
            resistances: this.resistances,
            inflictStatusChances: this.inflictStatusChances,
            _dropDisplay: this._dropDisplay,
            _autoPickupNote: this._autoPickupNote
        };
    }
}

