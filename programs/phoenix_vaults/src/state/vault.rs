use crate::constants::{
    ONE_YEAR, PERCENTAGE_PRECISION, PERCENTAGE_PRECISION_I128, TIME_FOR_LIQUIDATION,
};
use crate::error::{ErrorCode, VaultResult};
use crate::math::{amount_to_shares, calculate_rebase_info, shares_to_amount, Cast, SafeMath};
use crate::state::withdraw_request::WithdrawRequest;
use crate::state::{InvestorAction, InvestorRecord, MarketPosition, VaultFee, WithdrawUnit};
use crate::{validate, Size};
use anchor_lang::prelude::*;
use drift_macros::assert_no_slop;
use static_assertions::const_assert_eq;

#[assert_no_slop]
#[account(zero_copy(unsafe))]
#[derive(Default, Eq, PartialEq, Debug)]
#[repr(C)]
pub struct Vault {
    /// The name of the vault. Vault pubkey is derived from this name.
    pub name: [u8; 32],
    /// The vault's pubkey. It is a PDA also used as the authority token accounts
    pub pubkey: Pubkey,
    /// The manager of the vault who has ability to update vault config,
    /// and earns a profit share or management fee.
    pub manager: Pubkey,
    /// The Phoenix USDC mint.
    pub usdc_mint: Pubkey,
    /// The Phoenix (wrapped) SOL mint.
    pub sol_mint: Pubkey,
    /// The USDC token account investor transfer with,
    /// and the vault transfer to Phoenix markets with.
    pub usdc_token_account: Pubkey,
    /// The SOL token account investor transfer with,
    /// and the vault transfer to Phoenix markets with.
    pub sol_token_account: Pubkey,
    /// The delegate (investor) handling liquidation for an investor to withdraw their funds.
    pub liquidator: Pubkey,
    /// The delegate is the "portfolio manager", "trader", or "bot" that trades the vault assets.
    /// It can swap 100% of vault tokens.
    /// This is the manager by default.
    pub delegate: Pubkey,
    /// The sum of all shares held by the investors
    pub investor_shares: u128,
    /// The sum of all shares: investor deposits, manager deposits, manager profit/fee, and protocol profit/fee.
    /// The manager deposits are total_shares - investor_shares - protocol_profit_and_fee_shares.
    pub total_shares: u128,
    /// Last fee update unix timestamp
    pub last_fee_update_ts: i64,
    /// When the liquidation starts
    pub liquidation_start_ts: i64,
    /// The period (in seconds) that an investor must wait after requesting a withdrawal to transfer funds.
    /// The maximum is 90 days.
    /// This is only updatable to lesser values.
    pub redeem_period: i64,
    /// The sum of all outstanding withdraw requests
    pub total_withdraw_requested: u64,
    /// Max token capacity, once hit/passed vault will reject new deposits.
    /// This is only updatable to lesser values.
    pub max_tokens: u64,
    /// The annual fee charged on deposits by the manager.
    /// Traditional funds typically charge 2% per year on assets under management.
    /// This is only updatable to lesser values.
    pub management_fee: i64,
    /// Timestamp vault initialized
    pub init_ts: i64,
    /// The net deposits for the vault
    pub net_deposits: i64,
    /// The net deposits for the manager
    pub manager_net_deposits: i64,
    /// Total deposits
    pub total_deposits: u64,
    /// Total withdraws
    pub total_withdraws: u64,
    /// Total deposits for the manager
    pub manager_total_deposits: u64,
    /// Total withdraws for the manager
    pub manager_total_withdraws: u64,
    /// Total management fee accrued by the manager
    pub manager_total_fee: i64,
    /// Total profit share accrued by the manager
    pub manager_total_profit_share: u64,
    /// The minimum deposit amount.
    /// This is only updatable to lesser values.
    pub min_deposit_amount: u64,
    pub last_manager_withdraw_request: WithdrawRequest,
    /// The base 10 exponent of the shares (given massive share inflation can occur at near zero vault equity)
    pub shares_base: u32,
    /// Percentage the manager charges on all profits realized by depositors (multiplied by PERCENTAGE_PRECISION).
    /// Traditional funds typically charge 20% of profits.
    /// This is only updatable to lesser values.
    pub profit_share: u32,
    /// Vault manager only collect incentive fees during periods when returns are higher than this amount (multiplied by PERCENTAGE_PRECISION).
    pub hurdle_rate: u32,

