/**
 * 邮箱系统 - 玩家消息、物品传递、货币转账
 */
export default class MailSystem {
    constructor(play, database) {
        this.play = play;
        this.db = database;
        this.mailbox = {}; // 邮箱
        this.sentItems = {}; // 已发送物品
        this.transferSessions = {}; // 转账会话
    }

    // 获取邮箱列表
    getMailbox() {
        if (!this.mailbox[this.play.id]) {
            this.mailbox[this.play.id] = [];
        }
        return this.mailbox[this.play.id];
    }

    // 获取未读邮件数量
    getUnreadCount() {
        const mailbox = this.getMailbox();
        return mailbox.filter(m => !m.read).length;
    }

    // 获取邮件
    getMail(mailId) {
        const mailbox = this.getMailbox();
        return mailbox.find(m => m.id === mailId);
    }

    // 标记邮件已读
    markRead(mailId) {
        const mailbox = this.getMailbox();
        const mail = mailbox.find(m => m.id === mailId);
        if (mail) {
            mail.read = true;
            mail.readAt = Date.now();
            return { success: true, tip: '邮件已标记为已读' };
        }
        return { success: false, tip: '邮件不存在' };
    }

    // 删除邮件
    deleteMail(mailId) {
        const mailbox = this.getMailbox();
        const index = mailbox.findIndex(m => m.id === mailId);
        if (index !== -1) {
            mailbox.splice(index, 1);
            return { success: true, tip: '邮件已删除' };
        }
        return { success: false, tip: '邮件不存在' };
    }

    // 清空已读邮件
    clearReadMails() {
        const mailbox = this.getMailbox();
        const before = mailbox.length;
        mailbox.filter(m => m.read).forEach(m => {
            mailbox.splice(mailbox.indexOf(m), 1);
        });
        const after = mailbox.length;
        return {
            success: true,
            tip: `已清空${before - after}封已读邮件`,
            deleted: before - after
        };
    }

    // 发送邮件
    sendMail(recipientId, subject, content, attachments = []) {
        if (!this.db) {
            return { success: false, tip: '数据库未初始化' };
        }

        if (recipientId === this.play.id) {
            return { success: false, tip: '不能给自己发送邮件' };
        }

        // 创建邮件
        const mail = {
            id: Date.now(),
            senderId: this.play.id,
            senderName: this.play.nickname,
            recipientId,
            recipientName: this.getPlayerName(recipientId),
            subject,
            content,
            attachments: attachments.map(a => ({
                itemId: a.id,
                itemName: a.name,
                itemType: a.type,
                itemInfo: a.info,
                quantity: a.num || 1
            })),
            timestamp: Date.now(),
            read: false,
            readAt: null,
            replied: false,
            deleted: false
        };

        // 存储到数据库
        if (this.db.addMail(mail)) {
            return {
                success: true,
                tip: `邮件已发送给【${this.getPlayerName(recipientId)}】`,
                mailId: mail.id
            };
        }

        return { success: false, tip: '发送邮件失败' };
    }

    // 获取玩家名称
    getPlayerName(playerId) {
        if (this.play.id === playerId) {
            return this.play.nickname;
        }
        return `玩家${playerId}`;
    }

    // 发送物品
    sendItem(recipientId, itemId, quantity) {
        const item = this.play.backpack.getItemById(itemId);
        if (!item) {
            return { success: false, tip: '物品不存在' };
        }

        if (item.num < quantity) {
            return { success: false, tip: '物品数量不足' };
        }

        // 从背包移除
        this.play.backpack.removeItem(itemId, quantity);

        // 创建物品附件
        const attachment = {
            id: itemId,
            name: item.name,
            type: item.type,
            info: item.info,
            num: quantity
        };

        // 发送邮件
        return this.sendMail(recipientId, `物品发送：${item.name}`, `你收到了${quantity}个【${item.name}】`, [attachment]);
    }

    // 发送货币
    sendCurrency(recipientId, amount) {
        if (amount <= 0) {
            return { success: false, tip: '转账金额必须大于0' };
        }

        if (this.play.copper < amount) {
            return { success: false, tip: '铜币不足' };
        }

        // 扣除货币
        this.play.addCopper(-amount);

        // 创建货币邮件
        return this.sendMail(recipientId, `货币转账：${amount}铜币`, `你收到了${amount}铜贝`, [
            {
                id: 'currency_transfer',
                name: '铜贝',
                type: 15, // 货币类型
                info: { amount },
                num: 1
            }
        ]);
    }

    // 启动转账会话（安全转账）
    startTransferSession(recipientId, amount) {
        if (amount <= 0) {
            return { success: false, tip: '转账金额必须大于0' };
        }

        if (this.play.copper < amount) {
            return { success: false, tip: '铜币不足' };
        }

        const session = {
            id: Date.now(),
            senderId: this.play.id,
            recipientId,
            recipientName: this.getPlayerName(recipientId),
            amount,
            status: 'pending', // pending, confirmed, cancelled
            createdAt: Date.now(),
            expiresAt: Date.now() + 10 * 60 * 1000, // 10分钟有效期
            recipientConfirmed: false,
            senderConfirmed: false
        };

        this.transferSessions[session.id] = session;

        // 通知对方
        this.sendNotification(recipientId, {
            type: 'transfer_request',
            title: '转账请求',
            content: `玩家【${this.play.nickname}】请求向你转账${amount}铜贝`,
            sessionId: session.id,
            amount,
            timestamp: Date.now()
        });

        return {
            success: true,
            tip: `转账请求已发送给【${this.getPlayerName(recipientId)}】，请等待确认`,
            sessionId: session.id,
            expiresAt: session.expiresAt
        };
    }

