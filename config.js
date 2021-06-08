const ethers = require("ethers");
const fs = require('fs');

let project_secret;

const ProjectSecrestConfigFile = './project.secret.js';
const ProjectSecrestDummyConfigFile = './project.secret.sample.js';

try {
    project_secret = require(ProjectSecrestConfigFile);
}
catch (err) {
    project_secret = require(ProjectSecrestDummyConfigFile);
    console.log('Warning: loading secrets from tempalte file, might be invalid');
}

const HardhatNetworkConfig = {
    localhost: {
        url: 'http://127.0.0.1:8545',
        chainId: 1337,
    },
    hardhat: {
        blockGasLimit: 6000000,
        chainId: 31337,
        forking: {
          url: 'https://http-mainnet.hecochain.com',
        },
    },
    heco: {
        url: 'https://http-mainnet.hecochain.com',
        accounts: project_secret.private_key_list,
        chainId: 128,
        gasPrice: ethers.utils.parseUnits('1', 'gwei').toNumber(),
    },
    heco_test: {
        url: 'https://http-testnet.hecochain.com',
        accounts: project_secret.private_key_list,
        chainId: 256,
        gasPrice: ethers.utils.parseUnits('1', 'gwei').toNumber(),
    },
};

const HardhatSolidityConfig = {
    version: '0.8.0',
    settings: {
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },
};

const HardhatGasReporterConfig = {
    currency: 'USD',
    gasPrice: 21,
    enabled: true,
};

module.exports = {
    HardhatNetworkConfig,
    HardhatSolidityConfig,
    HardhatGasReporterConfig,
}
