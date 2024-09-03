# Jupiter Vaults

# Development

* anchor 0.29.0
* rust 1.75.0 (1.75.0-x86_64-apple-darwin for Apple Silicon)
* solana 1.18.8

```shell
# if you don't have avm, install it here: 
# https://book.anchor-lang.com/getting_started/installation.html
avm use 0.29.0

# if on Apple Silicon:
# rustup override set 1.75.0-x86_64-apple-darwin
rustup override set 1.75.0

agave-install init 1.18.8
```

If on Mac and getting this error: 
```shell
Error: failed to start validator: Failed to create ledger at test-ledger: blockstore error
```
then run these commands:
```shell
brew install gnu-tar
# Put this in ~/.zshrc 
export PATH="/opt/homebrew/opt/gnu-tar/libexec/gnubin:$PATH"
```

## Run tests
```shell
yarn && cd ts/sdk && yarn && yarn build && cd ..

export ANCHOR_WALLET=~/.config/solana/id.json && anchor test
```