import { ethers } from "hardhat";
// THIS IS A TEST PRIVATE KEY, DO NOT USE IN PRODUCTION.
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function main() {
    // signer and provider
    const signer = new ethers.Wallet(TEST_PRIVATE_KEY);
    const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
    const signerWithProvider = signer.connect(provider);

    // deploy EmanToken
    const tokenFactory = await ethers.getContractFactory("EmanToken", signerWithProvider);
    const et1 = await tokenFactory.deploy(
        'EmanToken1',
        'ET1'
    );
    await et1.deployed();

    const et2 = await tokenFactory.deploy(
        'EmanToken2',
        'ET2'
    );
    await et2.deployed();

    // deploy AMM
    const CPAMMFactory = await ethers.getContractFactory("CPAMM", signerWithProvider);
    const amm = await CPAMMFactory.deploy(
        et1.address,
        et2.address
    );
    await amm.deployed();

    // mint tokens
    await et1.connect(signerWithProvider).mint(signer.address, ethers.utils.parseEther('10000000'));
    await et2.connect(signerWithProvider).mint(signer.address, ethers.utils.parseEther('10000000'));
    // approve amm to spend tokens
    await et1.connect(signerWithProvider).approve(amm.address, ethers.utils.parseEther('10000000'));
    await et2.connect(signerWithProvider).approve(amm.address, ethers.utils.parseEther('10000000'));

    const tx = await amm.connect(signerWithProvider).addLiquidity(
        ethers.utils.parseEther('1000000'),
        ethers.utils.parseEther('500000'),
    );
    await tx.wait();

    console.log('//     -----     DATA     -----     // \n');
    return {
        'EmanToken1': et1.address,
        'EmanToken2': et2.address,
        'CPAMM': amm.address
    };
    
}

main().then(res => {
    console.log(res)
}).catch(err => {
    console.log(err);
});