import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';

const { StakingCtorParameters } = require('../test/constants.js');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const network: string = hre.hardhatArguments.network ? hre.hardhatArguments.network : 'rinkeby';
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    if (false) {
        {
            const impl = await ethers.getContractFactory('SZMoonStaking');
            const proxy = await upgrades.deployProxy(impl, [...Object.values(StakingCtorParameters[network])]);
            await proxy.deployed();
            console.log('SZMoonStaking proxy: ' + proxy.address);
        }
    } else {
        // heco testnet
        let deployedContractAddress = '0xE5642F25aaf166D5dac70721D140749eAE97B10c';
        if (network === 'heco_test') {
            deployedContractAddress = '0xE5642F25aaf166D5dac70721D140749eAE97B10c';
        } else {
            // TODO
        }
        // upgrade contract
        const impl = await ethers.getContractFactory('SZMoonStaking');
        await upgrades.upgradeProxy(deployedContractAddress, impl);
    }
};

func.tags = ['SZMoonStaking'];

module.exports = func;
