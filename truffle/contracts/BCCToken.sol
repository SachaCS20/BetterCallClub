// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./BetterCallClub.sol";

contract BCCToken is ERC20, Ownable {
    uint256 private constant TOTAL_SUPPLY = 21_000_000 * (10 ** 18); // 21 million tokens with 18 decimals
    uint256 private constant TEAM_ALLOCATION = (TOTAL_SUPPLY * 40) / 100; // 40% allocated to the team
    uint256 private constant DAILY_REWARD = 11_500 * (10 ** 18); // 11,500 BCC per day
    BetterCallClub public betterCallClub;

    // Record the last claim timestamp for each caller
    mapping(address => uint256) private lastClaimTimestamp;

    constructor(address teamWallet, address _betterCallClub) ERC20("Better Call Club Token", "BCC") {
        require(teamWallet != address(0), "Team wallet address cannot be zero");

        betterCallClub = BetterCallClub(_betterCallClub);

        // Tokens to the team wallet
        _mint(teamWallet, TEAM_ALLOCATION);

        // Distribute the remaining tokens for rewards
        _mint(address(this), TOTAL_SUPPLY - TEAM_ALLOCATION);
    }

    function updateBetterCallClub(address _betterCallClub) external onlyOwner {
        require(_betterCallClub != address(0), "BetterCallClub address cannot be zero");
        betterCallClub = BetterCallClub(_betterCallClub);
    }

    function getDailyReward(address user) public view returns (uint256) {
        uint256 lastClaim = lastClaimTimestamp[user];
        uint256 rewardsToClaim = 0;

        for (uint256 i = lastClaim + 1; i <= betterCallClub.dayCounter(); i++) {
            if (betterCallClub.dailyEligibleCallers(i, user)) {
                uint256 totalEligibleCallers = betterCallClub.dailyTotalEligibleCallers(i);
                uint256 dailyRewardShare = totalEligibleCallers > 0 ? DAILY_REWARD / totalEligibleCallers : 0;
                rewardsToClaim += dailyRewardShare;
            }
        }

        return rewardsToClaim;
    }


    function claimTokens() external {
        require(balanceOf(address(this)) > 0, "No more rewards available");

        uint256 rewardsToClaim = getDailyReward(msg.sender);
        require(rewardsToClaim > 0, "No rewards to claim");

        if (balanceOf(address(this)) < rewardsToClaim) {
            rewardsToClaim = balanceOf(address(this));
        }

        _transfer(address(this), msg.sender, rewardsToClaim);
        lastClaimTimestamp[msg.sender] = betterCallClub.dayCounter();
    }
    
}
