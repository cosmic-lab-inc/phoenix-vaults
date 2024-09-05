home() {
    cd $(git rev-parse --show-toplevel)
}

reset

home

CXX=/opt/homebrew/bin/c++-14 cargo build

anchor build

yarn && cd ts/sdk && yarn && yarn build && home

yarn idl