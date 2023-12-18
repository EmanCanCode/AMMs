// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Constant Product Automated Market Maker
contract CPAMM {
    address public owner;
    // These are the two tokens that the CPAMM contract will hold a reserve of and allow users to trade
    IERC20 public immutable tokenA;  
    IERC20 public immutable tokenB;

    // These are the reserves of the two tokens in the CPAMM contract
    uint public reserveA;
    uint public reserveB;

    // Track total supply of shares
    uint public totalSupply;

    // Track user balances of shares
    mapping(address => uint) public balanceOf;

    constructor(
        IERC20 _tokenA,
        IERC20 _tokenB
    ) {
        owner = msg.sender;
        tokenA = _tokenA;
        tokenB = _tokenB;
    }
    
    function _mint(address to, uint amount) private {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function _burn(address from, uint amount) private {
        totalSupply -= amount;
        balanceOf[from] -= amount;
    }

    function swap(
        address _tokenToSwap,
        uint _amountToSwap
    ) external returns (uint _amountGiven) {
        require(
            _tokenToSwap == address(tokenA) || 
            _tokenToSwap == address(tokenB),
            "CPAMM.swap(): Invalid token to swap"
        );
        require(_amountToSwap > 0, "CPAMM.swap(): Invalid amount to swap");

        // determine what token to swap and what token to receive
        bool isTokenA = _tokenToSwap == address(tokenA);
        (
            IERC20 tokenToSwap, 
            IERC20 tokenToReceive, 
            uint reserveSwap, 
            uint reserveGiven
        ) = isTokenA ? (tokenA, tokenB, reserveA, reserveB) : (tokenB, tokenA, reserveB, reserveA);
        tokenToSwap.transferFrom(msg.sender, address(this), _amountToSwap);

        // calculate token out (including fees), fee = 0.3%
        /*
            the equation is dy = (y * dx) / (x + dx)

            * dy - amount of token to receive (_amountGiven)
            * y  - reserve of token to receive (reserveGiven)
            * dx - amount of token to swap (_amountInWithFee)
            * x  - reserve of token to swap (reserveSwap)
        */ 
        uint amountInWithFee = (_amountToSwap * 997) / 1000;
        _amountGiven = (reserveGiven * amountInWithFee) / (reserveSwap + amountInWithFee);

        // transfore token out to msg.sender
        tokenToReceive.transfer(msg.sender, _amountGiven);
        // udpate reserves
        _update(
            tokenA.balanceOf(address(this)),
            tokenB.balanceOf(address(this))
        );
    }

    function addLiquidity(
        uint _amountA,
        uint _amountB
    ) external returns (uint _shares) {
        require(
            _amountA > 0 && _amountB > 0,
            "CPAMM.addLiquidity(): Invalid amount of tokens to add"
        );
        // get amount of tokenA and tokenB to add
        tokenA.transferFrom(msg.sender, address(this), _amountA);
        tokenB.transferFrom(msg.sender, address(this), _amountB);

        // create shares for msg.sender
        /*
            Now we have to ensure that the amount of token the user is adding in for liquidity is NOT affecting the price. 

            the equation is dy / dx = y / x
            * dy - amount of tokenA to add (_amountA)
            * dx - amount of tokenB to add (_amountB)
            * y  - reserve of tokenA (reserveA)
            * x  - reserve of tokenB (reserveB)
        */

        if (reserveA > 0 || reserveB > 0) {
            require(
                reserveA * _amountB == reserveB * _amountA,
                // Cross multiply instead of dividing 🤓
                "CPAMM.addLiquidity(): dy / dx != y / x; price is affected"
            );
        }

        // value of liquidity = sqrt(x * y)
        // s = dx / x * T = dy / y * T
        /*
            * s  - shares to mint (_shares)
            * dx - amount of tokenA to add (_amountA)
            * dy - amount of tokenB to add (_amountB)
            * x  
        */

        if (totalSupply == 0) {
            _shares = _sqrt(_amountA * _amountB);
        } else {
            _shares = _min(
                (_amountA * totalSupply) / reserveA,
                (_amountB * totalSupply) / reserveB
            );
        }
        require(
            _shares > 0, 
            "CPAMM.addLiquidity(): Invalid amount of shares to mint"
        );
        _mint(msg.sender, _shares);

        // update reserves
        _update(
            tokenA.balanceOf(address(this)), 
            tokenB.balanceOf(address(this))    
        );
    }
    function removeLiquidity(
        uint _shares
    ) external returns (uint _amountA, uint _amountB) {
        require(_shares <= balanceOf[msg.sender], "CPAMM.removeLiquidity(): Invalid amount of shares to burn");
        require(_shares > 0, "CPAMM.removeLiquidity(): Invalid amount of shares to burn");
        // calculate amount of tokenA and tokenB to send to msg.sender
        /*
            dx = s / T * x
            dy = s / T * y

            * dx - amount of tokenA that goes to msg.sender
            * dy - amount of tokenB that goes 
            * s  - shares
            * T  - total supply
            * x  - reserve of tokenA
            * y  - reserve of tokenB
        */
        uint balA = tokenA.balanceOf(address(this));
        uint balB = tokenB.balanceOf(address(this));
        _amountA = (_shares * balA) / totalSupply;
        _amountB = (_shares * balB) / totalSupply;

        require(
            _amountA > 0 && _amountB > 0,
            "CPAMM.removeLiquidity(): Invalid amount of tokens to send to msg.sender"
        );

        // burn shares
        _burn(msg.sender, _shares);
        // update reserves
        _update(
            balA - _amountA,
            balB - _amountB
        );
        // transfer tokens to msg.sender
        tokenA.transfer(msg.sender, _amountA);
        tokenB.transfer(msg.sender, _amountB);
    }

    function _update(
        uint _reserveA,
        uint _reserveB
    ) private {
        reserveA = _reserveA;
        reserveB = _reserveB;
    }

    function _sqrt(uint x) private pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        } 
    }


    /*
        EVEN THO s = dx / x * T = dy / y * T, we will take the minimum of the two to ensure that the user is not getting more than what they are supposed to get
    */ 
    function _min(uint y, uint z) private pure returns (uint x) {
        x = y < z ? y : z;
    }
}