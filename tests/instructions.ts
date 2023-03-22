import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMint,
  mintTo
} from "@solana/spl-token";
import * as anchor from "@project-serum/anchor";
import { DiceRoll } from "../target/types/dice_roll";
import * as Constants from "./constants";
import { User } from "./user";
import { assert } from "chai";
import BN from "bn.js";

const SOL_PYTH_ACC = new PublicKey("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG");
const program = anchor.workspace
  .DiceRoll as anchor.Program<DiceRoll>;

export const initializeProgram = async (admin: User, gangMint: PublicKey, usdcMint: PublicKey) => {
  const stateKey = await getStateKey();
  let poolGangTokenAccount = await getAssociatedTokenAddress(gangMint, stateKey, true);
  let poolUsdcTokenAccount = await getAssociatedTokenAddress(usdcMint, stateKey, true);
  const vaultKey = await getVaultKey();
  let res = await program.methods
    .initialize()
    .accounts({
      authority: admin.publicKey,
      state: stateKey,
      gangMint,
      usdcMint,
      poolGangTokenAccount,
      poolUsdcTokenAccount,
      poolSolVault: vaultKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([admin.keypair])
    .rpc();
  return res;
};

export const placeTokenBet = async (user: User, tokenMint: PublicKey, amount: number) => {
  const stateKey = await getStateKey();
  let poolTokenAccount = await getAssociatedTokenAddress(tokenMint, stateKey, true);
  let userTokenAccount = await getAssociatedTokenAddress(tokenMint, user.publicKey);
  console.log('before bet token bal: ', await program.provider.connection.getTokenAccountBalance(userTokenAccount));
  let tx = await program.methods
    .placeTokenBet(new BN(amount))
    .accounts({
      authority: user.publicKey,
      state: stateKey,
      solPythAccount: SOL_PYTH_ACC,
      poolTokenAccount,
      userTokenAccount,
      betTokenMint: tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([user.keypair])
    .rpc();
  console.log('before bet token bal: ', await program.provider.connection.getTokenAccountBalance(userTokenAccount));
  //let res = await program.provider.connection.simulateTransaction(tx, [user.keypair]);
  //  console.log('sim res =', res);
  return tx;
};

export const placeSolBet = async (user: User, amount: number) => {
  const stateKey = await getStateKey();
  const vaultKey = await getVaultKey();
  console.log('before sol bal: ', await program.provider.connection.getBalance(user.publicKey));
  let res = await program.methods
    .placeSolBet(new BN(amount))
    .accounts({
      authority: user.publicKey,
      state: stateKey,
      solPythAccount: SOL_PYTH_ACC,
      poolSolVault: vaultKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .signers([user.keypair])
    .rpc();
    console.log('after sol bal: ', await program.provider.connection.getBalance(user.publicKey));
  return res;
};

export const depositSol = async (admin: User, amount: number) => {
  const vaultKey = await getVaultKey();
  console.log('before sol bal: ', await program.provider.connection.getBalance(admin.publicKey));
  let res = await program.methods
    .depositSol(new BN(amount))
    .accounts({
      authority: admin.publicKey,
      poolSolVault: vaultKey,
      systemProgram: SystemProgram.programId
    })
    .signers([admin.keypair])
    .rpc();
  console.log('after sol bal: ', await program.provider.connection.getBalance(admin.publicKey));
  return res;
};
export const depositToken = async (user: User, tokenMint: PublicKey, amount: number) => {
  const stateKey = await getStateKey();
  let poolTokenAccount = await getAssociatedTokenAddress(tokenMint, stateKey, true);
  let userTokenAccount = await getAssociatedTokenAddress(tokenMint, user.publicKey, true);
  console.log('before deposit token bal: ', await program.provider.connection.getTokenAccountBalance(userTokenAccount));
  let res = await program.methods
    .depositToken(new BN(amount))
    .accounts({
      authority: user.publicKey,
      state: stateKey,
      poolTokenAccount,
      userTokenAccount,
      betTokenMint: tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([user.keypair])
    .rpc();
  console.log('after deposit token bal: ', await program.provider.connection.getTokenAccountBalance(userTokenAccount));
  return res;
};
export const withdrawSol = async (admin: User) => {
  const vaultKey = await getVaultKey();
  const stateKey = await getStateKey();
  console.log('before sol bal: ', await program.provider.connection.getBalance(admin.publicKey));
  let res = await program.methods
    .withdrawSol()
    .accounts({
      authority: admin.publicKey,
      state: stateKey,
      poolSolVault: vaultKey,
      systemProgram: SystemProgram.programId
    })
    .signers([admin.keypair])
    .rpc();
  // console.log('sim res =', await program.provider.connection.simulateTransaction(res, [admin.keypair]));

  console.log('after sol bal: ', await program.provider.connection.getBalance(admin.publicKey));
  return res;
};
export const withdrawToken = async (user: User, tokenMint: PublicKey) => {
  const stateKey = await getStateKey();
  let poolTokenAccount = await getAssociatedTokenAddress(tokenMint, stateKey, true);
  let userTokenAccount = await getAssociatedTokenAddress(tokenMint, user.publicKey, true);
  console.log('before withdraw token bal: ', await program.provider.connection.getTokenAccountBalance(userTokenAccount));
  let res = await program.methods
    .withdrawToken()
    .accounts({
      authority: user.publicKey,
      state: stateKey,
      poolTokenAccount,
      userTokenAccount,
      betTokenMint: tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([user.keypair])
    .rpc();
  console.log('after withdraw token bal: ', await program.provider.connection.getTokenAccountBalance(userTokenAccount));
  return res;
};

export const fetchAllData = async (type: string, options?: any) => {
  return await program.account[type].all();
};

export const getSettings = async () => {
  try {
    return (await fetchAllData('state'))[0];
  } catch(e) {
    console.error(e);
    return null;
  }
}

export const getStateKey = async () => {
  return (await PublicKey.findProgramAddress([Buffer.from(Constants.STATE_SEED)], program.programId))[0];
}

export const getVaultKey = async () => {
  return (await PublicKey.findProgramAddress([Buffer.from(Constants.VAULT_SEED)], program.programId))[0];
}