    /// Percentage the protocol charges on all profits realized by depositors: PERCENTAGE_PRECISION
    pub protocol_profit_share: u32,
    /// The protocol, company, or entity that services the product using this vault.
    /// The protocol is not allowed to deposit into the vault but can profit share and collect annual fees just like the manager.
    pub protocol: Pubkey,
    /// The shares from profit share and annual fee unclaimed by the protocol.
    pub protocol_profit_and_fee_shares: u128,
    /// The annual fee charged on deposits by the protocol (traditional hedge funds typically charge 2% per year on assets under management).
    /// Unlike the management fee this can't be negative.
    pub protocol_fee: u64,
    /// Total withdraws for the protocol
    pub protocol_total_withdraws: u64,
    /// Total fee charged by the protocol (annual management fee + profit share).
    /// Unlike the management fee this can't be negative.
    pub protocol_total_fee: u64,
    /// Total profit share charged by the protocol
    pub protocol_total_profit_share: u64,
    pub last_protocol_withdraw_request: WithdrawRequest,

    pub positions: [MarketPosition; 8],

    /// Whether anyone can be an investor
    pub permissioned: bool,
    /// The bump for the vault PDA
    pub bump: u8,
    pub padding: [u8; 6],
}

impl Vault {
    pub fn get_vault_signer_seeds<'a>(name: &'a [u8], bump: &'a u8) -> [&'a [u8]; 3] {
        [b"vault".as_ref(), name, bytemuck::bytes_of(bump)]
    }
}

impl Size for Vault {
    const SIZE: usize = 616 + 64 * 8 + 8;
}
const_assert_eq!(Vault::SIZE, std::mem::size_of::<Vault>() + 8);

