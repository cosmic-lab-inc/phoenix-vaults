home() {
    cd $(git rev-parse --show-toplevel)
}

home

solana-install init 1.18.8

# check if arch is apple-silicon

CXX=/opt/homebrew/bin/c++-14 cargo build

cargo fmt

anchor build

yarn && cd ts/sdk && yarn && yarn build && home

yarn prettify:fix

yarn idl