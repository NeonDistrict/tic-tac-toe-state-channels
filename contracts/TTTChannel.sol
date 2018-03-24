pragma solidity ^0.4.21;

import 'zeppelin-solidity/contracts/ECRecovery.sol';


contract TTTChannel {

    using ECRecovery for bytes32;

    event ChallengeMade(address indexed _challengerIdx, address indexed _opponentIdx, address _challenger, address _opponent, uint256 _gameId);

    uint256 public constant TIMEOUT = 10 minutes;

    struct Game {
        address challenger;
        address challenged;
        uint256 startTime;
        address winner;
        uint256 timeout;
        address inactive;
        address waiting;
        uint8[9] moves;
    }

    // The moves array is the sequence of moves in the game. Each move is
    // represented by a number between 1-9, inclusive. Each of those numbers
    // represents a location on the board:
    //
    // 1 | 2 | 3
    // ---------
    // 4 | 5 | 6
    // ---------
    // 7 | 8 | 9
    //
    // The challenged player moves first. So this array represents a challenger
    // victory: [7, 1, 4, 2, 5, 3]

    Game[] public games;

    function challenge(address _opponent) external {
        // TODO: Players can only play each other once per day
        emit ChallengeMade(msg.sender, _opponent, msg.sender, _opponent, games.length);
        games.push(Game(msg.sender, _opponent, now, 0x0, 0, 0x0, 0x0, [0, 0, 0, 0, 0, 0, 0, 0, 0]));
    }

    // TODO: validate moves... validate winner?
    function gameOver(uint256 _gameId, uint8[9] _moves, address _winner, bytes _gameSig, bytes _gameOverSig) external {
        Game storage _game = games[_gameId];

        require(_game.challenged == keccak256(_gameSig).recover(_gameOverSig));

        address _challenger = getSignerOfGameHash(_gameId, _moves, _gameSig);
        require(_challenger == _game.challenger);

        _game.winner = _winner;
        _game.moves = _moves;

        // emit Event
    }

    // TODO: challenger can't timeout unless there's a signed game with a move from the challenged
    function timeout(uint256 _gameId, uint8[9] _moves, bytes _gameSig) external {
        Game storage _game = games[_gameId];
        require(_game.timeout == 0); // not already timing out

        if (msg.sender == _game.challenger) {
            _game.inactive = _game.challenged;
            _game.waiting = _game.challenger;
        } else if (msg.sender == _game.challenged) {
            _game.inactive = _game.challenger;
            _game.waiting = _game.challenged;
        } else {
            revert(); // only the players can call timeout
        }

        if (_gameSig.length == 0) {
            // TODO: revert unless its the challenged
        } else {
            address _challenger = getSignerOfGameHash(_gameId, _moves, _gameSig);
            require(_challenger == _game.challenger);
        }

        _game.moves = _moves; // validate moves
        _game.timeout = now + TIMEOUT;

        // emit Event so the other player can be notified
    }

    function cancelTimeout(uint256 _gameId, uint8[9] _moves) external {
        Game storage _game = games[_gameId];
        require(_game.inactive == msg.sender);
        require(_game.timeout > now);

        _game.moves = _moves; // validate moves
        _game.timeout = 0;
        _game.inactive = 0x0;
        _game.waiting = 0x0;

        // emit Event so the other player can be notified
    }

    function winByForfeit(uint256 _gameId) external {
        Game storage _game = games[_gameId];
        require(_game.waiting == msg.sender);
        require(_game.timeout < now);

        _game.winner = msg.sender;

        // emit Event
    }

    function getSignerOfGameHash(uint256 _gameId, uint8[9] _moves, bytes _gameSigned) public pure returns (address) {
        bytes32 _gameHash = generateGameHash(_gameId, _moves);
        return _gameHash.recover(_gameSigned);
    }

    function generateGameHash(uint256 _gameId, uint8[9] _moves) public pure returns (bytes32) {
        return keccak256(_moves, _gameId);
    }

    function generateKeccak256(bytes _message) public pure returns (bytes32) {
        return keccak256(_message);
    }

    function gamesLength() external view returns (uint256) {
        return games.length;
    }

    function gameMoves(uint256 _gameId) external view returns (uint8[9]) {
        return games[_gameId].moves;
    }
}
