// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title GameItem - an ERC-721 game item with per-token metadata URIs.
contract GameItem is ERC721URIStorage {
    uint256 private _nextTokenId;

    constructor() ERC721("GameItem", "ITM") {}

    // Matches the exercise: any account may award an item.
    function awardItem(address player, string memory itemURI) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(player, tokenId);
        _setTokenURI(tokenId, itemURI);
        return tokenId;
    }
}
