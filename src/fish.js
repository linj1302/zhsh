import {fileURLToPath} from 'url';
import {fish as fishConfig, treasureMap, shopItems,equipment} from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);

export default class Fish {
    constructor(play, sailing) {
        this.play = play;
        this.sailing = sailing;
        this.fishingState = null; // 钓鱼状态
    }

    clear() {
        this.fishingState = null;
    }

    // 获取背包中的鱼竿
    getRods() {
        return this.play.backpack.getItemsByType(14); // 鱼竿类型为14
    }

    // 获取背包中的鱼饵
    getBaits() {
        return this.play.backpack.getItemsByType(8); // 鱼饵类型为8
    }

    //1:藏宝图 2高级藏宝图
    useTreasureMap(t) {
        // 检查背包中是否有藏宝图
        const treasureMaps = this.play.backpack.getItemsByType(2); // 藏宝图类型为2
        let mapName, mapItem;
        
        if (t == 1) {
            // 普通藏宝图
            mapName = "藏宝图";
            mapItem = treasureMaps.find(item => item.name === mapName);
        } else if (t == 2) {
            // 高级藏宝图
            mapName = "高级藏宝图";
            mapItem = treasureMaps.find(item => item.name === mapName);
        }
        
        // 检查是否有对应的藏宝图
        if (!mapItem || mapItem.num <= 0) {
            return {
                tip: `你没有${mapName}`
            };
        }
        
        // 使用藏宝图，减少数量
        this.play.backpack.removeItem(mapItem.id);
        
        // 根据藏宝图类型确定可获得的奖励
        let possibleRewards = [];
        
        // 添加common奖励
        possibleRewards = possibleRewards.concat(treasureMap.common.equipment, treasureMap.common.item);
        
        // 如果是高级藏宝图，额外添加high奖励
        if (t == 2) {
            possibleRewards = possibleRewards.concat(treasureMap.high.equipment, treasureMap.high.item);
        }
        
        // 随机选择一个奖励
        const rewardName = possibleRewards[Math.floor(Math.random() * possibleRewards.length)];
        
        // 查找奖励物品信息
        let rewardItem = null;
        
        // 先在装备中查找
        if (equipment[rewardName]) {
            rewardItem = {
                name: rewardName,
                type: 1, // 装备类型
                num: 1,
                info: equipment[rewardName]
            };
        } 
        // 再在商店物品中查找
        else {
            const shopItem = shopItems.find(item => item.name === rewardName);
            if (shopItem) {
                rewardItem = {
                    name: rewardName,
                    type: shopItem.type,
                    num: 1,
                    info: shopItem.info
                };
            }
        }
        
        // 如果找到奖励物品，则添加到背包
        if (rewardItem) {
            this.play.backpack.addItem(rewardItem);
            return {
                tip: `你使用了${mapName}，获得了${rewardName}`
            };
        } else {
            return {
                tip: `你使用了${mapName}，但没有获得任何物品`
            };
        }
    }

    // 开始钓鱼
    startFishing({rodIndex, baitIndex}) {
        const rods = this.getRods();
        const baits = this.getBaits();

        if (rodIndex >= rods.length || baitIndex >= baits.length) {
            return {
                tip: '无效的鱼竿或鱼饵选择'
            }
        }

        const rod = rods[rodIndex];
        const bait = baits[baitIndex];

        // 检查是否有航行状态
        const sailingStatus = this.sailing.getSailingStatus();
        if (!sailingStatus || !sailingStatus.from) {
            return {
                tip: '必须在航行中才能钓鱼'
            }
        }

        this.fishingState = {
            rod: rod,
            bait: bait,
            location: [sailingStatus.from, sailingStatus.to],
            step: 'waiting', // 等待鱼上钩
            startTime: Date.now(),
            // 添加钓鱼过程中的统计数据
            waitCount: 0,
            reelInCount: 0,
            letOutCount: 0,
            // 钓鱼成功率调整因子
            successFactor: 1.0
        };
    }