impl Vault {
    pub fn apply_fee(&mut self, vault_equity: u64, now: i64) -> Result<VaultFee> {
        let depositor_equity =
            shares_to_amount(self.investor_shares, self.total_shares, vault_equity)?
                .cast::<i128>()?;
        let management_fee_payment: i128 = 0;
        let mut management_fee_shares: i128 = 0;
        let protocol_fee_payment: i128 = 0;
        let mut protocol_fee_shares: i128 = 0;
        let mut skip_ts_update = false;

        let mut handle_no_protocol_fee = |vault: &mut Vault| -> Result<()> {
            let since_last = now.safe_sub(vault.last_fee_update_ts)?;

            // default behavior in legacy [`Vault`], manager taxes equity - 1 if tax is >= equity
            let management_fee_payment = depositor_equity
                .safe_mul(vault.management_fee.cast()?)?
                .safe_div(PERCENTAGE_PRECISION_I128)?
                .safe_mul(since_last.cast()?)?
                .safe_div(ONE_YEAR.cast()?)?
                .min(depositor_equity.saturating_sub(1));

            let new_total_shares_factor: u128 = depositor_equity
                .safe_mul(PERCENTAGE_PRECISION_I128)?
                .safe_div(depositor_equity.safe_sub(management_fee_payment)?)?
                .cast()?;

            let new_total_shares = vault
                .total_shares
                .safe_mul(new_total_shares_factor.cast()?)?
                .safe_div(PERCENTAGE_PRECISION)?
                .max(vault.investor_shares);

            if management_fee_payment == 0 || vault.total_shares == new_total_shares {
                // time delta wasn't large enough to pay any management/protocol fee
                skip_ts_update = true;
            }

            management_fee_shares = new_total_shares
                .cast::<i128>()?
                .safe_sub(vault.total_shares.cast()?)?;
            vault.total_shares = new_total_shares;
            vault.manager_total_fee = vault
                .manager_total_fee
                .saturating_add(management_fee_payment.cast()?);

            // in case total_shares is pushed to level that warrants a rebase
            vault.apply_rebase(vault_equity)?;
            Ok(())
        };

        if self.management_fee != 0 && self.protocol_fee != 0 && depositor_equity > 0 {
            let since_last = now.safe_sub(self.last_fee_update_ts)?;
            let total_fee = self
                .management_fee
                .safe_add(self.protocol_fee.cast()?)?
                .cast::<i128>()?;

            // if protocol fee is non-zero and total fee would lead to zero equity remaining,
            // so tax equity - 1 but only for the protocol, so that the user is left with 1 and the manager retains their full fee.
            let total_fee_payment = depositor_equity
                .safe_mul(total_fee)?
                .safe_div(PERCENTAGE_PRECISION_I128)?
                .safe_mul(since_last.cast()?)?
                .safe_div(ONE_YEAR.cast()?)?;
            let management_fee_payment = total_fee_payment
                .safe_mul(self.management_fee.cast()?)?
                .safe_div(total_fee)?;
            let protocol_fee_payment = total_fee_payment
                .min(depositor_equity.saturating_sub(1))
                .safe_mul(self.protocol_fee.cast()?)?
                .safe_div(total_fee)?;

            let new_total_shares_factor: u128 = depositor_equity
                .safe_mul(PERCENTAGE_PRECISION_I128)?
                .safe_div(
                    depositor_equity
                        .safe_sub(management_fee_payment)?
                        .safe_sub(protocol_fee_payment)?,
                )?
                .cast()?;
            let mgmt_fee_shares_factor: u128 = depositor_equity
                .safe_mul(PERCENTAGE_PRECISION_I128)?
                .safe_div(depositor_equity.safe_sub(management_fee_payment)?)?
                .cast()?;
            let protocol_fee_shares_factor: u128 = depositor_equity
                .safe_mul(PERCENTAGE_PRECISION_I128)?
                .safe_div(depositor_equity.safe_sub(protocol_fee_payment)?)?
                .cast()?;

            let new_total_shares = self
                .total_shares
                .safe_mul(new_total_shares_factor.cast()?)?
                .safe_div(PERCENTAGE_PRECISION)?
                .max(self.investor_shares);

            management_fee_shares = self
                .total_shares
                .safe_mul(mgmt_fee_shares_factor.cast()?)?
                .safe_div(PERCENTAGE_PRECISION)?
                .max(self.investor_shares)
                .cast::<i128>()?
                .safe_sub(self.total_shares.cast()?)?;

            protocol_fee_shares = self
                .total_shares
                .safe_mul(protocol_fee_shares_factor.cast()?)?
                .safe_div(PERCENTAGE_PRECISION)?
                .max(self.investor_shares)
                .cast::<i128>()?
                .safe_sub(self.total_shares.cast()?)?;

            if (management_fee_payment == 0 && protocol_fee_payment == 0)
                || self.total_shares == new_total_shares
            {
                // time delta wasn't large enough to pay any management/protocol fee
                skip_ts_update = true;
            }

            self.total_shares = new_total_shares;
            self.manager_total_fee = self
                .manager_total_fee
                .saturating_add(management_fee_payment.cast()?);

            self.protocol_total_fee = self
                .protocol_total_fee
                .saturating_add(protocol_fee_payment.cast()?);
            self.protocol_profit_and_fee_shares = self
                .protocol_profit_and_fee_shares
                .safe_add(protocol_fee_shares.cast()?)?;

            // in case total_shares is pushed to level that warrants a rebase
            self.apply_rebase(vault_equity)?;
        } else if self.management_fee == 0 && self.protocol_fee != 0 && depositor_equity > 0 {
            let since_last = now.safe_sub(self.last_fee_update_ts)?;

            // default behavior in legacy [`Vault`], manager taxes equity - 1 if tax is >= equity
            let protocol_fee_payment = depositor_equity
                .safe_mul(self.protocol_fee.cast()?)?
                .safe_div(PERCENTAGE_PRECISION_I128)?
                .safe_mul(since_last.cast()?)?
                .safe_div(ONE_YEAR.cast()?)?
                .min(depositor_equity.saturating_sub(1));

            let new_total_shares_factor: u128 = depositor_equity
                .safe_mul(PERCENTAGE_PRECISION_I128)?
                .safe_div(depositor_equity.safe_sub(protocol_fee_payment)?)?
                .cast()?;

            let new_total_shares = self
                .total_shares
                .safe_mul(new_total_shares_factor.cast()?)?
                .safe_div(PERCENTAGE_PRECISION)?
                .max(self.investor_shares);

            if protocol_fee_payment == 0 || self.total_shares == new_total_shares {
                // time delta wasn't large enough to pay any management/protocol fee
                skip_ts_update = true;
            }

            protocol_fee_shares = new_total_shares
                .cast::<i128>()?
                .safe_sub(self.total_shares.cast()?)?;
            self.total_shares = new_total_shares;
            self.protocol_total_fee = self
                .protocol_total_fee
                .saturating_add(protocol_fee_payment.cast()?);
            self.protocol_profit_and_fee_shares = self
                .protocol_profit_and_fee_shares
                .safe_add(protocol_fee_shares.cast()?)?;

            // in case total_shares is pushed to level that warrants a rebase
            self.apply_rebase(vault_equity)?;
        } else if self.management_fee != 0 && self.protocol_fee == 0 && depositor_equity > 0 {
            handle_no_protocol_fee(self)?;
        }

        if !skip_ts_update {
            self.last_fee_update_ts = now;
        }

        Ok(VaultFee {
            management_fee_payment: management_fee_payment.cast::<i64>()?,
            management_fee_shares: management_fee_shares.cast::<i64>()?,
            protocol_fee_payment: protocol_fee_payment.cast::<i64>()?,
            protocol_fee_shares: protocol_fee_shares.cast::<i64>()?,
        })
    }

    pub fn get_manager_shares(&self) -> VaultResult<u128> {
        self.total_shares
            .safe_sub(self.investor_shares)?
            .safe_sub(self.protocol_profit_and_fee_shares)
    }

