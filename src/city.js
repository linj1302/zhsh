import * as config from '../config/index.js'

const {
    cityMap,
    insideMap,
    cityToWorld,
    monsters,
    shipNpc,
    fbNpc,
    shipMap
} = config;

export default class City {
    constructor() {
        this._city = "威尼斯";
        this._position = "酒馆";
        this._coordinates = null;
        this.monsterCache = {};
        this.cacheExpirations = {};
    }

    resetCity() {
        this._city = "威尼斯";
        this._position = "福利院";
        this._coordinates = null;
    }

    get coordinates() {
        if (this._coordinates) {
            return this._coordinates
        }
        // 支持航行副本（shipMap）和普通城市（cityMap）
        const arr = cityMap[this._city] || shipMap[this._city];
        if (!arr) return {x: 0, y: 0};
        const position = this.position;
        let x = 0, y = 0;
        arr.some((item, i) => {
            return item.some((p, j) => {
                if (p === position) {
                    x = j;
                    y = i;
                    return true;
                }
            })
        })
        return {x, y}
    }

    set coordinates(value) {
        this._coordinates = value
    }

    get position() {
        return this._position;
    }

    set position(value) {
        this._position = value;
    }

    getPositionByCity(l, city) {
        let locationName = l;
        if (l.startsWith(city)) {
            locationName = l.substring(city.length);
        }

        const cityConfig = insideMap[city];
        if (!cityConfig) {
            return;
        }

        const {w, n} = cityConfig;

        if (!w && !n) {
            return;
        }

        let candidates = [...(n || [])];
        Object.keys(w || {}).forEach(key => candidates.push(key));

        let bestMatch = null;

        for (const candidate of candidates) {
            if (locationName === candidate) {
                bestMatch = candidate;
                break;
            }
        }

        if (bestMatch) {
            return bestMatch
        }
        
        let matches = [];
        for (const candidate of candidates) {
            if (locationName.includes(candidate)) {
                matches.push(candidate);
            }
        }

        if (matches.length > 0) {
            bestMatch = matches[matches.length - 1];
        }
        
        return bestMatch
    }

    getCityByName(name) {
        let res = null
        Object.keys(insideMap).some(city => {
            if (name.startsWith(city)) {
                res = city
                return true
            }
        })
        if (res) {
            return res
        }

        Object.keys(insideMap).some(city => {
            if (name.includes(city)) {
                res = city
                return true
            }
        })
        return res
    }

    moveCityAndLocation(name) {
        const city = this.getCityByName(name)
        if (city) {
            this.moveTo(city)
            this.moveLocation(name)
        }
    }

    moveLocation(l) {
        const position = this.getPositionByCity(l, this._city);
        if (position) {
            this.moveToPosition(position);
        }
    }

    move(dir) {
        let {x, y} = this.coordinates
        switch (dir) {
            case "东":
                x++;
                break;
            case "南":
                y++;
                break;
            case "西":
                x--;
                break;
            case "北":
                y--;
                break;
        }
        this._coordinates = {x, y}
        // 支持航行副本（shipMap）和普通城市（cityMap）
        const arr = cityMap[this._city] || shipMap[this._city];
        if (arr && arr[y] && arr[y][x]) {
            this._position = arr[y][x]
        }
    }

    moveToPosition(position) {
        this._position = position;
        this._coordinates = null;
    }

    moveTo(city) {
        this._city = city;
        this._position = "码头";
        this._coordinates = null;
    }

    getInsideMap() {
        return insideMap[this._city].n
    }

    getDirs() {
        // 支持航行副本（shipMap）和普通城市（cityMap）
        const arr = cityMap[this._city] || shipMap[this._city];
        if (!arr) return [];
        const {x, y} = this.coordinates
        const obj = {
            '东': arr[y]?.[x + 1],
            '南': arr[y + 1]?.[x],
            '西': arr[y]?.[x - 1],
            '北': arr[y - 1]?.[x],
        }
        return Object.keys(obj).filter(v => obj[v]).map(v => {
            return {
                value: v,
                label: obj[v]
            }
        })
    }

    getMonsterCacheKey() {
        const coordinatesStr = this._coordinates ? `${this._coordinates.x},${this._coordinates.y}` : 'null';
        return `${this._city}-${this._position}-${coordinatesStr}`;
    }