    // 抛竿
    cast() {
        if (!this.fishingState) {
            return {
                tip: '未开始钓鱼'
            }
        }

        // 消耗一个鱼饵
        const baitId = this.fishingState.bait.id;
        if (this.fishingState?.bait?.num > 0) {
            this.play.backpack.removeItem(baitId);
        } else {
            this.play.backpack.removeItem(baitId);
            return {
                tip: '没有鱼饵了'
            }
        }

        // 更新状态为抛竿
        this.fishingState.step = 'casting';

        // 抛竿的消息提示
        const castMessages = [
            `你熟练地挥动${this.fishingState.rod.name}，鱼线在空中划出一道优美的弧线落入水中。`,
            `你轻轻地将鱼钩抛出，水面泛起一圈圈涟漪。`,
            `伴随着一声轻响，鱼饵准确地落在了你预定的位置。`,
            `你用力一甩，鱼线笔直地飞向远方，鱼饵在水面上轻轻一弹。`,
            `你专注地瞄准目标水域，鱼线准确地落在了那里。`,
            `随着鱼线的飞出，你感到一种期待的紧张感。`,
            `你熟练地操作着鱼竿，鱼饵在水面上轻盈地跳跃了一下。`,
            `鱼线在空中飞舞，最终准确地落在了水中。`,
            `你小心地抛出鱼线，尽量不惊扰水中的鱼儿。`,
            `鱼钩带着鱼饵飞向水面，激起一小片水花。`,
            `你优雅地完成了一次抛竿动作，鱼线准确入水。`,
            `随着鱼线的延伸，你感到一种钓鱼独有的宁静。`,
            `你精准地将鱼饵投放到你认为有鱼的区域。`,
            `鱼线在空中划过，最终悄无声息地落入水中。`,
            `你熟练地控制着鱼线，确保鱼饵落在理想的位置。`,
            `抛竿的瞬间，你感到一种与自然的连接。`,
            `鱼钩准确地落在了你选择的钓点。`,
            `你轻松地挥动鱼竿，鱼线飞向远方的水域。`,
            `随着鱼饵入水，你开始静静地等待鱼儿上钩。`,
            `你完成了一次完美的抛竿，准备迎接接下来的挑战。`
        ];

        const randomMessage = castMessages[Math.floor(Math.random() * castMessages.length)];

        // 返回抛竿结果
        return {
            tip: randomMessage,
            action: 'cast'
        };
    }

    // 等待
    wait() {
        if (!this.fishingState) {
            throw new Error('未开始钓鱼');
        }

        // 增加等待计数
        this.fishingState.waitCount++;

        // 等待会影响成功率
        if (this.fishingState.waitCount <= 3) {
            this.fishingState.successFactor += 0.1; // 前几次等待增加成功率
        } else {
            this.fishingState.successFactor -= 0.05; // 过多等待降低成功率
        }

        // 等待过程中有一定概率发生事件
        const events = [
            {type: 'nothing', tip: '海面平静，没有鱼儿上钩的迹象...'},
            {type: 'bite', tip: '鱼鳔动了！有鱼上钩了！'},
            {type: 'line_snapped', tip: '糟糕！鱼线断了！', end: true},
            {type: 'bait_eaten', tip: '鱼儿吃掉了鱼饵跑了...', end: true}
        ];

        // 等待的消息提示
        const waitMessages = [
            '你静静地等待着，海风轻拂过脸颊。',
            '时间在慢慢流逝，你耐心地守候着。',
            '海浪轻拍着船舷，发出有节奏的声响。',
            '你专注地观察着水面的每一个细微变化。',
            '阳光洒在海面上，波光粼粼，美丽而宁静。',
            '你感受到一种与世隔绝的宁静。',
            '海鸥在远处盘旋，偶尔发出几声鸣叫。',
            '你仔细聆听着来自水下的每一个声音。',
            '时间仿佛静止了，只有你和这片海洋。',
            '你调整了一下姿势，继续耐心等待。',
            '海水轻柔地摇摆着船只，像摇篮一样舒适。',
            '你感受到内心的平静，仿佛与大海融为一体。',
            '远处有海豚跃出水面，激起一片水花。',
            '你注意到水面上有一些小鱼在游动。',
            '海风带来了淡淡的咸味，让你感到清新。',
            '你开始思考人生，享受这难得的宁静时光。',
            '阳光温暖地照在身上，让你感到舒适。',
            '你看到水中有影子在游动，可能是鱼群。',
            '海水清澈见底，你可以看到海底的景色。',
            '你感到一种前所未有的放松和自由。'
        ];

        // 根据等待次数选择消息
        let randomMessage;
        if (this.fishingState.waitCount <= waitMessages.length) {
            randomMessage = waitMessages[this.fishingState.waitCount - 1];
        } else {
            randomMessage = waitMessages[Math.floor(Math.random() * waitMessages.length)];
        }

        // 随机事件
        const randomEvent = events[Math.floor(Math.random() * events.length)];

        // 等待时间越长，触发事件的概率越高
        const eventProbability = Math.min(0.1 + (this.fishingState.waitCount * 0.05), 0.5);
        const shouldTriggerEvent = Math.random() < eventProbability;

        if (shouldTriggerEvent) {
            // 如果是结束事件，则重置为等待状态
            if (randomEvent.end) {
                this.fishingState.step = 'waiting';
                this.fishingState.waitCount = 0;
                this.fishingState.reelInCount = 0;
                this.fishingState.letOutCount = 0;
            }

            return {
                tip: randomMessage + ' ' + randomEvent.tip,
                type: randomEvent.type,
                end: randomEvent.end || false
            };
        } else {
            return {
                tip: randomMessage,
                type: 'waiting',
                end: false
            };
        }
    }

