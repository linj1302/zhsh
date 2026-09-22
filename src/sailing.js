import * as turf from '@turf/turf';
import {
    lngLat,
    ship as shipConfig,
    shipFb,
    sailingTips,
    shipMap,
    shipFbTips,
    sailingEncounters,
    sailingSpecialEvents
} from '../config/index.js';
import {getGoodsByName} from './goods.js';

export default class Sailing {
    constructor(play, city) {
        this.play = play;
        this.city = city;
        this.sailingState = null; // 航行状态
        this.showEncounterButton = false; // 特殊地点入口按钮显示状态
        this.encounterLocation = null; // 遇到的特殊地点信息
    }

    // 检查玩家是否在航行副本中（潜水副本、船副本等）
    isInSailingFb() {
        return shipMap.hasOwnProperty(this.city._city);
    }

    // 检查玩家是否拥有船只
    hasShip() {
        const backpackItems = this.play.backpack.getStatus().items;
        return backpackItems.some(item => item.type === 12);
    }

    // 获取船只信息
    getShipInfo() {
        const backpackItems = this.play.backpack.getStatus().items;
        const shipItem = backpackItems.find(item => item.type === 12);
        return shipItem;
    }

    // 计算两点间距离（海里）
    calculateDistance(fromCity, toCity) {
        const fromCoords = lngLat[fromCity];
        const toCoords = lngLat[toCity.replace('(PK)', '')];

        if (!fromCoords || !toCoords) {
            throw new Error(`无法找到城市${toCity}坐标`);
        }

        const [fromLng, fromLat] = fromCoords.split(',').map(Number);
        const [toLng, toLat] = toCoords.split(',').map(Number);

        const fromPoint = turf.point([fromLng, fromLat]);
        const toPoint = turf.point([toLng, toLat]);

        // 计算距离（单位：公里）
        const distanceKm = turf.distance(fromPoint, toPoint, {units: 'kilometers'});

        // 转换为海里（1海里 = 1.852公里）
        return Math.round(distanceKm / 1.852);
    }

    // 开始航行
    startSailing(toCity) {
        const currentCity = this.city.getStatus().city;

        if (currentCity === toCity) {
            throw new Error('不能在同一个城市间航行');
        }

        if (!this.hasShip()) {
            throw new Error('背包中没有船只，无法出航');
        }

        const ship = this.getShipInfo();
        const distance = this.calculateDistance(currentCity, toCity);

        this.sailingState = {
            from: currentCity,
            to: toCity,
            totalDistance: distance,
            remainingDistance: distance,
            ship: ship,
            speed: this.getShipSpeed(ship),
            hasReturned: false, // 添加返航标记
            isAutoSailing: false // 添加自动航行标记
        };

        return this.sailingState;
    }

    // 检查是否遇到特殊地点
    checkEncounterPoint(fromCity, toCity) {
        // 重置状态
        this.showEncounterButton = false;
        this.encounterLocation = null;

        // 遍历所有配置的特殊地点
        for (const encounter of sailingEncounters.encounters) {
            const route = encounter.route;
            // 检查航线是否匹配（正向或反向）
            if ((route[0] === fromCity && route[1] === toCity) ||
                (route[0] === toCity && route[1] === fromCity)) {
                // 根据配置的概率判断是否遇到特殊地点
                if (Math.random() < encounter.probability) {
                    this.showEncounterButton = true;
                    this.encounterLocation = encounter;
                    break;
                }
            }
        }
    }

    // 获取船只速度
    getShipSpeed(ship) {
        // 从ship.json配置中获取船只速度
        for (const city in shipConfig) {
            const ships = shipConfig[city];
            if (Array.isArray(ships)) {
                const foundShip = ships.find(s => s.name === ship.name);
                if (foundShip) {
                    return parseInt(foundShip.consumption) || 50;
                }
            }
        }
        // 默认速度
        return 50;
    }

