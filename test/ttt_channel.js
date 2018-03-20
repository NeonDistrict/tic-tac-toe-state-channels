var ethUtils = require('ethereumjs-util');

let TTTChannel = artifacts.require('TTTChannel.sol');
let ECRecovery = artifacts.require('ECRecovery.sol');

let tenMinutes = 10*60;

contract('TTTChannel', function([_, challenger, challenged]) {
    let channel;

    let privateKeys = {};
    // These need to be changed every time ganache is restarted. They are the 2nd and 3rd private keys.
    privateKeys[challenger] = '0xc2acccc51ed58ba9326f5b0bd0247a461ddff9e782f7e8d40c1bf6c635e62586';
    privateKeys[challenged] = '0xf8693d08cf31c71244865d48360d4b0239a7cc798c49ac514f060fa64e6ab5da';

    beforeEach(async () => {
        const ecrecovery = await ECRecovery.new();
        TTTChannel.link('ECRecovery', ecrecovery.address);
        channel = await TTTChannel.new();
        await channel.challenge(challenged, {from: challenger});
    });

    // Sign a message with a private key, it returns the signature in rpc format
    function signMsg(msg, pvKey) {
        const sig = ethUtils.ecsign(ethUtils.toBuffer(msg), ethUtils.toBuffer(pvKey));
        return ethUtils.toRpcSig(sig.v, sig.r, sig.s);
    }

    it("should create a new game when a new challenge appears", async () => {
        let gameCount = await channel.gamesLength();
        assert.equal(gameCount.toNumber(), 1);
    });

    it("should complete a game when both players sign off on it", async () => {
        let moves = [7, 1, 4, 2, 5, 3]; // challenger wins
        let hash = await channel.generateGameHash(0, moves, challenger);
        let gameSig = signMsg(hash, privateKeys[challenger])

        assert.equal(await channel.getSignerOfGameHash(0, moves, challenger, gameSig), challenger);

        const gameHash = await channel.generateKeccak256(gameSig);
        const gameOverSig = signMsg(gameHash, privateKeys[challenged]);

        await channel.gameOver(0, moves, challenger, gameSig, gameOverSig);

        let game = await channel.games(0);
        assert.equal(game[0], challenger);
        assert.equal(game[1], challenged);
        assert.equal(game[3], challenger); // winner

        let gameMoves = await channel.gameMoves(0);
        assert.equal(gameMoves[0], 7);
        assert.equal(gameMoves[1], 1);
    });

    it("should allow game to be put in timeout by one player and then continued by other player", async () => {
        let moves = [1]; // challenger never moves

        await channel.timeout(0, moves, {from: challenged});

        let game = await channel.games(0);
        assert.equal(game[4], now() + tenMinutes); // timeout
        assert.equal(game[5], challenger); // inactive player
        assert.equal(game[6], challenged); // waiting player

        let gameMoves = await channel.gameMoves(0);
        assert.equal(1, gameMoves[0]);

        await channel.cancelTimeout(0, [1, 2], {from: challenger});
        game = await channel.games(0);
        assert.equal(game[4], 0); // timeout
        assert.equal(game[5], 0); // inactive player
        assert.equal(game[6], 0); // inactive player

        gameMoves = await channel.gameMoves(0);
        assert.equal(2, gameMoves[1]);
    });

    it("should allow game to be put in timeout and then eventually closed out", async () => {
        let moves = []; // challenged never moves

        await channel.timeout(0, moves, {from: challenger});

        increaseTime(tenMinutes+1);

        await channel.winByForfeit(0, {from: challenger});

        let game = await channel.games(0);
        assert.equal(game[3], challenger); // winner
    });
});

function now() {
    return web3.eth.getBlock('latest').timestamp;
}

function increaseTime(duration) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1);

      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
}
