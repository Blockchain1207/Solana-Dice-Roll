import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { DiceRoll } from "../target/types/dice_roll";
import { User } from "./user";
import {
  initializeProgram,
  placeTokenBet,
  placeSolBet,
  depositSol,
  depositToken,
  withdrawSol,
  withdrawToken
} from './instructions';

import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMint,
  mintTo,
  createAssociatedTokenAccount
} from "@solana/spl-token";
describe("dice_roll", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const admin = new User();
  const user = new User();

  const program = anchor.workspace.DiceRoll as Program<DiceRoll>;
  
  const USDC_DECIMALS = 6;
  let gangMint = null;
  let usdcMint = null;
  it('Attach Event Listener', async() => {
    const betResultEventListener = program.addEventListener(
      'BetResultEvent',
      (event, slot) => {
        console.log({
          ...event,
          betMint: event.betMint.toString(),
          authority: event.authority.toString(),
          betAmount: event.betAmount.toNumber(),
        });
      }
    );
  });

  it("Setup", async () => {
    await admin.init(provider);
    await user.init(provider);
    gangMint = await createMint(
      provider.connection,
      admin.keypair,
      admin.publicKey,
      null,
      USDC_DECIMALS
    );   
    usdcMint = await createMint(
      provider.connection,
      admin.keypair,
      admin.publicKey,
      null,
      USDC_DECIMALS
    );
    
    let userGangAta = await createAssociatedTokenAccount(provider.connection, admin.keypair, gangMint, user.publicKey);
    let userUsdcAta = await createAssociatedTokenAccount(provider.connection, admin.keypair, usdcMint, user.publicKey);
    await mintTo(provider.connection, admin.keypair, gangMint, userGangAta, admin.keypair, 1000_000_000);
    await mintTo(provider.connection, admin.keypair, usdcMint, userUsdcAta, admin.keypair, 1000_000_000);

    let adminGangAta = await createAssociatedTokenAccount(provider.connection, admin.keypair, gangMint, admin.publicKey);
    let adminUsdcAta = await createAssociatedTokenAccount(provider.connection, admin.keypair, usdcMint, admin.publicKey);
    await mintTo(provider.connection, admin.keypair, gangMint, adminGangAta, admin.keypair, 1000_000_000);
    await mintTo(provider.connection, admin.keypair, usdcMint, adminUsdcAta, admin.keypair, 1000_000_000);
  });
  
  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await initializeProgram(admin, gangMint, usdcMint);
  });

  it("Deposit Token", async () => {
    // Add your test here.
    const tx = await depositToken(admin, gangMint, 10 * 1_000_000);
  });

  it("Place Token Bet - gangMint!", async () => {
    // Add your test here.
    const tx = await placeTokenBet(user, gangMint, 10 * 1_000_000);
  });
  it("Place Token Bet! - usdcMint", async () => {
    // Add your test here.
    const tx = await placeTokenBet(user, usdcMint, 20 * 1_000_000);
  });

  it("Deposit Sol", async () => {
    // Add your test here.
    const tx = await depositSol(admin, 100 * 1000_000_000);
  });

  it("Place Sol Bet!", async () => {
    // Add your test here.
    const tx = await placeSolBet(user, 1 * 1000_000_000);
  });

  it("Withdraw Sol", async () => {
    // Add your test here.
    const tx = await withdrawSol(admin);
  });

  it("Withdraw Token", async () => {
    // Add your test here.
    const tx = await withdrawToken(admin, gangMint);
  });

});
