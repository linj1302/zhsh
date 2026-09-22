/**
 * validate-config.js —— config 数值配置一致性校验脚本
 *
 * 用法：
 *   独立执行：node scripts/validate-config.js（失败时以非零退出码结束）
 *   模块引用：import { validateConfigs, printReport } from './scripts/validate-config.js'
 *
 * 校验项：
 *   1. config/exp.json 曲线严格单调递增（输出首个回退的等级）
 *   2. config/trial.json 的 levelRequirement / quantity / playerRequirement 可被正则解析
 *   3. 副本引用的怪物名在 monsters.json / monsterItems.json 中可查到（覆盖 targetName 与 target.monsters 一致性）
 *   4. config/equipment.json 数值字段可转为数字（不可转仅警告不失败）
 *   5. config/fbNpc.json 副本地图全部怪物名在 monsters.json / monsterItems.json 中存在，条目结构合法（畸形位置键/无名 type 60 占位条目均判为失败）
 *   6. config/holiday_events.json 事件 date/date_type schema 及阴历偏移表完整性
 *   7. 副本提交链完整性：每个副本的 submitNpc 非空、且可在 npcs.json / fbNpc.json（type 60）中找到；submitLocation / submitDialog 非空
 *   8. 【warning】商人货源覆盖：worldMap 每个世界在 cityShop 有世界键，或其每个城市有城市级键
 *   9. 【warning】副本接引 NPC：trial 每条的 receiveNpc 存在于 npcs.json 某城市某地点条目中
 *  10. 【warning】商店/市场物品消费契约：cityShop 商品名可被 nameToItem(shopItems) 解析；marketItems 价格为合法 [最低,最高] 区间
 *  11. 【warning】副本收集物品掉落来源：trial 的 target.items 及 targetName 中非怪物（非 target.monsters/boss/fbNpc）的收集物在 monsterItems / monsterDrops 中存在掉落来源
 *
 * 注：项目为 "type": "module"，本文件为 ESM；index.js 通过 import 接入。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_DIR = path.join(ROOT, 'config');

function loadJson(fileName) {
    return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, fileName), 'utf8'));
}

// trial.json 字段解析正则（与 src/trial.js / src/task.js 的解析方式保持一致）
const RE_LEVEL_REQ = /^\s*\d+\s*(?:-\s*\d+\s*)?级?\s*$/;   // "5-15级" / "210" / "30"
const RE_QUANTITY = /^\s*\d+(?:\s*,\s*\d+)*\s*$/;          // "40,1" / "160,160,80,80,1"
const RE_PLAYER_REQ = /^\s*\d+\s*人$/;                     // "6人"
const SPECIAL_PLAYER_REQS = ['情侣'];                       // 已知的非数字特殊要求

/**
 * 执行全部校验。
 * @returns {{ok: boolean, passes: string[], failures: string[], warnings: string[]}}
 */
