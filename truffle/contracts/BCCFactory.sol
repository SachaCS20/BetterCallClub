// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "./BCCStaking.sol";
import "./BetterCallClub.sol";
import "./BCCToken.sol";

contract BCCFactory {
    BCCStaking public stakingContract;
    BetterCallClub public betterCallClubContract;
    BCCToken public bccTokenContract; // stocke l'instance du contrat BCCToken
    address public teamWallet;

    constructor(address _teamWallet) {
        require(_teamWallet != address(0), "Team wallet address cannot be zero");
        teamWallet = _teamWallet;
    }

    function deployContracts() external {
        // Deploy BCCStaking contract
        stakingContract = new BCCStaking(address(0)); // Temporary address

        // Deploy BCCToken contract with the teamWallet address and a temporary address for BetterCallClub
        bccTokenContract = new BCCToken(teamWallet, address(0));

        // Deploy BetterCallClub contract
        betterCallClubContract = new BetterCallClub(address(stakingContract), address(bccTokenContract));

        // Update stakingToken in BCCStaking contract with the correct BCC token address
        stakingContract.updateStakingToken(address(bccTokenContract));

        // Update betterCallClub in BCCToken contract with the correct BetterCallClub contract address
        bccTokenContract.updateBetterCallClub(address(betterCallClubContract));
    }
}