    //潜水
    diving() {
        this.sailFb = null
        // 5%概率遇到潜水副本
        if (Math.random() < 0.05) {
            const encounter = this.getEncounter('潜水副本');
            console.log(encounter)
            if (encounter) {
                this.sailFb = encounter.name
                return {
                    type: 'encounter',
                    encounterType: '潜水副本',
                    name: encounter.name,
                    tip: encounter.tip
                };
            }
        }
        // 普通潜水逻辑可以在这里添加
        return {type: 'normal'};
    }

    // 获取可遇到的副本
    getAvailableDungeons(dungeonType) {
        const playLevel = this.play.level;
        const allDungeons = shipFb[dungeonType];

        // 根据玩家等级确定可选副本数量
        let maxDungeons = 0;
        if (playLevel >= 160) {
            maxDungeons = Object.keys(allDungeons).length; // 所有副本
        } else if (playLevel >= 140) {
            maxDungeons = 16;
        } else if (playLevel >= 120) {
            maxDungeons = 14;
        } else if (playLevel >= 100) {
            maxDungeons = 12;
        } else if (playLevel >= 80) {
            maxDungeons = 10;
        } else if (playLevel >= 60) {
            maxDungeons = 8;
        } else if (playLevel >= 40) {
            maxDungeons = 6;
        } else if (playLevel >= 20) {
            maxDungeons = 4;
        } else {
            maxDungeons = 2;
        }

        // 取前maxDungeons个副本
        const dungeonNames = Object.keys(allDungeons);
        return dungeonNames.slice(0, maxDungeons);
    }

    // 获取遇到的副本
    getEncounter(dungeonType) {
        const availableDungeons = this.getAvailableDungeons(dungeonType);
        if (availableDungeons.length === 0) {
            return null;
        }

        // 随机选择一个副本
        const randomIndex = Math.floor(Math.random() * availableDungeons.length);
        const dungeonName = availableDungeons[randomIndex];

        // 获取副本对应的提示
        const tip = shipFbTips[dungeonType][dungeonName];

        return {
            name: dungeonName,
            tip: tip
        };
    }

    // 检查特殊事件
    checkSpecialEvent() {
        // 整体特殊事件触发概率为5%
        if (Math.random() >= 0.05) {
            return null;
        }

        // 构建带权重的事件列表
        const weightedEvents = [];
        let totalWeight = 0;

        // 遍历所有特殊事件，计算权重
        for (const event of sailingSpecialEvents.events) {
            // 根据基础概率和玩家幸运值计算实际概率
            let actualProbability = event.probability;

            // 根据幸运值调整概率
            if (event.luckFactor !== 0) {
                // 幸运值影响概率:
                // 0-59: 非常不幸，负面事件概率增加50%，正面事件概率减少50%
                // 60-79: 正常，按原概率
                // 80-100: 幸运，负面事件概率减少50%，正面事件概率增加50%
                if (this.play.luck < 60) {
                    // 非常不幸
                    if (event.luckFactor < 0) {
                        // 负面事件，增加概率
                        actualProbability = event.probability * 1.5;
                    } else if (event.luckFactor > 0) {
                        // 正面事件，减少概率
                        actualProbability = event.probability * 0.5;
                    }
                } else if (this.play.luck >= 80) {
                    // 幸运
                    if (event.luckFactor < 0) {
                        // 负面事件，减少概率
                        actualProbability = event.probability * 0.5;
                    } else if (event.luckFactor > 0) {
                        // 正面事件，增加概率
                        actualProbability = event.probability * 1.5;
                    }
                }
                // 60-79区间保持原概率不变
            }

            // 对于装备奖励事件，检查背包中是否有足够的市场商品
            if (event.effect.type === 'equipmentReward') {
                // 计算背包中市场商品的总数量
                let marketItemCount = 0;
                const marketItems = this.play.backpack.getItemsByType(11);
                marketItems.forEach(item => {
                    marketItemCount += item.num;
                });

                // 只有当市场商品数量大于99时才将装备奖励事件加入权重列表
                if (marketItemCount > 99) {
                    weightedEvents.push({event, weight: actualProbability});
                    totalWeight += actualProbability;
                }
            } else {
                // 非装备奖励事件直接加入权重列表
                weightedEvents.push({event, weight: actualProbability});
                totalWeight += actualProbability;
            }
        }

        // 如果没有符合条件的事件，则不触发特殊事件
        if (weightedEvents.length === 0 || totalWeight <= 0) {
            return null;
        }

        // 根据权重随机选择一个事件
        let randomValue = Math.random() * totalWeight;
        for (const {event, weight} of weightedEvents) {
            randomValue -= weight;
            if (randomValue <= 0) {
                return this.handleSpecialEvent(event);
            }
        }

        return null;
    }

