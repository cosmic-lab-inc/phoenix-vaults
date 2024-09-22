use anchor_lang::prelude::*;

pub type VaultResult<T = ()> = std::result::Result<T, ErrorCode>;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Default")]
    Default,
    #[msg("InvalidVaultRebase")]
    InvalidVaultRebase,
    #[msg("InvalidVaultSharesDetected")]
    InvalidVaultSharesDetected,
    #[msg("CannotWithdrawBeforeRedeemPeriodEnd")]
    CannotWithdrawBeforeRedeemPeriodEnd,
    #[msg("InvalidVaultWithdraw")]
    InvalidVaultWithdraw,
    #[msg("InsufficientVaultShares")]
    InsufficientVaultShares,
    #[msg("InvalidVaultWithdrawSize")]
    InvalidVaultWithdrawSize,
    #[msg("InvalidVaultForNewDepositors")]
    InvalidVaultForNewDepositors,
    #[msg("VaultWithdrawRequestInProgress")]
    VaultWithdrawRequestInProgress,
    #[msg("VaultIsAtCapacity")]
    VaultIsAtCapacity,
    #[msg("InvalidVaultDepositorInitialization")]
    InvalidVaultDepositorInitialization,
    #[msg("DelegateNotAvailableForLiquidation")]
    DelegateNotAvailableForLiquidation,
    #[msg("InvalidLiquidator")]
    InvalidLiquidator,
    #[msg("LiquidationExpired")]
    LiquidationExpired,
    #[msg("InvalidEquityValue")]
    InvalidEquityValue,
    #[msg("VaultInLiquidation")]
    VaultInLiquidation,
    #[msg("InvestorCanWithdraw")]
    InvestorCanWithdraw,
    #[msg("InvalidVaultInitialization")]
    InvalidVaultInitialization,
    #[msg("InvalidVaultUpdate")]
    InvalidVaultUpdate,
    #[msg("PermissionedVault")]
    PermissionedVault,
    #[msg("WithdrawInProgress")]
    WithdrawInProgress,
    #[msg("SharesPercentTooLarge")]
    SharesPercentTooLarge,
    #[msg("InvalidVaultDeposit")]
    InvalidVaultDeposit,
    #[msg("OngoingLiquidation")]
    OngoingLiquidation,
    #[msg("VaultProtocolMissing")]
    VaultProtocolMissing,
    #[msg("BnConversion")]
    BnConversion,
    #[msg("MathError")]
    MathError,
    #[msg("CastError")]
    CastError,
    #[msg("UnwrapError")]
    UnwrapError,
    #[msg("MarketDeserializationError")]
    MarketDeserializationError,
    #[msg("UnrecognizedQuoteMint")]
    UnrecognizedQuoteMint,
    #[msg("SolMarketMissing")]
    SolMarketMissing,
    #[msg("MarketMapFull")]
    MarketMapFull,
    #[msg("InvalidAddressLookupTableData")]
    InvalidAddressLookupTableData,
    #[msg("AddressLookupTableAuthorityMissing")]
    AddressLookupTableAuthorityMissing,
    #[msg("AddressLookupTableAuthorityInvalid")]
    AddressLookupTableAuthorityInvalid,
    #[msg("MarketRegistryLookupTableMismatch")]
    MarketRegistryLookupTableMismatch,
    #[msg("MarketRegistryLength")]
    MarketRegistryLength,
    #[msg("MarketRegistryMismatch")]
    MarketRegistryMismatch,
    #[msg("OrderPacketDeserialization")]
    OrderPacketDeserialization,
    #[msg("OrderPacketMustUseDepositedFunds")]
    OrderPacketMustUseDepositedFunds,
    #[msg("InvalidPhoenixInstruction")]
    InvalidPhoenixInstruction,
    #[msg("OrderPacketMustBeTakeOnly")]
    OrderPacketMustBeTakeOnly,
    #[msg("BaseLotsMustBeZero")]
    BaseLotsMustBeZero,
    #[msg("TraderStateNotFound")]
    TraderStateNotFound,
}

#[macro_export]
macro_rules! cast_error {
    () => {{
        || {
            let error_code = $crate::error::ErrorCode::CastError;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            error_code
        }
    }};
}

#[macro_export]
macro_rules! math_error {
    () => {{
        || {
            let error_code = $crate::error::ErrorCode::MathError;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            error_code
        }
    }};
}

#[macro_export]
macro_rules! unwrap_error {
    () => {{
        || {
            let error_code = $crate::error::ErrorCode::UnwrapError;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            error_code
        }
    }};
}
