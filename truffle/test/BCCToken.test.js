const { expect } = require("chai");
const { BN, ether } = require("@openzeppelin/test-helpers");

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

    expect(name).to.equal("Better Call Club Token");
    expect(symbol).to.equal("BCC");
    expect(decimals).to.be.bignumber.equal(new BN(18));
    expect(totalSupply).to.be.bignumber.equal(ether("21000000"));
    expect(teamWalletBalance).to.be.bignumber.equal(ether("8400000"));
    expect(contractBalance).to.be.bignumber.equal(ether("12600000"));
  });

  it("should return correct daily reward for user1", async () => {
    const dailyReward = await bccToken.getDailyReward(user1);
    const expectedDailyReward = ether("3833.333333333333333333");
    expect(dailyReward).to.be.bignumber.equal(expectedDailyReward);
  });

  it("should allow user1 to claim tokens", async () => {
    const initialUserBalance = await bccToken.balanceOf(user1);
    const initialContractBalance = await bccToken.balanceOf(bccToken.address);

    await bccToken.claimTokens({ from: user1 });

    const newUserBalance = await bccToken.balanceOf(user1);
    const newContractBalance = await bccToken.balanceOf(bccToken.address);

    expect(newUserBalance).to.be.bignumber.equal(initialUserBalance.add(ether("3833.333333333333333333")));
    expect(newContractBalance).to.be.bignumber.equal(initialContractBalance.sub(ether("3833.333333333333333333")));
  });

  it("should return zero daily reward when user is not eligible", async () => {
    const dailyReward = await bccToken.getDailyReward(user3);
    expect(dailyReward).to.be.bignumber.equal(new BN(0));
  });

  it("should not allow claiming tokens if no rewards are available", async () => {
    // Simulate that the contract has no tokens left to distribute
    await bccToken.transfer(teamWallet, await bccToken.balanceOf(bccToken.address), { from: owner });
  
    // Attempt to claim tokens for user1
    await expectRevert(
      bccToken.claimTokens({ from: user1 }),
      "No more rewards available"
    );
  });
});