import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { DiceRoll } from "../target/types/dice_roll";

describe("dice_roll", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.DiceRoll as Program<DiceRoll>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
