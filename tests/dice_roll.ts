import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { DiceRoll } from "../target/types/dice_roll";
import { User } from "./user";

describe("dice_roll", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const admin = new User();
  const user1 = new User();
  const user2 = new User();
  const user3 = new User();

  const program = anchor.workspace.DiceRoll as Program<DiceRoll>;

  it("Setup", async () => {
    await admin.init(provider);
    await user1.init(provider);
    await user2.init(provider);
    await user3.init(provider);
  });
  
  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
