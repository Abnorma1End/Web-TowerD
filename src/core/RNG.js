// Simple, fast, seedable RNG with a friendly API.
// Deterministic per seed string.
// Exposes: range(max=1) -> [0,max), int(min,maxExclusive), chance(p), pick(arr), shuffle(arr)

export class RNG {
    constructor(seed = 'seed') {
        // xmur3 string hash → 32-bit seed for mulberry32
        this._seed = xmur3(seed)();
        this._state = this._seed >>> 0;
    }

    // Core PRNG: mulberry32
    _mulberry32() {
        let t = (this._state += 0x6D2B79F5) | 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Float in [0, max)
    range(max = 1) {
        return this._mulberry32() * max;
    }

    // Integer in [min, maxExclusive)
    int(min, maxExclusive) {
        if (maxExclusive === undefined) {
            maxExclusive = min;
            min = 0;
        }
        if (maxExclusive <= min) return min;
        const span = maxExclusive - min;
        return min + Math.floor(this.range(span));
    }

    // True with probability p (0..1)
    chance(p) {
        if (p <= 0) return false;
        if (p >= 1) return true;
        return this.range(1) < p;
    }

    // Pick one element from an array
    pick(arr) {
        if (!arr || arr.length === 0) return undefined;
        return arr[this.int(arr.length)];
    }

    // In-place Fisher–Yates shuffle (also returns the array)
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

// -------- helpers (private) --------
function xmur3(str) {
    // 32-bit string hash → function that returns 32-bit seeds
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    };
}
