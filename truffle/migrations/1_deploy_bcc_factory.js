const BCCFactory = artifacts.require("BCCFactory");
const BCCStaking = artifacts.require("BCCStaking");
const BCCToken = artifacts.require("BCCToken");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(BCCFactory);
  const bccFactory = await BCCFactory.deployed();
  console.log("BCCFactory deployed to:", bccFactory.address);

  // Call deployContracts to deploy BCCStaking and BetterCallClub
  await bccFactory.deployContracts();

  // Get deployed BCCStaking and BetterCallClub contracts
  const bccStakingAddress = await bccFactory.stakingContract();
  const bccTokenAddress = await bccFactory.bccTokenContract();
  const betterCallClubAddress = await bccFactory.betterCallClubContract();

  console.log("BCCStaking deployed to:", bccStakingAddress);
  console.log("BCCToken deployed to:", bccTokenAddress);
  console.log("BetterCallClub deployed to:", betterCallClubAddress);

  // Instantiate the deployed BCCStaking contract
  const bccStaking = await BCCStaking.at(bccStakingAddress);

  // Call setBetterCallClub to set the BetterCallClub contract as the owner of BCCStaking
  await bccStaking.setBetterCallClub(betterCallClubAddress);
  console.log("BetterCallClub set as the owner of BCCStaking");

};
