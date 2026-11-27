// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WiserdEnterpriseCurrency
 * @notice Fixed-cap ERC-20 enterprise settlement & supply currency prepared for Base (Chain ID 8453).
 *         Supports controlled treasury allocation, third-party commerce fee settlement, and hard supply cap.
 */
contract WiserdEnterpriseCurrency {
    string public constant name = "WISERD Enterprise Currency";
    string public constant symbol = "WSRD";
    uint8 public constant decimals = 18;

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1B capped supply
    uint256 public totalSupply;

    address public treasuryAdmin;
    address public pendingTreasuryAdmin;
    bool public mintingSealed;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MintingSealed(uint256 finalSupply);
    event TreasuryAdminTransferProposed(address indexed currentAdmin, address indexed proposedAdmin);
    event TreasuryAdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyTreasury() {
        require(msg.sender == treasuryAdmin, "WSRD: caller is not treasury admin");
        _;
    }

    constructor(address initialTreasury, uint256 initialMint) {
        require(initialTreasury != address(0), "WSRD: zero treasury address");
        require(initialMint <= MAX_SUPPLY, "WSRD: exceeds MAX_SUPPLY");
        treasuryAdmin = initialTreasury;
        if (initialMint > 0) {
            totalSupply = initialMint;
            balanceOf[initialTreasury] = initialMint;
            emit Transfer(address(0), initialTreasury, initialMint);
        }
    }

    function proposeTreasuryAdmin(address newAdmin) external onlyTreasury {
        require(newAdmin != address(0), "WSRD: zero treasury admin");
        require(newAdmin != treasuryAdmin, "WSRD: already treasury admin");
        pendingTreasuryAdmin = newAdmin;
        emit TreasuryAdminTransferProposed(treasuryAdmin, newAdmin);
    }

    function acceptTreasuryAdmin() external {
        require(msg.sender == pendingTreasuryAdmin, "WSRD: caller is not pending admin");
        address previousAdmin = treasuryAdmin;
        treasuryAdmin = msg.sender;
        pendingTreasuryAdmin = address(0);
        emit TreasuryAdminTransferred(previousAdmin, msg.sender);
    }

    function mintEnterpriseAllocation(address to, uint256 amount) external onlyTreasury {
        require(!mintingSealed, "WSRD: minting permanently sealed");
        require(to != address(0), "WSRD: zero recipient");
        require(totalSupply + amount <= MAX_SUPPLY, "WSRD: exceeds MAX_SUPPLY");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function sealMinting() external onlyTreasury {
        require(!mintingSealed, "WSRD: already sealed");
        mintingSealed = true;
        emit MintingSealed(totalSupply);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "WSRD: approve to zero address");
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "WSRD: insufficient allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(to != address(0), "WSRD: transfer to zero address");
        require(balanceOf[from] >= amount, "WSRD: insufficient balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
        return true;
    }
}
