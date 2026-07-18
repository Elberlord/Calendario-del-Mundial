const assert = require("assert");
const {
  alignRemoteOrientation,
  reverseScoreText,
  parseScoreText
} = require("./update-worldcup-public");

assert.deepStrictEqual(parseScoreText("1-1 (2-4)"), {
  home: 1,
  away: 1,
  pensHome: 2,
  pensAway: 4
});

assert.strictEqual(reverseScoreText("2-1"), "1-2");
assert.strictEqual(reverseScoreText("1-1 (2-4)"), "1-1 (4-2)");

const existing = { home: "Francia", away: "Inglaterra" };
const reversedRemote = {
  home: "Inglaterra",
  away: "Francia",
  score: "2-1",
  status: "complete",
  winner: "Inglaterra"
};
const aligned = alignRemoteOrientation(reversedRemote, existing);
assert.strictEqual(aligned.home, "Francia");
assert.strictEqual(aligned.away, "Inglaterra");
assert.strictEqual(aligned.score, "1-2");
assert.strictEqual(aligned.winner, "Inglaterra");

const directRemote = { home: "Francia", away: "Inglaterra", score: "3-0" };
assert.strictEqual(alignRemoteOrientation(directRemote, existing), directRemote);

console.log("Pruebas del actualizador superadas.");
