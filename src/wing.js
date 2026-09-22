/**
* 羽翼系统模块
* 实现羽翼装备、属性加成等功能
* 羽翼数据统一来自 config/wings.json（config/index.js 自动加载导出为 wings）
* 
*/
import { wings as wingsConfig } from '../config/index.js';

export default class Wing {
    constructor(play, backpack) {
        this.play = play;
        this.backpack = backpack;
        this.currentWing = null; // 当前装备的羽翼
    }

/**
* 获取所有羽翼列表
* @returns {Array} 羽翼配置列表（来源：config/wings.json）
*/
getWingList() {
    return wingsConfig;
}

/**
* 检查是否可以装备羽翼
* @param {Object} wing - 羽翼信息
* @returns {Object} 检查结果
*/
canEquip(wing) {
    // 检查等级
    if (this.play.level < wing.level) {
        return {
            success: false,
            message: `需要达到${wing.level}级才能装备${wing.name}` 
        };
    }
    
    // 检查翼形术等级
    const wingSkillLevel = this.play.wingSkillLevel || 0;
    if (wingSkillLevel < wing.wingSkillLevel) {
        return {
            success: false,
            message: `需要${wing.wingSkillLevel}级翼形术才能装备${wing.name}` 
        };
    }
    
    return { success: true };
}

/**
* 装备羽翼
* @param {string} wingName - 羽翼名称
* @returns {Object} 操作结果
*/
equip(wingName) {
    // 从羽翼列表中查找
    const wings = this.getWingList();
    const wing = wings.find(w => w.name === wingName);
    
    if (!wing) {
        return { success: false, message: '羽翼不存在' };
    }
    
    // 检查装备条件
    const canEquipResult = this.canEquip(wing);
    if (!canEquipResult.success) {
        return canEquipResult;
    }
    
    // 装备羽翼
    this.currentWing = wing;
    return { 
        success: true, 
        message: `你装备了${wing.name}！`,
        wing: wing
    };
}

/**
* 卸下羽翼
* @returns {Object} 操作结果
*/
unequip() {
    if (!this.currentWing) {
        return { success: false, message: '你当前没有装备羽翼' };
    }
    
    this.currentWing = null;
    return { 
        success: true,
        message: '你卸下了羽翼'
    };
}

/**
* 切换羽翼状态
* @returns {Object} 操作结果
*/
toggleWing() {
    if (this.currentWing) {
        return this.unequip();
    } else {
        // 自动选择第一个可用的羽翼
        const wings = this.getWingList();
        const availableWings = wings.filter(wing => {
            const result = this.canEquip(wing);
            return result.success;
        });
        
        if (availableWings.length > 0) {
            return this.equip(availableWings[0].name);
        } else {
            return { success: false, message: '没有可用的羽翼' };
        }
    }
}

/**
* 获取当前羽翼的属性加成
* @returns {Object} 属性加成
*/
getWingBonus() {
    if (!this.currentWing) {
        return {};
    }
    
    const bonuses = this.currentWing.bonuses;
    const bonus = {};
    
    // 处理各种属性加成
    if (bonuses.healthPercent) {
        bonus.healthPercent = bonuses.healthPercent;
    }
    if (bonuses.vampire) {
        bonus.vampire = bonuses.vampire;
    }
    if (bonuses.combo) {
        bonus.combo = bonuses.combo;
    }
    if (bonuses.ironWall) {
        bonus.ironWall = bonuses.ironWall;
    }
    if (bonuses.attackPercent !== undefined) {
        bonus.attackPercent = bonuses.attackPercent;
    }
    if (bonuses.defensePercent !== undefined) {
        bonus.defensePercent = bonuses.defensePercent;
    }
    
    return bonus;
}

/**
* 获取当前羽翼状态
* @returns {Object} 羽翼状态
*/
 getStatus() {
    return {
        currentWing: this.currentWing,
        bonus: this.currentWing ? this.getWingBonus() : null,
        wingSkillLevel: this.play.wingSkillLevel || 0
    };
}

/**
* 学习翼形术
* @param {number} level - 学习的等级
* @returns {Object} 学习结果
*/
learnWingSkill(level) {
    // 检查是否已经学会
    const currentLevel = this.play.wingSkillLevel || 0;
    if (currentLevel >= level) {
        return { success: false, message: '你已经学会了这个等级的翼形术' };
    }
    
    // 检查前置条件：3级翼形术需求降低至200级（原240级），以便与220级羽翼匹配
    const requiredLevel = level === 3 ? 200 : level * 80;
    if (this.play.level < requiredLevel) {
        return { 
            success: false, 
            message: `需要达到${requiredLevel}级才能学习${level}级翼形术` 
        };
    }
    
    // 学习成功
    this.play.wingSkillLevel = level;
    return { 
        success: true, 
        message: `你学会了${level}级翼形术！` 
    };
}
}
