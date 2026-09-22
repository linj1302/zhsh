class Chat {
    constructor(database, userId) {
        // 初始化聊天消息数组
        this.messages = [];
        this.db = database;
        this.userId = userId;
        
        // 从数据库加载消息
        this.loadMessagesFromDB();
    }
    
    // 从数据库加载消息
    loadMessagesFromDB() {
        try {
            if (this.db) {
                // 加载所有公共聊天消息
                const publicMessages = this.db.getChatMessages(50, 'public');
                // 加载用户的私聊消息
                const privateMessages = this.db.getChatMessages(50, 'private', this.userId);
                // 加载帮会消息（如果有帮会）
                const gangMessages = this.db.getChatMessages(50, 'gang', this.userId);
                // 加载队伍消息（如果有队伍）
                const teamMessages = this.db.getChatMessages(50, 'team', this.userId);
                
                // 合并所有消息
                const dbMessages = [...publicMessages, ...privateMessages, ...gangMessages, ...teamMessages];
                
                // 转换数据库消息格式为内部格式
                this.messages = dbMessages.map(msg => ({
                    id: msg.id,
                    user: msg.username,
                    userId: msg.user_id,
                    message: msg.message,
                    channel: msg.type || 'public',
                    timestamp: new Date(msg.created_at)
                }));
            }
        } catch (error) {
            console.error('加载聊天消息失败:', error);
            this.messages = [];
        }
    }

    // 发送聊天消息
    sendMessage(user, userId, message, channel = 'public', targetUserId = null, gangId = null, teamId = null) {
        if (!message || message.trim() === '') {
            return { error: '消息不能为空' };
        }

        const chatMessage = {
            id: Date.now(), // 使用时间戳作为唯一ID
            user: user,
            userId: userId,
            message: message.trim(),
            channel: channel,
            targetUserId: targetUserId,
            timestamp: new Date()
        };

        this.messages.push(chatMessage);
        
        // 保存消息到数据库
        try {
            if (this.db) {
                this.db.saveChatMessage(userId, user, message.trim(), channel, targetUserId, gangId, teamId);
            }
        } catch (error) {
            console.error('保存聊天消息失败:', error);
        }
        
        // 限制保存的消息数量，只保留最新的100条在内存中
        if (this.messages.length > 100) {
            this.messages.shift();
        }

        return { success: true, message: chatMessage };
    }

    // 获取聊天消息
    getMessages(limit = 50, channel = 'public') {
        // 返回最新的消息，按时间倒序排列
        const messages = [...this.messages]
            .filter(msg => msg.channel === channel)
            .reverse();
        return messages.slice(0, limit);
    }

    // 获取私聊消息
    getPrivateMessages(limit = 50, targetUserId) {
        if (!targetUserId) {
            return [];
        }
        
        // 返回与特定用户的私聊消息，按时间倒序排列
        const messages = [...this.messages]
            .filter(msg => msg.channel === 'private' && 
                          (msg.userId === targetUserId || msg.targetUserId === targetUserId))
            .reverse();
        return messages.slice(0, limit);
    }

    // 获取完整状态用于保存到数据库
    getState() {
        // 不再需要保存消息到用户状态，因为消息已经保存在独立的表中
        return {
            // 可以保存一些聊天设置等其他状态
        };
    }

    // 从保存的数据中恢复状态
    restoreState(state) {
        // 消息已经从数据库加载，不需要从用户状态恢复
        // 这里可以恢复其他聊天设置
    }
}

export default Chat;