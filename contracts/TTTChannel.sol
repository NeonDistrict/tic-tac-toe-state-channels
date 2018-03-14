pragma solidity ^0.4.21;

import 'zeppelin-solidity/contracts/ECRecovery.sol';


// TODO: Handle timeout/un-repsonsiveness
// NOTE: sample code at https://github.com/ethereum/EIPs/pull/712
contract TTTChannel {

    using ECRecovery for bytes32;

    event ChallengeMade(address indexed _challengerIdx, address indexed _opponentIdx, address _challenger, address _opponent, uint256 _gameId);

    struct Game {
        address challenger;
        address challenged;
        uint256 startTime;
        address winner;
        uint8[9] moves;
    }

    Game[] public games;

    function challenge(address _opponent) external {
        // TODO: Players can only play each other once per day
        // require(once per day)
        emit ChallengeMade(msg.sender, _opponent, msg.sender, _opponent, games.length);
        games.push(Game(msg.sender, _opponent, now, 0x0, [0, 0, 0, 0, 0, 0, 0, 0, 0]));
    }

    function gameOver(uint256 _gameId, uint8[9] _moves, address _winner, bytes _gameSig, bytes _gameOverSig) external {
        Game storage _game = games[_gameId];

        require(_game.challenged == keccak256(_gameSig).recover(_gameOverSig));

        address _challenger = getSignerOfGameHash(_gameId, _moves, _winner, _gameSig);
        require(_challenger == _game.challenger);

        _game.winner = _winner;
        _game.moves = _moves;
    }

    function getSignerOfGameHash(uint256 _gameId, uint8[9] _moves, address _winner, bytes _gameSigned) public view returns (address) {
        bytes32 _gameHash = generateGameHash(_gameId, _moves, _winner);
        return _gameHash.recover(_gameSigned);
    }

    function generateGameHash(uint256 _gameId, uint8[9] _moves, address _winner) public view returns (bytes32) {
        return keccak256(games[_gameId].challenged, _moves, _winner, _gameId);
    }

    function generateKeccak256(bytes _message) public pure returns (bytes32) {
        return keccak256(_message);
    }

    function gamesLength() external view returns (uint256) {
        return games.length;
    }
}
