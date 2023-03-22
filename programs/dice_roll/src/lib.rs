use anchor_lang::prelude::*;
use anchor_spl::{
  token::{self, Mint, Token, TokenAccount, Transfer},
  associated_token::{self, AssociatedToken}
};
use anchor_lang::solana_program::{
  program::{invoke, invoke_signed},
  system_instruction,
};

use std::mem::size_of;
use std::str::FromStr;

use thiserror::Error;
use pyth_client;

const WSOL: &'static str = "So11111111111111111111111111111111111111112";

const STATE_SEED: &[u8] = b"STATE_SEED";
const VAULT_SEED: &[u8] = b"VAULT_SEED";
const MIN_BET: u64 = 1_000_000; // usdc, gang 1
const MAX_BET: u64 = 50_000_000; // usdc, gang 50
const MIN_SOL_BET: u64 = 1_000_000_000; // 1 sol
const MAX_SOL_BET: u64 = 50_000_000_000; // 50 sol
const RTP: u64 = 80;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
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

    pub fn place_token_bet(ctx: Context<PlaceTokenBet>, bet_amount: u64) -> Result<()> {
      let accts = ctx.accounts;
      require!(accts.bet_token_mint.key().eq(&accts.state.gang_mint) || accts.bet_token_mint.key().eq(&accts.state.usdc_mint)
      , CustomError::InvalidToken); 
      require!(bet_amount >= MIN_BET && bet_amount <= MAX_BET, CustomError::InvalidParameter); 
      let pyth_price_info = &accts.sol_pyth_account;
      let pyth_price_data = &pyth_price_info.try_borrow_data()?;
      let pyth_price = pyth_client::cast::<pyth_client::Price>(pyth_price_data);
      
      token::transfer(
        CpiContext::new(
          accts.token_program.to_account_info(),
          Transfer {
              from: accts.user_token_account.to_account_info(),
              to: accts.pool_token_account.to_account_info(),
              authority: accts.authority.to_account_info(),
          },
        ),
        bet_amount,
      )?;


      let bet_prize = bet_amount * RTP / 100;
      let bet_result = (pyth_price.agg.price as u64) % 11;
      let signer_seeds: &[&[&[u8]]] = &[&[STATE_SEED.as_ref(), &[*ctx.bumps.get("state").unwrap()]]];
      if bet_result > 5 { //win
        token::transfer(
          CpiContext::new(
            accts.token_program.to_account_info(),
            Transfer {
                from: accts.pool_token_account.to_account_info(),
                to: accts.user_token_account.to_account_info(),
                authority: accts.state.to_account_info(),
            },
          ).with_signer(signer_seeds),
          bet_prize,
        )?;
      }

      emit!(BetResultEvent {
          is_win: bet_result > 5,
          authority: accts.authority.key(),
          bet_mint: accts.bet_token_mint.key(),
          bet_amount
      });

      Ok(())
    }

    pub fn place_sol_bet(ctx: Context<PlaceSolBet>, bet_amount: u64) -> Result<()> {
      let accts = ctx.accounts;
      require!(bet_amount >= MIN_SOL_BET && bet_amount <= MAX_SOL_BET, CustomError::InvalidParameter); 
      let pyth_price_info = &accts.sol_pyth_account;
      let pyth_price_data = &pyth_price_info.try_borrow_data()?;
      let pyth_price = pyth_client::cast::<pyth_client::Price>(pyth_price_data);
      
      invoke(
        &system_instruction::transfer(&accts.authority.key(), &accts.pool_sol_vault.key(), bet_amount),
        &[
            accts.authority.to_account_info(),
            accts.pool_sol_vault.to_account_info(),
            accts.system_program.to_account_info(),
        ],
      )?;


      let bet_prize = bet_amount * RTP / 100;
      let bet_result = (pyth_price.agg.price as u64) % 11;
      let signer_seeds: &[&[&[u8]]] = &[&[STATE_SEED.as_ref(), &[*ctx.bumps.get("state").unwrap()]]];
      if bet_result > 5 { //win
        invoke_signed(
          &system_instruction::transfer(&accts.pool_sol_vault.key(), &accts.authority.key(), bet_amount),
          &[
              accts.pool_sol_vault.to_account_info(),
              accts.authority.to_account_info(),
              accts.system_program.to_account_info(),
          ],
          signer_seeds
        )?;
      }

      emit!(BetResultEvent {
          is_win: bet_result > 5,
          authority: accts.authority.key(),
          bet_mint: Pubkey::from_str(WSOL).unwrap(),
          bet_amount
      });
      Ok(())
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
      let accts = ctx.accounts;
      invoke(
        &system_instruction::transfer(&accts.authority.key(), &accts.pool_sol_vault.key(), amount),
        &[
            accts.authority.to_account_info(),
            accts.pool_sol_vault.to_account_info(),
            accts.system_program.to_account_info(),
        ],
      )?;
      Ok(())
    }

    pub fn deposit_token(ctx: Context<DepositToken>, amount: u64) -> Result<()> {
      let accts = ctx.accounts;
      token::transfer(
        CpiContext::new(
          accts.token_program.to_account_info(),
          Transfer {
              from: accts.user_token_account.to_account_info(),
              to: accts.pool_token_account.to_account_info(),
              authority: accts.authority.to_account_info(),
          },
        ),
        amount,
      )?;
      Ok(())
    }
    
    pub fn withdraw_sol(ctx: Context<WithdrawSol>) -> Result<()> {
      let accts = ctx.accounts;
      let signer_seeds: &[&[&[u8]]] = &[&[STATE_SEED.as_ref(), &[*ctx.bumps.get("state").unwrap()]]];

      invoke_signed(
        &system_instruction::transfer(&accts.pool_sol_vault.key(), &accts.authority.key(), 
        accts.pool_sol_vault.to_account_info().lamports()),
        &[
            accts.pool_sol_vault.to_account_info(),
            accts.authority.to_account_info(),
            accts.system_program.to_account_info(),
        ],
        signer_seeds
      )?;
      Ok(())
    }
    
    pub fn withdraw_token(ctx: Context<WithdrawToken>) -> Result<()> {
      let accts = ctx.accounts;

      let signer_seeds: &[&[&[u8]]] = &[&[STATE_SEED.as_ref(), &[*ctx.bumps.get("state").unwrap()]]];
      token::transfer(
        CpiContext::new(
          accts.token_program.to_account_info(),
          Transfer {
              from: accts.user_token_account.to_account_info(),
              to: accts.pool_token_account.to_account_info(),
              authority: accts.state.to_account_info(),
          },
        ).with_signer(signer_seeds),
        accts.pool_token_account.amount,
      )?;
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
    /// CHECK: this is not dangerous
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
    
    /// CHECK:
    pub sol_pyth_account: AccountInfo<'info>,

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

    /// CHECK:
    pub sol_pyth_account: AccountInfo<'info>,

    #[account(
      mut,
      seeds = [VAULT_SEED], 
      bump
    )]
    /// CHECK: this is not dangerous
    pub pool_sol_vault: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [VAULT_SEED], bump)]
    /// CHECK: this is not dangerous
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
    /// CHECK: this is not dangerous
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


#[error_code]
pub enum CustomError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,

    #[msg("Input Invalid Value")]
    InvalidParameter,

    #[msg("Input Invalid Token")]
    InvalidToken,
    
}

#[event]
pub struct BetResultEvent {
  pub is_win: bool,
  pub authority: Pubkey,
  pub bet_mint: Pubkey,
  pub bet_amount: u64,
}
