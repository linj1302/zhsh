/**
 * 坐骑系统模块
 * 实现坐骑骑乘、属性加成等功能
 */

import * as config from '../config/index.js';

export default class Mount {
    constructor(play, backpack) {
        this.play = play;
        this.backpack = backpack;
        this.currentMount = null; // 当前骑乘的坐骑
    }

    /**
     * 获取所有坐骑列表
     * @returns {Array} 坐骑配置列表
     */
    getMountList() {
        return [
            // 80 级坐骑
            {
                id: 1,
                name: '暴风狮鹫',
                level: 80,
                rideSkillLevel: 1,
                bonuses: {
                    attack: 100,
                    defense: 100,
                    agility: 100,
                    health: 100
                },
                bonusType: 'fixed' // 固定数值加成
            },
            // 160 级坐骑
            {
                id: 2,
                name: '炽焰战蝎',
                level: 160,
                rideSkillLevel: 2,
                bonuses: {
                    attack: 200,
                    defense: 200,
                    agility: 200,
                    health: 200
                },
                bonusType: 'fixed'
            },
            // 200 级坐骑
            {
                id: 3,
                name: '仙境古兽',
                level: 200,
                rideSkillLevel: 2,
                bonuses: {
                    attack: 300,
                    defense: 300,
                    agility: 300,
                    health: 300
                },
                bonusType: 'fixed'
            },
            // 210 级坐骑 - 百分比加成
            {
                id: 4,
                name: '暗月战狼',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.05,
                    defense: 0.05,
                    agility: 0.05,
                    health: 0.05
                },
                bonusType: 'percent', // 百分比加成
                exclusive: 'dark legion' // 黑暗军团专属
            },
            {
                id: 5,
                name: '圣灵白虎',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.05,
                    defense: 0.05,
                    agility: 0.05,
                    health: 0.05
                },
                bonusType: 'percent',
                exclusive: 'holy legion' // 神圣军团专属
            },
            // 稀有坐骑
            {
                id: 6,
                name: '巨型海龟',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.10,
                    defense: 0.10,
                    agility: 0.10,
                    health: 0.10
                },
                bonusType: 'percent',
                rarity: 'rare'
            },
            {
                id: 7,
                name: '雷霆巨犀',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.20,
                    defense: 0.20,
                    agility: 0.20,
                    health: 0.20
                },
                bonusType: 'percent',
                exclusive: 'dark legion'
            },
            {
                id: 8,
                name: '猛犸巨象',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.20,
                    defense: 0.20,
                    agility: 0.20,
                    health: 0.20
                },
                bonusType: 'percent',
                exclusive: 'holy legion'
            },
            {
                id: 10,
                name: '地狱战马',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.30,
                    defense: 0.30,
                    agility: 0.30,
                    health: 0.30
                },
                bonusType: 'percent',
                rarity: 'rare'
            },
            // 超稀有坐骑
            {
                id: 15,
                name: '虚空幻影',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.45,
                    defense: 0.45,
                    agility: 0.45,
                    health: 0.45
                },
                bonusType: 'percent',
                rarity: 'ultra_rare'
            },
            {
                id: 20,
                name: '魔法飞毯',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.55,
                    defense: 0.55,
                    agility: 0.55,
                    health: 0.55
                },
                bonusType: 'percent',
                rarity: 'ultra_rare'
            },
            {
                id: 25,
                name: '机甲蝰蛇',
                level: 210,
                rideSkillLevel: 3,
                bonuses: {
                    attack: 0.65,
                    defense: 0.65,
                    agility: 0.65,
                    health: 0.65
                },
                bonusType: 'percent',
                rarity: 'ultra_rare'
            }
        ];
    }

    /**
     * 检查是否可以骑乘坐骑
     * @param {Object} mount - 坐骑信息
     * @returns {Object} 检查结果
     */
    canRide(mount) {
        // 检查等级
        if (this.play.level < mount.level) {
            return { 
                success: false, 
                message: `需要达到${mount.level}级才能骑乘${mount.name}` 
            };
        }

        // 检查乘骑术等级
        const rideSkillLevel = this.play.rideSkillLevel || 0;
        if (rideSkillLevel < mount.rideSkillLevel) {
            return { 
                success: false, 
                message: `需要${mount.rideSkillLevel}级乘骑术才能骑乘${mount.name}` 
            };
        }

        // 检查专属限制
        if (mount.exclusive) {
            // 这里需要检查玩家是否属于对应军团
            // 简化处理，暂时不限制
        }

        return { success: true };
    }

    /**
     * 骑乘坐骑
     * @param {string} mountName - 坐骑名称
     * @returns {Object} 操作结果
     */
    ride(mountName) {
        // 检查背包中是否有该坐骑
        const mountItem = this.backpack.getItemByName(mountName);
        
        if (!mountItem) {
            // 尝试从坐骑列表中查找
            const mounts = this.getMountList();
            const mount = mounts.find(m => m.name === mountName);
            
            if (!mount) {
                return { success: false, message: '坐骑不存在' };
            }

            // 检查骑乘条件
            const canRideResult = this.canRide(mount);
            if (!canRideResult.success) {
                return canRideResult;
            }

            // 设置当前坐骑
            this.currentMount = mount;
            return { 
                success: true, 
                message: `你骑上了${mount.name}！`,
                mount: mount
            };
        } else {
            // 从背包物品中获取坐骑信息
            const mount = this.getMountByName(mountItem.name);
            if (!mount) {
                return { success: false, message: '这不是一个有效的坐骑' };
            }

            const canRideResult = this.canRide(mount);
            if (!canRideResult.success) {
                return canRideResult;
            }

            this.currentMount = mount;
            return { 
                success: true, 
                message: `你骑上了${mount.name}！`,
                mount: mount
            };
        }
    }

    /**
     * 下坐骑
     * @returns {Object} 操作结果
     */
    dismount() {
        if (!this.currentMount) {
            return { success: false, message: '你当前没有骑乘坐骑' };
        }

        this.currentMount = null;
        return { 
            success: true, 
            message: '你从坐骑上下来了' 
        };
    }

    /**
     * 切换坐骑状态
     * @returns {Object} 操作结果
     */
    toggleMount() {
        if (this.currentMount) {
            return this.dismount();
        } else {
            // 自动选择第一个可用的坐骑
            const mounts = this.getMountList();
            const availableMounts = mounts.filter(mount => {
                const result = this.canRide(mount);
                return result.success;
            });

            if (availableMounts.length > 0) {
                return this.ride(availableMounts[0].name);
            } else {
                return { success: false, message: '没有可用的坐骑' };
            }
        }
    }

    /**
     * 获取坐骑名称对应的信息
     * @param {string} name - 坐骑名称
     * @returns {Object|null} 坐骑信息
     */
    getMountByName(name) {
        const mounts = this.getMountList();
        return mounts.find(m => m.name === name) || null;
    }

    /**
     * 获取当前坐骑的属性加成
     * @returns {Object} 属性加成
     */
    getMountBonus() {
        if (!this.currentMount) {
            return {
                attack: 0,
                defense: 0,
                agility: 0,
                health: 0
            };
        }

        const bonuses = this.currentMount.bonuses;
        
        if (this.currentMount.bonusType === 'fixed') {
            // 固定数值加成
            return {
                attack: bonuses.attack || 0,
                defense: bonuses.defense || 0,
                agility: bonuses.agility || 0,
                health: bonuses.health || 0
            };
        } else {
            // 百分比加成 - 基于基础属性计算
            const baseStats = {
                attack: this.play._attack,
                defense: this.play._defense,
                agility: this.play._agility,
                health: this.play._health
            };

            return {
                attack: Math.floor(baseStats.attack * bonuses.attack),
                defense: Math.floor(baseStats.defense * bonuses.defense),
                agility: Math.floor(baseStats.agility * bonuses.agility),
                health: Math.floor(baseStats.health * bonuses.health)
            };
        }
    }

    /**
     * 获取当前坐骑状态
     * @returns {Object} 坐骑状态
     */
    getStatus() {
        return {
            currentMount: this.currentMount,
            bonus: this.currentMount ? this.getMountBonus() : null
        };
    }

    /**
     * 学习乘骑术
     * @param {number} level - 学习的等级
     * @returns {Object} 学习结果
     */
    learnRideSkill(level) {
        // 检查是否已经学会
        const currentLevel = this.play.rideSkillLevel || 0;
        if (currentLevel >= level) {
            return { success: false, message: '你已经学会了这个等级的乘骑术' };
        }

        // 检查前置条件
        const requiredLevel = level * 80; // 每级需要 80 的倍数等级
        if (this.play.level < requiredLevel) {
            return { 
                success: false, 
                message: `需要达到${requiredLevel}级才能学习${level}级乘骑术` 
            };
        }

        // 学习成功
        this.play.rideSkillLevel = level;
        return { 
            success: true, 
            message: `你学会了${level}级乘骑术！` 
        };
    }
}