    pub fn get_protocol_shares(&self) -> u128 {
        self.protocol_profit_and_fee_shares
    }

    pub fn get_profit_share(&self) -> VaultResult<u32> {
        self.profit_share.safe_add(self.protocol_profit_share)
    }

    pub fn apply_rebase(&mut self, vault_equity: u64) -> Result<Option<u128>> {
        let mut rebase_divisor = None;
        if vault_equity != 0 && vault_equity.cast::<u128>()? < self.total_shares {
            let (expo_diff, _rebase_divisor) =
                calculate_rebase_info(self.total_shares, vault_equity)?;

            if expo_diff != 0 {
                self.total_shares = self.total_shares.safe_div(_rebase_divisor)?;
                self.investor_shares = self.investor_shares.safe_div(_rebase_divisor)?;
                self.shares_base = self.shares_base.safe_add(expo_diff)?;
                self.protocol_profit_and_fee_shares = self
                    .protocol_profit_and_fee_shares
                    .safe_div(_rebase_divisor)?;

                rebase_divisor = Some(_rebase_divisor);

                msg!("rebasing vault: expo_diff={}", expo_diff);
            }
        }

        if vault_equity != 0 && self.total_shares == 0 {
            self.total_shares = vault_equity.cast::<u128>()?;
        }

        Ok(rebase_divisor)
    }

    pub fn manager_deposit(&mut self, amount: u64, vault_equity: u64, now: i64) -> Result<()> {
        self.apply_rebase(vault_equity)?;
        let VaultFee {
            management_fee_payment,
            management_fee_shares,
            protocol_fee_payment,
            protocol_fee_shares,
        } = self.apply_fee(vault_equity, now)?;

        let user_vault_shares_before = self.investor_shares;
        let total_vault_shares_before = self.total_shares;
        let vault_shares_before: u128 = self.get_manager_shares()?;
        let protocol_shares_before: u128 = self.get_protocol_shares();

        let n_shares = amount_to_shares(amount, total_vault_shares_before, vault_equity)?;

        self.total_deposits = self.total_deposits.saturating_add(amount);
        self.manager_total_deposits = self.manager_total_deposits.saturating_add(amount);
        self.net_deposits = self.net_deposits.safe_add(amount.cast()?)?;
        self.manager_net_deposits = self.manager_net_deposits.safe_add(amount.cast()?)?;

        self.total_shares = self.total_shares.safe_add(n_shares)?;
        let vault_shares_after = self.get_manager_shares()?;
        let protocol_shares_after = self.get_protocol_shares();

        emit!(InvestorRecord {
            ts: now,
            vault: self.pubkey,
            depositor_authority: self.manager,
            action: InvestorAction::Deposit,
            amount: 0,
            usdc_mint: self.usdc_mint,
            sol_mint: self.sol_mint,
            vault_equity_before: vault_equity,
            vault_shares_before,
            user_vault_shares_before,
            total_vault_shares_before,
            vault_shares_after,
            total_vault_shares_after: self.total_shares,
            user_vault_shares_after: self.investor_shares,
            protocol_profit_share: 0,
            protocol_fee: protocol_fee_payment,
            protocol_fee_shares,
            manager_profit_share: 0,
            management_fee: management_fee_payment,
            management_fee_shares,
            protocol_shares_before,
            protocol_shares_after,
        });

        Ok(())
    }

    pub fn manager_request_withdraw(
        &mut self,
        withdraw_amount: u64,
        withdraw_unit: WithdrawUnit,
        vault_equity: u64,
        now: i64,
    ) -> Result<()> {
        let rebase_divisor = self.apply_rebase(vault_equity)?;
        let VaultFee {
            management_fee_payment,
            management_fee_shares,
            protocol_fee_payment,
            protocol_fee_shares,
        } = self.apply_fee(vault_equity, now)?;

        let vault_shares_before: u128 = self.get_manager_shares()?;
        let protocol_shares_before: u128 = self.get_protocol_shares();

        let (withdraw_value, n_shares) = withdraw_unit.get_withdraw_value_and_shares(
            withdraw_amount,
            vault_equity,
            self.get_manager_shares()?,
            self.total_shares,
            rebase_divisor,
        )?;

        validate!(
            n_shares > 0,
            ErrorCode::InvalidVaultWithdrawSize,
            "Requested n_shares = 0"
        )?;
        validate!(
            vault_shares_before >= n_shares,
            ErrorCode::InvalidVaultWithdrawSize,
            "Requested n_shares={} > manager shares={}",
            n_shares,
            vault_shares_before,
        )?;

        let total_vault_shares_before = self.total_shares;
        let user_vault_shares_before = self.investor_shares;

        self.last_manager_withdraw_request.set(
            vault_shares_before,
            n_shares,
            withdraw_value,
            vault_equity,
            now,
        )?;
        self.total_withdraw_requested = self.total_withdraw_requested.safe_add(withdraw_value)?;

        let vault_shares_after: u128 = self.get_manager_shares()?;
        let protocol_shares_after: u128 = self.get_protocol_shares();

        emit!(InvestorRecord {
            ts: now,
            vault: self.pubkey,
            depositor_authority: self.manager,
            action: InvestorAction::WithdrawRequest,
            amount: self.last_manager_withdraw_request.value,
            usdc_mint: self.usdc_mint,
            sol_mint: self.sol_mint,
            vault_equity_before: vault_equity,
            vault_shares_before,
            user_vault_shares_before,
            total_vault_shares_before,
            vault_shares_after,
            total_vault_shares_after: self.total_shares,
            user_vault_shares_after: self.investor_shares,
            protocol_profit_share: 0,
            protocol_fee: protocol_fee_payment,
            protocol_fee_shares,
            manager_profit_share: 0,
            management_fee: management_fee_payment,
            management_fee_shares,
            protocol_shares_before,
            protocol_shares_after,
        });

        Ok(())
    }

