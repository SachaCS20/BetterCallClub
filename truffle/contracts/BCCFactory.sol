// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "./BCCStaking.sol";
import "./BetterCallClub.sol";
import "./BCCToken.sol";


/**
 * @title BCCFactory
 * @notice Contrat pour déployer les contrats BCCStaking, BetterCallClub et BCCToken
 * @dev Ce contrat permet de déployer les contrats nécessaires et de les configurer correctement
*/

contract BCCFactory {
    BCCStaking public stakingContract;
    BetterCallClub public betterCallClubContract;
    BCCToken public bccTokenContract;
    address public teamWallet;

/**
 * @notice Construit le contrat BCCFactory
 * @param _teamWallet L'adresse du portefeuille de l'équipe
*/
    constructor(address _teamWallet) {
        require(_teamWallet != address(0), "Team wallet address cannot be zero");
        teamWallet = _teamWallet;
    }

/**
 * @notice Déploie les contrats BCCStaking, BetterCallClub et BCCToken
 * @dev Cette fonction déploie les contrats et les configure correctement
*/
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
