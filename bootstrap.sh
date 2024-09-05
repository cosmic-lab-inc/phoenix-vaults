home() {
    cd $(git rev-parse --show-toplevel)
}

home

cargo test --package phoenix-vaults --test phoenix bootstrap_markets -- --exact --nocapture