    pub fn manager_cancel_withdraw_request(&mut self, vault_equity: u64, now: i64) -> Result<()> {
        self.apply_rebase(vault_equity)?;

        let vault_shares_before: u128 = self.get_manager_shares()?;
        let total_vault_shares_before = self.total_shares;
        let user_vault_shares_before = self.investor_shares;
        let protocol_shares_before: u128 = self.get_protocol_shares();

        let VaultFee {
            management_fee_payment,
            management_fee_shares,
            protocol_fee_payment,
            protocol_fee_shares,
        } = self.apply_fee(vault_equity, now)?;

        let vault_shares_lost = self
            .last_manager_withdraw_request
            .calculate_shares_lost(self, vault_equity)?;

        self.total_shares = self.total_shares.safe_sub(vault_shares_lost)?;
        self.investor_shares = self.investor_shares.safe_sub(vault_shares_lost)?;
        self.protocol_profit_and_fee_shares = self
            .protocol_profit_and_fee_shares
            .safe_sub(vault_shares_lost)?;

        let vault_shares_after = self.get_manager_shares()?;
        let protocol_shares_after: u128 = self.get_protocol_shares();

        emit!(InvestorRecord {
            ts: now,
            vault: self.pubkey,
            depositor_authority: self.manager,
            action: InvestorAction::CancelWithdrawRequest,
            amount: 0,
            usdc_mint: self.usdc_mint,
            sol_mint: self.sol_mint,
            vault_equity_before: vault_equity,
            vault_shares_before,
            user_vault_shares_before,
            total_vault_shares_before,
            vault_shares_after,
            total_vault_shares_after: self.total_shares,
            user_vault_shares_after: self.investor_shares,
            protocol_profit_share: 0,
            protocol_fee: protocol_fee_payment,
            protocol_fee_shares,
            manager_profit_share: 0,
            management_fee: management_fee_payment,
            management_fee_shares,
            protocol_shares_before,
            protocol_shares_after,
        });

        self.total_withdraw_requested = self
            .total_withdraw_requested
            .safe_sub(self.last_manager_withdraw_request.value)?;
        self.last_manager_withdraw_request.reset(now)?;

        Ok(())
    }