    // 处理特殊事件
    handleSpecialEvent(event) {
        switch (event.effect.type) {
            case 'morale':
                // 增加士气
                this.play.addMorale(event.effect.value);
                return {
                    type: 'specialEvent',
                    eventType: 'morale',
                    name: event.name,
                    tip: event.tip
                };

            case 'marketLoss':
                // 市场商品损失
                return this.handleMarketLossEvent(event);

            case 'speedBoost':
                // 提升航行速度
                if (this.sailingState) {
                    this.sailingState.speed += event.effect.value;
                }
                return {
                    type: 'specialEvent',
                    eventType: 'speedBoost',
                    name: event.name,
                    tip: event.tip
                };

            case 'treasure':
                // 发现宝藏
                return this.handleTreasureEvent(event);

            case 'pirateAttack':
                // 海盗袭击
                return this.handlePirateAttackEvent(event);

            case 'luckBoost':
                // 幸运值提升
                this.play.addLuck(event.effect.value);
                return {
                    type: 'specialEvent',
                    eventType: 'luckBoost',
                    name: event.name,
                    tip: event.tip
                };

            case 'moraleLoss':
                // 士气值减少
                this.play.addMorale(-event.effect.value);
                return {
                    type: 'specialEvent',
                    eventType: 'moraleLoss',
                    name: event.name,
                    tip: event.tip
                };

            case 'distanceBoost':
                // 距离推进
                if (this.sailingState) {
                    const distanceReduction = Math.floor(this.sailingState.remainingDistance * event.effect.value);
                    this.sailingState.remainingDistance = Math.max(0, this.sailingState.remainingDistance - distanceReduction);
                }
                return {
                    type: 'specialEvent',
                    eventType: 'distanceBoost',
                    name: event.name,
                    tip: event.tip
                };

            case 'shipDamage':
                // 船体损坏，需要修理费
                this.play.addCopper(-event.effect.repairCost);
                return {
                    type: 'specialEvent',
                    eventType: 'shipDamage',
                    name: event.name,
                    tip: event.tip + `你花费了${event.effect.repairCost}铜贝进行修理。`
                };

            case 'expGain':
                // 获得经验
                this.play.addExp(event.effect.value);
                return {
                    type: 'specialEvent',
                    eventType: 'expGain',
                    name: event.name,
                    tip: event.tip + `你获得了${event.effect.value}点经验。`
                };

            case 'timeLoss':
                // 时间损失，航行速度降低
                if (this.sailingState) {
                    this.sailingState.speed = Math.max(1, this.sailingState.speed - event.effect.value);
                }
                return {
                    type: 'specialEvent',
                    eventType: 'timeLoss',
                    name: event.name,
                    tip: event.tip
                };

            case 'equipmentReward':
                // 装备奖励
                return this.handleEquipmentRewardEvent(event);

            default:
                return null;
        }
    }

