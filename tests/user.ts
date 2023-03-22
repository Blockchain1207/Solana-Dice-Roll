import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { createAssociatedTokenAccount } from "@solana/spl-token";

export class User {
  public publicKey: PublicKey;
  public keypair: Keypair;
  public provider: anchor.Provider;

  constructor() {
    this.keypair = Keypair.generate();
    this.publicKey = this.keypair.publicKey;
  }

  public async init(provider: anchor.Provider) {
    await this.airdropSol(
      provider,
      this.keypair.publicKey,
      99999 * LAMPORTS_PER_SOL
    );
   
    this.provider = provider;
  }

  public async airdropSol(
    provider: anchor.Provider,
    target: PublicKey,
    lamps: number
  ): Promise<string> {
    const sig: string = await provider.connection.requestAirdrop(target, lamps);
    await provider.connection.confirmTransaction(sig);
    return sig;
  };
}
