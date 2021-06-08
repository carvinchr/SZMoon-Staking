// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
// import 'hardhat/console.sol';

contract SZMoonStaking is OwnableUpgradeable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event StakeSuccess(
        address indexed staking_owner,
        uint256 stake_amount
    );

    event UnstakeSuccess(
        address indexed staking_owner,
        uint256 unstake_amount
    );

    event ClaimRewardSuccess(
        address indexed staking_owner,
        uint256 reward
    );

    // to handle `integer division`
    uint256 private constant TOKEN_DECIMAL = 10**18;

    bool public staking_paused;
    bool public unstake_paused;
    bool public claim_reward_paused;
    // should be the LP token
    address public staking_token;
    // should be SZMoon token
    address public reward_token;
    uint256 public start_stake_block_id;
    uint256 public start_unstake_block_id;
    uint256 public start_claim_block_id;
    uint256 public total_staked_amount;

    struct StakingState {
        address staking_owner;
        uint256 block_id;
        uint256 staked;
        uint256 total_reward;
    }

    // staking database
    mapping(address => StakingState) private staking_db;

    // accumulate unit reward records
    mapping(uint256 => uint256) private accumulate_unit_reward;

    // latest `reward` per block, per staking share
    uint256 private unit_reward;
    uint256 private reward_update_block_id;

    uint256 public share_per_block;

    function initialize(
        address _staking_token,
        address _reward_token,
        uint256 _start_stake_block_id,
        uint256 _start_unstake_block_id,
        uint256 _start_claim_block_id,
        uint256 _share_per_block
    )
        public
        initializer
    {
        __Ownable_init();
        require(IERC20(_staking_token).totalSupply() > 0, 'invalid staking token');
        require(IERC20(_reward_token).totalSupply() > 0, 'invalid reward token');
        require(_start_claim_block_id >= _start_stake_block_id, 'invalid block index config');

        staking_token = _staking_token;
        reward_token = _reward_token;
        start_stake_block_id = _start_stake_block_id;
        start_unstake_block_id = _start_unstake_block_id;
        start_claim_block_id = _start_claim_block_id;
        share_per_block = _share_per_block;
    }

    function stake(uint256 amount) external {
        require(amount > 0, 'invalid amount');
        require(!staking_paused, 'paused');

        SafeERC20.safeTransferFrom(IERC20(staking_token), _msgSender(), address(this), amount);
        total_staked_amount = amount.add(total_staked_amount);
        _update_unit_reward_state();

        StakingState storage rec = staking_db[_msgSender()];

        uint256 total_reward = _commit_user_reward(_msgSender());
        _update_staking_database(_msgSender(), rec.staked.add(amount), total_reward);

        emit StakeSuccess(_msgSender(), amount);
    }

    function unstake(uint256 amount) external {
        require(amount > 0, 'invalid amount');
        require(!unstake_paused, 'paused');
        require(block.number >= start_unstake_block_id, 'not started');

        StakingState storage rec = staking_db[_msgSender()];

        require(amount <= rec.staked, 'exceeds staked amount');

        total_staked_amount = total_staked_amount.sub(amount);
        _update_unit_reward_state();

        uint256 total_reward = _commit_user_reward(_msgSender());
        _update_staking_database(_msgSender(), rec.staked.sub(amount), total_reward);

        SafeERC20.safeTransfer(IERC20(staking_token), _msgSender(), amount);

        emit UnstakeSuccess(_msgSender(), amount);
    }

    function claim_reward() external {
        require(!claim_reward_paused, 'paused');
        require(block.number >= start_claim_block_id, 'not started');

        _update_unit_reward_state();
        uint256 total_reward = _commit_user_reward(_msgSender());

        require(total_reward > 0, 'no rewared');

        StakingState storage rec = staking_db[_msgSender()];
        _update_staking_database(_msgSender(), rec.staked, 0);

        // transfer reward to `user`
        SafeERC20.safeTransfer(IERC20(reward_token), _msgSender(), total_reward);
        emit ClaimRewardSuccess(_msgSender(), total_reward);
    }

    function get_total_reward(address staking_owner) external view returns (uint256) {
        if (block.number <= start_stake_block_id) {
            return 0;
        }

        uint256 current_accumulate_reward = accumulate_unit_reward[block.number];
        if (reward_update_block_id < block.number) {
            uint256 unit_reward_increment = unit_reward.mul(block.number.sub(reward_update_block_id));
            current_accumulate_reward = accumulate_unit_reward[reward_update_block_id].add(unit_reward_increment);
        }

        StakingState storage rec = staking_db[staking_owner];

        uint256 pre_unit_reward = accumulate_unit_reward[rec.block_id];
        uint256 current_reward = (current_accumulate_reward.sub(pre_unit_reward)).mul(rec.staked).div(TOKEN_DECIMAL);

        return rec.total_reward.add(current_reward);
    }

    function _update_staking_database(
        address staking_owner,
        uint256 staked,
        uint256 total_reward
    ) internal {
        staking_db[staking_owner].staked = staked;
        staking_db[staking_owner].total_reward = total_reward;
        staking_db[staking_owner].block_id = block.number;

        if (block.number < start_stake_block_id) {
            staking_db[staking_owner].block_id = start_stake_block_id;
        }
    }

    function _commit_user_reward(address staking_owner) internal view returns (uint256) {
        if (block.number <= start_stake_block_id) {
            return 0;
        }

        StakingState storage rec = staking_db[staking_owner];

        uint256 pre_unit_reward = accumulate_unit_reward[rec.block_id];
        uint256 latest_unit_reward = accumulate_unit_reward[block.number];
        uint256 reward = (latest_unit_reward.sub(pre_unit_reward)).mul(rec.staked).div(TOKEN_DECIMAL);

        return rec.total_reward.add(reward);
    }

    function _update_unit_reward_state() internal {
        uint256 current_block_id = block.number;
        if (reward_update_block_id >= current_block_id) {
            _update_unit_reward();
            return;
        }

        uint256 accumulate_reward_increment = unit_reward.mul(current_block_id.sub(reward_update_block_id));
        accumulate_unit_reward[current_block_id] = accumulate_reward_increment.add(
            accumulate_unit_reward[reward_update_block_id]
        );

        reward_update_block_id = block.number;

        if (current_block_id <= start_stake_block_id) {
            accumulate_unit_reward[start_stake_block_id] = accumulate_unit_reward[current_block_id];
            reward_update_block_id = start_stake_block_id;
        }

        _update_unit_reward();
    }
    //-------------------------------------------------------------------------------
    function get_staking_amount(address staking_owner) external view returns (uint256) {
        StakingState storage rec = staking_db[staking_owner];
        return rec.staked;
    }

    function _update_unit_reward() internal {
        if (total_staked_amount > 0) {
            unit_reward = share_per_block.mul(TOKEN_DECIMAL).div(total_staked_amount);
        }
    }
    //-------------------------------------------------------------------------------
    function pause_staking() external onlyOwner {
        staking_paused = true;
    }

    function restart_staking() external onlyOwner {
        staking_paused = false;
    }

    function pause_unstake() external onlyOwner {
        unstake_paused = true;
    }

    function restart_unstake() external onlyOwner {
        unstake_paused = false;
    }

    function pause_claim_reward() external onlyOwner {
        claim_reward_paused = true;
    }

    function restart_claim_reward() external onlyOwner {
        claim_reward_paused = false;
    }

    function set_staking_token(address _token) external onlyOwner {
        staking_token = _token;
    }

    function setSharePerBlock(uint256 _share_per_block) external onlyOwner {
        share_per_block = _share_per_block;
        _update_unit_reward_state();
    }

    function set_start_unstake_block_id(uint256 _start_unstake_block_id) external onlyOwner {
        start_unstake_block_id = _start_unstake_block_id;
    }

    function set_start_claim_block_id(uint256 _start_claim_block_id) external onlyOwner {
        start_claim_block_id = _start_claim_block_id;
    }

    // `contract owner` can withdraw `tokens`
    function withdraw(address token, address to) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        SafeERC20.safeTransfer(IERC20(token), to, balance);
    }
}