    pub fn manager_withdraw(&mut self, vault_equity: u64, now: i64) -> Result<(u64, bool)> {
        self.last_manager_withdraw_request
            .check_redeem_period_finished(self, now)?;

        self.apply_rebase(vault_equity)?;

        let VaultFee {
            management_fee_payment,
            management_fee_shares,
            protocol_fee_payment,
            protocol_fee_shares,
        } = self.apply_fee(vault_equity, now)?;

        let vault_shares_before: u128 = self.get_manager_shares()?;
        let total_vault_shares_before = self.total_shares;
        let user_vault_shares_before = self.investor_shares;
        let protocol_shares_before: u128 = self.get_protocol_shares();

        let n_shares = self.last_manager_withdraw_request.shares;

        validate!(
            n_shares > 0,
            ErrorCode::InvalidVaultWithdraw,
            "Must submit withdraw request and wait the redeem_period ({} seconds)",
            self.redeem_period
        )?;

        let amount: u64 = shares_to_amount(n_shares, self.total_shares, vault_equity)?;

        let n_tokens = amount.min(self.last_manager_withdraw_request.value);

        validate!(
            vault_shares_before >= n_shares,
            ErrorCode::InsufficientVaultShares
        )?;

        self.total_withdraws = self.total_withdraws.saturating_add(n_tokens);
        self.manager_total_withdraws = self.manager_total_withdraws.saturating_add(n_tokens);
        self.net_deposits = self.net_deposits.safe_sub(n_tokens.cast()?)?;
        self.manager_net_deposits = self.manager_net_deposits.safe_sub(n_tokens.cast()?)?;

        let vault_shares_before = self.get_manager_shares()?;

        validate!(
            vault_shares_before >= n_shares,
            ErrorCode::InvalidVaultWithdrawSize,
            "vault_shares_before={} < n_shares={}",
            vault_shares_before,
            n_shares
        )?;

        self.total_shares = self.total_shares.safe_sub(n_shares)?;
        let vault_shares_after = self.get_manager_shares()?;
        let protocol_shares_after: u128 = self.get_protocol_shares();

        emit!(InvestorRecord {
            ts: now,
            vault: self.pubkey,
            depositor_authority: self.manager,
            action: InvestorAction::Withdraw,
            amount: 0,
            usdc_mint: self.usdc_mint,
            sol_mint: self.sol_mint,
            vault_equity_before: vault_equity,
            vault_shares_before,
            user_vault_shares_before,
            total_vault_shares_before,
            vault_shares_after,
            total_vault_shares_after: self.total_shares,
            user_vault_shares_after: self.investor_shares,
            protocol_profit_share: 0,
            protocol_fee: protocol_fee_payment,
            protocol_fee_shares,
            manager_profit_share: 0,
            management_fee: management_fee_payment,
            management_fee_shares,
            protocol_shares_before,
            protocol_shares_after,
        });

        self.total_withdraw_requested = self
            .total_withdraw_requested
            .safe_sub(self.last_manager_withdraw_request.value)?;
        self.last_manager_withdraw_request.reset(now)?;

        let finishing_liquidation = self.liquidator == self.manager;

        Ok((n_tokens, finishing_liquidation))
    }

    pub fn in_liquidation(&self) -> bool {
        self.liquidator != Pubkey::default()
    }

    pub fn liquidation_expired(&self, now: i64) -> bool {
        now.saturating_sub(self.liquidation_start_ts) > TIME_FOR_LIQUIDATION
    }

    pub fn check_can_exit_liquidation(&self, now: i64) -> VaultResult {
        validate!(
            now.saturating_sub(self.liquidation_start_ts) > TIME_FOR_LIQUIDATION,
            ErrorCode::VaultInLiquidation,
            "vault is in liquidation"
        )?;

        Ok(())
    }

    pub fn check_liquidator(&self, signer: &Signer, now: i64) -> VaultResult {
        validate!(
            &self.liquidator == signer.key,
            ErrorCode::InvalidLiquidator,
            "Investor is not the liquidator"
        )?;

        validate!(
            now.saturating_sub(self.liquidation_start_ts) <= TIME_FOR_LIQUIDATION,
            ErrorCode::LiquidationExpired,
            "Investor liquidation expired"
        )?;

        Ok(())
    }

    pub fn check_delegate_available_for_liquidation(
        &self,
        signer: &Signer,
        now: i64,
    ) -> VaultResult {
        validate!(
            &self.liquidator != signer.key,
            ErrorCode::DelegateNotAvailableForLiquidation,
            "vault in liquidation by another investor"
        )?;

        validate!(
            now.saturating_sub(self.liquidation_start_ts) > TIME_FOR_LIQUIDATION,
            ErrorCode::DelegateNotAvailableForLiquidation,
            "vault liquidation not expired"
        )?;

        Ok(())
    }

    pub fn set_liquidation_delegate(&mut self, liquidation_delegate: Pubkey, now: i64) {
        self.liquidator = liquidation_delegate;
        self.liquidation_start_ts = now;
    }

    pub fn reset_liquidation_delegate(&mut self) {
        self.liquidator = Pubkey::default();
        self.liquidation_start_ts = 0;
    }