    getMonsterCache(play) {
        const cacheKey = this.getMonsterCacheKey();
        const cache = this.monsterCache[cacheKey];
        const expiration = this.cacheExpirations[cacheKey];

        if (cache && expiration && Date.now() < expiration) {
            return cache.monsters;
        }

        delete this.monsterCache[cacheKey];
        delete this.cacheExpirations[cacheKey];
        return this.generateMonsterCache(play);
    }

    generateMonsterCache(play) {
        const cacheKey = this.getMonsterCacheKey();

        let monsterList = [];

        if (shipNpc[this._city] && shipNpc[this._city][this._position]) {
            monsterList = shipNpc[this._city][this._position];
        } else if (fbNpc[this._city] && fbNpc[this._city][this._position]) {
            monsterList = fbNpc[this._city][this._position];
        } else if (monsters[this._city] && monsters[this._city][this._position]) {
            monsterList = monsters[this._city][this._position];
        }

        let availableMonsterTypes = [];
        if (shipNpc[this._city] && shipNpc[this._city][this._position]) {
            // 船副本：类型40（普通）和类型45（BOSS）
            availableMonsterTypes = [40, 45];
        } else if (fbNpc[this._city] && fbNpc[this._city][this._position]) {
            // 副本：类型50（普通）和类型55（BOSS）
            availableMonsterTypes = [50, 55];
        } else {
            // 普通城市地图：类型5（普通）和类型6（BOSS）
            availableMonsterTypes = [5, 6];
        }

        const availableMonsters = monsterList.filter(monster =>
            availableMonsterTypes.includes(monster.type)
        );

        if (availableMonsters.length === 0) {
            const cacheData = {
                monsters: [],
                timestamp: Date.now()
            };
            this.monsterCache[cacheKey] = cacheData;
            this.cacheExpirations[cacheKey] = Date.now() + 5 * 60 * 1000;
            return [];
        }

        const selectedTypes = [];
        const typesToSelect = Math.min(availableMonsters.length, Math.floor(Math.random() * 3) + 1);

        const shuffled = [...availableMonsters].sort(() => 0.5 - Math.random());
        for (let i = 0; i < typesToSelect && i < shuffled.length; i++) {
            if (!selectedTypes.some(m => m.name === shuffled[i].name)) {
                selectedTypes.push(shuffled[i]);
            }
        }

        const totalMonsters = Math.floor(Math.random() * 3) + 3;
        const generatedMonsters = [];

        let remaining = totalMonsters;
        for (let i = 0; i < selectedTypes.length; i++) {
            const maxAllocatable = remaining - (selectedTypes.length - i - 1);
            const count = i === selectedTypes.length - 1 ? remaining : Math.floor(Math.random() * maxAllocatable) + 1;

            for (let j = 0; j < count; j++) {
                const baseMonster = {...selectedTypes[i]};
                let newLevel = baseMonster.level;

                if (newLevel) {
                    const percentChange = Math.floor(newLevel * 0.2);
                    const maxChange = Math.min(percentChange, 10);
                    const change = Math.floor(Math.random() * (maxChange * 2 + 1)) - maxChange;
                    newLevel = Math.max(1, Math.min(210, newLevel + change));
                }

                generatedMonsters.push({
                    ...baseMonster,
                    level: newLevel,
                    id: `${baseMonster.name}-${Date.now()}-${Math.random()}`
                });
            }

            remaining -= count;
        }

        const cacheData = {
            monsters: generatedMonsters,
            timestamp: Date.now()
        };
        this.monsterCache[cacheKey] = cacheData;
        this.cacheExpirations[cacheKey] = Date.now() + 30 * 1000;

        return generatedMonsters;
    }

    removeDefeatedMonster(monsterId) {
        const cacheKey = this.getMonsterCacheKey();
        const cache = this.monsterCache[cacheKey];

        if (cache) {
            cache.monsters = cache.monsters.filter(monster => monster.id !== monsterId);
            cache.timestamp = Date.now();

            if (cache.monsters.length === 0) {
                delete this.monsterCache[cacheKey];
                delete this.cacheExpirations[cacheKey];
            }
        }
    }

    clearMonsterCache() {
        const cacheKey = this.getMonsterCacheKey();
        delete this.monsterCache[cacheKey];
        delete this.cacheExpirations[cacheKey];
    }

    getStatus() {
        const world = cityToWorld[this._city]
        return {
            city: this._city,
            position: this._position,
            coordinates: this._coordinates,
            world,
        };
    }
}
