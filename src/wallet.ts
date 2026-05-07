import type { KeyPair } from "@ton/crypto";
import { mnemonicToPrivateKey } from "@ton/crypto";
import type { Address, Cell, StateInit, Sender } from "@ton/core";
import { internal, TonClient, WalletContractV4 } from "@ton/ton";

export type OutboundMessage = {
  to: Address;
  value: bigint;
  body?: Cell;
  bounce?: boolean | null;
  init?: StateInit | null;
};

export type TraderWallet = {
  address: Address;
  sendMessage: (msg: OutboundMessage) => Promise<void>;
  keyPair: KeyPair;
};

export async function openWalletV4(client: TonClient, mnemonic: string): Promise<TraderWallet> {
  const words = mnemonic.trim().split(/\s+/);
  const keyPair = await mnemonicToPrivateKey(words);
  const w = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const opened = client.open(w);
  return {
    address: opened.address,
    keyPair,
    async sendMessage(msg) {
      const seqno = await opened.getSeqno();
      await opened.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to: msg.to,
            value: msg.value,
            bounce: msg.bounce,
            body: msg.body,
            init: msg.init,
          }),
        ],
      });
    },
  };
}

export function walletToSender(wallet: TraderWallet): Sender {
  return {
    address: wallet.address,
    async send(args) {
      if (args.body == null) throw new Error("DeDust sends require a body cell");
      await wallet.sendMessage({
        to: args.to,
        value: args.value,
        body: args.body,
        bounce: args.bounce,
        init: args.init ?? undefined,
      });
    },
  };
}
