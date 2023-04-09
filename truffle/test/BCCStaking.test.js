const BCCStaking = artifacts.require("BCCStaking");
const BCCToken = artifacts.require("BCCToken");
const TestToken = artifacts.require("TestToken"); // Remplacez par le contrat de votre token ERC20 si nécessaire

contract("BCCStaking", (accounts) => {
  const [owner, staker1, staker2, betterCallClub] = accounts;
  let bccStaking, bccToken, testToken;

  beforeEach(async () => {
    bccToken = await BCCToken.new({ from: owner });
    testToken = await TestToken.new("TestToken", "TT", { from: owner }); // Remplacez par la méthode de déploiement de votre token ERC20 si nécessaire

    bccStaking = await BCCStaking.new(bccToken.address, { from: owner });
    await bccStaking.setBetterCallClub(betterCallClub, { from: owner });
  });

  it("should correctly deploy with the initial configuration", async () => {
    const stakingToken = await bccStaking.stakingToken();
    const bccAddress = await bccStaking.betterCallClub();

    assert.equal(stakingToken, bccToken.address);
    assert.equal(bccAddress, betterCallClub);
  });

  it("should allow users to stake tokens", async () => {
    const amountToStake = web3.utils.toBN(100);

    await bccToken.transfer(staker1, amountToStake, { from: owner });
    await bccToken.approve(bccStaking.address, amountToStake, { from: staker1 });

    await bccStaking.stake(amountToStake, { from: staker1 });

    const staker1Balance = await bccStaking.stakedBalance(staker1);
    const totalStaked = await bccStaking.totalStaked();

    assert(staker1Balance.eq(amountToStake));
    assert(totalStaked.eq(amountToStake));
  });

  it("should allow users to unstake tokens", async () => {
    const amountToStake = web3.utils.toBN(100);
    const amountToUnstake = web3.utils.toBN(50);

    await bccToken.transfer(staker1, amountToStake, { from: owner });
    await bccToken.approve(bccStaking.address, amountToStake, { from: staker1 });

    await bccStaking.stake(amountToStake, { from: staker1 });
    await bccStaking.unstake(amountToUnstake, { from: staker1 });

    const staker1Balance = await bccStaking.stakedBalance(staker1);
    const totalStaked = await bccStaking.totalStaked();

    assert(staker1Balance.eq(amountToStake.sub(amountToUnstake)));
    assert(totalStaked.eq(amountToStake.sub(amountToUnstake)));
  });

  it("should allow users to claim rewards", async () => {
    const amountToStake = web3.utils.toBN(100);
    const feesAmount = web3.utils.toBN(50);

    await bccToken.transfer(staker1, amountToStake, { from: owner });
    await bccToken.approve(bccStaking.address, amountToStake, { from: staker1 });

    await bccStaking.stake(amountToStake, { from: staker1 });

    await testToken.transfer(bccStaking.address, feesAmount, { from: owner });
    await bccStaking.updateUserFees(testToken.address, feesAmount, { from: betterCallClub });

    const claimableAmountBefore = await bccStaking.getUserClaimableBalance(staker1, testToken.address);
    assert(claimableAmountBefore.eq(feesAmount));

    await bccStaking.claim({ from: staker1 });

    const claimableAmountAfter = await bccStaking.getUserClaimableBalance(staker1, testToken.address);
    const staker1TestTokenBalance = await testToken.balanceOf(staker1);

    assert(claimableAmountAfter.eq(web3.utils.toBN(0)));
    assert(staker1TestTokenBalance.eq(feesAmount));
  });

  it("should distribute fees proportionally among stakers", async () => {
    const amountToStake1 = web3.utils.toBN(100);
    const amountToStake2 = web3.utils.toBN(200);
    const feesAmount = web3.utils.toBN(300); // A MODIFIER POUR VERIFIER AVEC 11500

    await bccToken.transfer(staker1, amountToStake1, { from: owner });
    await bccToken.transfer(staker2, amountToStake2, { from: owner });

    await bccToken.approve(bccStaking.address, amountToStake1, { from: staker1 });
    await bccToken.approve(bccStaking.address, amountToStake2, { from: staker2 });

    await bccStaking.stake(amountToStake1, { from: staker1 });
    await bccStaking.stake(amountToStake2, { from: staker2 });

    await testToken.transfer(bccStaking.address, feesAmount, { from: owner });
    await bccStaking.updateUserFees(testToken.address, feesAmount, { from: betterCallClub });

    const claimableAmount1 = await bccStaking.getUserClaimableBalance(staker1, testToken.address);
    const claimableAmount2 = await bccStaking.getUserClaimableBalance(staker2, testToken.address);

    assert(claimableAmount1.eq(web3.utils.toBN(100))); //A MODIFIER SI FEESAMOUNT DIFFERENT DE 300 AU DEBUT
    assert(claimableAmount2.eq(web3.utils.toBN(200))); //A MODIFIER SI FEESAMOUNT DIFFERENT DE 300 AU DEBUT
  });

  it("should not allow users to unstake more tokens than they have staked", async () => {
    const amountToStake = web3.utils.toBN(100);
    const amountToUnstake = web3.utils.toBN(101);
  
    await bccToken.transfer(staker1, amountToStake, { from: owner });
    await bccToken.approve(bccStaking.address, amountToStake, { from: staker1 });
  
    await bccStaking.stake(amountToStake, { from: staker1 });
  
    await expectRevert(
      bccStaking.unstake(amountToUnstake, { from: staker1 }),
      "ERC20: burn amount exceeds balance"
    );
  });

  it("should not allow users to stake zero tokens", async () => {
    const amountToStake = web3.utils.toBN(0);
  
    await bccToken.transfer(staker1, amountToStake, { from: owner });
    await bccToken.approve(bccStaking.address, amountToStake, { from: staker1 });
  
    await expectRevert(
      bccStaking.stake(amountToStake, { from: staker1 }),
      "Cannot stake zero tokens"
    );
  });

  it("should not allow users to claim rewards if no rewards are available", async () => {
    const amountToStake = web3.utils.toBN(100);
  
    await bccToken.transfer(staker1, amountToStake, { from: owner });
    await bccToken.approve(bccStaking.address, amountToStake, { from: staker1 });
  
    await bccStaking.stake(amountToStake, { from: staker1 });
  
    await expectRevert(
      bccStaking.claim({ from: staker1 }),
      "Nothing to claim"
    );
  });

  it("should only allow the owner to call setBetterCallClub", async () => {
    const newBetterCallClub = accounts[9];
  
    await expectRevert(
      bccStaking.setBetterCallClub(newBetterCallClub, { from: staker1 }),
      "Ownable: caller is not the owner"
    );
  
    await bccStaking.setBetterCallClub(newBetterCallClub, { from: owner });
    const updatedBetterCallClub = await bccStaking.betterCallClub();
    assert.equal(updatedBetterCallClub, newBetterCallClub, "Failed to update BetterCallClub");
  });

  it("should only allow the owner to call updateStakingToken", async () => {
    const newStakingToken = accounts[9];
  
    await expectRevert(
      bccStaking.updateStakingToken(newStakingToken, { from: staker1 }),
      "Ownable: caller is not the owner"
    );
  
    await bccStaking.updateStakingToken(newStakingToken, { from: owner });
    const updatedStakingToken = await bccStaking.stakingToken();
    assert.equal(updatedStakingToken, newStakingToken, "Failed to update staking token");
  });

  it("should correctly update totalStaked when multiple users stake tokens", async () => {
    const staker1Amount = web3.utils.toBN(100);
    const staker2Amount = web3.utils.toBN(200);
  
    await bccToken.transfer(staker1, staker1Amount, { from: owner });
    await bccToken.transfer(staker2, staker2Amount, { from: owner });
  
    await bccToken.approve(bccStaking.address, staker1Amount, { from: staker1 });
    await bccToken.approve(bccStaking.address, staker2Amount, { from: staker2 });
  
    await bccStaking.stake(staker1Amount, { from: staker1 });
    await bccStaking.stake(staker2Amount, { from: staker2 });
  
    const totalStaked = await bccStaking.totalStaked();
    assert.equal(totalStaked.toString(), staker1Amount.add(staker2Amount).toString(), "Total staked amount is incorrect");
  });
  
  it("should correctly update user rewards after claiming", async () => {
    const staker1Amount = web3.utils.toBN(100);
    const rewardTokenAmount = web3.utils.toBN(50);
  
    await bccToken.transfer(staker1, staker1Amount, { from: owner });
    await bccToken.approve(bccStaking.address, staker1Amount, { from: staker1 });
  
    await bccStaking.stake(staker1Amount, { from: staker1 });
  
    await rewardToken.transfer(bccStaking.address, rewardTokenAmount, { from: owner });
    await bccStaking.updateUserFees(rewardToken.address, rewardTokenAmount, { from: betterCallClub });
  
    const claimableAmountBeforeClaim = await bccStaking.getUserClaimableBalance(staker1, rewardToken.address);
    assert.equal(claimableAmountBeforeClaim.toString(), rewardTokenAmount.toString(), "Claimable amount is incorrect before claim");
  
    await bccStaking.claim({ from: staker1 });
  
    const claimableAmountAfterClaim = await bccStaking.getUserClaimableBalance(staker1, rewardToken.address);
    assert.equal(claimableAmountAfterClaim.toString(), "0", "Claimable amount should be 0 after claim");
  
    const rewardTokenBalance = await rewardToken.balanceOf(staker1);
    assert.equal(rewardTokenBalance.toString(), rewardTokenAmount.toString(), "Reward token balance after claim is incorrect");
  });
});

