use anchor_lang::prelude::*;
use anchor_spl::{
  token::{self, Mint, Token, TokenAccount, Transfer},
  associated_token::{self, AssociatedToken}
};
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
use std::mem::size_of;

pub const STATE_SEED: &[u8] = b"STATE_SEED";
pub const VAULT_SEED: &[u8] = b"VAULT_SEED";

#[program]
pub mod dice_roll {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
      let accts = ctx.accounts;
      accts.state.authority = accts.authority.key();
      accts.state.gang_mint = accts.gang_mint.key();
      accts.state.usdc_mint = accts.usdc_mint.key();
      Ok(())
    }

    pub fn place_token_bet(ctx: Context<PlaceTokenBet>) -> Result<()> {
      let accts = ctx.accounts;
      Ok(())
    }

    pub fn place_sol_bet(ctx: Context<PlaceSolBet>) -> Result<()> {
      let accts = ctx.accounts;
      Ok(())
    }

    pub fn deposit_sol(ctx: Context<DepositSol>) -> Result<()> {
      let accts = ctx.accounts;
      Ok(())
    }

    pub fn deposit_token(ctx: Context<DepositToken>) -> Result<()> {
      let accts = ctx.accounts;
      Ok(())
    }
    
    pub fn withdraw_sol(ctx: Context<WithdrawSol>) -> Result<()> {
      let accts = ctx.accounts;
      Ok(())
    }
    
    pub fn withdraw_token(ctx: Context<WithdrawToken>) -> Result<()> {
      let accts = ctx.accounts;
      Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
      init, 
      payer = authority, 
      space = 8 + size_of::<State>(),
      seeds = [STATE_SEED], 
      bump
    )]
    pub state: Account<'info, State>,

    pub gang_mint: Account<'info, Mint>,
    pub usdc_mint: Account<'info, Mint>,

    #[account(
      init,
      payer = authority,
      associated_token::authority = state, 
      associated_token::mint = gang_mint
    )]
    pub pool_gang_token_account: Account<'info, TokenAccount>,
    #[account(
      init,
      payer = authority,
      associated_token::authority = state, 
      associated_token::mint = usdc_mint
    )]
    pub pool_usdc_token_account: Account<'info, TokenAccount>,
    #[account(seeds = [VAULT_SEED], bump)]
    pub pool_sol_vault: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

#[derive(Accounts)]
pub struct PlaceTokenBet<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
      mut,
      seeds = [STATE_SEED],
      bump,
    )]
    pub state: Account<'info, State>,
    #[account(mut, associated_token::authority = state, associated_token::mint = bet_token_mint)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut, associated_token::authority = authority, associated_token::mint = bet_token_mint)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub bet_token_mint: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct PlaceSolBet<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
      mut,
      seeds = [STATE_SEED],
      bump,
    )]
    pub state: Account<'info, State>,
    #[account(
      mut,
      seeds = [VAULT_SEED], 
      bump
    )]
    pub pool_sol_vault: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}


#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [VAULT_SEED], bump)]
    pub pool_sol_vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct DepositToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
      seeds = [STATE_SEED],
      bump,
    )]
    pub state: Account<'info, State>,
    #[account(mut, associated_token::authority = state, associated_token::mint = bet_token_mint)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut, associated_token::authority = authority, associated_token::mint = bet_token_mint)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub bet_token_mint: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
      seeds = [STATE_SEED],
      bump,
      has_one = authority
    )]
    pub state: Account<'info, State>,
    #[account(
      mut,
      seeds = [VAULT_SEED], 
      bump
    )]
    pub pool_sol_vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct WithdrawToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
      seeds = [STATE_SEED],
      bump,
      has_one = authority
    )]
    pub state: Account<'info, State>,
    #[account(mut, associated_token::authority = state, associated_token::mint = bet_token_mint)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut, associated_token::authority = authority, associated_token::mint = bet_token_mint)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub bet_token_mint: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
#[account]
#[derive(Default)]
pub struct State {
  pub authority: Pubkey,
  pub gang_mint: Pubkey,
  pub usdc_mint: Pubkey,
}