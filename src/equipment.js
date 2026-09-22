export default class Equipment {
    constructor() {
        this._weapon = null;
        this._offhand = null;
        this._headgear = null;
        this._clothes = null;
        this._belt = null;
        this._shoes = null;
        this._accessories = [null, null, null];
        // 装备版本号：槽位每次实际变更 +1，供 play.equipProperty 版本缓存失效使用（随 getFullState 序列化，恢复后仍一致）
        this._version = 0;
    }

    // 获取装备版本号
    getVersion() {
        return this._version;
    }

    // 使装备属性缓存失效（装备穿脱/强化/宝石镶嵌等变更入口调用）
    bumpVersion() {
        this._version++;
    }

    equip(item) {
        this[{
            1: 'equipWeapon',
            7: 'equipOffhand',
            2: 'equipHeadgear',
            3: 'equipClothes',
            4: 'equipBelt',
            5: 'equipShoes',
            6: 'equipAccessory'
        }[item.info.type]](item)
    }

    unequip(slotType) {
        const methodMap = {
            1: 'unequipWeapon',
            7: 'unequipOffhand',
            2: 'unequipHeadgear',
            3: 'unequipClothes',
            4: 'unequipBelt',
            5: 'unequipShoes',
            6: 'unequipAccessory'
        };
        const method = methodMap[slotType];
        if (method && this[method]) {
            this[method]();
        }
    }

    unequipWeapon(slot) {
        if (this._weapon) {
            this._weapon.status = 1;
            this._weapon = null;
            this._version++;
        }
    }

    unequipOffhand(slot) {
        if (this._offhand) {
            this._offhand.status = 1;
            this._offhand = null;
            this._version++;
        }
    }

    unequipHeadgear(slot) {
        if (this._headgear) {
            this._headgear.status = 1;
            this._headgear = null;
            this._version++;
        }
    }

    unequipClothes(slot) {
        if (this._clothes) {
            this._clothes.status = 1;
            this._clothes = null;
            this._version++;
        }
    }

    unequipBelt(slot) {
        if (this._belt) {
            this._belt.status = 1;
            this._belt = null;
            this._version++;
        }
    }

    unequipShoes(slot) {
        if (this._shoes) {
            this._shoes.status = 1;
            this._shoes = null;
            this._version++;
        }
    }

    unequipAccessory(slot) {
        if (slot !== undefined && slot >= 0 && slot < 3 && this._accessories[slot]) {
            this._accessories[slot].status = 1;
            this._accessories[slot] = null;
            this._version++;
        }
    }

    equipWeapon(item) {
        item.status = 2;
        if (this._weapon) {
            this._weapon.status = 1;
        }
        this._weapon = item;
        this._version++;
    }

    equipOffhand(item) {
        item.status = 2;
        if (this._offhand) {
            this._offhand.status = 1;
        }
        this._offhand = item;
        this._version++;
    }

    equipHeadgear(item) {
        item.status = 2;
        if (this._headgear) {
            this._headgear.status = 1;
        }
        this._headgear = item;
        this._version++;
    }

    equipClothes(item) {
        item.status = 2;
        if (this._clothes) {
            this._clothes.status = 1;
        }
        this._clothes = item;
        this._version++;
    }

    equipBelt(item) {
        item.status = 2;
        if (this._belt) {
            this._belt.status = 1;
        }
        this._belt = item;
        this._version++;
    }

    equipShoes(item) {
        item.status = 2;
        if (this._shoes) {
            this._shoes.status = 1;
        }
        this._shoes = item;
        this._version++;
    }

    equipAccessory(item, slot) {
        // 未指定槽位时自动找第一个空槽
        if (slot === undefined) {
            slot = this._accessories.findIndex(a => a === null);
            if (slot === -1) slot = 0; // 全满则覆盖第一个
        }
        if (slot >= 0 && slot < 3) {
            item.status = 2;
            if (this._accessories[slot]) {
                this._accessories[slot].status = 1;
            }
            this._accessories[slot] = item;
            this._version++;
        }
    }

    getEquipmentAttributes() {
        const attributes = {
            attack: 0,
            defense: 0,
            agility: 0,
            morale: 0,
            health: 0
        };

        const equippedItems = [
            this._weapon,
            this._offhand,
            this._headgear,
            this._clothes,
            this._belt,
            this._shoes,
            ...this._accessories
        ].filter(item => item !== null);

        for (const item of equippedItems) {
            if (item.info.attack) attributes.attack += parseInt(item.info.attack);
            if (item.info.defense) attributes.defense += parseInt(item.info.defense);
            if (item.info.agility) attributes.agility += parseInt(item.info.agility);
            if (item.info.morale) attributes.morale += parseInt(item.info.morale);
            if (item.info.health) attributes.health += parseInt(item.info.health);
            
            if (item.info.strengthenLevel) {
                const strengthenLevel = item.info.strengthenLevel;
                attributes.attack += strengthenLevel;
                attributes.defense += strengthenLevel;
                attributes.agility += Math.floor(strengthenLevel / 2);
                attributes.morale += Math.floor(strengthenLevel / 3);
                attributes.health += strengthenLevel * 2;
            }
            
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
        }

        return attributes;
    }

    getStatus() {
        return {
            weapon: this._weapon,
            offhand: this._offhand,
            headgear: this._headgear,
            clothes: this._clothes,
            belt: this._belt,
            shoes: this._shoes,
            accessories: this._accessories,
        };
    }
}
