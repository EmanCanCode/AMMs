// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract MultiSig {
    mapping(address => bool) public isOwner;
    mapping(address => bool) private hasVoted; // internal way to track who has voted yet or not
    uint256 public numOwners;

    constructor() {
        isOwner[msg.sender] = true;
        numOwners = 1;
    }

    receive() external payable {
        revert("cannot receive ether via fallback function");
    }

    // crud isOwner
    event AddedOwner(
        address indexed _target,
        address indexed _actor
    );
    function addOwner(address _newOwner) public {
        require(isOwner[msg.sender], "only owner can add owner");
        isOwner[_newOwner] = true;
        numOwners++;
        emit AddedOwner(_newOwner, msg.sender);
    }

    event RemovedOwner(
        address indexed _target,
        address indexed _actor,
        uint256 timestamp
    );
    function removeOwner(ActionParams memory _actionParams) public {
        require(isOwner[msg.sender], "only owner can remove owner");
        if (msg.sender == _actionParams.target) {
            isOwner[_actionParams.target] = false;
            numOwners--;
            return;
        }
        // create signature digest
        bytes32 digest = getEthSignedMessageHash(
            keccak256(
                abi.encodePacked(
                    _actionParams.action, // "removeOwner"
                    _actionParams.target
                )
            )
        );
        // amount in favor for vote
        uint inFavor = 0;
        for (uint i = 0; i < _actionParams.signers.length; i++) {
            require(
                !hasVoted[_actionParams.signers[i]],
                "signer has already voted"
            );
            // verify signature
            (bytes32 r, bytes32 s, uint8 v) = splitSignature(
                _actionParams.signatures[i]
            );
            require(
                ecrecover(
                    digest,
                    v,
                    r,
                    s
                ) == _actionParams.signers[i],
                "invalid signature"
            );
            inFavor++;
            hasVoted[_actionParams.signers[i]] = true;
        }

        // reset hasVoted
        for (uint i = 0; i < _actionParams.signers.length; i++) {
            hasVoted[_actionParams.signers[i]] = false;
        }

        // check if majority
        require(inFavor > numOwners / 2, "Not enough votes");

        isOwner[_actionParams.target] = false;
        numOwners--;
        emit RemovedOwner(_actionParams.target, msg.sender, block.timestamp);
    }

    // deposit

    event Deposit(address indexed _from, uint256 _value);
    function deposit() public payable {
        emit Deposit(msg.sender, msg.value);
    }   


    // withdraw

    event Withdraw(address indexed _to, uint256 _value, uint256 timestamp);
    function withdraw(
        uint _amount,
        ActionParams memory _actionParams
    ) external {
        require(isOwner[msg.sender], "only owner can withdraw");
        require(_amount <= address(this).balance, "not enough balance");
        // create signature digest
        bytes32 digest = getEthSignedMessageHash(
            keccak256(
                abi.encodePacked(
                    _actionParams.action, // "withdraw"
                    _amount, 
                    _actionParams.target
                )
            )
        );
        // amount in favor for vote
        uint inFavor = 0;
        for (uint i = 0; i < _actionParams.signers.length; i++) {
            require(
                !hasVoted[_actionParams.signers[i]],
                "signer has already voted"
            );
            // verify signature
            (bytes32 r, bytes32 s, uint8 v) = splitSignature(
                _actionParams.signatures[i]
            );
            require(
                ecrecover(
                    digest,
                    v,
                    r,
                    s
                ) == _actionParams.signers[i],
                "invalid signature"
            );
            inFavor++;
            hasVoted[_actionParams.signers[i]] = true;
        }

        // check if majority
        require(inFavor > numOwners / 2, "Not enough votes");

        // reset hasVoted
        for (uint i = 0; i < _actionParams.signers.length; i++) {
            hasVoted[_actionParams.signers[i]] = false;
        }

        payable(_actionParams.target).transfer(_amount);
        emit Withdraw(_actionParams.target, _amount, block.timestamp);
    }



    // helpers
    function getEthSignedMessageHash(
        bytes32 _messageHash
    ) public pure returns (bytes32) {
        /*
        Signature is produced by signing a keccak256 hash with the following format:
        "\x19Ethereum Signed Message\n" + len(msg) + msg
        */
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    _messageHash
                )
            );
    }

    function splitSignature(
        bytes memory sig
    ) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }
}

struct ActionParams {
    address target; // address of who is the target of the action
    bytes action; // should be abi.encodePacked(removeOwner | withdraw)
    address[] signers; // signers of action -- ensure same index as respective signatures
    bytes[] signatures; // signatures of action
}
