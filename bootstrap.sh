#!/usr/bin/env bash

home() {
    cd "$(git rev-parse --show-toplevel)" || exit 1
}

home

chmod +x ./build.sh
./build.sh

export ANCHOR_WALLET=~/.config/solana/cosmic_lab_inc.json
rpc_url=$(solana config get | grep "RPC URL" | cut -d " " -f 3)
export ANCHOR_PROVIDER_URL=$rpc_url

yarn market-registry