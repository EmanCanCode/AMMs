import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { CPAMM, EmanToken } from "../typechain-types";
import { token } from "../typechain-types/@openzeppelin/contracts";


describe("CPAMM", () => {
    let signers: SignerWithAddress[];
    let tokenA: EmanToken;
    let tokenB: EmanToken;
    let contract: CPAMM;
    let owner: SignerWithAddress;
    let liquidityProvider: SignerWithAddress;
    let swapper: SignerWithAddress;
    beforeEach(async () => {
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
    });


    describe("Deployment", () => {
        it("Should set the right owner", async () => {
            expect(await contract.owner()).to.equal(owner.address);
        });
    });

    describe("Swap", () => {
        describe("Success", () => {
            it("Swaps", async () => {
                // Mint tokens to liquidity provider
                await tokenA.connect(owner).mint(liquidityProvider.address, 100);
                await tokenB.connect(owner).mint(liquidityProvider.address, 100);
                // Mint tokens to swapper
                await tokenA.connect(owner).mint(swapper.address, 25);
                // Approve contract to spend tokens
                await tokenA.connect(liquidityProvider).approve(contract.address, 100);
                await tokenB.connect(liquidityProvider).approve(contract.address, 100);
                await tokenA.connect(swapper).approve(contract.address, 10);
                // Add liquidity
                await contract.connect(liquidityProvider).addLiquidity(100, 100);
                // Swap
                await contract.connect(swapper).swap(tokenA.address, 10);
                // Check balances
                const balances = (async () => {
                    const a = await contract.reserveA();
                    const b = await contract.reserveB();
                    return { a, b };
                })();
                const totalSupply = await contract.totalSupply();
                const LPTBalance = await contract.balanceOf(liquidityProvider.address);
                console.log({
                    balances,
                    totalSupply,
                    LPTBalance
                });
            });
        });
        describe("Failure", () => {});
    });
});