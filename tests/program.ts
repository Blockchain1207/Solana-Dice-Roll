import * as anchor from "@project-serum/anchor";
import { DiceRoll } from "../target/types/dice_roll";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.DiceRoll as anchor.Program<DiceRoll>;

export const getProgram = () => {
  return program;
};
