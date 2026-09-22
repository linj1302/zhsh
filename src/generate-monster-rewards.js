/**
 * 生成 config/monsterRewards.json —— 击杀怪物经验/铜贝的逐等级固定数值表。
 *
 * 设计（固定化）：
 * - 怪物奖励与玩家经验曲线（exp.json）解耦：曲线调整不会隐式改变怪物奖励；
 * - exp(L)    = exp.json 同级玩家升级需求 ÷ balance.monsterExp.killsPerLevel（初始标定，之后以表为准可直接手改）
 * - copper(L) = balance.monsterCopper.base × L^exponent（同上）
 * - 运行时唯一消费者是 formulas.calcMonsterExp / calcMonsterCopper（含 BOSS/副本类型倍率）。
 *
 * 用法：node src/generate-monster-rewards.js
 * ⚠️ 重新生成会覆盖手工修改，改动前先把期望值同步进上方参数来源。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfgDir = path.join(__dirname, '..', 'config');

const expJson = JSON.parse(fs.readFileSync(path.join(cfgDir, 'exp.json'), 'utf8'));
const balance = JSON.parse(fs.readFileSync(path.join(cfgDir, 'balance.json'), 'utf8'));

const maxLevel = balance.playerExp.maxLevel;
const kills = balance.monsterExp.killsPerLevel;
const copperCfg = balance.monsterCopper;

const table = {};
for (let level = 1; level <= maxLevel; level++) {
    const playerNeed = Number(expJson[level]);
    if (!Number.isFinite(playerNeed) || playerNeed <= 0) {
        console.error(`[monsterRewards] exp.json 缺失或非法等级 ${level}，终止生成`);
        process.exit(1);
    }
    table[level] = {
        exp: Math.max(1, Math.floor(playerNeed / kills)),
        copper: Math.floor(copperCfg.base * Math.pow(level, copperCfg.exponent)),
    };
}

const outFile = path.join(cfgDir, 'monsterRewards.json');
fs.writeFileSync(outFile, JSON.stringify(table, null, 1), 'utf8');

console.log(`已生成 ${outFile}（等级 1-${maxLevel}，killsPerLevel=${kills}）`);
for (const l of [1, 10, 50, 100, 150, 210]) {
    if (table[l]) console.log(`  lv${l}: exp=${table[l].exp.toLocaleString()} copper=${table[l].copper.toLocaleString()}`);
}
