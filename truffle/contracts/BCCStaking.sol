// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IBetterCallClub {
        function acceptedTokensLength() external view returns (uint256);
        function getAcceptedTokens(uint256 index) external view returns (address);
}


/**
 * @title BCCStaking
 * @notice Contrat permettant de staker des BCC et de claim les fees du protocole au prorata du staking pour les utilisateurs
 * @dev Ce contrat gère le staking du token BCC et la distribution des fees
 */
contract BCCStaking is Ownable {
    using SafeMath for uint256;

    IERC20 public stakingToken;
    uint256 public totalStaked;
    mapping(address => uint256) public stakedBalance;
    address[] public stakers;
    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => mapping(address => uint256)) public userFees;

    IBetterCallClub public betterCallClub;

    struct TokenInfo {
        IERC20 token;
        uint256 totalFees;
    }

/**
 * @notice Construit le contrat BCCStaking
 * @param _stakingToken L'adresse du token utilisé pour le staking (BCC)
*/
    constructor(address _stakingToken) {
        stakingToken = IERC20(_stakingToken);
    }

    modifier onlyBetterCallClub() {
        require(msg.sender == address(betterCallClub), "Caller is not the BetterCallClub contract");
        _;
    }

/**
 * @notice Fait passer l'adresse du contrat BetterCallClub (appelé par le script de déploiement)
 * @param _betterCallClub L'adresse du contrat BetterCallClub
*/
    function setBetterCallClub(address _betterCallClub) external onlyOwner {
        betterCallClub = IBetterCallClub(_betterCallClub);
    }

    function updateStakingToken(address _stakingToken) external onlyOwner {
        stakingToken = IERC20(_stakingToken);
    }

/**
 * @notice Permet à un utilisateur de stake ses BCC
 * @param _amount Le montant de tokens à stake
*/

    function stake(uint256 _amount) external {
        require(_amount > 0, "Cannot stake zero tokens");
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        if (stakedBalance[msg.sender] == 0) {
            stakers.push(msg.sender);
        }
        stakedBalance[msg.sender] = stakedBalance[msg.sender].add(_amount);
        totalStaked = totalStaked.add(_amount);
    }

/**
 * @notice Permet à un utilisateur d'unstake ses BCC
 * @param _amount Le montant de tokens à unstake
*/
    function unstake(uint256 _amount) external {
        stakedBalance[msg.sender] = stakedBalance[msg.sender].sub(_amount);
        totalStaked = totalStaked.sub(_amount);
        stakingToken.transfer(msg.sender, _amount);

        // Remove user from stakers if their staked balance is 0
        if (stakedBalance[msg.sender] == 0) {
            for (uint256 i = 0; i < stakers.length; i++) {
                if (stakers[i] == msg.sender) {
                    stakers[i] = stakers[stakers.length - 1];
                    stakers.pop();
                    break;
                }
            }
        }
    }

/**
 * @notice Permet à un utilisateur de réclamer toutes ses fees en une fois (dans les tokens stockés dans acceptedTokens dans BetterCallClub.sol)
*/
    function claim() external {
        for (uint256 i = 0; i < betterCallClub.acceptedTokensLength(); i++) {
            address tokenAddress = betterCallClub.getAcceptedTokens(i);
            uint256 claimableAmount = userFees[msg.sender][tokenAddress];
            require(claimableAmount > 0, "Nothing to claim");

            userFees[msg.sender][tokenAddress] = 0;
            tokenInfo[tokenAddress].token.transfer(msg.sender, claimableAmount);
        }
    }

    function getUserStakedBalance(address _user) public view returns (uint256) {
        return stakedBalance[_user];
    }

    function getUserClaimableBalance(address _user, address _tokenAddress) public view returns (uint256) {
        return userFees[_user][_tokenAddress];
    }

    function getNumberOfStakers() public view returns (uint256) {
        return stakers.length;
    }

/**
 * @notice Met à jour les frais des utilisateurs lorsqu'un nouveau call est effectué
 * @param _tokenAddress L'adresse du token pour lequel les frais sont mis à jour
 * @param _feesAmount Le montant des fees à ajouter
*/
    function updateUserFees(address _tokenAddress, uint256 _feesAmount) external onlyBetterCallClub {
        require(tokenInfo[_tokenAddress].token != IERC20(address(0)), "Token not registered");
        tokenInfo[_tokenAddress].totalFees = tokenInfo[_tokenAddress].totalFees.add(_feesAmount);

         for (uint256 i = 0; i < stakers.length; i++) {
            address user = stakers[i];
            uint256 userShare = stakedBalance[user].mul(_feesAmount).div(totalStaked);
            userFees[user][_tokenAddress] = userFees[user][_tokenAddress].add(userShare);
        }
    }

}