    // 处理市场损失事件
    handleMarketLossEvent(event) {
        // 计算基础损失率
        const lossRate = event.effect.minLoss + Math.random() * (event.effect.maxLoss - event.effect.minLoss);

        // 检查是否有猫或者老鼠药可以减少损失
        let reduction = 0;
        let reductionTip = "";

        // 检查是否有猫（减少40%损失）
        if (this.play.backpack.hasItem("猫", 1)) {
            reduction += 0.4;
            reductionTip += "你养的猫帮助减少了一些损失。";
        }

        // 检查是否有老鼠药（减少20%损失，消耗1个）
        if (this.play.backpack.hasItem("老鼠药", 1)) {
            reduction += 0.2;
            // 消耗1个老鼠药
            this.play.backpack.removeItemByName("老鼠药");
            if (reductionTip) {
                reductionTip += "老鼠药也起到了一定作用。";
            } else {
                reductionTip += "你使用了老鼠药减少了一些损失。";
            }
        }

        // 应用损失减少
        const finalLossRate = Math.max(0, lossRate * (1 - reduction));

        // 实际损失市场商品
        let lostSupplies = 0;
        const marketGoods = this.play.backpack.getItemsByType(11);
        marketGoods.forEach(item => {
            // 计算需要丢失的数量
            const loseCount = Math.floor(item.num * finalLossRate);
            if (loseCount > 0) {
                // 累计丢失的市场商品数量
                lostSupplies += loseCount;
                // 从背包中移除指定数量的市场商品
                this.play.backpack.removeItem(item.id, loseCount);
            }
        });

        const tip = event.tip + (reductionTip ? " " + reductionTip : "") + `最终损失了${lostSupplies}个市场商品。`;

        return {
            type: 'specialEvent',
            eventType: 'marketLoss',
            name: event.name,
            tip: tip,
            lostSupplies: lostSupplies
        };
    }

    // 处理宝藏事件
    handleTreasureEvent(event) {
        let treasureTip = event.tip + " ";
        let totalCopper = 0;

        // 处理宝藏中的物品
        for (const item of event.effect.items) {
            if (item.name === "铜贝") {
                // 随机获得一定数量的铜贝
                const amount = Math.floor(Math.random() * (item.max - item.min + 1)) + item.min;
                this.play.addCopper(amount);
                totalCopper += amount;
            }
            // 可以添加更多物品类型处理
        }

        treasureTip += `你获得了${totalCopper}铜贝！`;

        return {
            type: 'specialEvent',
            eventType: 'treasure',
            name: event.name,
            tip: treasureTip
        };
    }

    // 处理海盗袭击事件
    handlePirateAttackEvent(event) {
        // 损失一定比例的铜贝
        const lossAmount = Math.floor(this.play.copper * event.effect.lossPercent);
        this.play.addCopper(-lossAmount);

        // 查是否有市场商品可以损失
        let lostSupplies = 0;
        const marketGoods = this.play.backpack.getItemsByType(11);
        if (marketGoods.length > 0) {
            const randomItem = marketGoods[Math.floor(Math.random() * marketGoods.length)];
            const loseCount = Math.floor(randomItem.num * event.effect.lossPercent);
            if (loseCount > 0) {
                lostSupplies = loseCount;
                this.play.backpack.removeItem(randomItem.id, loseCount);
            }
        }

        const tip = event.tip + `你损失了${lossAmount}铜贝` +
            (lostSupplies > 0 ? `和${lostSupplies}个市场商品。` : "。");

        // 将玩家送回出发城市，以便迎战海盗
        if (this.sailingState) {
            this.city._city = this.sailingState.from;
            this.city._position = '码头';
            this.city._coordinates = { x: 0, y: 0 };
            this.city.clearMonsterCache();
        }

        return {
            type: 'pirateFight',
            eventType: 'pirateAttack',
            name: event.name,
            tip: tip,
            lostCopper: lossAmount,
            lostSupplies: lostSupplies
        };
    }

    // 处理装备奖励事件
    handleEquipmentRewardEvent(event) {
        // 从装备列表中随机选择一个装备
        const equipmentList = event.effect.equipmentList;
        const randomIndex = Math.floor(Math.random() * equipmentList.length);
        const equipmentName = equipmentList[randomIndex];

        // 获取装备对象
        const equipmentItem = getGoodsByName(equipmentName, 1);

        // 添加到背包
        this.play.backpack.addItem(equipmentItem);

        const tip = event.tip + `你获得了${equipmentName}！`;

        return {
            type: 'specialEvent',
            eventType: 'equipmentReward',
            name: event.name,
            tip: tip,
            equipment: equipmentItem
        };
    }

