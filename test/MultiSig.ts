import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MultiSig } from "../typechain-types";

describe("MultiSig", () => {
    let owner: SignerWithAddress;
    let signers: SignerWithAddress[];
    let contract: MultiSig;

    beforeEach(async () => {
        [owner, ...signers] = await ethers.getSigners();
        const _contract = await ethers.getContractFactory("MultiSig");
        contract = await _contract.deploy();
        await contract.deployed();
    });

    describe("Deployment", () => {
        it("Should make the deployer an owner", async () => {
            expect(await contract.isOwner(owner.address)).to.be.true;
        });
        it("Should initialize the correct amount of signers", async () => {
            expect(await contract.numOwners()).to.equal(1);
        });
    });

    describe("Add Owner", () => {
        describe("Success", () => {
            it('Adds a new Owner, emits event', async () => {
                await expect(
                    contract.connect(owner).addOwner(signers[1].address)
                ).to.emit(contract, 'AddedOwner').withArgs(
                    signers[1].address,
                    owner.address
                );
                expect(await contract.isOwner(signers[1].address)).to.be.true;
            });
        });
        describe("Failure", () => {
            it("Reverts when a non-owner tries to add an owner", async () => {
                await expect(
                    contract.connect(
                        signers[0]
                    ).addOwner(signers[1].address)
                ).to.be.revertedWith('only owner can add owner');
            });
        });
    });

    describe("Remove Owner", () => {
        describe("Success", () => {});
        describe("Failure", () => {});
    });
    
    describe("Deposit", () => {
        it("Receives ETH, emits event", async () => {
            await expect(
                contract.connect(owner).deposit({ value: 100 })
            ).to.emit(contract, 'Deposit').withArgs(
                owner.address,
                100
            );
        });
    });

    describe("Withdraw", () => {
        let target: string;
        let amount: number;
        let withdrawAction: {
            target: string,
            action: string,
            signers: string[],
            signatures: string[]
        };
        beforeEach(async () => {
            // add signers
            for (let i = 1; i < 4; i++) {
                await contract.connect(owner).addOwner(signers[i].address);
            }
            target = '0x0000000000000000000000000000000000000001';
            amount = 1000000000;
            withdrawAction = {
                target,
                action: ethers.utils.solidityPack(['string'], ['withdraw']),
                // make signers from index 0 to 3 to sign
                signers: (() => {
                    const s = signers.slice(0, 3);
                    const _s = [];
                    for (let i = 0; i < 3; i++) {
                        _s[i] = s[i].address;
                    }
                    return _s;
                })(),
                signatures: (() => {
                    const messageHash = ethers.utils.solidityKeccak256(
                        ['bytes'],
                        [
                            ethers.utils.solidityPack(
                                ['bytes', 'uint256', 'address'],
                                ['0x' + Buffer.from('withdraw').toString('hex'), amount, target]
                            )
                        ]
                    );
                    // const digest = ethers.utils.solidityKeccak256(
                    //     ['bytes'],
                    //     [
                    //         ethers.utils.solidityPack(
                    //             ['string', 'bytes'],
                    //             ["\x19Ethereum Signed Message:\n32", messageHash]
                    //         )
                    //     ]
                    // );
    
                    const signatures: string[] = [];
                    for (let i = 0; i < 3; i++) {
                        signers[i].signMessage(
                            Buffer.from(messageHash.slice(2), 'hex')
                        ).then(sig => {
                            signatures.push(sig);
                        });
                    }
    
                    return signatures;
                })()
            };
        });

        
        describe("Success", () => {});
        describe("Failure", () => {
            it("Reverts when non-owner calls", async () => {
                await expect(
                    contract.connect(signers[4]).withdraw(
                        amount,
                        withdrawAction
                    )
                ).to.be.revertedWith('only owner can withdraw');
            });
            it("Reverts when not enough balance to withdraw", async () => {
                // dont call deposit
                await expect(
                    contract.connect(owner).withdraw(
                        amount,
                        withdrawAction
                    )
                ).to.be.revertedWith('not enough balance');
            });
            it("Reverts when signer has voted already", async () => {
                // deposit 
                await contract.connect(owner).deposit({ value: amount });
                //  duplicate an index
                let action = withdrawAction;
                action.signatures[1] = action.signatures[0];
                await expect(
                    contract.connect(owner).withdraw(
                        amount,
                        action
                    )
                ).to.be.revertedWith('signer has voted already');
            });
            it("Reverts when invalid signature", async () => {
                // deposit 
                await contract.connect(owner).deposit({ value: amount });
                let action = withdrawAction;
                action.signatures[0] = '0x1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111';
                await expect(
                    contract.connect(owner).withdraw(
                        amount,
                        action
                    )
                ).to.be.revertedWith('invalid signature');
            });
            it("Reverts when not enough votes", async () => {
                // add more signers
                for (let i = 4; i < 7; i++) {
                    await contract.connect(owner).addOwner(signers[i].address);
                }
                // deposit
                await contract.connect(owner).deposit({ value: amount });
                // call withdraw
                await expect(
                    contract.connect(owner).withdraw(
                        amount,
                        withdrawAction
                    )
                ).to.be.revertedWith('not enough votes');
            });
        });
    });
});