    // 收线
    reelIn() {
        if (!this.fishingState) {
            throw new Error('未开始钓鱼');
        }

        // 增加收线计数
        this.fishingState.reelInCount++;

        // 收线会影响成功率
        if (this.fishingState.reelInCount <= 2) {
            this.fishingState.successFactor += 0.15; // 前几次收线增加成功率
        } else {
            this.fishingState.successFactor -= 0.1; // 过多收线降低成功率
        }

        const events = [
            {type: 'tiring', tip: '鱼线绷得很紧，鱼儿在拼命挣扎！'},
            {type: 'pulling', tip: '你在努力地收线...'},
            {type: 'got_fish', tip: '成功钓到了鱼！', end: true, fish: true},
            {type: 'lost_fish', tip: '哎呀，鱼从钩上逃脱了！', end: true}
        ];

        // 收线的消息提示
        const reelInMessages = [
            '你小心地收着线，感受着来自水下的拉力。',
            '鱼线绷得紧紧的，你能感受到水下有大家伙。',
            '你熟练地控制着收线的速度，不让鱼儿感到惊慌。',
            '随着鱼线的收紧，你感到一种即将收获的兴奋。',
            '你稳稳地握着鱼竿，感受着鱼儿的每一次挣扎。',
            '鱼线在你的控制下慢慢收紧，鱼儿越来越近了。',
            '你专注地收线，每收一寸都小心翼翼。',
            '水下的鱼儿似乎察觉到了危险，开始剧烈挣扎。',
            '你调整着鱼竿的角度，以应对鱼儿的拉力。',
            '随着距离的拉近，你能隐约看到水下的影子。',
            '你感到鱼竿在微微颤动，那是鱼儿在做最后的挣扎。',
            '你小心地控制着力道，既不能让鱼儿逃脱，也不能拉断鱼线。',
            '鱼儿在水中翻腾，溅起阵阵水花。',
            '你感受到一种即将胜利的喜悦，同时保持着冷静。',
            '鱼线越来越短，鱼儿的身影也越来越清晰。',
            '你全神贯注地收线，不敢有丝毫松懈。',
            '鱼儿似乎累了，挣扎的力度在慢慢减弱。',
            '你看到了鱼儿的轮廓，那是一条不错的鱼。',
            '你感到胜利在望，同时更加小心地操作着。',
            '随着最后一段鱼线的收紧，你准备将鱼儿拉出水面。'
        ];

        // 根据收线次数选择消息
        let randomMessage;
        if (this.fishingState.reelInCount <= reelInMessages.length) {
            randomMessage = reelInMessages[this.fishingState.reelInCount - 1];
        } else {
            randomMessage = reelInMessages[Math.floor(Math.random() * reelInMessages.length)];
        }

        // 根据收线次数调整事件概率
        let gotFishProbability = 0.1;
        if (this.fishingState.reelInCount >= 3) {
            gotFishProbability = Math.min(0.1 + (this.fishingState.reelInCount * 0.1), 0.8);
        }

        // 根据成功率因子调整获得鱼的概率
        gotFishProbability *= this.fishingState.successFactor;

        const randomValue = Math.random();
        let randomEvent;
        if (randomValue < gotFishProbability) {
            // 获得鱼
            randomEvent = events.find(e => e.type === 'got_fish');
        } else if (randomValue < gotFishProbability + 0.2) {
            // 失去鱼
            randomEvent = events.find(e => e.type === 'lost_fish');
        } else if (randomValue < gotFishProbability + 0.4) {
            // 鱼挣扎
            randomEvent = events.find(e => e.type === 'tiring');
        } else {
            // 普通收线
            randomEvent = events.find(e => e.type === 'pulling');
        }

        let result = {
            tip: randomMessage + ' ' + randomEvent.tip,
            type: randomEvent.type,
            end: randomEvent.end || false
        };

        // 如果钓到了鱼，决定钓到什么鱼
        if (randomEvent.fish) {
            const fish = this.calculateCatch();
            if (fish) {
                // 将鱼添加到背包
                this.play.backpack.addItem({
                    name: fish.name,
                    type: 13, // 鱼类类型
                    num: 1,
                    info: fish
                });
                result.fish = fish;
                // 钓鱼大赛统计记录（失败静默跳过，绝不影响正常钓鱼流程）
                try {
                    if (this.tournament && typeof this.tournament.recordCatch === 'function') {
                        const rarityQuality = { common: 1, uncommon: 2, rare: 3, epic: 4 };
                        const catchWeight = Number(fish.weight) > 0
                            ? Number(fish.weight)
                            : Math.round((1 + Math.random() * 20) * 10) / 10;
                        const activeMatch = this.tournament.getActiveTournament();
                        this.tournament.recordCatch(
                            fish.name,
                            catchWeight,
                            rarityQuality[fish.rarity] || 1,
                            activeMatch ? activeMatch.id : null
                        );
                    }
                } catch (e) { /* 大赛模块异常不影响钓鱼 */ }
                randomEvent.tip = ' 恭喜！你钓到了' + fish.name + '！';
            } else {
                result.tip = randomMessage + ' 鱼线断了，鱼儿逃走了...';
                result.end = true;
            }
        }

        // 如果是结束事件，则重置为等待状态
        if (result.end) {
            this.fishingState.step = 'waiting';
            this.fishingState.waitCount = 0;
            this.fishingState.reelInCount = 0;
            this.fishingState.letOutCount = 0;
        }

        return result;
    }