    pub fn protocol_request_withdraw(
        &mut self,
        withdraw_amount: u64,
        withdraw_unit: WithdrawUnit,
        vault_equity: u64,
        now: i64,
    ) -> Result<()> {
        let rebase_divisor = self.apply_rebase(vault_equity)?;
        let VaultFee {
            management_fee_payment,
            management_fee_shares,
            protocol_fee_payment,
            protocol_fee_shares,
        } = self.apply_fee(vault_equity, now)?;

        let vault_shares_before: u128 = self.get_manager_shares()?;
        let protocol_shares_before: u128 = self.get_protocol_shares();

        let (withdraw_value, n_shares) = withdraw_unit.get_withdraw_value_and_shares(
            withdraw_amount,
            vault_equity,
            protocol_shares_before,
            self.total_shares,
            rebase_divisor,
        )?;

        validate!(
            n_shares > 0,
            ErrorCode::InvalidVaultWithdrawSize,
            "Requested n_shares = 0"
        )?;

        let total_vault_shares_before = self.total_shares;
        let user_vault_shares_before = self.investor_shares;

        self.last_protocol_withdraw_request.set(
            protocol_shares_before,
            n_shares,
            withdraw_value,
            vault_equity,
            now,
        )?;
        self.total_withdraw_requested = self.total_withdraw_requested.safe_add(withdraw_value)?;

        let vault_shares_after: u128 = self.get_manager_shares()?;
        let protocol_shares_after: u128 = self.get_protocol_shares();

        emit!(InvestorRecord {
            ts: now,
            vault: self.pubkey,
            depositor_authority: self.manager,
            action: InvestorAction::WithdrawRequest,
            amount: self.last_manager_withdraw_request.value,
            usdc_mint: self.usdc_mint,
            sol_mint: self.sol_mint,
            vault_equity_before: vault_equity,
            vault_shares_before,
            user_vault_shares_before,
            total_vault_shares_before,
            vault_shares_after,
            total_vault_shares_after: self.total_shares,
            user_vault_shares_after: self.investor_shares,
            protocol_profit_share: 0,
            protocol_fee: protocol_fee_payment,
            protocol_fee_shares,
            manager_profit_share: 0,
            management_fee: management_fee_payment,
            management_fee_shares,
            protocol_shares_before,
            protocol_shares_after,
        });

        Ok(())
    }

    pub fn protocol_cancel_withdraw_request(&mut self, vault_equity: u64, now: i64) -> Result<()> {
        self.apply_rebase(vault_equity)?;

        let vault_shares_before: u128 = self.get_manager_shares()?;
        let total_vault_shares_before = self.total_shares;
        let user_vault_shares_before = self.investor_shares;
        let protocol_shares_before: u128 = self.get_protocol_shares();

        let VaultFee {
            management_fee_payment,
            management_fee_shares,
            protocol_fee_payment,
            protocol_fee_shares,
        } = self.apply_fee(vault_equity, now)?;

        let vault_shares_lost = self
            .last_protocol_withdraw_request
            .calculate_shares_lost(self, vault_equity)?;

        self.total_shares = self.total_shares.safe_sub(vault_shares_lost)?;
        self.investor_shares = self.investor_shares.safe_sub(vault_shares_lost)?;
        self.protocol_profit_and_fee_shares = self
            .protocol_profit_and_fee_shares
            .safe_sub(vault_shares_lost)?;

        let vault_shares_after = self.get_manager_shares()?;
        let protocol_shares_after: u128 = self.get_protocol_shares();

        self.total_withdraw_requested = self
            .total_withdraw_requested
            .safe_sub(self.last_protocol_withdraw_request.value)?;
        self.last_protocol_withdraw_request.reset(now)?;

        emit!(InvestorRecord {
            ts: now,
            vault: self.pubkey,
            depositor_authority: self.manager,
            action: InvestorAction::CancelWithdrawRequest,
            amount: 0,
            usdc_mint: self.usdc_mint,
            sol_mint: self.sol_mint,
            vault_equity_before: vault_equity,
            vault_shares_before,
            user_vault_shares_before,
            total_vault_shares_before,
            vault_shares_after,
            total_vault_shares_after: self.total_shares,
            user_vault_shares_after: self.investor_shares,
            protocol_profit_share: 0,
            protocol_fee: protocol_fee_payment,
            protocol_fee_shares,
            manager_profit_share: 0,
            management_fee: management_fee_payment,
            management_fee_shares,
            protocol_shares_before,
            protocol_shares_after,
        });

        Ok(())
    }

