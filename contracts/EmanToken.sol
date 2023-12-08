// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract EmanToken is ERC20 {
    address public owner;
    mapping(address => bool) public minters;

    constructor(
        string memory _name, 
        string memory _symbol
    ) ERC20(_name, _symbol) {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    function mint(address _to, uint _amount) external {
        if (msg.sender != owner) {
            require(minters[msg.sender], "Only Minters");
        }
        _mint(_to, _amount);
    }

    function editMinter(address _minter, bool _status) external onlyOwner {
        minters[_minter] = _status;
    }

    function changeOwner(address _owner) external onlyOwner {
        owner = _owner;
    }
}
