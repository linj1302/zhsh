export default class Backpack {
    constructor() {
        this.items = []
        this.maxWeight = 200
        this.nextId = 1
    }

    getItemInfo(id) {
        const index = this.items.findIndex(item => item.id == id);
        if (index == -1) {
            return null;
        }
        const item = this.items[index];
        return {
            ...item,
            index,
        }
    }

    removeItem(id, count) {
        const index = this.items.findIndex(item => item.id == id);
        if (index < 0) {
            return
        }
        if (!this.items[index]) {
            return;
        }
        const removeCount = count || 1;
        this.items[index].num -= removeCount;
        if (this.items[index].num <= 0) {
            this.items.splice(index, 1);
        }
    }

    removeItemByName(name, num = 1) {
        const item = this.getItemByName(name);
        if (item) {
            this.removeItem(item.id, num);
        }
    }

    getItemByName(name) {
        return this.items.find(item => item.name == name);
    }

    setItemStatus(id, status) {
        const index = this.items.findIndex(item => item.id == id);
        if (index < 0) {
            return;
        }
        this.items[index].status = status;
    }

    mergeInfo(info) {
        if (!info.info) {
            return info
        }
        const merge = {
            ...info
        };
        if (Object.keys(info.info).length == 0) {
            delete merge.info;
            return merge;
        }
        return info.info;
    }

    addItem({name, type = 10, num = 1, status = 1, info}) {
        num = +num
        if (type !== 1) {
            const existingItemIndex = this.items.findIndex(item =>
                item.name == name && item.type == type && item.status !== 2);
            if (existingItemIndex !== -1) {
                this.items[existingItemIndex].num += num;
                return;
            }
        }

        this.items.push({
            id: this.generateUniqueId(),
            name,
            type,
            num,
            status,
            locked: false,
            info: this.mergeInfo(info)
        });
    }

    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    hasItem(itemName, quantity) {
        let totalCount = 0;
        for (const item of this.items) {
            if (item.name == itemName) {
                if (item.type !== 1) {
                    totalCount += item.num;
                } else {
                    totalCount += 1;
                }
            }
        }
        return totalCount >= quantity;
    }

    getItemsByType(type) {
        return this.items.filter(item => item.type == type);
    }

    getPetItems() {
        return this.items.filter(item => item.type == 25 || item.type == 26);
    }

    findItemIndexById(id) {
        const numId = Number(id);
        const strId = String(id);
        return this.items.findIndex(item => {
            if (item.id === numId) return true;
            if (item.id === strId) return true;
            if (item.id == id) return true;
            if (String(item.id) === strId) return true;
            return false;
        });
    }

    getItemById(id) {
        // 先尝试 ID 匹配
        const numId = Number(id);
        const strId = String(id);
        let item = this.items.find(item => {
            if (item.id === numId) return true;
            if (item.id === strId) return true;
            if (item.id == id) return true;
            if (String(item.id) === strId) return true;
            return false;
        });
        if (item) return item;

        // 后备：尝试索引查找（如果 id 碰巧是数字索引）
        if (!isNaN(numId) && numId >= 0 && numId < this.items.length) {
            return this.items[numId];
        }
        return null;
    }

    get weight() {
        let totalWeight = 0;
        for (const item of this.items) {
            // 装备 type=1 每件算1负重
            if (item.type === 1) {
                totalWeight += item.num || 1;
            }
            // 百宝箱/乾坤袋 type=7 负重 = info.expand
            if (item.type === 7) {
                totalWeight += (item.info && item.info.expand ? item.info.expand : 0) * (item.num || 1);
            }
        }
        return totalWeight;
    }

    getStatus() {
        return {
            items: this.items,
            maxWeight: this.maxWeight,
            weight: this.weight
        };
    }

    toggleLock(id) {
        const item = this.getItemById(id);
        if (!item) return {success: false, tip: '物品不存在'};
        item.locked = !item.locked;
        return {
            success: true,
            locked: item.locked,
            tip: item.locked ? '物品已锁定（无法卖出/交易）' : '物品已解锁'
        };
    }
}
