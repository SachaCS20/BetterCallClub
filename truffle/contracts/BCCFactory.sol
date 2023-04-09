// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "./BCCStaking.sol";
import "./BetterCallClub.sol";
import "./BCCToken.sol";

contract BCCFactory {
    BCCStaking public stakingContract;
    BetterCallClub public betterCallClubContract;
    BCCToken public bccTokenContract; // stocke l'instance du contrat BCCToken

    function deployContracts() external {
        // Deploy BCCStaking contract
        stakingContract = new BCCStaking(address(0)); // Temporary address

         // Deploy BCCToken contract
        bccTokenContract = new BCCToken();

        // Deploy BetterCallClub contract
        betterCallClubContract = new BetterCallClub(address(stakingContract), address(bccTokenContract));

        // Update stakingToken in BCCStaking contract with the correct BCC token address
        stakingContract.updateStakingToken(address(bccTokenContract));
    }
}
