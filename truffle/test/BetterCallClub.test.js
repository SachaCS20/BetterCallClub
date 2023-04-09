const BetterCallClub = artifacts.require("BetterCallClub");
const BCCStaking = artifacts.require("BCCStaking");
const IERC20 = artifacts.require("IERC20");

const truffleAssert = require('truffle-assertions');


contract("BetterCallClub", (accounts) => {
    const owner = accounts[0];
    const user1 = accounts[1];
    const user2 = accounts[2];
    const teamWallet = accounts[3];
    const stakingContract = accounts[4];
    const bcctoken = accounts[5];
    const CALL_PROTOCOL_FEE_PERCENTAGE = 12;
    const CALL_TEAM_FEE_PERCENTAGE = 8;
    const CALL_CALLER_FEE_PERCENTAGE = 80;

    let betterCallClubInstance;
    let bccTokenInstance;
    let acceptedTokenInstance;

    beforeEach(async () => {
        bccTokenInstance = await IERC20.new({ from: owner });
        betterCallClubInstance = await BetterCallClub.new(BCCStaking.address, bccTokenInstance.address, { from: owner });
        const acceptedTokenIndex = 1;
        const acceptedTokenAddress = await betterCallClubInstance.getAcceptedTokens(acceptedTokenIndex);
        acceptedTokenInstance = await IERC20.at(acceptedTokenAddress);

    });

    it("should create a new user profile", async () => {
        await betterCallClubInstance.createUserProfile("User1", { from: user1 });
        const userProfile = await betterCallClubInstance.userProfiles(user1);
        assert.equal(userProfile.username, "User1", "User profile creation failed");
    });

    it("should post a new call", async () => {
        await betterCallClubInstance.postCall("Test Call", false, "Test Description", 100, 50, 30 * 24 * 60 * 60, { from: user1 });
        const userCalls = await betterCallClubInstance.calls(user1);
        assert.equal(userCalls.length, 1, "Call posting failed");
    });

    it("should create a new club correctly", async () => {
        const acceptedTokenIndex = 1;
        const acceptedTokenAddress = await betterCallClubInstance.getAcceptedTokens(acceptedTokenIndex);
        const clubName = "Club Test";
        const pricePerCall = 100;
        const weeklySubscription = 200;
        const monthlySubscription = 800;
        const yearlySubscription = 9600;
        const lifetimeSubscription = 24000;
    
        await betterCallClubInstance.createClub(clubName, pricePerCall, weeklySubscription, monthlySubscription, yearlySubscription, lifetimeSubscription, acceptedTokenAddress, { from: accounts[1] });
    
        const club = await betterCallClubInstance.clubs(accounts[1]);
    
        assert.equal(club.caller, accounts[1]);
        assert.equal(club.clubName, clubName);
        assert.equal(club.pricePerCall, pricePerCall);
        assert.equal(club.weeklySubscription, weeklySubscription);
        assert.equal(club.monthlySubscription, monthlySubscription);
        assert.equal(club.yearlySubscription, yearlySubscription);
        assert.equal(club.lifetimeSubscription, lifetimeSubscription);
        assert.equal(club.acceptedToken, acceptedTokenAddress);
    });

    it("should allow a user to subscribe to a club correctly", async () => {
        const user = accounts[2];
        const clubOwner = accounts[1];
        const subscriptionType = 1; // Weekly subscription
        const subscriptionPrice = 200;

        const acceptedTokenIndex = 1;
        const acceptedTokenAddress = await betterCallClubInstance.getAcceptedTokens(acceptedTokenIndex);
        const acceptedTokenInstance = await IERC20.at(acceptedTokenAddress);
    
        // Approve token transfer
        await acceptedTokenInstance.approve(betterCallClubInstance.address, subscriptionPrice, { from: user });
    
        // Subscribe
        await betterCallClubInstance.subscribe(clubOwner, subscriptionType, { from: user });
    
        const userSubscription = await betterCallClubInstance.userSubscriptions(user, clubOwner);
    
        assert.equal(userSubscription.subscriptionType, subscriptionType);
        assert(userSubscription.expiryTimestamp > 0);
    });

    it("should allow a user to unsubscribe from a club correctly", async () => {
        const user = accounts[2];
        const clubOwner = accounts[1];
    
        // Unsubscribe
        await betterCallClubInstance.unsubscribe(clubOwner, { from: user });
    
        const userSubscription = await betterCallClub.userSubscriptions(user, clubOwner);
    
        assert.equal(userSubscription.subscriptionType, 0);
        assert.equal(userSubscription.expiryTimestamp, 0);
    });

    it("should allow a user to pay for a specific call correctly", async () => {
        const user = accounts[3];
        const callId = 1;
        const call = await betterCallClubInstance.allCalls(callId);
        const club = await betterCallClubInstance.clubs(call.caller);

        const acceptedTokenIndex = 1;
        const acceptedTokenAddress = await betterCallClubInstance.acceptedTokens(acceptedTokenIndex);
        const acceptedTokenInstance = await IERC20.at(acceptedTokenAddress);

        const pricePerCall = club.pricePerCall;
    
        // Approve token transfer
        await acceptedTokenInstance.approve(betterCallClubInstance.address, pricePerCall, { from: user });
    
        // Pay for the call
        await betterCallClubInstance.payPerCall(callId, { from: user });
    
        const hasPaid = await betterCallClubInstance.hasUserPaidForCall(user, callId);
        assert(hasPaid);
    });

    it("User cannot access a specific call without paying for it", async () => {
        const callId = 1;
        // User should not have access to the call initially
        assert.isFalse(await betterCallClub.hasUserPaidForCall(user1, callId));

        // Try to access the paid call without paying
        try {
            await betterCallClub.accessPaidCall(callId, { from: user1 });
            assert.fail("Expected error not thrown");
        } catch (error) {
            assert.isTrue(error.message.includes("User must have paid for the call"));
        }  
    });

    it("Tokens are distributed correctly when user pays for a call", async () => {
        const betterCallClubInstance = await BetterCallClub.deployed();
        const clubCaller = accounts[1];
        const user = accounts[2];
        const callId = 1; // Assuming the call with ID 1 exists
    
        // Create club
        await betterCallClubInstance.createClub("Test Club", 100, 500, 2000, 8000, 30000, acceptedTokenAddress, {from: clubCaller});
    
        // Approve the ERC20 transfer
        const acceptedTokenInstance = await IERC20.at(acceptedTokenAddress);
        const pricePerCall = (await betterCallClubInstance.clubs(clubCaller)).pricePerCall;
        const totalFee = pricePerCall.mul(new BN(100)).div(new BN(80));
        await acceptedTokenInstance.approve(betterCallClubInstance.address, totalFee, {from: user});
    
        // Pay for the call
        const callerInitialBalance = await acceptedTokenInstance.balanceOf(clubCaller);
        const protocolInitialBalance = await acceptedTokenInstance.balanceOf(stakingContract.address);
        const teamInitialBalance = await acceptedTokenInstance.balanceOf(teamWallet);
    
        await betterCallClubInstance.payPerCall(callId, {from: user});
    
        // Check the token balances after paying for the call
        const callerFinalBalance = await acceptedTokenInstance.balanceOf(clubCaller);
        const protocolFinalBalance = await acceptedTokenInstance.balanceOf(stakingContract.address);
        const teamFinalBalance = await acceptedTokenInstance.balanceOf(teamWallet);
    
        assert.equal(callerFinalBalance.sub(callerInitialBalance).toString(), pricePerCall.mul(new BN(CALL_CALLER_FEE_PERCENTAGE)).div(new BN(100)).toString(), "Caller fee was not distributed correctly");
        assert.equal(protocolFinalBalance.sub(protocolInitialBalance).toString(), pricePerCall.mul(new BN(CALL_PROTOCOL_FEE_PERCENTAGE)).div(new BN(100)).toString(), "Protocol fee was not distributed correctly");
        assert.equal(teamFinalBalance.sub(teamInitialBalance).toString(), pricePerCall.mul(new BN(CALL_TEAM_FEE_PERCENTAGE)).div(new BN(100)).toString(), "Team fee was not distributed correctly");
    });

    it("should not allow a user to create a club with invalid subscription prices", async () => {
        const clubName = "Invalid Club";
        const pricePerCall = 100;
        const weeklySubscription = 100;
        const monthlySubscription = 400;
        const yearlySubscription = 4500;
        const lifetimeSubscription = 11000;
    
        try {
            await betterCallClubInstance.createClub(clubName, pricePerCall, weeklySubscription, monthlySubscription, yearlySubscription, lifetimeSubscription, acceptedTokens[0], { from: accounts[1] });
            assert.fail("Expected error not thrown");
        } catch (error) {
            assert.isTrue(error.message.includes("Invalid subscription prices"));
        }
    });
    
    it("should not allow a user to create a club with a negative call price", async () => {
        const clubName = "Invalid Club";
        const pricePerCall = -100;
        const weeklySubscription = 200;
        const monthlySubscription = 800;
        const yearlySubscription = 9600;
        const lifetimeSubscription = 24000;
    
        try {
            await betterCallClubInstance.createClub(clubName, pricePerCall, weeklySubscription, monthlySubscription, yearlySubscription, lifetimeSubscription, acceptedTokens[0], { from: accounts[1] });
            assert.fail("Expected error not thrown");
        } catch (error) {
            assert.isTrue(error.message.includes("Invalid call price"));
        }
    });
    
    it("should not allow a user to subscribe with an invalid subscription type", async () => {
        const user = accounts[2];
        const clubOwner = accounts[1];
        const subscriptionType = 5; // Invalid subscription type
        const subscriptionPrice = 200;
    
        try {
            await acceptedTokenInstance.approve(betterCallClubInstance.address, subscriptionPrice, { from: user });
            await betterCallClubInstance.subscribe(clubOwner, subscriptionType, { from: user });
            assert.fail("Expected error not thrown");
        } catch (error) {
            assert.isTrue(error.message.includes("Invalid subscription type"));
        }
    });
    
    it("should not allow a user to subscribe without approving token transfer", async () => {
        const user = accounts[2];
        const clubOwner = accounts[1];
        const subscriptionType = 1; // Weekly subscription
        const subscriptionPrice = 200;
    
        try {
            await betterCallClubInstance.subscribe(clubOwner, subscriptionType, { from: user });
            assert.fail("Expected error not thrown");
        } catch (error) {
            assert.isTrue(error.message.includes("ERC20: transfer amount exceeds allowance"));
        }
    });
    
    it("should not allow a user to pay for a specific call without approving token transfer", async () => {
        const user = accounts[3];
        const callId = 1;
        const call = await betterCallClubInstance.allCalls(callId);
        const club = await betterCallClubInstance.clubs(call.caller);
        const pricePerCall = club.pricePerCall;
    
        try {
            await betterCallClubInstance.payPerCall(callId, { from: user });
            assert.fail("Expected error not thrown");
        } catch (error) {
            assert.isTrue(error.message.includes("ERC20: transfer amount exceeds allowance"));
        }
    });
    
    it("should not allow a user to pay for a non-existent call", async () => {
        const user = accounts[3];
        const callId = 999; // Non-existent call ID
        const pricePerCall = 100;
    
        try {
            await acceptedTokenInstance.approve(betterCallClubInstance.address, pricePerCall, { from: user });
            await betterCallClubInstance.payPerCall(callId, { from: user });
            assert.fail("Expected error not thrown");
        } catch (error) {
            assert.isTrue(error.message.includes("Call does not exist"));
        }
    });
});

