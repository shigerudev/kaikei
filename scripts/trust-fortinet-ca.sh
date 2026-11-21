#!/usr/bin/env bash
# Trust the Fortinet SSL-inspection CA so Node/npm can use registry.npmjs.org.
# Usage:
#   ./scripts/trust-fortinet-ca.sh /path/to/fortinet-ca.cer
# Get the cert from FortiGate: Security Profiles → SSL/SSH Inspection → Download CA Certificate
# (CN should match the MITM issuer, e.g. FG6H0FTB22905955).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_IN="${1:-}"
DEST_DIR="$ROOT/.certs"
DEST_PEM="$DEST_DIR/fortinet-ssl-inspection-ca.pem"
NPMRC="$ROOT/.npmrc"

if [[ -z "$CERT_IN" || ! -f "$CERT_IN" ]]; then
  echo "Usage: $0 /path/to/fortinet-ca.cer|.crt|.pem" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Normalize to PEM
if grep -q "BEGIN CERTIFICATE" "$CERT_IN"; then
  cp "$CERT_IN" "$DEST_PEM"
else
  openssl x509 -inform DER -in "$CERT_IN" -out "$DEST_PEM"
fi

echo "Installed PEM → $DEST_PEM"
openssl x509 -in "$DEST_PEM" -noout -subject -issuer

# Verify npmjs leaf chains to this CA
LEAF="$DEST_DIR/npmjs-leaf-chain.pem"
if [[ ! -f "$LEAF" ]]; then
  echo | openssl s_client -servername registry.npmjs.org -connect registry.npmjs.org:443 2>/dev/null \
    | awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/{print}' > "$LEAF" || true
fi
if [[ -s "$LEAF" ]]; then
  if openssl verify -CAfile "$DEST_PEM" "$LEAF" 2>/dev/null | grep -q OK; then
    echo "openssl verify: OK (leaf chains to this CA)"
  else
    echo "WARNING: leaf did not verify against this CA. Wrong cert?" >&2
    openssl verify -CAfile "$DEST_PEM" "$LEAF" || true
  fi
fi

# Project npmrc: official registry + this CA
cat > "$NPMRC" <<EOF
registry=https://registry.npmjs.org/
strict-ssl=true
cafile=$DEST_PEM
EOF
echo "Wrote $NPMRC"

# Optional: user keychain (may prompt for password)
if command -v security >/dev/null; then
  if security add-trusted-cert -d -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" "$DEST_PEM" 2>/dev/null; then
    echo "Added to login keychain as trusted root."
  else
    echo "Keychain trust skipped (run manually if desired):"
    echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $DEST_PEM"
  fi
fi

echo
echo "Shell tip for this repo:"
echo "  export NODE_EXTRA_CA_CERTS=\"$DEST_PEM\""
echo "Then: npm ping && npm view @langchain/core version"
