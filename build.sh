home() {
    cd $(git rev-parse --show-toplevel)
}

home

CXX=/opt/homebrew/bin/c++-14 cargo build

cargo fmt

anchor build

yarn && cd ts/sdk && yarn && yarn build && home

yarn prettify:fix

yarn idl