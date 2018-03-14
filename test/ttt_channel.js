var ethUtils = require('ethereumjs-util');


let TTTChannel = artifacts.require('TTTChannel.sol');
let ECRecovery = artifacts.require('ECRecovery.sol');


contract('TTTChannel', function([_, challenger, challenged]) {
    let channel;

    // These private keys should match the ones used by testrpc    
    let privateKeys = {};
    privateKeys[challenger] = '0x0bbd25f3721c8efc84fb9b657ea46539163f5ef185c952ad64864c1fc8cddf8d';
    privateKeys[challenged] = '0x80b938c0b44ed7fd8de077d82f3e6483fff826cc5c34f7c9696578a6248d52d0';

    beforeEach(async () => {
        const ecrecovery = await ECRecovery.new();
        TTTChannel.link('ECRecovery', ecrecovery.address);
        channel = await TTTChannel.new();
    });

    // Sign a message with a private key, it returns the signature in rpc format
    function signMsg(msg, pvKey) {
        const sig = ethUtils.ecsign(ethUtils.toBuffer(msg), ethUtils.toBuffer(pvKey));
        return ethUtils.toRpcSig(sig.v, sig.r, sig.s);
    }

    it("should create a new game when a new challenge appears", async () => {
        await channel.challenge(challenged, {from: challenger});
        let gameCount = await channel.gamesLength();
        assert.equal(gameCount.toNumber(), 1);
    });

    it("should complete a game when both players sign off on it", async () => {
        await channel.challenge(challenged, {from: challenger});
        let moves = [1, 4, 2, 5, 3];

        let hash = await channel.generateGameHash(0, moves, challenger);
        let gameSig = signMsg(hash, privateKeys[challenger])

        assert.equal(challenger,
              await channel.getSignerOfGameHash(0, moves, challenger, gameSig)
        );

        const gameHash = await channel.generateKeccak256(gameSig);
        const gameOverSig = signMsg(gameHash, privateKeys[challenged]);

        await channel.gameOver(0, moves, challenger, gameSig, gameOverSig);

        let game = await channel.games(0);
        assert.equal(game[0], challenger);
        assert.equal(game[1], challenged);
        assert.equal(game[3], challenger);

        // TODO: How to get the moves? WTF?
        // let firstMove = await channel.games(0, 0);
        // assert.equal(firstMove, moves[0]);
    });

});
