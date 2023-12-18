import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { CPAMM, EmanToken } from "../typechain-types";


describe("CPAMM", () => {
    let signers: SignerWithAddress[];
    let tokenA: EmanToken;
    let tokenB: EmanToken;
    let contract: CPAMM;
    let owner: SignerWithAddress;
    let liquidityProvider: SignerWithAddress;
    let swapper: SignerWithAddress;
    beforeEach(async () => {
        // -----     contract deployment     ----- //

        [owner, liquidityProvider, swapper, ...signers] = await ethers.getSigners();

        const tokenFactory = await ethers.getContractFactory("EmanToken");
        tokenA = await tokenFactory.deploy(
            'EmanTokenA',
            'EMAN1'
        );  
        await tokenA.deployed();
        tokenB = await tokenFactory.deploy(
            'EmanTokenB',
            'EMAN2'
        );
        await tokenB.deployed();

        const CPAMMFactory = await ethers.getContractFactory("CPAMM");
        contract = await CPAMMFactory.deploy(
            tokenA.address,
            tokenB.address
        );
        await contract.deployed();

        // -----     test setup     ----- //

        // Mint tokens to liquidity provider
        await tokenA.connect(owner).mint(liquidityProvider.address, 1000);
        await tokenB.connect(owner).mint(liquidityProvider.address, 1000);
        // Mint tokens to swapper
        await tokenA.connect(owner).mint(swapper.address, 1000);
        await tokenB.connect(owner).mint(swapper.address, 1000);
        // Approve contract to spend tokens
        await tokenA.connect(liquidityProvider).approve(contract.address, 1000);
        await tokenB.connect(liquidityProvider).approve(contract.address, 1000);
        await tokenA.connect(swapper).approve(contract.address, 1000);
    });


    describe("Deployment", () => {
        it("Should set the right owner", async () => {
            expect(await contract.owner()).to.equal(owner.address);
        });
    });

    describe("Add Liquidity", () => {
        describe("Success", () => {
            it("Initializes liquidity pool, give LPT, verify reserves", async () => {
                expect(await contract.reserveA()).to.equal(0);
                expect(await contract.reserveB()).to.equal(0);
                expect(await contract.totalSupply()).to.equal(0);
                expect(await contract.balanceOf(liquidityProvider.address)).to.equal(0);
                await contract.connect(liquidityProvider).addLiquidity(
                    1000,
                    500
                );
                expect(await contract.reserveA()).to.equal(1000);
                expect(await contract.reserveB()).to.equal(500);
                expect(await contract.totalSupply()).to.equal(707);
                expect(await contract.balanceOf(liquidityProvider.address)).to.equal(707);
            });
            it("Adds to existing liquidity pool, give LPT, verify reserves", async () => {
                await contract.connect(liquidityProvider).addLiquidity(
                    1000,
                    500
                );
                expect(await contract.reserveA()).to.equal(1000);
                expect(await contract.reserveB()).to.equal(500);
                expect(await contract.totalSupply()).to.equal(707);
                expect(await contract.balanceOf(liquidityProvider.address)).to.equal(707);

                // console.log('----- first add liquidity -----\n', {
                //     reserveA: (await contract.reserveA()).toString(),
                //     reserveB: (await contract.reserveB()).toString(),
                //     totalSupply: (await contract.totalSupply()).toString(),
                //     balanceOfReservesForLP: (await contract.balanceOf(liquidityProvider.address)).toString(),
                //     swapperBalance: (await tokenA.balanceOf(swapper.address)).toString()
                // });

                // swap to change reserves ratio
                await contract.connect(swapper).swap(tokenA.address, 100);
                let reserveA = await contract.reserveA();
                let reserveB = await contract.reserveB();
                // console.log( '----- after swap -----\n', {
                //     reserveA: reserveA.toString(),
                //     reserveB: reserveB.toString(),
                //     totalSupply: (await contract.totalSupply()).toString(),
                //     swapperBalance: {
                //         tokenA: (await tokenA.balanceOf(swapper.address)).toString(),
                //         tokenB: (await tokenB.balanceOf(swapper.address)).toString()
                //     }
                // });

                // reserveA is 1100 and reserveB is 455
                const ratio = {  // divided reserves by 5
                    tokenA: 220,
                    tokenB: 91
                }

                await tokenA.mint(liquidityProvider.address, 500);
                await tokenB.mint(liquidityProvider.address, 500);
                await tokenA.connect(liquidityProvider).approve(contract.address, 500);
                await tokenB.connect(liquidityProvider).approve(contract.address, 500);
                await contract.connect(liquidityProvider).addLiquidity(
                    ratio.tokenA,
                    ratio.tokenB
                );
                reserveA = await contract.reserveA();
                reserveB = await contract.reserveB();
                // console.log({
                //     reserveA: reserveA.toString(),
                //     reserveB: reserveB.toString(),
                //     totalSupply: (await contract.totalSupply()).toString(),
                //     balanceOfReservesForLP: (await contract.balanceOf(liquidityProvider.address)).toString()
                // });
            });
        });
        describe("Failure", () => {
            it("Reverts if amountA or amountB is 0", async () => {
                await expect(contract.connect(liquidityProvider).addLiquidity(
                    0,
                    500
                )).to.be.revertedWith("CPAMM.addLiquidity(): Invalid amount of tokens to add");
                await expect(contract.connect(liquidityProvider).addLiquidity(
                    500,
                    0
                )).to.be.revertedWith("CPAMM.addLiquidity(): Invalid amount of tokens to add");
            });
            it("Reverts if dy / dx != y / x; Changes price", async () => {
                await contract.connect(liquidityProvider).addLiquidity(
                    200,
                    500
                );
                await expect(contract.connect(liquidityProvider).addLiquidity(
                    100,
                    500
                )).to.be.revertedWith("CPAMM.addLiquidity(): dy / dx != y / x; price is affected");
            });
        });
    });

    describe("Swap", () => {
        describe("Success", () => {
            it("Swaps", async () => {
                
                // Add liquidity
                await contract.connect(liquidityProvider).addLiquidity(1000, 500);
                // assert swapper token balances
                expect(await tokenA.balanceOf(swapper.address)).to.equal(1000);
                expect(await tokenB.balanceOf(swapper.address)).to.equal(1000);
                // user will swap 100 tokenA for tokenB
                await contract.connect(swapper).swap(tokenA.address, 100);
                // assert swapper token balances
                expect(await tokenA.balanceOf(swapper.address)).to.equal(900);
                expect(await tokenB.balanceOf(swapper.address)).to.equal(1045);
                // console.log({ 
                //     text: 'AFTER SWAP',
                //     contractTokenABalance: (await contract.reserveA()).toString(),
                //     contractTokenBBalance: (await contract.reserveB()).toString(),
                //     userTokenABalance: (await tokenA.balanceOf(swapper.address)).toString(),
                //     userTokenBBalance: (await tokenB.balanceOf(swapper.address)).toString()
                // });

            });
        });
        describe("Failure", () => {
            it("Reverts when token to swap is not in pool", async () => {
                await contract.connect(liquidityProvider).addLiquidity(1000, 500);
                await expect(contract.connect(swapper).swap(ethers.constants.AddressZero, 100)).to.be.revertedWith("CPAMM.swap(): Invalid token to swap");
            });
            it("Reverts when token amount is 0", async () => {
                await contract.connect(liquidityProvider).addLiquidity(1000, 500);
                await expect(contract.connect(swapper).swap(tokenA.address, 0)).to.be.revertedWith("CPAMM.swap(): Invalid amount to swap");
            });
        });
    });

    describe("Remove Liquidity", () => {
        describe("Success", () => {
            it("Removes Liquidity after swaps", async () => {
                expect(await tokenA.balanceOf(swapper.address)).to.equal(1000);
                expect(await tokenB.balanceOf(swapper.address)).to.equal(1000);
                await contract.connect(liquidityProvider).addLiquidity(1000, 500);
                expect(await contract.balanceOf(liquidityProvider.address)).to.equal(707);
                await contract.connect(swapper).swap(tokenA.address, 100);
                // assert swapper balances
                expect(await tokenA.balanceOf(swapper.address)).to.equal(900);
                expect(await tokenB.balanceOf(swapper.address)).to.equal(1045);
                // assert contract balances
                expect(await contract.reserveA()).to.equal(1100);
                expect(await contract.reserveB()).to.equal(455);
                // assert liquidity provider balances before liquidity removal
                expect(await tokenA.balanceOf(liquidityProvider.address)).to.equal(0);
                expect(await tokenB.balanceOf(liquidityProvider.address)).to.equal(500);
                // remove liquidity, assert balances on contract and token balances of liquidity provider
                await contract.connect(liquidityProvider).removeLiquidity(707);
                expect(await contract.balanceOf(liquidityProvider.address)).to.equal(0);
                expect(await contract.reserveA()).to.equal(0);
                expect(await contract.reserveB()).to.equal(0);
                expect(await tokenA.balanceOf(liquidityProvider.address)).to.equal(1100);
                expect(await tokenB.balanceOf(liquidityProvider.address)).to.equal(955);
                // ethers constant address 0
            });
        });
        describe("Failure", () => {
            it("Reverts when amount of shares to burn is greater than shares owned", async () => {
                await expect(
                    contract.connect(liquidityProvider).removeLiquidity(1000)
                ).to.be.revertedWith("CPAMM.removeLiquidity(): Invalid amount of shares to burn");
            });
            it("Reverts when amount is 0", async () => {
                await contract.connect(liquidityProvider).addLiquidity(1000, 500);
                await expect(
                    contract.connect(liquidityProvider).removeLiquidity(0)
                ).to.be.revertedWith("CPAMM.removeLiquidity(): Invalid amount of shares to burn");
            });
        });
    });
});