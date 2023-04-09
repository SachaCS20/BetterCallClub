const BCCFactory = artifacts.require("BCCFactory");
const BCCStaking = artifacts.require("BCCStaking");
const BetterCallClub = artifacts.require("BetterCallClub");
const BCCToken = artifacts.require("BCCToken");

const { expect } = require("chai");

contract("BCCFactory", function (accounts) {
  let bccFactory;

  beforeEach(async () => {
    bccFactory = await BCCFactory.new();
  });

  it("should deploy the BCCStaking, BetterCallClub, and BCCToken contracts correctly", async () => {
    await bccFactory.deployContracts();

    const stakingContractAddress = await bccFactory.stakingContract();
    const betterCallClubContractAddress = await bccFactory.betterCallClubContract();
    const bccTokenContractAddress = await bccFactory.bccTokenContract();

    expect(stakingContractAddress).to.not.equal("0x0000000000000000000000000000000000000000");
    expect(betterCallClubContractAddress).to.not.equal("0x0000000000000000000000000000000000000000");
    expect(bccTokenContractAddress).to.not.equal("0x0000000000000000000000000000000000000000");

    const stakingInstance = await BCCStaking.at(stakingContractAddress);
    const betterCallClubInstance = await BetterCallClub.at(betterCallClubContractAddress);
    const bccTokenInstance = await BCCToken.at(bccTokenContractAddress);

    const stakingToken = await stakingInstance.stakingToken();
    expect(stakingToken).to.equal(bccTokenContractAddress);

    const betterCallClubStakingContract = await betterCallClubInstance.stakingContract();
    expect(betterCallClubStakingContract).to.equal(stakingContractAddress);
  });

  it("should have the correct BCCToken address set in the BetterCallClub contract", async () => {
    await bccFactory.deployContracts();
  
    const betterCallClubContractAddress = await bccFactory.betterCallClubContract();
    const bccTokenContractAddress = await bccFactory.bccTokenContract();
  
    const betterCallClubInstance = await BetterCallClub.at(betterCallClubContractAddress);
    const bccTokenInBetterCallClub = await betterCallClubInstance.bccToken();
  
    expect(bccTokenInBetterCallClub).to.equal(bccTokenContractAddress);
  });

  it("should have the correct BCCStaking address set in the BetterCallClub contract", async () => {
    await bccFactory.deployContracts();
  
    const betterCallClubContractAddress = await bccFactory.betterCallClubContract();
    const bccStakingContractAddress = await bccFactory.stakingContract();
  
    const betterCallClubInstance = await BetterCallClub.at(betterCallClubContractAddress);
    const bccStakingInBetterCallClub = await betterCallClubInstance.stakingContract();
  
    expect(bccStakingInBetterCallClub).to.equal(bccStakingContractAddress);
  });

  it("should have the correct staking token address set in the BCCStaking contract", async () => {
    await bccFactory.deployContracts();
  
    const bccStakingContractAddress = await bccFactory.stakingContract();
    const bccTokenContractAddress = await bccFactory.bccTokenContract();
  
    const bccStakingInstance = await BCCStaking.at(bccStakingContractAddress);
    const stakingTokenInBCCStaking = await bccStakingInstance.stakingToken();
  
    expect(stakingTokenInBCCStaking).to.equal(bccTokenContractAddress);
  });
  
  it("should allow multiple contract deployments from different accounts", async () => {
    const bccFactory2 = await BCCFactory.new({ from: accounts[1] });
  
    await bccFactory.deployContracts();
    await bccFactory2.deployContracts();
  
    const bccTokenContractAddress = await bccFactory.bccTokenContract();
    const bccTokenContractAddress2 = await bccFactory2.bccTokenContract();
  
    expect(bccTokenContractAddress).to.not.equal("0x0000000000000000000000000000000000000000");
    expect(bccTokenContractAddress2).to.not.equal("0x0000000000000000000000000000000000000000");
    expect(bccTokenContractAddress).to.not.equal(bccTokenContractAddress2);
  });
  
});