    // 放线
    letOut() {
        if (!this.fishingState) {
            throw new Error('未开始钓鱼');
        }

        // 增加放线计数
        this.fishingState.letOutCount++;

        // 放线会影响成功率
        if (this.fishingState.letOutCount <= 2) {
            this.fishingState.successFactor += 0.1; // 前几次放线增加成功率
        } else {
            this.fishingState.successFactor -= 0.05; // 过多放线降低成功率
        }

        const events = [
            {type: 'loosening', tip: '你松开了鱼线...'},
            {type: 'big_fish', tip: '水波一阵翻腾，似乎是一条大鱼！'},
            {type: 'lost_fish', tip: '鱼儿趁机游走了...', end: true}
        ];

        // 放线的消息提示
        const letOutMessages = [
            '你轻轻松开鱼线，让鱼儿有更多活动空间。',
            '你有策略地放出一些鱼线，避免鱼儿感到惊慌。',
            '通过放线，你给了鱼儿一些喘息的机会。',
            '你巧妙地控制着鱼线的松紧，与鱼儿进行着博弈。',
            '你放松了收线的力度，让鱼儿不会因为紧张而逃脱。',
            '通过放线，你更好地控制了与鱼儿的较量。',
            '你有节奏地放着线，感受着鱼儿的反应。',
            '你适时地给鱼儿一些空间，这是一种钓鱼技巧。',
            '放线让你能够更好地感知鱼儿的状态。',
            '你通过放线来消耗鱼儿的体力。',
            '你巧妙地运用放线技巧，让鱼儿放松警惕。',
            '你通过放线来试探鱼儿的反应。',
            '放线的同时，你准备着下一步的收线动作。',
            '你熟练地控制着鱼线的张力，时松时紧。',
            '通过放线，你让鱼儿以为已经逃脱，放松了警惕。',
            '你策略性地放线，为最终的收线做准备。',
            '你用放线来调节与鱼儿之间的力量平衡。',
            '你通过放线来寻找最佳的收线时机。',
            '放线让你更好地掌控整个钓鱼过程。',
            '你优雅地操作着鱼线，展现着钓鱼的艺术。'
        ];

        // 根据放线次数选择消息
        let randomMessage;
        if (this.fishingState.letOutCount <= letOutMessages.length) {
            randomMessage = letOutMessages[this.fishingState.letOutCount - 1];
        } else {
            randomMessage = letOutMessages[Math.floor(Math.random() * letOutMessages.length)];
        }

        // 根据放线次数调整事件概率
        const bigFishProbability = Math.min(0.1 + (this.fishingState.letOutCount * 0.05), 0.5);
        const lostFishProbability = 0.1;

        const randomValue = Math.random();
        let randomEvent;
        if (randomValue < bigFishProbability) {
            // 大鱼
            randomEvent = events.find(e => e.type === 'big_fish');
        } else if (randomValue < bigFishProbability + lostFishProbability) {
            // 失去鱼
            randomEvent = events.find(e => e.type === 'lost_fish');
        } else {
            // 普通放线
            randomEvent = events.find(e => e.type === 'loosening');
        }

        // 根据成功率因子调整失去鱼的概率
        if (randomEvent.type === 'lost_fish' && Math.random() > this.fishingState.successFactor) {
            // 成功率低时更容易失去鱼
            randomEvent = events.find(e => e.type === 'lost_fish');
        }

        // 如果是结束事件，则重置为等待状态
        if (randomEvent.end) {
            this.fishingState.step = 'waiting';
            this.fishingState.waitCount = 0;
            this.fishingState.reelInCount = 0;
            this.fishingState.letOutCount = 0;
        }

        return {
            tip: randomMessage + ' ' + randomEvent.tip,
            type: randomEvent.type,
            end: randomEvent.end || false
        };
    }