    // 航行一步
    sail() {
        if (!this.sailingState) {
            throw new Error('当前没有航行任务');
        }

        const {speed, remainingDistance, from, to} = this.sailingState;
        this.sailFb = null

        // 检查特殊事件
        const specialEvent = this.checkSpecialEvent();
        if (specialEvent) {
            return specialEvent;
        }

        // 5%概率遇到船副本
        if (Math.random() < 0.05) {
            const encounter = this.getEncounter('船副本');
            if (encounter) {
                this.sailFb = encounter.name
                return {
                    type: 'encounter',
                    encounterType: '船副本',
                    name: encounter.name,
                    tip: encounter.tip
                };
            }
        }

        if (remainingDistance <= speed) {
            // 到达目的地
            const destination = this.sailingState.to;
            this.sailingState = null;
            this.showEncounterButton = false; // 到达目的地时隐藏按钮
            this.encounterLocation = null;
            this.city.moveTo(destination);
            return {
                page: 'main', arrived: true, city: destination
            };
        } else {
            // 继续航行
            this.sailingState.remainingDistance -= speed;
            // 检查是否遇到特殊地点
            this.checkEncounterPoint(from, to);

            return {
                arrived: false,
                remaining: this.sailingState.remainingDistance,
                total: this.sailingState.totalDistance,
                showEncounterButton: this.showEncounterButton,
                encounterLocation: this.encounterLocation
            };
        }
    }

    clear() {
        this.sailingState = null;
        this.showEncounterButton = false;
        this.encounterLocation = null;
    }

    // 进入特殊地点
    enterEncounter() {
        if (!this.sailingState || !this.encounterLocation) {
            throw new Error('当前没有遇到特殊地点');
        }

        // 设置位置信息到特殊地点
        this.city._city = this.encounterLocation.location;
        this.city._position = this.encounterLocation.position;
        this.city._coordinates = null;

        // 重置特殊地点状态
        this.showEncounterButton = false;
        this.encounterLocation = null;
    }

    levelSailFb() {
        if (!this.sailFb) {
            return
        }
        // 设置副本位置信息
        this.city._city = this.sailingState.from;
        this.city._position = '码头';
        this.city._coordinates = null;
    }

    enterSailFb() {
        if (!this.sailFb) {
            return
        }
        // 设置副本位置信息
        this.city._city = this.sailFb;
        this.city._position = shipMap[this.sailFb][0][0];
        this.city._coordinates = {
            x: 0,
            y: 0
        };
    }

    // 返航
    returnSailing() {
        if (!this.sailingState) {
            throw new Error('当前没有航行任务');
        }

        // 交换起点和终点
        const {from, to, totalDistance, remainingDistance, ship, speed, isAutoSailing} = this.sailingState;

        // 使用已航行的距离作为返航距离
        const sailedDistance = totalDistance - remainingDistance;

        this.sailingState = {
            from: to,
            to: from,
            totalDistance: sailedDistance,
            remainingDistance: sailedDistance,
            ship: ship,
            speed: speed,
            hasReturned: true, // 标记已返航
            isAutoSailing: isAutoSailing // 保持自动航行状态
        };

        return this.sailingState;
    }

    // 开启/关闭自动航行
    toggleAutoSailing() {
        if (!this.sailingState) {
            throw new Error('当前没有航行任务');
        }

        this.sailingState.isAutoSailing = !this.sailingState.isAutoSailing;
        return {
            isAutoSailing: this.sailingState.isAutoSailing
        };
    }

    // 获取自动航行状态
    getAutoSailingStatus() {
        if (!this.sailingState) {
            return false;
        }
        return this.sailingState.isAutoSailing;
    }

    // 获取航行状态
    getSailingStatus() {
        return {
            ...this.sailingState,
            showEncounterButton: this.showEncounterButton,
            encounterLocation: this.encounterLocation
        };
    }
}