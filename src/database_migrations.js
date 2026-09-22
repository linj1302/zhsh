/**
 * 数据库迁移模块
 * 在游戏启动时自动创建必要的表
 */

import Card from './card.js';

export function initDatabaseTables(db) {
    if (!db) {
        console.log('数据库未初始化，跳过表创建');
        return;
    }

    try {
        console.log('📦 初始化游戏数据库表...');

        // 1. 师徒系统表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS mentor_disciple (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mentor_id INTEGER NOT NULL,
                disciple_id INTEGER NOT NULL,
                level_when_joined INTEGER DEFAULT 1,
                has_joined_gang INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                graduated_at DATETIME,
                UNIQUE(mentor_id, disciple_id)
            )
        `);
        console.log('  ✅ mentor_disciple (师徒关系)');

        // 2. 随从系统表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS followers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                follower_id INTEGER NOT NULL,
                recruit_id TEXT UNIQUE,
                quality TEXT DEFAULT 'normal',
                level INTEGER DEFAULT 1,
                exp INTEGER DEFAULT 0,
                state TEXT DEFAULT 'rest',
                stats TEXT DEFAULT '{}',
                skill_level INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ followers (随从)');

        // 3x. 随从装备表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS follower_equipment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                recruit_id TEXT NOT NULL,
                slot TEXT NOT NULL,
                item_id INTEGER,
                item_name TEXT,
                item_type INTEGER,
                item_info TEXT DEFAULT '{}',
                equipped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(recruit_id, slot)
            )
        `);
        console.log('  ✅ follower_equipment (随从装备)');

        // 3b. 随从精灵表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS follower_sprite (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recruit_id TEXT UNIQUE NOT NULL,
                sprite_level INTEGER DEFAULT 1,
                sprite_exp INTEGER DEFAULT 0,
                skills TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ follower_sprite (随从精灵)');

        // 3. 卡片系统表（新版含 card_id 列，无同卡同品唯一约束，升星需 2 张同种同品）
        const cardsCols = db.executeSQL(`PRAGMA table_info(cards)`, [], 'all') || [];
        if (cardsCols.length === 0) {
            // 表不存在，直接建新版表
            db.executeSQL(`
                CREATE TABLE IF NOT EXISTS cards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    card_id INTEGER NOT NULL,
                    card_name TEXT NOT NULL,
                    quality TEXT DEFAULT 'normal',
                    level INTEGER DEFAULT 1,
                    collected_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('  ✅ cards (卡片，新建)');
        } else {
            const cardsColNames = cardsCols.map(c => c.name);
            if (!cardsColNames.includes('card_id')) {
                // 存量库迁移：旧表缺 card_id 列 → 新建表并按 card_name 反查 CARD_CONFIG 回填
                // 整段迁移用 beginBatch/endBatch 包裹：中间态不落盘，COMMIT 后由 endBatch 一次性落盘（磁盘原子性）
                db.beginBatch && db.beginBatch();
                try {
                    // 先清理上次迁移中断可能残留的 cards_new（幂等保障；其内容可由 cards 重新生成，安全）
                    db.executeSQL('DROP TABLE IF EXISTS cards_new');
                    db.executeSQL(`
                        CREATE TABLE cards_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            card_id INTEGER NOT NULL,
                            card_name TEXT NOT NULL,
                            quality TEXT DEFAULT 'normal',
                            level INTEGER DEFAULT 1,
                            collected_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    const cardList = Card.getCardList();
                    const oldRows = db.executeSQL('SELECT * FROM cards', [], 'all') || [];
                    oldRows.forEach(r => {
                        const cfg = cardList.find(c => c.name === r.card_name);
                        let cid;
                        if (cfg) {
                            cid = cfg.id;
                        } else {
                            cid = 0;
                            console.warn(`  ⚠️ cards 表迁移：card_name=${r.card_name} 未匹配到卡片配置，回填 card_id=0 并保留原 card_name`);
                        }
                        db.executeSQL(
                            'INSERT INTO cards_new (user_id, card_id, card_name, quality, level, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [r.user_id, cid, r.card_name, r.quality || 'normal', r.level || 1, r.collected_at || null], 'run'
                        );
                    });
                    // 逐条执行事务语句：executeSQL 对多语句 SQL 只会执行第一条，
                    // 合并写法会导致只执行 BEGIN，共享单例库被永久卡在打开事务中
                    db.executeSQL('BEGIN', [], 'run');
                    try {
                        db.executeSQL('DROP TABLE cards', [], 'run');
                        db.executeSQL('ALTER TABLE cards_new RENAME TO cards', [], 'run');
                        db.executeSQL('COMMIT', [], 'run');
                    } catch (txErr) {
                        try { db.executeSQL('ROLLBACK', [], 'run'); } catch (_) {}
                        throw txErr;
                    }
                    console.log(`  ✅ cards (卡片，存量表已迁移补 card_id，共 ${oldRows.length} 行)`);
                } finally {
                    db.endBatch && db.endBatch();
                }
            } else {
                console.log('  ✅ cards (卡片)');
            }
        }

        // 3d. 存量背包卡片物品类型一次性修正（历史卡片物品曾以 type=7 入背包，而 7 已被百宝箱/乾坤袋占用，改为 37；仅改 info.cardId 存在的物品，幂等）
        try {
            const userDataRows = db.executeSQL('SELECT user_id, data FROM user_data', [], 'all') || [];
            let fixedUsers = 0;
            userDataRows.forEach(r => {
                let obj;
                try { obj = JSON.parse(r.data); } catch (e) { return; }
                const items = obj && obj.backpack && obj.backpack.items;
                if (!Array.isArray(items)) return;
                let touched = false;
                items.forEach(it => {
                    if (it && it.type === 7 && it.info && it.info.cardId) {
                        it.type = 37;
                        touched = true;
                    }
                });
                if (touched) {
                    db.executeSQL(
                        'INSERT OR REPLACE INTO user_data (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                        [r.user_id, JSON.stringify(obj)], 'run'
                    );
                    fixedUsers++;
                }
            });
            if (fixedUsers > 0) {
                console.log(`  ✅ 存量背包卡片物品类型修正 (7→37，共 ${fixedUsers} 个用户)`);
            }
        } catch (e) {
            console.warn('  ⚠️ 存量背包卡片物品类型修正失败:', e.message);
        }

        // 4a. 卡片附魔表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS card_enchanted (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                card_id INTEGER NOT NULL,
                card_name TEXT,
                quality TEXT DEFAULT 'normal',
                level INTEGER DEFAULT 1,
                slot TEXT NOT NULL,
                card_db_id INTEGER,
                equipped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, slot)
            )
        `);
        console.log('  ✅ card_enchanted (卡片附魔)');

        // 4. 圣痕系统表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS holy_marks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                mark_type TEXT NOT NULL,
                quality TEXT DEFAULT 'white',
                level INTEGER DEFAULT 1,
                exp INTEGER DEFAULT 0,
                collected_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ holy_marks (圣痕)');

        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS holy_sanctified (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                mark_id INTEGER NOT NULL,
                slot INTEGER DEFAULT 0,
                equipped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, slot),
                UNIQUE(mark_id)
            )
        `);
        console.log('  ✅ holy_sanctified (圣痕圣化槽位)');

        // 5. 坐骑系统表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS user_mounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                mount_name TEXT NOT NULL,
                obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, mount_name)
            )
        `);
        console.log('  ✅ user_mounts (坐骑)');

        // 6. 羽翼系统表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS user_wings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                wing_name TEXT NOT NULL,
                obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, wing_name)
            )
        `);
        console.log('  ✅ user_wings (羽翼)');

        // 7. 成就系统表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                achievement_id TEXT NOT NULL,
                claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, achievement_id)
            )
        `);
        console.log('  ✅ achievements (成就)');

        // 8. 节假日活动系统表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS holiday_claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                holiday_id TEXT NOT NULL,
                claim_type TEXT DEFAULT 'login_gift',
                claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, holiday_id, claim_type)
            )
        `);
        console.log('  ✅ holiday_claims (节假日活动)');

        // 9a. 节日活动追踪表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS holiday_tracker (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                data TEXT DEFAULT '{}',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ holiday_tracker (节日活动追踪)');

        // 8c. 宠物锁列升级（检查列是否存在再添加，避免 duplicate column 错误）
        const petsColumns = db.executeSQL(`PRAGMA table_info(pets)`, [], 'all');
        const petColNames = new Set(petsColumns.map(c => c.name));
        if (!petColNames.has('talent_locked')) { db.executeSQL(`ALTER TABLE pets ADD COLUMN talent_locked INTEGER DEFAULT 0`); }
        console.log('  ✅ pets.talent_locked');
        if (!petColNames.has('qual_locked')) { db.executeSQL(`ALTER TABLE pets ADD COLUMN qual_locked INTEGER DEFAULT 0`); }
        console.log('  ✅ pets.qual_locked');
        if (!petColNames.has('name_set')) { db.executeSQL(`ALTER TABLE pets ADD COLUMN name_set INTEGER DEFAULT 0`); }
        console.log('  ✅ pets.name_set');
        if (!petColNames.has('innate_skills')) { db.executeSQL(`ALTER TABLE pets ADD COLUMN innate_skills TEXT DEFAULT '[]'`); }
        console.log('  ✅ pets.innate_skills');
        if (!petColNames.has('used_skill_points')) { db.executeSQL(`ALTER TABLE pets ADD COLUMN used_skill_points INTEGER DEFAULT 0`); }
        console.log('  ✅ pets.used_skill_points');

        // 8d. 婚宴表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS marriage_banquets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                marriage_id INTEGER NOT NULL,
                host_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                guest_count INTEGER DEFAULT 0,
                needed_guests INTEGER DEFAULT 8,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ marriage_banquets');
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS banquet_guests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                banquet_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(banquet_id, user_id)
            )
        `);
        console.log('  ✅ banquet_guests');

        // 9. 攻城系统表
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS siege_wars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attacker_gang_id INTEGER NOT NULL,
                defender_city TEXT NOT NULL,
                start_time DATETIME,
                end_time DATETIME,
                status TEXT DEFAULT 'pending',
                result TEXT
            )
        `);
        console.log('  ✅ siege_wars (攻城战)');

        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS siege_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                siege_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                state TEXT DEFAULT 'fighting',
                damage_dealt INTEGER DEFAULT 0,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ siege_participants (攻城参与者)');

        // 8g. 随从培养次数字段升级
        const followerColumns = db.executeSQL(`PRAGMA table_info(followers)`, [], 'all');
        const followerColNames = new Set(followerColumns.map(c => c.name));
        if (!followerColNames.has('train_count')) { db.executeSQL(`ALTER TABLE followers ADD COLUMN train_count INTEGER DEFAULT 0`); }
        console.log('  ✅ followers.train_count');

        // 8h. 通用键值设置表（随从随魂、招募池缓存等）
        db.executeSQL(`
            CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                key_name TEXT NOT NULL,
                data TEXT DEFAULT '',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, key_name)
            )
        `);
        console.log('  ✅ user_settings (通用键值设置)');

        console.log('✅ 数据库表初始化完成！\n');

    } catch (error) {
        console.error('❌ 数据库表创建失败:', error.message);
    }
}
