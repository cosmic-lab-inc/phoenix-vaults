home() {
    cd $(git rev-parse --show-toplevel)
}

home

cargo clean

cd ts/sdk && yarn clean && home && rm -rf node_modules