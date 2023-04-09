const BCCToken = artifacts.require("BCCToken");
const BetterCallClub = artifacts.require("BetterCallClub");

contract("BCCToken", function ([owner, teamWallet, user1, user2, user3]) {
  let bccToken;
  let betterCallClub;

  beforeEach(async () => {
    betterCallClub = await BetterCallClub.new({ from: owner });
    bccToken = await BCCToken.new(teamWallet, betterCallClub.address, { from: owner });

    // Simulate eligible callers for day 1
    await betterCallClub.setDailyEligibleCallers(1, user1, true);
    await betterCallClub.setDailyEligibleCallers(1, user2, true);
    await betterCallClub.setDailyEligibleCallers(1, user3, true);
    
    // Simulate total eligible callers for day 1
    await betterCallClub.setDailyTotalEligibleCallers(1, 3);
  });

  it("should have correct initial state", async () => {
    const name = await bccToken.name();
    const symbol = await bccToken.symbol();
    const decimals = await bccToken.decimals();
    const totalSupply = await bccToken.totalSupply();
    const teamWalletBalance = await bccToken.balanceOf(teamWallet);
    const contractBalance = await bccToken.balanceOf(bccToken.address);

    assert.equal(name, "Better Call Club Token");
    assert.equal(symbol, "BCC");
    assert.equal(decimals.toString(), "18");
    assert.equal(totalSupply.toString(), web3.utils.toWei("21000000", "ether"));
    assert.equal(teamWalletBalance.toString(), web3.utils.toWei("8400000", "ether"));
    assert.equal(contractBalance.toString(), web3.utils.toWei("12600000", "ether"));
  });

  it("should return correct daily reward for user1", async () => {
    const dailyReward = await bccToken.getDailyReward(user1);
    const expectedDailyReward = web3.utils.toWei("3833.333333333333333333", "ether");
    assert.equal(dailyReward.toString(), expectedDailyReward);
  });

  it("should allow user1 to claim tokens", async () => {
    const initialUserBalance = await bccToken.balanceOf(user1);
    const initialContractBalance = await bccToken.balanceOf(bccToken.address);

    await bccToken.claimTokens({ from: user1 });

    const newUserBalance = await bccToken.balanceOf(user1);
    const newContractBalance = await bccToken.balanceOf(bccToken.address);

    assert.equal(initialUserBalance.add(web3.utils.toWei("3833.333333333333333333", "ether")).toString(), newUserBalance.toString());
    assert.equal(initialContractBalance.sub(web3.utils.toWei("3833.333333333333333333", "ether")).toString(), newContractBalance.toString());
  });

  it("should return zero daily reward when user is not eligible", async () => {
    const dailyReward = await bccToken.getDailyReward(user3);
    assert.equal(dailyReward.toString(), "0");
  });

  it("should not allow claiming tokens if no rewards are available", async () => {
    // Simulate that the contract has no tokens left to distribute
    await bccToken.transfer(teamWallet, await bccToken.balanceOf(bccToken.address), { from: owner });
  
    // Attempt to claim tokens for user1
    try {
      await bccToken.claimTokens({ from: user1 });
      assert.fail("The transaction should have reverted");
    } catch (error) {
      assert(error.message.includes("No more rewards available"), `Expected "No more rewards available", but got "${error.message}" instead`);
    }
  });
});