    // 计算钓到的鱼
    calculateCatch() {
        // 根据当前航线筛选可钓到的鱼
        const availableFish = fishConfig.filter(fish => {
            // 如果鱼没有指定航线限制，则可以在任何地方钓到
            if (!fish.locations) {
                return true;
            }

            // 检查当前航线是否在鱼的可钓取航线中（不区分起点和终点）
            return fish.locations.some(location =>
                (location[0] === this.fishingState.location[0] && location[1] === this.fishingState.location[1]) ||
                (location[1] === this.fishingState.location[0] && location[0] === this.fishingState.location[1])
            );
        });

        // 根据鱼饵类型进一步筛选
        const baitFilteredFish = availableFish.filter(fish =>
            fish.bait === this.fishingState.bait.name
        );

        // 如果没有符合当前鱼饵的鱼，返回空
        if (baitFilteredFish.length === 0) {
            return null;
        }

        // 根据稀有度加权随机选择鱼，并考虑成功率因子
        const rarityWeights = {
            'common': 50,
            'uncommon': 30,
            'rare': 15,
            'epic': 5
        };

        // 根据成功率因子调整权重
        if (this.fishingState.successFactor < 1.0) {
            // 成功率低时，更容易钓到普通鱼
            rarityWeights.common += 20;
            rarityWeights.uncommon -= 10;
            rarityWeights.rare -= 5;
            rarityWeights.epic -= 2;
        } else if (this.fishingState.successFactor > 1.0) {
            // 成功率高时，更容易钓到稀有鱼
            rarityWeights.common -= 10;
            rarityWeights.uncommon += 10;
            rarityWeights.rare += 5;
            rarityWeights.epic += 2;
        }

        // 构建权重数组
        let weightedFish = [];
        baitFilteredFish.forEach(fish => {
            const weight = rarityWeights[fish.rarity] || 10;
            for (let i = 0; i < weight; i++) {
                weightedFish.push(fish);
            }
        });

        // 随机选择一条鱼
        if (weightedFish.length > 0) {
            const randomIndex = Math.floor(Math.random() * weightedFish.length);
            return {...weightedFish[randomIndex]}; // 返回副本
        }

        return null;
    }

    // 获取钓鱼状态
    getFishingStatus() {
        return this.fishingState;
    }
}