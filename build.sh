home() {
    cd $(git rev-parse --show-toplevel)
}

home

if [[ $(uname -m) == "arm64" ]]; then
    echo "Running on Apple Silicon"
    rustup override set 1.75.0-x86_64-apple-darwin
else
    echo "Not running on Apple Silicon"
    rustup override set 1.75.0
fi

agave-install init 1.18.8
solana-install init 1.18.8

CXX=/opt/homebrew/bin/c++-14 cargo build

cargo fmt

anchor build

yarn && cd ts/sdk && yarn && yarn build && home

yarn prettify:fix

yarn idl