#[macro_export]
macro_rules! validate {
        ($assert:expr, $err:expr) => {{
            if ($assert) {
                Ok(())
            } else {
                let error_code: ErrorCode = $err;
                msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
                Err(error_code)
            }
        }};
        ($assert:expr, $err:expr, $($arg:tt)+) => {{
        if ($assert) {
            Ok(())
        } else {
            let error_code: ErrorCode = $err;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            msg!($($arg)*);
            Err(error_code)
        }
    }};
}

#[macro_export]
macro_rules! declare_vault_seeds {
    ( $vault_loader:expr, $name: ident ) => {
        let vault = $vault_loader.load()?;
        let name = vault.name;
        let bump = vault.bump;
        let $name = &[&Vault::get_vault_signer_seeds(&name, &bump)[..]];
        drop(vault);
    };
}
