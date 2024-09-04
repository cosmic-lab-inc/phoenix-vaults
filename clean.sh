home() {
    cd $(git rev-parse --show-toplevel)
}

home

cargo clean

yarn clean && cd ts/sdk && yarn clean && home