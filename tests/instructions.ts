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
  getAssociatedTokenAddress
} from "@solana/spl-token";
import * as anchor from "@project-serum/anchor";
import { Solminer } from "../target/types/solminer";
import * as Constants from "./constants";
import { User } from "./user";
import { assert } from "chai";
import BN from "bn.js";

const program = anchor.workspace
  .Solminer as anchor.Program<Solminer>;

export const initializeProgram = async (admin: User) => {

  let settingsKey = await getSettingsKey();
  console.log("key =", settingsKey.toBase58());
  const poolKey = await getPoolKey();
  let res = await program.methods
    .initialize()
    .accounts({
      admin: admin.publicKey,
      settings: settingsKey,
      pool: poolKey,
      devWallet: new PublicKey(Constants.DEV_WALLET),
      marketingWallet: new PublicKey(Constants.MARKETING_WALLET),
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([admin.keypair])
    .rpc();
  return res;
};

export const initBlacklist = async (admin: User) => {

  let settingsKey = await getSettingsKey();
  const poolKey = await getPoolKey();

  const blacklistKey = await getBlacklistKey();
  let res = await program.methods
    .initBlacklist(
    )
    .accounts({
      admin: admin.publicKey,
      settings: settingsKey,
      blacklist: blacklistKey,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([admin.keypair])
    .rpc();
  return res;
};

export const createUserStateInstruction = async (
  payer: User,
  userKey: PublicKey,
  userStateKey: PublicKey
) => {
  return await program.methods
    .initUserState(userKey)
    .accounts({
      payer: payer.publicKey,
      settings: await getSettingsKey(),
      userState: userStateKey,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();
};

export const deposit = async (user: User, solAmount: number, refAddress: PublicKey) => {
  const settings = await getSettings();
  if (!settings) throw new Error('Please init program');
  console.log("settings =", settings);

  let userStateKey = await getUserStateKey(user.publicKey);
  let refUserKey = refAddress;

  const tx = new Transaction();
  let userStateData = await program.account.userState.fetchNullable(userStateKey);
  if (!userStateData) {
    tx.add(await createUserStateInstruction(user, user.publicKey, userStateKey));
  } else {
    if(userStateData.referrer.toBase58() !== PublicKey.default.toBase58()) {
      refUserKey = userStateData.referrer;
    }
  }

  let refUserStateKey = await getUserStateKey(refUserKey);
  let refUserStateData = await program.account.userState.fetchNullable(refUserStateKey);
  if (!refUserStateData) {
    tx.add(await createUserStateInstruction(user, refUserKey, refUserStateKey));
  }
  
  let seedKey = Keypair.generate().publicKey;
  let investDataKey = await getInvestDataKey(user.publicKey, seedKey);
  tx.add(await program.methods
    .deposit(
      new BN(solAmount * LAMPORTS_PER_SOL), 
      seedKey
    )
    .accounts({
      user: user.publicKey,
      settings: await getSettingsKey(),
      devWallet: settings.account.devWallet,
      pool: settings.account.pool,
      userState: userStateKey,
      investData: investDataKey,
      referrer: refUserKey,
      refUserState: refUserStateKey,
      lastDepositUser: settings.account.lastDepositUser,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .instruction());
  
  //let txHash = await sendAndConfirmTransaction(program.provider.connection, tx, [user.keypair]);
  let txHash = await program.provider.connection.simulateTransaction(tx, [user.keypair]);
  console.log("txHash =", txHash);

  const contractBalance = (await program.provider.connection.getBalance(settings.account.pool)).toFixed();
  console.log("contractBalance =", Number.parseFloat(contractBalance) / LAMPORTS_PER_SOL);

  const devWalletBalance = (await program.provider.connection.getBalance(settings.account.devWallet)).toFixed();
  console.log("devWalletBalance =", Number.parseFloat(devWalletBalance) / LAMPORTS_PER_SOL);
  return investDataKey;
};

export const unstake = async (user: User, investDataKey: PublicKey) => {
  const settings = await getSettings();
  if (!settings) throw new Error('Please init program');
  let userStateKey = await getUserStateKey(user.publicKey);
 
  let userStateData = await program.account.userState.fetchNullable(userStateKey);
  if (!userStateData) {
    throw new Error('Please deposit');;
  } 
  
  const userBalance = (await program.provider.connection.getBalance(user.publicKey)).toFixed();
  console.log("userBalance =", Number.parseFloat(userBalance) / LAMPORTS_PER_SOL);
  
  const blacklistKey = await getBlacklistKey();
  let tx = new Transaction();
  tx.add(await program.methods
    .unstake()
    .accounts({
      user: user.publicKey,
      settings: settings.publicKey,
      blacklist: blacklistKey,
      pool: settings.account.pool,
      investData: investDataKey,
      userState: userStateKey,
      devWallet: settings.account.devWallet,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .instruction());
  
  let txHash = await sendAndConfirmTransaction(program.provider.connection, tx, [user.keypair]);
  console.log("txHash =", txHash);

  const contractBalance = (await program.provider.connection.getBalance(settings.account.pool)).toFixed();
  console.log("contractBalance =", Number.parseFloat(contractBalance) / LAMPORTS_PER_SOL);

  const devWalletBalance = (await program.provider.connection.getBalance(settings.account.devWallet)).toFixed();
  console.log("devWalletBalance =", Number.parseFloat(devWalletBalance) / LAMPORTS_PER_SOL);

  const userNewBalance = (await program.provider.connection.getBalance(user.publicKey)).toFixed();
  console.log("User Balance Change = +", (Number.parseFloat(userNewBalance) - Number.parseFloat(userBalance)) / LAMPORTS_PER_SOL);

  return txHash;
};

export const compound = async (user: User, investDataKey: PublicKey) => {
  const settings = await getSettings();
  if (!settings) throw new Error('Please init program');
  let userStateKey = await getUserStateKey(user.publicKey);
 
  let userStateData = await program.account.userState.fetchNullable(userStateKey);
  if (!userStateData) {
    throw new Error('Please deposit');;
  } 

  let tx = new Transaction();
  tx.add(await program.methods
    .compound()
    .accounts({
      user: user.publicKey,
      settings: settings.publicKey,
      pool: settings.account.pool,
      investData: investDataKey,
      marketingWallet: settings.account.marketingWallet,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .instruction());
  
  let txHash = await sendAndConfirmTransaction(program.provider.connection, tx, [user.keypair]);
  console.log("txHash =", txHash);

  const contractBalance = (await program.provider.connection.getBalance(settings.account.pool)).toFixed();
  console.log("contractBalance =", Number.parseFloat(contractBalance) / LAMPORTS_PER_SOL);

  const investData = await program.account.investData.fetch(investDataKey);
 // console.log("rewardAmount =", investData.rewardAmount.toString());

  const devWalletBalance = (await program.provider.connection.getBalance(settings.account.devWallet)).toFixed();
  console.log("devWalletBalance =", Number.parseFloat(devWalletBalance) / LAMPORTS_PER_SOL);
  return txHash;
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