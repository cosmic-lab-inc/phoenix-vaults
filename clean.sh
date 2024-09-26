home() {
    cd "$(git rev-parse --show-toplevel)" || exit 1
}

home

cargo clean

cd ts/sdk && yarn clean && home && rm -rf node_modules