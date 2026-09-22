class ChatHandler {
    // 处理聊天页面请求
    static handleChatRequest(user, query, config) {
        const { type, message, channel, targetUserId } = query;
        let mergeObj = {};

        // 处理发送消息
        if (type === 'sendChatMessage' && message) {
            user.sendChatMessage(message, channel, targetUserId ? parseInt(targetUserId) : null);
        }

        // 获取聊天消息
        const chatMessages = user.getChatMessages();

        return {
            page: 'chat',
            ...config,
            query,
            user: user,
            chatMessages,
            ...mergeObj
        };
    }
}

export default ChatHandler;