    // 确认收款
    confirmReceipt(sessionId) {
        const session = this.transferSessions[sessionId];
        if (!session) return { success: false, tip: '转账会话不存在' };

        if (session.recipientId !== this.play.id) {
            return { success: false, tip: '这不是你的转账请求' };
        }

        if (session.status !== 'pending') {
            return { success: false, tip: '转账状态异常' };
        }

        session.recipientConfirmed = true;
        session.confirmedAt = Date.now();

        // 检查是否双方都已确认
        if (session.senderConfirmed) {
            // 执行转账
            this.executeTransfer(session);
        }

        return {
            success: true,
            tip: '已确认收款，等待发送方确认',
            sessionId: sessionId
        };
    }

    // 发送方确认
    confirmSend(sessionId) {
        const session = this.transferSessions[sessionId];
        if (!session) return { success: false, tip: '转账会话不存在' };

        if (session.senderId !== this.play.id) {
            return { success: false, tip: '这不是你的转账请求' };
        }

        session.senderConfirmed = true;
        session.confirmedAt = Date.now();

        // 检查是否双方都已确认
        if (session.recipientConfirmed) {
            this.executeTransfer(session);
        }

        return {
            success: true,
            tip: '已确认发送，等待接收方确认',
            sessionId: sessionId
        };
    }

    // 执行转账
    executeTransfer(session) {
        // 扣除货币
        this.play.addCopper(-session.amount);

        // 通知接收方
        this.sendNotification(session.recipientId, {
            type: 'transfer_received',
            title: '转账成功',
            content: `玩家【${session.senderName || this.getPlayerName(session.senderId)}】已向你转账${session.amount}铜贝`,
            sessionId: session.id,
            amount: session.amount,
            timestamp: Date.now()
        });

        // 更新状态
        session.status = 'completed';
        session.completedAt = Date.now();

        return {
            success: true,
            tip: `转账成功！已发送${session.amount}铜贝给【${session.recipientName}】`
        };
    }

    // 取消转账
    cancelTransfer(sessionId) {
        const session = this.transferSessions[sessionId];
        if (!session) return { success: false, tip: '转账会话不存在' };

        if (session.senderId !== this.play.id) {
            return { success: false, tip: '只能取消你自己的转账' };
        }

        if (session.status === 'completed') {
            return { success: false, tip: '转账已完成，无法取消' };
        }

        session.status = 'cancelled';
        session.cancelledAt = Date.now();

        // 退回货币
        this.play.addCopper(session.amount);

        // 通知对方
        this.sendNotification(session.recipientId, {
            type: 'transfer_cancelled',
            title: '转账已取消',
            content: `玩家【${this.play.nickname}】取消了向你转账${session.amount}铜贝`,
            sessionId: session.id,
            timestamp: Date.now()
        });

        return {
            success: true,
            tip: '转账已取消，货币已退回',
            sessionId: sessionId
        };
    }

    // 获取转账会话
    getTransferSession(sessionId) {
        const session = this.transferSessions[sessionId];
        if (!session) return null;

        const isSender = session.senderId === this.play.id;
        const isRecipient = session.recipientId === this.play.id;

        return {
            id: session.id,
            type: isSender ? 'sent' : 'received',
            partnerName: isSender ? session.recipientName : this.getPlayerName(session.senderId),
            amount: session.amount,
            status: session.status,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            confirmed: isSender ? session.senderConfirmed : session.recipientConfirmed,
            partnerConfirmed: isSender ? session.recipientConfirmed : session.senderConfirmed,
            canConfirm: session.status === 'pending' && 
                         ((isSender && !session.senderConfirmed) || 
                          (isRecipient && !session.recipientConfirmed)),
            expired: Date.now() > session.expiresAt
        };
    }

    // 获取所有转账会话
    getAllTransferSessions() {
        const sessions = Object.values(this.transferSessions)
            .filter(s => s.senderId === this.play.id || s.recipientId === this.play.id);

        return sessions.map(s => this.getTransferSession(s.id));
    }

    // 发送通知
    sendNotification(userId, notification) {
        if (this.db) {
            this.db.addNotification(userId, notification);
        }
    }

    // 获取邮件统计
    getMailStats() {
        const mailbox = this.getMailbox();
        const total = mailbox.length;
        const unread = mailbox.filter(m => !m.read).length;
        const attachments = mailbox.filter(m => m.attachments && m.attachments.length > 0).length;

        return {
            totalMails: total,
            unreadCount: unread,
            attachmentMails: attachments,
            unreadRatio: total > 0 ? Math.round((unread / total) * 100) : 0
        };
    }

    // 搜索邮件
    searchMails(query) {
        const mailbox = this.getMailbox();
        const lowerQuery = query.toLowerCase();

        return mailbox.filter(m =>
            m.subject.toLowerCase().includes(lowerQuery) ||
            m.content.toLowerCase().includes(lowerQuery) ||
            m.senderName.toLowerCase().includes(lowerQuery)
        );
    }

    // 回复邮件
    replyMail(mailId, content) {
        const mail = this.getMail(mailId);
        if (!mail) return { success: false, tip: '邮件不存在' };

        return this.sendMail(mail.senderId, `回复：${mail.subject}`, content);
    }
}
