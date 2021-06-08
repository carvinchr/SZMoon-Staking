const chai = require('chai');
const MockDate = require('mockdate');
const expect = chai.expect;
const helper = require('./helper');
const hre = require('hardhat');
chai.use(require('chai-as-promised'));

const jsonABI = require('../artifacts/contracts/SZMoonStaking.sol/SZMoonStaking.json');
const interface = new ethers.utils.Interface(jsonABI.abi);
const ERC20Artifact = require('../node_modules/@openzeppelin/contracts/build/contracts/ERC20.json');

let snapshotId;
let mbContract;
let SZMoonTokenApp;
let SZMoonHtLpToken;

let contractCreator;
let SZMoonUser_0;
let SZMoonUser_1;
let SZMoonTokenHolder;

const {
    SZMoon_HT_LP_TOKEN_DECIMAL,
    SZMOON_TOKEN_DECIMAL,
    ContractAddressConfig,
    SZMOON_TOKEN_HOLDER_ADDRESS,
    StakingCtorParameters,
} = require('./constants');

const StakingCtor = StakingCtorParameters.heco;

// 1M tokens
// const SZMoonTokenContractBalance = ethers.utils.parseUnits('1000000', SZMoon_HT_LP_TOKEN_DECIMAL);
const testStakingAmount = ethers.utils.parseUnits('100', SZMoon_HT_LP_TOKEN_DECIMAL);
const SZMoonTokenRewardPoolAmount = ethers.utils.parseUnits('1000000', SZMOON_TOKEN_DECIMAL);

