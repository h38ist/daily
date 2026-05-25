import { useState } from "react";
import { ethers } from "ethers";
import "./App.css";

const BUILDER_CODE_DATA =
  "0x62635f72393130306e666b0b0080218021802180218021802180218021";

const DAILY_CHECK_IN_V2_ADDRESS = "0x6E215f914d479c1A329A7eC38fb9dE7d7Ff3ACa0";
const BASE_CHAIN_ID = "0x2105";

function App() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [stats, setStats] = useState(null);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("MetaMask bulunamadı.");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    setAccount(accounts[0]);
    setStatus("Wallet bağlandı.");
    await loadStats(accounts[0]);
  }

  async function switchToBase() {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID }],
    });
  }

  async function getContract() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(
      DAILY_CHECK_IN_V2_ADDRESS,
      [
        "function getUserStats(address user) view returns (uint256 total, uint256 currentStreak, uint256 bestStreak, uint256 lastCheckInDay, uint256 level)",
      ],
      provider
    );
  }

  async function loadStats(userAddress = account) {
    if (!window.ethereum || !userAddress) return;

    await switchToBase();

    const contract = await getContract();
    const result = await contract.getUserStats(userAddress);

    setStats({
      total: Number(result.total),
      currentStreak: Number(result.currentStreak),
      bestStreak: Number(result.bestStreak),
      lastCheckInDay: Number(result.lastCheckInDay),
      level: Number(result.level),
    });
  }

  async function checkIn() {
    try {
      setStatus("Base ağına geçiliyor...");
      await switchToBase();

      setStatus("Daily check-in transaction hazırlanıyor...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const iface = new ethers.Interface(["function checkIn()"]);
      const normalCallData = iface.encodeFunctionData("checkIn");
      const finalData = normalCallData + BUILDER_CODE_DATA.slice(2);

      const tx = await signer.sendTransaction({
        to: DAILY_CHECK_IN_V2_ADDRESS,
        value: 0,
        data: finalData,
      });

      setTxHash(tx.hash);
      setStatus("Check-in gönderildi. Onay bekleniyor...");

      await tx.wait();

      setStatus("Daily check-in başarılı!");
      await loadStats(await signer.getAddress());
    } catch (error) {
      console.error(error);
      setStatus(error?.reason || error?.message || "Bir hata oluştu.");
    }
  }

  const progress = stats ? Math.min((stats.currentStreak / 90) * 100, 100) : 0;

  return (
    <main className="container">
      <section className="card">
        <h1>Base 90-Day Builder Check-in</h1>
        <p>
          Check in once per day on Base, build a 90-day streak, and level up.
          Each check-in includes Builder Code attribution.
        </p>

        <button onClick={connectWallet}>Connect Wallet</button>

        {account && <p className="account">Connected: {account}</p>}

        {stats && (
          <div className="stats">
            <h2>Level {stats.level}</h2>
            <p>Total Check-ins: {stats.total}</p>
            <p>Current Streak: {stats.currentStreak} / 90 days</p>
            <p>Best Streak: {stats.bestStreak} days</p>

            <div className="progress">
              <div style={{ width: `${progress}%` }}></div>
            </div>

            <p className="levels">
              L1: 1 day · L2: 7 days · L3: 30 days · L4: 60 days · L5: 90 days
            </p>
          </div>
        )}

        <button onClick={checkIn} disabled={!account}>
          Daily Check-in
        </button>

        <button onClick={() => loadStats()} disabled={!account}>
          Refresh Stats
        </button>

        {status && <p className="status">{status}</p>}

        {txHash && (
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction on BaseScan
          </a>
        )}
      </section>
    </main>
  );
}

export default App;
