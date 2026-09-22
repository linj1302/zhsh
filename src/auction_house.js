/**
 * 拍卖行系统 - 物品交易、出价、竞拍
 */
import { auctionConfig } from '../config/index.js';

export default class AuctionHouse {
    constructor(play, database) {
        this.play = play;
        this.db = database;
        this.auctions = {}; // 活跃拍卖
        this.bids = {}; // 竞标记录
        this.history = {}; // 交易历史
    }

    // 创建拍卖
    createAuction(itemId, startingPrice, durationHours) {
        const item = this.play.backpack.getItemById(itemId);
        if (!item) {
            return { success: false, tip: '物品不存在' };
        }
        
        if (item.locked) {
            return { success: false, tip: '物品已锁定，无法拍卖' };
        }

        // 防流转死物品：卡片物品不可上架拍卖
        if (item.info && item.info.cardId) {
            return { success: false, tip: '卡片不可拍卖' };
        }
        
        const auction = {
            id: Date.now(),
            sellerId: this.play.id,
            sellerName: this.play.nickname,
            item: {
                name: item.name,
                type: item.type,
                info: item.info,
                image: item.info?.image || ''
            },
            startingPrice,
            currentPrice: startingPrice,
            currentBidder: null,
            bidderCount: 0,
            startTime: Date.now(),
            endTime: Date.now() + durationHours * 3600 * 1000,
            status: 'active',
            premium: 0.1 // 佣金10%
        };
        
        this.auctions[auction.id] = auction;
        
        // 从背包移除物品（暂存到拍卖行）
        this.play.backpack.removeItem(itemId);
        
        return {
            success: true,
            tip: `成功上架【${item.name}】，起拍价${startingPrice}铜币，${durationHours}小时后结束`,
            auctionId: auction.id
        };
    }

    // 竞标
    bid(auctionId, bidPrice) {
        const auction = this.auctions[auctionId];
        if (!auction) {
            return { success: false, tip: '拍卖不存在' };
        }
        
        if (auction.status !== 'active') {
            return { success: false, tip: '拍卖已结束' };
        }
        
        if (bidPrice <= auction.currentPrice) {
            return { success: false, tip: `出价必须高于当前价格${auction.currentPrice}` };
        }
        
        if (this.play.copper < bidPrice) {
            return { success: false, tip: '铜币不足' };
        }
        
        // 出价成功，退还前の出价给前の bidder
        if (auction.currentBidder) {
            // 返还前の出价（简化处理）
        }
        
        auction.currentPrice = bidPrice;
        auction.currentBidder = this.play.id;
        auction.bidderCount++;
        
        return {
            success: true,
            tip: `成功出价${bidPrice}铜币，目前是最高价`
        };
    }

    // 取消拍卖（取回物品）
    cancelAuction(auctionId) {
        const auction = this.auctions[auctionId];
        if (!auction) {
            return { success: false, tip: '拍卖不存在' };
        }
        
        if (auction.sellerId !== this.play.id) {
            return { success: false, tip: '只有卖家可以取消拍卖' };
        }
        
        if (auction.status !== 'active') {
            return { success: false, tip: '拍卖已结束，无法取消' };
        }
        
        // 返还物品
        this.play.backpack.addItem({
            name: auction.item.name,
            type: auction.item.type,
            num: 1,
            info: auction.item.info
        });
        
        auction.status = 'cancelled';
        
        return { success: true, tip: '成功取回物品' };
    }

    // 结束拍卖（由定时任务调用）
    endAuction(auctionId) {
        const auction = this.auctions[auctionId];
        if (!auction) {
            return null;
        }
        
        if (auction.status !== 'active') {
            return null;
        }
        
        auction.status = 'completed';
        
        if (auction.currentBidder) {
            // 支付佣金
            const commission = Math.floor(auction.currentPrice * auction.premium);
            
            // 卖家获得收益
            const sellerRevenue = auction.currentPrice - commission;
            
            // 查找卖家
            const seller = this.db ? this.db.getUserById(auction.sellerId) : null;
            if (seller) {
                // 更新卖家铜币
                // 这里简化处理，实际需要更新数据库
            }
            
            // 买家获得物品
            const buyer = this.db ? this.db.getUserById(auction.currentBidder) : null;
            if (buyer) {
                // 扣除铜币并给予物品
            }
            
            return {
                success: true,
                seller: auction.sellerName,
                buyer: this.play.nickname || '未知',
                price: auction.currentPrice,
                commission,
                item: auction.item.name
            };
        } else {
            // 没有人出价，返还给卖家
            const seller = this.db ? this.db.getUserById(auction.sellerId) : null;
            if (seller) {
                // 直接将物品返还给卖家
            }
            
            return {
                success: false,
                tip: '没有人出价，物品已返还给卖家'
            };
        }
    }

    // 浏览拍卖
    browseAuctions(page = 1, pageSize = 20) {
        const now = Date.now();
        const activeAuctions = Object.values(this.auctions)
            .filter(a => a.status === 'active' && a.endTime > now)
            .sort((a, b) => a.endTime - b.endTime);
        
        const startIndex = (page - 1) * pageSize;
        const auctions = activeAuctions.slice(startIndex, startIndex + pageSize);
        
        return {
            auctions,
            total: activeAuctions.length,
            page,
            pageSize,
            hasMore: startIndex + pageSize < activeAuctions.length
        };
    }

    // 搜索拍卖
    searchAuctions(keyword, page = 1, pageSize = 20) {
        const now = Date.now();
        const activeAuctions = Object.values(this.auctions)
            .filter(a => a.status === 'active' && a.endTime > now)
            .filter(a => a.item.name.includes(keyword))
            .sort((a, b) => a.endTime - b.endTime);
        
        const startIndex = (page - 1) * pageSize;
        const auctions = activeAuctions.slice(startIndex, startIndex + pageSize);
        
        return {
            auctions,
            total: activeAuctions.length,
            page,
            pageSize,
            hasMore: startIndex + pageSize < activeAuctions.length
        };
    }

    // 获取玩家的拍卖记录
    getMyAuctions(sell = true) {
        const myAuctions = Object.values(this.auctions)
            .filter(a => sell ? a.sellerId === this.play.id : a.currentBidder === this.play.id)
            .sort((a, b) => b.startTime - a.startTime);
        
        return myAuctions;
    }

    // 获取交易历史
    getHistory(itemName) {
        if (!this.history[itemName]) {
            this.history[itemName] = [];
        }
        return this.history[itemName].slice(-10);
    }

    // 获取当前最高价
    getCurrentHighestBid(auctionId) {
        const auction = this.auctions[auctionId];
        if (!auction) return null;
        
        return {
            auctionId,
            itemName: auction.item.name,
            currentPrice: auction.currentPrice,
            bidderCount: auction.bidderCount,
            endTime: auction.endTime,
            timeLeft: Math.max(0, auction.endTime - Date.now())
        };
    }
}
