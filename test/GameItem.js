const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GameItem", function () {
  async function deploy() {
    return ethers.deployContract("GameItem");
  }

  it("sets the collection name and symbol", async function () {
    const item = await deploy();
    expect(await item.name()).to.equal("GameItem");
    expect(await item.symbol()).to.equal("ITM");
  });

  it("awards sequential NFTs to different accounts with their own metadata", async function () {
    const [player0, player1] = await ethers.getSigners();
    const item = await deploy();
    const firstURI = "ipfs://bafy-example/thor_hammer.json";
    const secondURI = "https://example.org/second.json";

    await expect(item.awardItem(player0.address, firstURI))
      .to.emit(item, "Transfer")
      .withArgs(ethers.ZeroAddress, player0.address, 0);
    await item.awardItem(player1.address, secondURI);

    expect(await item.ownerOf(0)).to.equal(player0.address);
    expect(await item.ownerOf(1)).to.equal(player1.address);
    expect(await item.tokenURI(0)).to.equal(firstURI);
    expect(await item.tokenURI(1)).to.equal(secondURI);
  });

  it("allows the owner to transfer an awarded NFT", async function () {
    const [player0, player1] = await ethers.getSigners();
    const item = await deploy();
    await item.awardItem(player0.address, "ipfs://metadata");
    await item.connect(player0).transferFrom(player0.address, player1.address, 0);
    expect(await item.ownerOf(0)).to.equal(player1.address);
  });
});
