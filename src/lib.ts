// pixi.js v4.8.9
/// <reference path="../lib/pixi.min.d.ts" />

// pixi-spine v2.?.?
/// <reference path="../lib/pixi-spine.d.ts" />

// string-similarity v4.0.4, un-minified and standalone-ified by chatgpt
function findBestMatch(query, candidates) {
    function compareTwoStrings(str1, str2) {
        str1 = str1.replace(/\s+/g, "");
        str2 = str2.replace(/\s+/g, "");
        if (str1 === str2) return 1;
        if (str1.length < 2 || str2.length < 2) return 0;
        let bigramMap = new Map();
        for (let i = 0; i < str1.length - 1; i++) {
            const bigram = str1.substring(i, i + 2);
            bigramMap.set(bigram, (bigramMap.get(bigram) || 0) + 1);
        }
        let matchCount = 0;
        for (let i = 0; i < str2.length - 1; i++) {
            const bigram = str2.substring(i, i + 2);
            if (bigramMap.has(bigram) && bigramMap.get(bigram) > 0) {
                bigramMap.set(bigram, bigramMap.get(bigram) - 1);
                matchCount++;
            }
        }
        return (2 * matchCount) / (str1.length + str2.length - 2);
    }
    if (typeof query !== 'string' || !Array.isArray(candidates) || candidates.some(candidate => typeof candidate !== 'string')) {
        throw new Error("Bad arguments: First argument should be a string, second should be an array of strings");
    }
    let results = [];
    let bestMatchIndex = 0;
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const similarity = compareTwoStrings(query, candidate);
        results.push({ target: candidate, rating: similarity });
        if (similarity > results[bestMatchIndex].rating) {
            bestMatchIndex = i;
        }
    }
    return {
        ratings: results,
        bestMatch: results[bestMatchIndex],
        bestMatchIndex: bestMatchIndex
    };
}
