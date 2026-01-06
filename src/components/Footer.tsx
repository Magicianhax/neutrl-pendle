"use client";

import React, { useState } from "react";

type FooterTab = "info" | "contracts";

const CONTRACTS = {
  "Neutrl Protocol": [
    { name: "NUSD", address: "0xe556aba6fe6036275ec1f87eda296be72c811bce" },
    { name: "sNUSD", address: "0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313" },
    { name: "Lock Contract", address: "0x99161BA892ECae335616624c84FAA418F64FF9A6" },
  ],
  "Pendle NUSD Market (Feb 26)": [
    { name: "Market", address: "0x6d520a943a4da0784917a2e71defe95248a1daa1" },
    { name: "SY-NUSD", address: "0x29ac34026c369d21fe3b2c7735ec986e2880b347" },
    { name: "PT-NUSD", address: "0x215a6a2a0d1c563d0cb55ebd8d126f3bc0b92cf2" },
    { name: "YT-NUSD", address: "0x38fdf2dbaae0e1e42499a4c6dfecae3b5cb35c59" },
  ],
  "Pendle sNUSD Market (Mar 5)": [
    { name: "Market", address: "0x6d8c4de7071d5aee27fc3a810764e62a4a00ceb9" },
    { name: "SY-sNUSD", address: "0x10c5e7711eaddc1b6b64e40ef1976fc462666409" },
    { name: "PT-sNUSD", address: "0x54bf2659b5cdfd86b75920e93c0844c0364f5166" },
    { name: "YT-sNUSD", address: "0x08903411e7a3eb500e30aac3bdd44775055b8c00" },
  ],
  "Curve & Other": [
    { name: "Curve NUSD-USDC Pool", address: "0x7E19F0253A564e026C63eeAA9338d6DBddeF3b09" },
    { name: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { name: "upNUSD (K3)", address: "0xd852a101B7C6e0C647C8418A763394A37Dd72bCa" },
  ],
};

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function Footer() {
  const [activeTab, setActiveTab] = useState<FooterTab>("info");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopy = (address: string) => {
    copyToClipboard(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <footer className="border-t-2 border-black dark:border-white bg-white dark:bg-black">
      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex border-b border-black/20 dark:border-white/20">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              activeTab === "info"
                ? "text-black dark:text-white border-b-2 border-black dark:border-white -mb-[1px]"
                : "text-black/50 dark:text-white/50"
            }`}
          >
            Info
          </button>
          <button
            onClick={() => setActiveTab("contracts")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              activeTab === "contracts"
                ? "text-black dark:text-white border-b-2 border-black dark:border-white -mb-[1px]"
                : "text-black/50 dark:text-white/50"
            }`}
          >
            Contracts
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        {activeTab === "info" && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-black/60 dark:text-white/60 uppercase tracking-wide">
            <p>
              Estimates only. Actual results may vary based on market conditions.
            </p>
            <p>
              Built for{" "}
              <a
                href="https://app.neutrl.fi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black dark:text-white font-bold"
              >
                Neutrl
              </a>
              {" "}on{" "}
              <a
                href="https://pendle.finance"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black dark:text-white font-bold"
              >
                Pendle
              </a>
            </p>
          </div>
        )}

        {activeTab === "contracts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(CONTRACTS).map(([category, contracts]) => (
              <div key={category}>
                <h3 className="text-xs font-bold uppercase tracking-wide text-black dark:text-white mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {contracts.map((contract) => (
                    <div
                      key={contract.address}
                      className="flex items-center justify-between gap-2 group"
                    >
                      <span className="text-xs text-black/60 dark:text-white/60">
                        {contract.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <a
                          href={`https://etherscan.io/address/${contract.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-black dark:text-white"
                        >
                          {shortenAddress(contract.address)}
                        </a>
                        <button
                          onClick={() => handleCopy(contract.address)}
                          className="p-1 text-black/40 dark:text-white/40 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy address"
                        >
                          {copiedAddress === contract.address ? (
                            <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}

