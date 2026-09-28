import { useEffect, useState } from "react";
import { ethers } from "ethers";
import deployment from "./deployment.json";
import "./App.css";

const ABI = [
  "function name() view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function awardItem(address player, string itemURI) returns (uint256)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];
const LOCAL_CHAIN_ID = 31337n;
const DEFAULT_RPC = "http://127.0.0.1:8545";

function resolveURI(uri) {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7).replace(/^ipfs\//, "")}`;
  }
  return uri;
}

function errorMessage(error) {
  return error?.shortMessage || error?.reason || error?.message || String(error);
}

export default function App() {
  const [address, setAddress] = useState(deployment.address);
  const [rpcURL, setRpcURL] = useState(DEFAULT_RPC);
  const [account, setAccount] = useState("");
  const [walletChain, setWalletChain] = useState(null);
  const [metadataURI, setMetadataURI] = useState(`${window.location.origin}/thor_hammer.txt`);
  const [recipient, setRecipient] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [nft, setNft] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!window.ethereum) return;
    let active = true;
    const refresh = async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        const chain = await window.ethereum.request({ method: "eth_chainId" });
        if (active) {
          setAccount(accounts[0] || "");
          setWalletChain(BigInt(chain));
        }
      } catch (error) {
        if (active) setStatus(errorMessage(error));
      }
    };
    refresh();
    window.ethereum.on?.("accountsChanged", refresh);
    window.ethereum.on?.("chainChanged", refresh);
    return () => {
      active = false;
      window.ethereum.removeListener?.("accountsChanged", refresh);
      window.ethereum.removeListener?.("chainChanged", refresh);
    };
  }, []);

  async function connectWallet() {
    if (!window.ethereum) throw new Error("Установите MetaMask или другой EVM-кошелёк.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    setAccount(accounts[0]);
    setWalletChain(network.chainId);
    return provider;
  }

  async function writableContract() {
    if (!ethers.isAddress(address)) throw new Error("Введите корректный адрес контракта.");
    const provider = await connectWallet();
    const network = await provider.getNetwork();
    if (network.chainId !== LOCAL_CHAIN_ID) {
      throw new Error("Переключите кошелёк на локальную сеть Hardhat (chain ID 31337).");
    }
    const code = await provider.getCode(address);
    if (code === "0x") throw new Error("По этому адресу в локальной сети нет контракта.");
    return new ethers.Contract(address, ABI, await provider.getSigner());
  }

  async function readContract() {
    if (!ethers.isAddress(address)) throw new Error("Введите корректный адрес контракта.");
    const provider = new ethers.JsonRpcProvider(rpcURL);
    if ((await provider.getCode(address)) === "0x") {
      throw new Error("По этому адресу нет контракта. Проверьте деплой и адрес.");
    }
    return new ethers.Contract(address, ABI, provider);
  }

  async function run(action) {
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      setStatus(`Ошибка: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function parsedTokenId() {
    if (!/^(0|[1-9]\d*)$/.test(tokenId)) throw new Error("Token ID должен быть целым неотрицательным числом.");
    return BigInt(tokenId);
  }

  async function awardNFT() {
    await run(async () => {
      const contract = await writableContract();
      const target = recipient.trim() || (await contract.runner.getAddress());
      if (!ethers.isAddress(target)) throw new Error("Введите корректный адрес получателя.");
      const uri = metadataURI.trim();
      if (!uri || !(uri.startsWith("ipfs://") || /^https?:\/\//.test(uri))) {
        throw new Error("URI метаданных должен начинаться с ipfs://, http:// или https://.");
      }
      setStatus("Ожидаем подтверждения транзакции в кошельке…");
      const tx = await contract.awardItem(target, uri);
      const receipt = await tx.wait();
      const transfer = receipt.logs
        .map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } })
        .find((log) => log?.name === "Transfer" && log.args.from === ethers.ZeroAddress);
      const mintedId = transfer?.args.tokenId?.toString();
      if (mintedId !== undefined) setTokenId(mintedId);
      setStatus(`NFT создан${mintedId !== undefined ? `, Token ID: ${mintedId}` : ""}. Транзакция: ${tx.hash}`);
    });
  }

  async function fetchNFT() {
    await run(async () => {
      const id = parsedTokenId();
      const contract = await readContract();
      const [uri, owner] = await Promise.all([contract.tokenURI(id), contract.ownerOf(id)]);
      const response = await fetch(resolveURI(uri));
      if (!response.ok) throw new Error(`Не удалось загрузить метаданные (HTTP ${response.status}).`);
      const metadata = await response.json();
      setNft({ id: id.toString(), uri, owner, metadata });
      setStatus(`NFT #${id} загружен.`);
    });
  }

  async function transferNFT() {
    await run(async () => {
      const id = parsedTokenId();
      if (!ethers.isAddress(transferTo.trim())) throw new Error("Введите корректный адрес нового владельца.");
      const contract = await writableContract();
      const owner = await contract.ownerOf(id);
      const signerAddress = await contract.runner.getAddress();
      if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error("Переводить NFT должен его текущий владелец.");
      }
      setStatus("Ожидаем подтверждения перевода в кошельке…");
      const tx = await contract.transferFrom(owner, transferTo.trim(), id);
      await tx.wait();
      if (nft?.id === id.toString()) setNft({ ...nft, owner: transferTo.trim() });
      setStatus(`NFT #${id} переведён. Транзакция: ${tx.hash}`);
    });
  }

  return (
    <main className="shell">
      <header className="hero">
        <span className="eyebrow">Практика 6 · Hardhat + IPFS</span>
        <h1>GameItem NFT</h1>
        <p>Создавайте, просматривайте и передавайте игровые предметы ERC-721 в локальной сети Hardhat.</p>
      </header>

      <section className="panel connection">
        <div>
          <h2>Подключение</h2>
          <p>Сеть Hardhat · chain ID 31337</p>
        </div>
        <button onClick={() => run(connectWallet)} disabled={busy}>
          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Подключить кошелёк"}
        </button>
        {walletChain !== null && walletChain !== LOCAL_CHAIN_ID && <p className="warning">Кошелёк подключён к сети {walletChain.toString()}. Переключите на Hardhat.</p>}
        <label className="full">RPC локальной сети
          <input value={rpcURL} onChange={(e) => setRpcURL(e.target.value.trim())} placeholder={DEFAULT_RPC} spellCheck="false" />
        </label>
        <label className="full">Адрес контракта
          <input value={address} onChange={(e) => setAddress(e.target.value.trim())} placeholder="0x…" spellCheck="false" />
        </label>
      </section>

      <div className="grid">
        <section className="panel">
          <h2>Создать NFT</h2>
          <p>Для демонстрации доступна локальная метаинформация. После загрузки файлов в IPFS вставьте URI вида <code>ipfs://CID</code>.</p>
          <label>URI метаданных
            <input value={metadataURI} onChange={(e) => setMetadataURI(e.target.value)} spellCheck="false" />
          </label>
          <label>Адрес получателя <small>(пусто — текущий аккаунт)</small>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" spellCheck="false" />
          </label>
          <button onClick={awardNFT} disabled={busy}>Award NFT</button>
        </section>

        <section className="panel">
          <h2>Найти NFT</h2>
          <label>Token ID
            <input value={tokenId} onChange={(e) => setTokenId(e.target.value)} inputMode="numeric" placeholder="0" />
          </label>
          <button onClick={fetchNFT} disabled={busy}>Fetch NFT</button>
          {nft && <div className="nft">
            {nft.metadata.image && <img src={resolveURI(nft.metadata.image)} alt={nft.metadata.name || `NFT #${nft.id}`} />}
            <div>
              <h3>{nft.metadata.name || `NFT #${nft.id}`}</h3>
              <p>{nft.metadata.description}</p>
              {nft.metadata.strength !== undefined && <p><strong>Сила:</strong> {nft.metadata.strength}</p>}
              <p className="break"><strong>Владелец:</strong> {nft.owner}</p>
              <p className="break"><strong>Token URI:</strong> {nft.uri}</p>
            </div>
          </div>}
        </section>

        <section className="panel transfer">
          <h2>Передать NFT</h2>
          <p>Укажите Token ID выше и адрес нового владельца. Подтверждение выполняется в кошельке.</p>
          <label>Новый владелец
            <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="0x…" spellCheck="false" />
          </label>
          <button onClick={transferNFT} disabled={busy}>Transfer NFT</button>
        </section>
      </div>
      {status && <p className="status" role="status">{status}</p>}
    </main>
  );
}