    pub fn protocol_withdraw(&mut self, vault_equity: u64, now: i64) -> Result<(u64, bool)> {
        self.last_manager_withdraw_request
            .check_redeem_period_finished(self, now)?;

        self.apply_rebase(vault_equity)?;

        let VaultFee {
            management_fee_payment,
            management_fee_shares,
            protocol_fee_payment,
            protocol_fee_shares,
        } = self.apply_fee(vault_equity, now)?;

        let vault_shares_before: u128 = self.get_protocol_shares();
        let total_vault_shares_before = self.total_shares;
        let user_vault_shares_before = self.investor_shares;
        let protocol_shares_before: u128 = self.get_protocol_shares();

        let n_shares = self.last_protocol_withdraw_request.shares;

        validate!(
            n_shares > 0,
            ErrorCode::InvalidVaultWithdraw,
            "Must submit withdraw request and wait the redeem_period ({} seconds)",
            self.redeem_period
        )?;

        let amount: u64 = shares_to_amount(n_shares, self.total_shares, vault_equity)?;

        let n_tokens = amount.min(self.last_protocol_withdraw_request.value);

        validate!(
            vault_shares_before >= n_shares,
            ErrorCode::InsufficientVaultShares
        )?;

        self.total_withdraws = self.total_withdraws.saturating_add(n_tokens);
        self.protocol_total_withdraws = self.protocol_total_withdraws.saturating_add(n_tokens);
        self.net_deposits = self.net_deposits.safe_sub(n_tokens.cast()?)?;

        validate!(
            protocol_shares_before >= n_shares,
            ErrorCode::InvalidVaultWithdrawSize,
            "vault_shares_before={} < n_shares={}",
            vault_shares_before,
            n_shares
        )?;

        self.total_shares = self.total_shares.safe_sub(n_shares)?;
        self.protocol_profit_and_fee_shares =
            self.protocol_profit_and_fee_shares.safe_sub(n_shares)?;

        let vault_shares_after = self.get_protocol_shares();
        let protocol_shares_after = self.get_protocol_shares();

        emit!(InvestorRecord {
            ts: now,
            vault: self.pubkey,
            depositor_authority: self.manager,
            action: InvestorAction::Withdraw,
            amount: 0,
            usdc_mint: self.usdc_mint,
            sol_mint: self.sol_mint,
            vault_equity_before: vault_equity,
            vault_shares_before,
            user_vault_shares_before,
            total_vault_shares_before,
            vault_shares_after,
            total_vault_shares_after: self.total_shares,
            user_vault_shares_after: self.investor_shares,
            protocol_profit_share: 0,
            protocol_fee: protocol_fee_payment,
            protocol_fee_shares,
            manager_profit_share: 0,
            management_fee: management_fee_payment,
            management_fee_shares,
            protocol_shares_before,
            protocol_shares_after,
        });

        self.total_withdraw_requested = self
            .total_withdraw_requested
            .safe_sub(self.last_protocol_withdraw_request.value)?;
        self.last_protocol_withdraw_request.reset(now)?;

        let finishing_liquidation = self.liquidator == self.protocol;

        Ok((n_tokens, finishing_liquidation))
    }

    pub fn profit_share(&self) -> u32 {
        self.profit_share.saturating_add(self.protocol_profit_share)
    }

    pub fn get_market_position_index(&self, market: &Pubkey) -> Result<usize> {
        self.positions
            .iter()
            .position(|pos| &pos.market == market)
            .ok_or(ErrorCode::MarketPositionNotFound.into())
    }

    pub fn get_market_position(&self, market: &Pubkey) -> Result<&MarketPosition> {
        self.get_market_position_index(market)
            .map(|market_index| &self.positions[market_index])
    }

    pub fn get_market_position_mut(&mut self, market: &Pubkey) -> Result<&mut MarketPosition> {
        self.get_market_position_index(market)
            .map(move |market_index| &mut self.positions[market_index])
    }

    pub fn add_market_position(&mut self, market: Pubkey) -> Result<usize> {
        let new_spot_position_index = self
            .positions
            .iter()
            .position(|pos| pos.is_available())
            .ok_or(ErrorCode::MarketPositionNotFound)?;

        let new_spot_position = MarketPosition {
            market,
            ..Default::default()
        };

        self.positions[new_spot_position_index] = new_spot_position;

        Ok(new_spot_position_index)
    }

    pub fn force_get_market_position_mut(&mut self, market: Pubkey) -> Result<&mut MarketPosition> {
        self.get_market_position_index(&market)
            .or_else(|_| self.add_market_position(market))
            .map(move |market_index| &mut self.positions[market_index])
    }

    pub fn force_get_market_position_index(&mut self, market: Pubkey) -> Result<usize> {
        self.get_market_position_index(&market)
            .or_else(|_| self.add_market_position(market))
    }

    /// Deposit or place order instructions should call this
    pub fn force_update_market_position(&mut self, position: MarketPosition) -> Result<()> {
        if position.is_available() {
            return Ok(());
        }
        let market_index = self.force_get_market_position_index(position.market)?;
        self.positions[market_index].quote_lots_free = position.quote_lots_free;
        self.positions[market_index].quote_lots_locked = position.quote_lots_locked;
        self.positions[market_index].base_lots_free = position.base_lots_free;
        self.positions[market_index].base_lots_locked = position.base_lots_locked;
        Ok(())
    }

    /// Withdrawal instructions should call this
    pub fn update_market_position(
        &mut self,
        market_index: usize,
        position: MarketPosition,
    ) -> Result<()> {
        if position.is_available() {
            return Ok(());
        }
        self.positions[market_index].quote_lots_free = position.quote_lots_free;
        self.positions[market_index].quote_lots_locked = position.quote_lots_locked;
        self.positions[market_index].base_lots_free = position.base_lots_free;
        self.positions[market_index].base_lots_locked = position.base_lots_locked;
        Ok(())
    }
}
