const ethers = require('ethers');

const ContractAddressConfig = {
    heco_test: {
        USDT: '0x04f535663110a392a6504839beed34e019fdb4e0',
        USDC: '0xd459dad367788893c17c09e17cfbf0bf25c62833',
        // Fake
        SZMoon: '0x0000000000000000000000000000000000000000',
        SZMoon_HT_LP_TOKEN: '0x0000000000000000000000000000000000000000',
        MDX_ROUTER: '0x0000000000000000000000000000000000000000',
    },
    heco: {
        USDT: '0xa71edc38d189767582c38a3145b5873052c3e47a',
        USDC: '0x9362bbef4b8313a8aa9f0c9808b80577aa26b73b',
        SZMoon: '0x7F28616C97E0De533973FBC912055850174662Ee',
        SZMoon_HT_LP_TOKEN: '0x573d77a5F1c14f337BE9C4ac44Ac3e130f3b9aB9',
        MDX_ROUTER: '0xed7d5f38c79115ca12fe6c0041abb22f0a06c300',
    },
};

const SZMoon_HT_LP_TOKEN_DECIMAL = 18;
const SZMOON_TOKEN_DECIMAL = 9;

const StakingCtorParameters = {
    heco_test: {
        // stake: USDT token -> rewar: USDC token
        staking_token: ContractAddressConfig.heco_test.USDT,
        reward_token: ContractAddressConfig.heco_test.USDC,
        start_stake_block_id: 7915188,
        start_unstake_block_id: 7915188,
        start_claim_block_id: 7915188,
        // 1000 tokens per block
        share_per_block: ethers.utils.parseUnits('1000', SZMOON_TOKEN_DECIMAL),
    },
    heco: {
        // stake: LP token -> rewar: SZMoon
        staking_token: ContractAddressConfig.heco.SZMoon_HT_LP_TOKEN,
        reward_token: ContractAddressConfig.heco.SZMoon,
        start_stake_block_id: 7915188,
        start_unstake_block_id: 7915188,
        start_claim_block_id: 7915188,
        share_per_block: ethers.utils.parseUnits('1000', SZMOON_TOKEN_DECIMAL),
    },
};

const SZMOON_TOKEN_HOLDER_ADDRESS = '0x190b9f06bb6376ae5431e8a0bb79723627a6c359';

module.exports = {
    SZMoon_HT_LP_TOKEN_DECIMAL,
    SZMOON_TOKEN_DECIMAL,
    ContractAddressConfig,
    SZMOON_TOKEN_HOLDER_ADDRESS,
    StakingCtorParameters,
};
