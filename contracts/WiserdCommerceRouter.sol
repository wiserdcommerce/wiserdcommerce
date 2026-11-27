// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WiserdCommerceRouter
 * @notice Third-party commerce checkout & programmable settlement router on Base (USDC / WSRD).
 *         Splits buyer payment atomically between a verified third-party merchant and the WISERD protocol treasury.
 * @dev Compile with solc >=0.8.24, run full unit/fuzz test suite, and complete an external audit before mainnet deployment.
 */
contract WiserdCommerceRouter {
    bytes4 private constant TRANSFER_FROM_SELECTOR = 0x23b872dd;

    address public owner;
    address public pendingOwner;
    address public protocolTreasury;
    uint16 public protocolFeeBps; // e.g., 250 = 2.50%
    uint16 public constant MAX_FEE_BPS = 1000; // hard cap 10%
    uint256 private _reentrancyLock = 1;

    mapping(bytes32 => bool) public settledOrders;
    mapping(address => bool) public allowedTokens;

    event OwnershipTransferProposed(address indexed currentOwner, address indexed proposedOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProtocolTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event ProtocolFeeUpdated(uint16 previousFeeBps, uint16 newFeeBps);
    event AllowedTokenUpdated(address indexed token, bool allowed);
    event OrderSettled(
        bytes32 indexed orderId,
        address indexed buyer,
        address indexed merchant,
        address token,
        uint256 grossAmount,
        uint256 protocolFee,
        uint256 merchantNet
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Router: caller is not owner");
        _;
    }

    modifier nonReentrant() {
        require(_reentrancyLock == 1, "Router: reentrant call");
        _reentrancyLock = 2;
        _;
        _reentrancyLock = 1;
    }

    constructor(address _treasury, uint16 _feeBps, address[] memory _initialTokens) {
        require(_treasury != address(0), "Router: zero treasury");
        require(_feeBps <= MAX_FEE_BPS, "Router: fee too high");
        owner = msg.sender;
        protocolTreasury = _treasury;
        protocolFeeBps = _feeBps;
        for (uint256 i = 0; i < _initialTokens.length; i++) {
            address token = _initialTokens[i];
            require(token != address(0) && token.code.length > 0, "Router: invalid token");
            allowedTokens[token] = true;
            emit AllowedTokenUpdated(token, true);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Router: zero owner");
        require(newOwner != owner, "Router: already owner");
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Router: caller is not pending owner");
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function setProtocolTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Router: zero treasury");
        address previousTreasury = protocolTreasury;
        protocolTreasury = newTreasury;
        emit ProtocolTreasuryUpdated(previousTreasury, newTreasury);
    }

    function setProtocolFeeBps(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "Router: fee too high");
        uint16 previousFeeBps = protocolFeeBps;
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(previousFeeBps, newFeeBps);
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        require(token != address(0), "Router: zero token");
        if (allowed) {
            require(token.code.length > 0, "Router: token is not a contract");
        }
        allowedTokens[token] = allowed;
        emit AllowedTokenUpdated(token, allowed);
    }

    function settleThirdPartyOrder(
        bytes32 orderId,
        address merchant,
        address token,
        uint256 grossAmount
    ) external nonReentrant {
        require(!settledOrders[orderId], "Router: order already settled");
        require(merchant != address(0), "Router: zero merchant");
        require(allowedTokens[token], "Router: token not enabled");
        require(grossAmount > 0, "Router: zero amount");

        settledOrders[orderId] = true;

        uint256 fee = (grossAmount * protocolFeeBps) / 10_000;
        uint256 merchantNet = grossAmount - fee;

        _safeTransferFrom(token, msg.sender, merchant, merchantNet);
        if (fee > 0) {
            _safeTransferFrom(token, msg.sender, protocolTreasury, fee);
        }

        emit OrderSettled(orderId, msg.sender, merchant, token, grossAmount, fee, merchantNet);
    }

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        require(token.code.length > 0, "Router: token is not a contract");
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(TRANSFER_FROM_SELECTOR, from, to, amount)
        );
        require(
            ok && (data.length == 0 || abi.decode(data, (bool))),
            "Router: safe transferFrom failed"
        );
    }
}