export function validateConfigs() {
    const passes = [];
    const failures = [];
    const warnings = [];

    /* ---------- 1. exp.json 严格单调递增 ---------- */
    try {
        const exp = loadJson('exp.json');
        const levels = Object.keys(exp).map(Number).sort((a, b) => a - b);
        let firstRegression = null;
        const regressions = [];
        let nonNumeric = null;
        for (let i = 0; i < levels.length; i++) {
            const value = Number(exp[levels[i]]);
            if (!Number.isFinite(value)) {
                if (!nonNumeric) nonNumeric = levels[i];
                continue;
            }
            if (i > 0) {
                const prev = Number(exp[levels[i - 1]]);
                if (Number.isFinite(prev) && value <= prev) {
                    if (!firstRegression) firstRegression = levels[i];
                    regressions.push(`L${levels[i - 1]}(${prev}) -> L${levels[i]}(${value})`);
                }
            }
        }
        if (nonNumeric !== null) {
            failures.push(`config/exp.json: 等级 ${nonNumeric} 的经验值不是数字`);
        }
        if (firstRegression !== null) {
            failures.push(`config/exp.json: 曲线非严格单调递增，首个回退等级 ${firstRegression}，共 ${regressions.length} 处：${regressions.join('；')}`);
        } else {
            passes.push(`config/exp.json: ${levels.length} 级经验曲线严格单调递增`);
        }
    } catch (e) {
        failures.push(`config/exp.json: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 2 + 3. trial.json 字段解析 & 怪物引用 ---------- */
    let monsterNamesFromMap = null;
    let monsterItemNames = null;
    try {
        const monsters = loadJson('monsters.json');
        monsterNamesFromMap = {};
        // monsters.json 结构：城市 -> 地点 -> [{name, level, type}, ...]
        Object.keys(monsters).forEach(city => {
            Object.keys(monsters[city]).forEach(location => {
                const list = monsters[city][location];
                if (Array.isArray(list)) {
                    list.forEach(m => {
                        if (m && m.name) monsterNamesFromMap[m.name] = true;
                    });
                }
            });
        });
    } catch (e) {
        failures.push(`config/monsters.json: 读取/解析失败（${e.message}）`);
    }
    try {
        const monsterItems = loadJson('monsterItems.json');
        monsterItemNames = {};
        Object.keys(monsterItems).forEach(name => {
            monsterItemNames[name] = true;
        });
    } catch (e) {
        failures.push(`config/monsterItems.json: 读取/解析失败（${e.message}）`);
    }

    try {
        const trials = loadJson('trial.json');
        let fieldPass = 0;
        trials.forEach((trial, index) => {
            const where = `config/trial.json[${index}]（${trial.name || '未命名副本'}）`;

            // levelRequirement
            if (trial.levelRequirement === undefined || trial.levelRequirement === null || trial.levelRequirement === '') {
                warnings.push(`${where}.levelRequirement: 缺失`);
            } else if (!RE_LEVEL_REQ.test(String(trial.levelRequirement))) {
                failures.push(`${where}.levelRequirement: "${trial.levelRequirement}" 无法解析（期望如 "5-15级" 或 "210"）`);
            } else {
                fieldPass++;
            }

            // quantity
            if (trial.quantity === undefined || trial.quantity === null || trial.quantity === '') {
                failures.push(`${where}.quantity: 为空，无法解析（期望如 "40,1"）`);
            } else if (!RE_QUANTITY.test(String(trial.quantity))) {
                failures.push(`${where}.quantity: "${trial.quantity}" 无法解析（期望如 "40,1"）`);
            } else {
                fieldPass++;
            }

            // playerRequirement
            const playerReq = String(trial.playerRequirement || '');
            if (!playerReq) {
                warnings.push(`${where}.playerRequirement: 缺失`);
            } else if (!RE_PLAYER_REQ.test(playerReq) && !SPECIAL_PLAYER_REQS.includes(playerReq)) {
                failures.push(`${where}.playerRequirement: "${playerReq}" 无法解析（期望如 "6人" 或已知特殊值 ${SPECIAL_PLAYER_REQS.join('/')}）`);
            } else {
                fieldPass++;
            }

            // quantity 与 targetName 的条目数必须一一对应（task.js 提交校验依赖）
            const targetNames = String(trial.targetName || '').split(',').filter(s => s.trim() !== '');
            const quantities = String(trial.quantity || '').split(',').filter(s => s.trim() !== '');
            if (targetNames.length > 0 && targetNames.length !== quantities.length) {
                failures.push(`${where}: targetName 有 ${targetNames.length} 项但 quantity 有 ${quantities.length} 项，数量不匹配（期望一一对应）`);
            }

            // 副本引用的怪物名（target.monsters + boss）
            const referenced = [];
            if (trial.target && Array.isArray(trial.target.monsters)) {
                trial.target.monsters.forEach(m => {
                    if (m && m.name) referenced.push(m.name);
                });
            }
            if (trial.boss && trial.boss.name) {
                referenced.push(trial.boss.name);
            }
            referenced.forEach(name => {
                const inMap = monsterNamesFromMap && monsterNamesFromMap[name];
                const inItems = monsterItemNames && monsterItemNames[name];
                if (!inMap && !inItems) {
                    failures.push(`${where}: 引用的怪物 "${name}" 在 config/monsters.json 和 config/monsterItems.json 中均不存在`);
                } else if (!inMap) {
                    warnings.push(`${where}: 怪物 "${name}" 不在 config/monsters.json（仅存在于 monsterItems，可能为副本专属怪）`);
                }
            });
        });
        if (fieldPass > 0) {
            passes.push(`config/trial.json: ${trials.length} 个副本，${fieldPass} 个字段（levelRequirement/quantity/playerRequirement）解析通过`);
        }
    } catch (e) {
        failures.push(`config/trial.json: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 4. equipment.json 数值字段可转数字（仅警告） ---------- */
    try {
        const equipment = loadJson('equipment.json');
        const numericFields = ['attack', 'maxAttack', 'defense', 'agility', 'morale', 'health', 'level'];
        let checked = 0;
        let bad = 0;
        Object.keys(equipment).forEach(name => {
            const item = equipment[name];
            numericFields.forEach(field => {
                if (item && item[field] !== undefined && item[field] !== null && item[field] !== '') {
                    checked++;
                    if (!Number.isFinite(Number(item[field]))) {
                        bad++;
                        warnings.push(`config/equipment.json["${name}"].${field}: "${item[field]}" 无法转为数字`);
                    }
                }
            });
        });
        if (bad === 0) {
            passes.push(`config/equipment.json: ${checked} 个数值字段均可转为数字`);
        } else {
            passes.push(`config/equipment.json: ${checked - bad}/${checked} 个数值字段可转为数字（其余见警告）`);
        }
    } catch (e) {
        failures.push(`config/equipment.json: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 5. fbNpc.json 副本地图怪物引用完整性 ---------- */
    try {
        const fbNpc = loadJson('fbNpc.json');
        let entryCount = 0;
        Object.keys(fbNpc).forEach(fbName => {
            const locations = fbNpc[fbName];
            if (!locations || typeof locations !== 'object') {
                failures.push(`config/fbNpc.json["${fbName}"]: 结构异常，期望 {位置:[怪物]}`);
                return;
            }
            Object.keys(locations).forEach(loc => {
                if (loc === 'undefined' || loc === 'null') {
                    failures.push(`config/fbNpc.json["${fbName}"]: 存在畸形位置键 "${loc}"（无名占位位置，玩家无法进入，必须赋予规范位置名或删除）`);
                }
                const list = locations[loc];
                if (!Array.isArray(list)) {
                    failures.push(`config/fbNpc.json["${fbName}"]["${loc}"]: 期望怪物数组`);
                    return;
                }
                list.forEach(m => {
                    entryCount++;
                    if (!m || !m.name) {
                        if (m && m.type === 60) {
                            failures.push(`config/fbNpc.json["${fbName}"]["${loc}"]: type 60 奖励NPC 缺少 name（占位条目，不可领奖，必须赋予规范名称）`);
                        } else {
                            failures.push(`config/fbNpc.json["${fbName}"]["${loc}"]: 存在缺少 name 的可战斗怪物条目`);
                        }
                        return;
                    }
                    if (![50, 55, 60].includes(m.type)) {
                        failures.push(`config/fbNpc.json["${fbName}"]["${loc}"]: 怪物 "${m.name}" 的 type=${m.type} 非法（仅支持 50普通/55BOSS/60奖励NPC）`);
                    }
                    // type 50/55 可战斗怪物必须在怪物库中存在；type 60 为奖励NPC，不参与怪物库检查（如"基德船长"）
                    if (m.type === 50 || m.type === 55) {
                        const known = (monsterNamesFromMap && monsterNamesFromMap[m.name]) || (monsterItemNames && monsterItemNames[m.name]);
                        if (!known) {
                            failures.push(`config/fbNpc.json["${fbName}"]["${loc}"]: 怪物 "${m.name}" 在 config/monsters.json 和 config/monsterItems.json 中均不存在`);
                        }
                    }
                });
            });
        });
        if (entryCount > 0) {
            passes.push(`config/fbNpc.json: ${Object.keys(fbNpc).length} 个副本、${entryCount} 个怪物条目引用检查完成`);
        }
    } catch (e) {
        failures.push(`config/fbNpc.json: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 6. holiday_events.json 事件 schema & 阴历偏移表 ---------- */
    try {
        const holiday = loadJson('holiday_events.json');
        const events = holiday.events || [];
        const LUNAR_KEYS = ['lunar_new_year', 'lunar_5_5', 'lunar_7_7', 'lunar_8_15', 'lunar_9_9'];
        const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
        let lunarEventCount = 0;
        events.forEach(ev => {
            const where = `config/holiday_events.json 事件"${ev.name || ev.id || '未命名'}"`;
            // 双兼容：date 或 date_type 必须存在其一（代码 isEventActive 对两种写法均支持）
            const dateKind = ev.date || ev.date_type;
            if (!dateKind) {
                failures.push(`${where}: 缺少 date / date_type 字段`);
                return;
            }
            if (!['solar', 'lunar'].includes(dateKind)) {
                failures.push(`${where}: date/date_type="${dateKind}" 非法（仅支持 solar / lunar）`);
                return;
            }
            if (ev.date && ev.date_type && ev.date !== ev.date_type) {
                warnings.push(`${where}: date 与 date_type 同时存在且不一致（"${ev.date}" vs "${ev.date_type}"）`);
            }
            if (dateKind === 'solar') {
                if (!Number.isFinite(ev.solar_month) || !Number.isFinite(ev.solar_day)) {
                    failures.push(`${where}: solar 事件缺少有效的 solar_month / solar_day`);
                }
            } else {
                lunarEventCount++;
                if (!Number.isFinite(ev.lunar_month) || !Number.isFinite(ev.lunar_day)) {
                    failures.push(`${where}: lunar 事件缺少有效的 lunar_month / lunar_day`);
                }
            }
        });
        const offset = (holiday.system_config && holiday.system_config.lunar_calendar_offset) || {};
        const years = Object.keys(offset);
        if (lunarEventCount > 0 && years.length === 0) {
            failures.push('config/holiday_events.json: 存在阴历节日但 lunar_calendar_offset 偏移表为空');
        }
        years.forEach(year => {
            const table = offset[year];
            LUNAR_KEYS.forEach(key => {
                if (!table[key]) {
                    failures.push(`config/holiday_events.json: lunar_calendar_offset["${year}"] 缺少 ${key}`);
                } else if (!RE_DATE.test(table[key]) || !table[key].startsWith(year)) {
                    failures.push(`config/holiday_events.json: lunar_calendar_offset["${year}"].${key}="${table[key]}" 格式/年份异常（期望 ${year}-MM-DD）`);
                }
            });
        });
        passes.push(`config/holiday_events.json: ${events.length} 个事件（含 ${lunarEventCount} 个阴历节日）schema 检查完成，偏移表覆盖 ${years.sort().join('/')}`);
    } catch (e) {
        failures.push(`config/holiday_events.json: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 7. 副本提交链完整性：submitNpc 非空且可被找到 ---------- */
    try {
        const trials = loadJson('trial.json');
        const fbNpc = loadJson('fbNpc.json');
        const npcs = loadJson('npcs.json');

        // npcs.json 全部 NPC 名索引：城市 -> 位置 -> [{name, ...}]
        const npcNames = {};
        Object.keys(npcs).forEach(city => {
            const positions = npcs[city];
            if (!positions || typeof positions !== 'object') return;
            Object.keys(positions).forEach(pos => {
                const list = positions[pos];
                if (!Array.isArray(list)) return;
                list.forEach(n => {
                    if (n && n.name) npcNames[n.name] = true;
                });
            });
        });

        let chainChecked = 0;
        trials.forEach((trial, index) => {
            const where = `config/trial.json[${index}]（${trial.name || '未命名副本'}）`;
            chainChecked++;

            // submitLocation 非空（进入副本时作为玩家初始位置，空值会导致无处可去）
            if (!trial.submitLocation || String(trial.submitLocation).trim() === '') {
                failures.push(`${where}.submitLocation: 为空，玩家进入副本后无初始位置可活动`);
            }

            // submitDialog 非空（提交后展示文案）
            if (!Array.isArray(trial.submitDialog) || trial.submitDialog.length === 0) {
                failures.push(`${where}.submitDialog: 缺失或为空，提交后无文案可展示`);
            }

            // submitNpc 非空且可被找到：
            // 副本内 npc.getStatus 仅展示当前位置 type 60 的 fbNpc，因此发奖 NPC 需在该副本的 fbNpc（type 60）中，
            // 或者在 npcs.json 中已存在（如“牛头山守卫”）
            if (!trial.submitNpc || String(trial.submitNpc).trim() === '') {
                failures.push(`${where}.submitNpc: 为空，玩家完成击杀目标后无处提交、无法领奖`);
            } else {
                let foundInFb = false;
                const fbLocations = fbNpc[trial.name];
                if (fbLocations && typeof fbLocations === 'object') {
                    Object.keys(fbLocations).forEach(loc => {
                        const list = fbLocations[loc];
                        if (!Array.isArray(list)) return;
                        list.forEach(m => {
                            if (m && m.name === trial.submitNpc && m.type === 60) foundInFb = true;
                        });
                    });
                }
                if (!foundInFb && !npcNames[trial.submitNpc]) {
                    failures.push(`${where}.submitNpc: "${trial.submitNpc}" 在 config/fbNpc.json["${trial.name}"]（type 60）和 config/npcs.json 中均不存在，玩家找不到该 NPC 提交`);
                }
            }
        });
        if (chainChecked > 0) {
            passes.push(`config/trial.json: ${chainChecked} 个副本提交链（submitLocation/submitNpc/submitDialog）完整性检查通过`);
        }
    } catch (e) {
        failures.push(`副本提交链校验: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 8. 【warning】商人货源覆盖：worldMap 世界 -> cityShop 键 ---------- */
    try {
        const worldMap = loadJson('worldMap.json');
        const cityShop = loadJson('cityShop.json');
        let worldChecked = 0;
        Object.keys(worldMap).forEach(world => {
            const cities = worldMap[world];
            if (!Array.isArray(cities)) return;
            worldChecked++;
            if (cityShop[world]) return; // 世界级键存在，商人可取货
            const missing = cities.filter(c => !cityShop[c]);
            if (missing.length > 0) {
                warnings.push(`config/worldMap.json["${world}"]: cityShop 缺少世界键 "${world}"，且以下城市无城市级键，商人(105) 将无货：${missing.join('、')}`);
            }
        });
        if (worldChecked > 0) {
            passes.push(`config/cityShop.json: ${worldChecked} 个世界的商人货源覆盖检查完成`);
        }
    } catch (e) {
        warnings.push(`商人货源覆盖校验: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 9. 【warning】副本接引 NPC：trial.receiveNpc 存在于 npcs ---------- */
    try {
        const trials = loadJson('trial.json');
        const npcs = loadJson('npcs.json');
        const npcNames = {};
        Object.keys(npcs).forEach(city => {
            const positions = npcs[city];
            if (!positions || typeof positions !== 'object') return;
            Object.keys(positions).forEach(pos => {
                const list = positions[pos];
                if (!Array.isArray(list)) return;
                list.forEach(n => { if (n && n.name) npcNames[n.name] = true; });
            });
        });
        let receiveChecked = 0;
        trials.forEach((trial, index) => {
            const where = `config/trial.json[${index}]（${trial.name || '未命名副本'}）`;
            if (!trial.receiveNpc || String(trial.receiveNpc).trim() === '') {
                warnings.push(`${where}.receiveNpc: 为空，副本无接引 NPC，玩家无法进入`);
                return;
            }
            receiveChecked++;
            if (!npcNames[trial.receiveNpc]) {
                warnings.push(`${where}.receiveNpc: "${trial.receiveNpc}" 不在 config/npcs.json 任何城市/地点，玩家找不到接引 NPC 进入副本`);
            }
        });
        if (receiveChecked > 0) {
            passes.push(`config/trial.json: ${receiveChecked} 个副本的接引 NPC(receiveNpc) 存在性检查完成`);
        }
    } catch (e) {
        warnings.push(`副本接引NPC校验: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 10. 【warning】商店/市场物品消费契约 ---------- */
    try {
        const cityShop = loadJson('cityShop.json');
        const shopItems = loadJson('shopItems.json');
        // getShopItems(105) 仅用 nameToItem(shopItems) 解析 cityShop 商品名
        const nameToItem = {};
        shopItems.forEach(i => { if (i && i.name) nameToItem[i.name] = true; });
        let shopTotal = 0, shopBad = 0;
        Object.keys(cityShop).forEach(scope => {
            const arr = cityShop[scope];
            if (!Array.isArray(arr)) return;
            arr.forEach(v => {
                if (!v || !v.name) return;
                shopTotal++;
                if (!nameToItem[v.name]) {
                    shopBad++;
                    warnings.push(`config/cityShop.json["${scope}"]: 商品 "${v.name}" 无法被 nameToItem(shopItems) 解析，getShopItems(105) 会跳过该条目（商人缺货）`);
                }
            });
        });

        // marketItems 为 type=11 自定义货物，getShopItems(111) 直接消费键名，不经 nameToItem；
        // config/index.js 以 getRandomBetween(+v[0], +v[1]) 生成价格，故校验价格区间格式
        const marketItems = loadJson('marketItems.json');
        let mktTotal = 0, mktBad = 0;
        Object.keys(marketItems).forEach(city => {
            const goods = marketItems[city];
            if (!goods || typeof goods !== 'object') return;
            Object.keys(goods).forEach(name => {
                mktTotal++;
                const v = goods[name];
                const okRange = Array.isArray(v) && v.length === 2
                    && Number.isFinite(+v[0]) && Number.isFinite(+v[1]) && (+v[0]) <= (+v[1]);
                if (!okRange) {
                    mktBad++;
                    warnings.push(`config/marketItems.json["${city}"]["${name}"]: 价格 ${JSON.stringify(v)} 非法，期望 [最低价, 最高价] 数字区间（该条目将在加载时被剔除）`);
                }
            });
        });
        passes.push(`config/cityShop.json: ${shopTotal - shopBad}/${shopTotal} 个商品名可被 nameToItem 解析；config/marketItems.json: ${mktTotal - mktBad}/${mktTotal} 个价格区间合法`);
    } catch (e) {
        warnings.push(`商店/市场物品解析校验: 读取/解析失败（${e.message}）`);
    }

    /* ---------- 11. 【warning】副本收集物品掉落来源 ---------- */
    try {
        const trials = loadJson('trial.json');
        const monsterItems = loadJson('monsterItems.json');
        const monsterDrops = loadJson('monsterDrops.json');
        const fbNpc = loadJson('fbNpc.json');
        // 反向掉落索引：monsterItems / monsterDrops 结构均为 怪物名 -> [掉落物品名...]，前缀 '+' 表示特殊掉落
        const droppable = {};
        [monsterItems, monsterDrops].forEach(src => {
            Object.keys(src).forEach(mon => {
                const arr = src[mon];
                if (!Array.isArray(arr)) return;
                arr.forEach(it => {
                    if (typeof it !== 'string') return;
                    const nm = it.replace(/^\+/, '');
                    if (nm) droppable[nm] = true;
                });
            });
        });
        let collectChecked = 0, collectBad = 0;
        trials.forEach((trial, index) => {
            const where = `config/trial.json[${index}]（${trial.name || '未命名副本'}）`;

            // 本副本的“怪物名”集合：target.monsters + boss + fbNpc[副本名] 全部条目
            const monsterNameSet = {};
            if (trial.target && Array.isArray(trial.target.monsters)) {
                trial.target.monsters.forEach(m => { if (m && m.name) monsterNameSet[m.name] = true; });
            }
            if (trial.boss && trial.boss.name) monsterNameSet[trial.boss.name] = true;
            const fbLocs = fbNpc[trial.name];
            if (fbLocs && typeof fbLocs === 'object') {
                Object.keys(fbLocs).forEach(loc => {
                    const list = fbLocs[loc];
                    if (!Array.isArray(list)) return;
                    list.forEach(m => { if (m && m.name) monsterNameSet[m.name] = true; });
                });
            }

            // 待校验的收集物名集合：target.items + targetName 拆分中非怪物的名字（去重）
            const collectNames = {};
            if (trial.target && Array.isArray(trial.target.items)) {
                trial.target.items.forEach(it => { if (it && it.name) collectNames[it.name] = true; });
            }
            String(trial.targetName || '').split(',').map(s => s.trim()).filter(Boolean).forEach(nm => {
                if (!monsterNameSet[nm]) collectNames[nm] = true;
            });

            Object.keys(collectNames).forEach(name => {
                collectChecked++;
                if (!droppable[name]) {
                    collectBad++;
                    warnings.push(`${where}: 收集物品 "${name}" 在 config/monsterItems.json / monsterDrops.json 中无任何怪物掉落来源，玩家无法凑齐提交`);
                }
            });
        });
        if (collectChecked > 0) {
            passes.push(`config/trial.json: ${collectChecked - collectBad}/${collectChecked} 个副本收集物品存在 monsterItems/monsterDrops 掉落来源`);
        }
    } catch (e) {
        warnings.push(`副本收集物品掉落来源校验: 读取/解析失败（${e.message}）`);
    }

    return { ok: failures.length === 0, passes, failures, warnings };
}

/** 打印校验报告 */
export function printReport(result) {
    console.log('========== config 校验报告 ==========');
    result.passes.forEach(msg => console.log(`  [√] ${msg}`));
    result.warnings.forEach(msg => console.log(`  [!] 警告: ${msg}`));
    result.failures.forEach(msg => console.log(`  [x] 失败: ${msg}`));
    console.log(`结果：${result.passes.length} 项通过，${result.warnings.length} 项警告，${result.failures.length} 项失败`);
    console.log('=====================================');
}

// 直接执行入口：node scripts/validate-config.js
const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
    const result = validateConfigs();
    printReport(result);
    process.exitCode = result.ok ? 0 : 1;
}
