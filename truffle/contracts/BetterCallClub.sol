// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./BCCStaking.sol";

/**
 * @title BetterCallClub
 * @author Sacha COHEN SOLAL
 * @dev Gestion des clubs, des appels et des abonnements des utilisateurs.
 */

contract BetterCallClub is Ownable {
    using SafeMath for uint256;

    // Enums
    enum CallStatus { Ongoing, Finished }
    enum CallResult { InProgress, Success, Failure }
    enum SubscriptionType { None, Weekly, Monthly, Yearly, Lifetime }

    // Structures
    struct Call {
        uint256 id;
        address caller;
        string title;
        bool hasTradingViewGraph;
        string description;
        uint256 targetPrice;
        uint256 stopLoss;
        uint256 duration;
        CallStatus status;
        CallResult result;
    }

    struct Club {
        address caller;
        string clubName;
        uint256 pricePerCall;
        uint256 weeklySubscription;
        uint256 monthlySubscription;
        uint256 yearlySubscription;
        uint256 lifetimeSubscription;
        address acceptedToken;
        uint256 subscribersCount;
        mapping(address => bool) subscribers;
    }

    struct UserProfile {
        string username;
        uint256 followerCount;
        uint256 followingCount;
        uint256 totalCalls;
        uint256 successfulCalls;
        uint256 failedCalls;
        mapping(address => bool) followers;
        mapping(address => bool) following;
    }

    struct UserSubscription {
        SubscriptionType subscriptionType;
        uint256 expiryTimestamp;
    }

    // Constants
    uint256 public constant CALL_PROTOCOL_FEE_PERCENTAGE = 12;
    uint256 public constant CALL_TEAM_FEE_PERCENTAGE = 8;
    uint256 public constant CALL_CALLER_FEE_PERCENTAGE = 80;
    //(USDC, USDT, DAI, WETH, WBTC on Mumbai) :
    address[] public acceptedTokens = [address(0xe9DcE89B076BA6107Bb64EF30678efec11939234), address(0xAcDe43b9E5f72a4F554D4346e69e8e7AC8F352f0), address(0xF14f9596430931E177469715c591513308244e8F), address(0xD087ff96281dcf722AEa82aCA57E8545EA9e6C96), address(0x97e8dE167322a3bCA28E8A49BC46F6Ce128FEC68)];
    BCCStaking public stakingContract;
    address public teamWallet = address(0x2ca57255E54D5e6b4B7e745C49ae6D37D9781743);
    uint256 public constant MAX_CALL_DURATION = 182 days; // Maximum call duration of 6 months
    IERC20 public bccToken;
    

    // Variables
    mapping(address => Call[]) public calls;
    mapping(uint256 => Call) public allCalls;
    uint256 public callIdCounter;
    mapping(address => Club) public clubs;
    mapping(address => mapping(address => uint256)) public tokenBalances;
    uint256 public totalStaked;
    mapping(address => mapping(address => UserSubscription)) public userSubscriptions;
    mapping(address => mapping(uint256 => bool)) public userCallAccess; //stocker les droits d'accès des utilisateurs aux appels payants.
    uint256[] public ongoingCallIndices; //stocke les indices des calls Ongoing
    mapping(uint256 => Call) public calls2;
    mapping(address => UserProfile) public userProfiles;
    mapping(uint256 => mapping(address => bool)) public dailyEligibleCallers;
    uint256 public dayCounter;
    mapping(uint256 => uint256) public dailyTotalEligibleCallers;

    // Modifiers
    modifier onlyCallOwner(uint256 _callId) {
        require(allCalls[_callId].caller == msg.sender, "Caller must be the call owner");
        _;
    }

    modifier onlyClubOwner(address _clubAddress) {
        require(clubs[_clubAddress].caller == msg.sender, "Caller must be the club owner");
        _;
    }

    modifier onlySubscribedUser(address _clubAddress, uint256 _callId) {
        require(isUserSubscribed(msg.sender, _clubAddress) || hasUserPaidForCall(msg.sender, _callId), "You must be subscribed or have paid for the call");
        _;
    }


    // Events
    event CallPosted(address indexed caller, uint256 indexed callId);
    event CallUpdated(uint256 indexed callId, CallStatus status, CallResult result);
    event ClubCreated(address indexed caller);
    event ClubUpdated(address indexed caller);
    event UserSubscribed(address indexed user, address indexed clubAddress, SubscriptionType subscriptionType);
    event UserUnsubscribed(address indexed user, address indexed clubAddress);
    event UserPaidForCall(address indexed user, uint256 indexed callId);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);


    constructor(address _stakingContract, address _bccToken) {
        stakingContract = BCCStaking(_stakingContract);
        bccToken = IERC20(_bccToken);
        dayCounter = 1;
    }

    // Fonctions principales
    
    function createUserProfile(string memory _username) external {
        require(bytes(userProfiles[msg.sender].username).length == 0, "Profile already exists");
        userProfiles[msg.sender].username = _username;
    }

    function postCall(string memory _title, bool _hasTradingViewGraph, string memory _description, uint256 _targetPrice, uint256 _stopLoss, uint256 _duration) external {
        require(_duration > 0 && _duration <= MAX_CALL_DURATION, "Duration must be greater than 0 and less than or equal to 6 months");
        require(_targetPrice > 0, "Targetprice must be greater than 0");
        require(_stopLoss > 0, "Stop loss must be greater than 0");

        uint256 newCallId = callIdCounter.add(1);
    
        Call memory newCall = Call({
            id: newCallId,
            caller: msg.sender,
            title: _title,
            hasTradingViewGraph: _hasTradingViewGraph,
            description: _description,
            targetPrice: _targetPrice,
            stopLoss: _stopLoss,
            duration: _duration,
            status: CallStatus.Ongoing,
            result: CallResult.InProgress
        });

        calls[msg.sender].push(newCall);
        allCalls[newCallId] = newCall;
        callIdCounter = newCallId;
        ongoingCallIndices.push(newCallId);

        emit CallPosted(msg.sender, newCallId);

        uint256 today = block.timestamp / 86400;
            if (today > dayCounter) {
                dayCounter = today;
            }
        dailyEligibleCallers[dayCounter][msg.sender] = true;
        dailyTotalEligibleCallers[dayCounter] += 1;


    }


    //UPDATE de la fonction :
    //AVANT : parcourait tous les calls Ongoing ou Finished
    //MAINTENANT : ne parcours que les calls dont le status est Ongoing :
    function updateAllFinishedCalls() external onlyOwner {
        for (uint256 i = 0; i < ongoingCallIndices.length; i++) {
            uint256 callIndex = ongoingCallIndices[i];
            Call storage currentCall = allCalls[callIndex];
            if (currentCall.status == CallStatus.Ongoing && block.timestamp >= currentCall.duration) {
                currentCall.status = CallStatus.Finished;

                // Supprime l'index de ongoingCallIndices
                ongoingCallIndices[i] = ongoingCallIndices[ongoingCallIndices.length - 1];
                ongoingCallIndices.pop();
                i--;
            }
        }
    }

    function getAllCalls() external view returns (Call[] memory) {
        uint256 length = callIdCounter;
        Call[] memory callList = new Call[](length);
    
        for (uint256 i = 1; i <= length; i++) {
            callList[i - 1] = allCalls[i];
        }
    
        return callList;
    }

    function acceptedTokensLength() public view returns (uint256) {
        return acceptedTokens.length;
    }

    function getAcceptedTokens(uint256 index) public view returns (address) {
        return acceptedTokens[index];
    }

    function createClub(string memory _clubName, uint256 _pricePerCall, uint256 _weeklySubscription, uint256 _monthlySubscription, uint256 _yearlySubscription, uint256 _lifetimeSubscription, address _acceptedToken) external {
        require(_pricePerCall > 0, "Price per call must be greater than 0");
        require(_weeklySubscription > 0, "Weekly subscription price must be greater than 0");
        require(_monthlySubscription > 0, "Monthly subscription price must be greater than 0");
        require(_yearlySubscription > 0, "Yearly subscription price must be greater than 0");
        require(_lifetimeSubscription > 0, "Lifetime subscription price must be greater than 0");
        require(isTokenAccepted(_acceptedToken), "Accepted token must be in the accepted Tokens list");

        clubs[msg.sender].caller = msg.sender;
        clubs[msg.sender].clubName = _clubName;
        clubs[msg.sender].pricePerCall = _pricePerCall;
        clubs[msg.sender].weeklySubscription = _weeklySubscription;
        clubs[msg.sender].monthlySubscription = _monthlySubscription;
        clubs[msg.sender].yearlySubscription = _yearlySubscription;
        clubs[msg.sender].lifetimeSubscription = _lifetimeSubscription;
        clubs[msg.sender].acceptedToken = _acceptedToken;

        emit ClubCreated(msg.sender);
    }

    // Récupère le nombre d'abonnés d'un compte
    function getClubSubscribersCount(address _clubAddress) external view returns (uint256) {
        return clubs[_clubAddress].subscribersCount;
    }

    //Récupère la liste des membres d'un club
    function getClubSubscribers(address _clubAddress, address _user) external view returns (bool) {
        return clubs[_clubAddress].subscribers[_user];
    }

    function updateClub(uint256 _pricePerCall, uint256 _weeklySubscription, uint256 _monthlySubscription, uint256 _yearlySubscription, uint256 _lifetimeSubscription, address _acceptedToken) external onlyClubOwner(msg.sender) {
        Club storage club = clubs[msg.sender];
        club.pricePerCall = _pricePerCall;
        club.weeklySubscription = _weeklySubscription;
        club.monthlySubscription = _monthlySubscription;
        club.yearlySubscription = _yearlySubscription;
        club.lifetimeSubscription = _lifetimeSubscription;
        club.acceptedToken = _acceptedToken;
        emit ClubUpdated(msg.sender);
    }

    function subscribe(address _clubAddress, SubscriptionType _subscriptionType) external {
        require(_subscriptionType != SubscriptionType.None, "Invalid subscription type");
        Club storage club = clubs[_clubAddress];
        uint256 subscriptionPrice;
        uint256 subscriptionDuration;

        if (_subscriptionType == SubscriptionType.Weekly) {
            subscriptionPrice = club.weeklySubscription;
            subscriptionDuration = 7 days;
        } else if (_subscriptionType == SubscriptionType.Monthly) {
            subscriptionPrice = club.monthlySubscription;
            subscriptionDuration = 30 days;
        } else if (_subscriptionType == SubscriptionType.Yearly) {
            subscriptionPrice = club.yearlySubscription;
            subscriptionDuration = 365 days;
        } else {
            subscriptionPrice = club.lifetimeSubscription;
            subscriptionDuration = 0;
        }

        // Transfer the subscription fee
        IERC20(club.acceptedToken).transferFrom(msg.sender, club.caller, subscriptionPrice.mul(CALL_CALLER_FEE_PERCENTAGE).div(100));
        IERC20(club.acceptedToken).transferFrom(msg.sender, address(stakingContract), subscriptionPrice.mul(CALL_PROTOCOL_FEE_PERCENTAGE).div(100));
        IERC20(club.acceptedToken).transferFrom(msg.sender, teamWallet, subscriptionPrice.mul(CALL_TEAM_FEE_PERCENTAGE).div(100));

        // Update user subscription
        UserSubscription storage userSubscription = userSubscriptions[msg.sender][_clubAddress];
        userSubscription.subscriptionType = _subscriptionType;

        if (subscriptionDuration > 0) {
            userSubscription.expiryTimestamp = block.timestamp.add(subscriptionDuration);
        } else {
            userSubscription.expiryTimestamp = 0; // Lifetime subscription, no expiry
        }

        emit UserSubscribed(msg.sender, _clubAddress, _subscriptionType);
    }

    function unsubscribe(address _clubAddress) external {
        UserSubscription storage userSubscription = userSubscriptions[msg.sender][_clubAddress];
        require(userSubscription.subscriptionType != SubscriptionType.None, "User is not subscribed");

        userSubscription.subscriptionType = SubscriptionType.None;
        userSubscription.expiryTimestamp = 0;

        emit UserUnsubscribed(msg.sender, _clubAddress);
    }

    // Add a function that requires the user to be subscribed or have paid for the specific call
    function accessCall(uint256 _callId) external onlySubscribedUser(allCalls[_callId].caller, _callId){
    // The user can access the call since the modifier onlySubscribedUser has passed
    }

    function payPerCall(uint256 _callId) external {
        Call memory _call = allCalls[_callId];
        Club storage _club = clubs[_call.caller];
        require(_club.pricePerCall > 0, "Price per call must be greater than 0");
        
        // Transfer the fee for the call
        IERC20(_club.acceptedToken).transferFrom(msg.sender, _call.caller, _club.pricePerCall.mul(CALL_CALLER_FEE_PERCENTAGE).div(100));
        IERC20(_club.acceptedToken).transferFrom(msg.sender, address(stakingContract), _club.pricePerCall.mul(CALL_PROTOCOL_FEE_PERCENTAGE).div(100));
        IERC20(_club.acceptedToken).transferFrom(msg.sender, teamWallet, _club.pricePerCall.mul(CALL_TEAM_FEE_PERCENTAGE).div(100));

        // Grant access to the specific call
        userCallAccess[msg.sender][_callId] = true;
        emit UserPaidForCall(msg.sender, _callId);
    }

    // Add a modifier for restricting access to paid calls
    modifier onlyPaidUser(uint256 _callId) {
        require(userCallAccess[msg.sender][_callId], "User must have paid for the call");
        _;
    }

    // Add a function that requires the user to have paid for the specific call
    function accessPaidCall(uint256 _callId) external onlyPaidUser(_callId) {
        // The user can access the call since the modifier onlyPaidUser has passed
    }

    // Utility function for checking if a user has paid for a specific call
    function hasUserPaidForCall(address _user, uint256 _callId) public view returns (bool) {
        return userCallAccess[_user][_callId];
    }

    function isTokenAccepted(address _tokenAddress) public view returns (bool) {
        for (uint256 i = 0; i < acceptedTokens.length; i++) {
            if (acceptedTokens[i] == _tokenAddress) {
                return true;
            }
        }
        return false;
    }

    function getCallById(uint256 _callId) public view returns (Call memory) {
        return allCalls[_callId];
    }

    function getCallsByCaller(address _caller) public view returns (Call[] memory) {
        return calls[_caller];
    }

    function isUserSubscribed(address _user, address _clubAddress) public view returns (bool) {
        UserSubscription memory userSubscription = userSubscriptions[_user][_clubAddress];
        if (userSubscription.subscriptionType == SubscriptionType.None) {
            return false;
        }
        if (userSubscription.subscriptionType == SubscriptionType.Lifetime || userSubscription.expiryTimestamp > block.timestamp) {
            return true;
        }
        return false;
    }
}