describe('SZMoonStaking', () => {
    before(async () => {
        signers = await ethers.getSigners();
        contractCreator = signers[0];
        SZMoonUser_0 = signers[1];
        SZMoonUser_1 = signers[2];

        // For impersonating HECO SZMoon/HT holder
        await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [SZMOON_TOKEN_HOLDER_ADDRESS],
        });
        SZMoonTokenHolder = ethers.provider.getSigner(SZMOON_TOKEN_HOLDER_ADDRESS);
        SZMoonTokenHolder.address = SZMoonTokenHolder._address;
        {
            const factory = await ethers.getContractFactory('SZMoonStaking');
            const proxy = await upgrades.deployProxy(factory, [...Object.values(StakingCtor)]);
            mbContract = new ethers.Contract(proxy.address, jsonABI.abi, contractCreator);
        }
        SZMoonTokenApp = new ethers.Contract(ContractAddressConfig.heco.SZMoon, ERC20Artifact.abi, contractCreator);
        SZMoonHtLpToken = new ethers.Contract(
            ContractAddressConfig.heco.SZMoon_HT_LP_TOKEN,
            ERC20Artifact.abi,
            contractCreator,
        );
        // transfer LP token to user for testing
        {
            await SZMoonHtLpToken.connect(SZMoonTokenHolder).transfer(SZMoonUser_0.address, testStakingAmount);
            const balance = await SZMoonHtLpToken.balanceOf(SZMoonUser_0.address);
            expect(balance.eq(testStakingAmount)).to.be.true;
            // console.log("SZMoonUser_0 LP token balance: " + ethers.utils.formatUnits(balance, SZMoon_HT_LP_TOKEN_DECIMAL));
            await SZMoonHtLpToken.connect(SZMoonUser_0).approve(mbContract.address, testStakingAmount);
        }
        {
            await SZMoonHtLpToken.connect(SZMoonTokenHolder).transfer(SZMoonUser_1.address, testStakingAmount);
            const balance = await SZMoonHtLpToken.balanceOf(SZMoonUser_1.address);
            // console.log("testStakingAmount: " + ethers.utils.formatUnits(testStakingAmount, SZMoon_HT_LP_TOKEN_DECIMAL));
            expect(balance.eq(testStakingAmount)).to.be.true;
            // console.log("SZMoonUser_1 LP token balance: " + ethers.utils.formatUnits(balance, SZMoon_HT_LP_TOKEN_DECIMAL));
            await SZMoonHtLpToken.connect(SZMoonUser_0).approve(mbContract.address, testStakingAmount);
        }
        // transfer SZMoon token to contract for reward testing
        {
            await SZMoonTokenApp.connect(SZMoonTokenHolder).transfer(mbContract.address, SZMoonTokenRewardPoolAmount);
            const balance = await SZMoonTokenApp.balanceOf(mbContract.address);
            // console.log("SZMoonTokenRewardPoolAmount: " + ethers.utils.formatUnits(SZMoonTokenRewardPoolAmount, SZMOON_TOKEN_DECIMAL));
            // console.log("balance: " + ethers.utils.formatUnits(balance, SZMOON_TOKEN_DECIMAL));
            // will fail because of the `FEE`
            // expect(balance.eq(SZMoonTokenRewardPoolAmount)).to.be.true;
        }
        if (false) {
            const balance = await SZMoonHtLpToken.balanceOf(SZMoonUser_0.address);
            console.log(
                'SZMoonUser_0 LP token balance: ' + ethers.utils.formatUnits(balance, SZMoon_HT_LP_TOKEN_DECIMAL),
            );
            const allowance = await SZMoonHtLpToken.allowance(SZMoonUser_0.address, mbContract.address);
            console.log('allowance: ' + ethers.utils.formatUnits(allowance, SZMoon_HT_LP_TOKEN_DECIMAL));
        }
    });

    beforeEach(async () => {
        snapshotId = await helper.takeSnapshot();
        MockDate.set(Date.now());
    });

    afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
        // We also need to reset the "real time" (as what we do for evm)
        MockDate.reset();
    });

    it('Should variables initialized properly in contract creator', async () => {
        const owner = await mbContract.owner();
        expect(owner).to.be.eq(contractCreator.address);

        const staking_token = await mbContract.staking_token();
        expect(staking_token).to.be.eq(StakingCtor.staking_token);

        const reward_token = await mbContract.reward_token();
        expect(reward_token).to.be.eq(StakingCtor.reward_token);

        const start_stake_block_id = await mbContract.start_stake_block_id();
        expect(start_stake_block_id.toString()).to.be.eq(StakingCtor.start_stake_block_id.toString());

        const start_unstake_block_id = await mbContract.start_unstake_block_id();
        expect(start_unstake_block_id.toString()).to.be.eq(StakingCtor.start_unstake_block_id.toString());

        const start_claim_block_id = await mbContract.start_claim_block_id();
        expect(start_claim_block_id.toString()).to.be.eq(StakingCtor.start_claim_block_id.toString());

        const share_per_block = await mbContract.share_per_block();
        expect(share_per_block.toString()).to.be.eq(StakingCtor.share_per_block.toString());

        const total_staked_amount = await mbContract.total_staked_amount();
        expect(total_staked_amount.eq(0)).to.be.true;
    });

    // TODO
    it('test stake before started', async () => {});
    it('test claim while paused', async () => {});

    it('test stake/unstake', async () => {
        const UserSZMoonTokenBalanceBeforeStake = await SZMoonTokenApp.balanceOf(SZMoonUser_0.address);
        const ContractSZMoonTokenBalanceBeforeStake = await SZMoonTokenApp.balanceOf(mbContract.address);
        const UserLpTokenBalanceBeforeStake = await SZMoonHtLpToken.balanceOf(SZMoonUser_0.address);
        const ContractLpTokenBalanceBeforeStake = await SZMoonHtLpToken.balanceOf(mbContract.address);
        expect(ContractLpTokenBalanceBeforeStake.eq(0)).to.be.true;
        await mbContract.connect(SZMoonUser_0).stake(testStakingAmount);
        const UserLpTokenBalanceAfterStake = await SZMoonHtLpToken.balanceOf(SZMoonUser_0.address);
        const ContractLpTokenBalanceAfterStake = await SZMoonHtLpToken.balanceOf(mbContract.address);
        expect(UserLpTokenBalanceBeforeStake.eq(UserLpTokenBalanceAfterStake.add(ContractLpTokenBalanceAfterStake))).to
            .be.true;
        const total_staked_amount = await mbContract.total_staked_amount();
        expect(total_staked_amount.eq(testStakingAmount)).to.be.true;
        expect((await mbContract.get_total_reward(SZMoonUser_0.address)).eq(0)).to.be.true;
        // increase block number by 1
        {
            const block_id_stake = await ethers.provider.getBlockNumber();
            await ethers.provider.send('evm_mine');
            const block_id_claim_reward = await ethers.provider.getBlockNumber();
            expect(block_id_claim_reward).to.be.eq(block_id_stake + 1);
            const total_reward = await mbContract.get_total_reward(SZMoonUser_0.address);
            expect(total_reward.eq(StakingCtor.share_per_block)).to.be.true;
        }
        // increase block number by 100
        {
            const total_reward_before = await mbContract.get_total_reward(SZMoonUser_0.address);
            const block_id_before = await ethers.provider.getBlockNumber();
            for (let i = 0; i < 100; i++) {
                await ethers.provider.send('evm_mine');
            }
            const block_id_after = await ethers.provider.getBlockNumber();
            expect(block_id_after).to.be.eq(block_id_before + 100);
            const total_reward_after = await mbContract.get_total_reward(SZMoonUser_0.address);
            // valida reward
            expect(total_reward_after.eq(total_reward_before.add(StakingCtor.share_per_block.mul(100)))).to.be.true;
        }
        // can not `unstake` more than `staked` amount
        await expect(
            mbContract.connect(SZMoonUser_0).unstake(testStakingAmount.add(testStakingAmount)),
        ).to.be.rejectedWith('exceeds staked amount');
        await mbContract.connect(SZMoonUser_0).unstake(testStakingAmount);
        const UserLpTokenBalanceAfterUnstake = await SZMoonHtLpToken.balanceOf(SZMoonUser_0.address);
        const ContractLpTokenBalanceAfterUnstake = await SZMoonHtLpToken.balanceOf(mbContract.address);
        expect(UserLpTokenBalanceAfterUnstake.eq(UserLpTokenBalanceBeforeStake)).to.be.true;
        expect(ContractLpTokenBalanceAfterUnstake.eq(ContractLpTokenBalanceBeforeStake)).to.be.true;

        await mbContract.connect(SZMoonUser_0).claim_reward();
        const UserSZMoonTokenBalanceAfterReward = await SZMoonTokenApp.balanceOf(SZMoonUser_0.address);
        const ContractSZMoonTokenBalanceAfterReward = await SZMoonTokenApp.balanceOf(mbContract.address);
        expect(UserSZMoonTokenBalanceAfterReward.gt(UserSZMoonTokenBalanceBeforeStake)).to.be.true;
        expect(ContractSZMoonTokenBalanceBeforeStake.gt(ContractSZMoonTokenBalanceAfterReward)).to.be.true;
    });

    // TODO
    it('test multiple-user stake/unstake', async () => {});

    it('test staking_paused', async () => {
        {
            const staking_paused = await mbContract.staking_paused();
            expect(staking_paused).to.be.false;
        }
        // Only owner can do this
        await expect(mbContract.connect(SZMoonUser_0).pause_staking()).to.be.rejectedWith(
            'Ownable: caller is not the owner',
        );
        await mbContract.connect(contractCreator).pause_staking();
        {
            const staking_paused = await mbContract.staking_paused();
            expect(staking_paused).to.be.true;
        }
    });

    // TODO
    it('test restart_staking', async () => {});

    // TODO
    it('test restart_unstake', async () => {});

    // TODO
    it('test set_staking_token', async () => {});

    // TODO more
});
