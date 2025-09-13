#!/bin/bash

# Verification script for Yarn and Turborepo setup

echo "Verifying Yarn setup..."

# Check Node.js version
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"
if [[ ! $NODE_VERSION == *"v20."* ]]; then
    echo "Warning: You are using Node.js $NODE_VERSION. This project requires Node.js v20.18.0."
    echo "Consider using nvm to switch to the correct version:"
    echo "nvm use"
fi

# Check Yarn version
YARN_VERSION=$(yarn --version)
echo "Yarn version: $YARN_VERSION"
if [[ "$YARN_VERSION" != "1.22.22" ]]; then
    echo "Warning: Expected Yarn v1.22.22, but found $YARN_VERSION."
fi

# Check if yarn.lock exists
if [ -f "yarn.lock" ]; then
    echo "✅ yarn.lock file found"
else
    echo "❌ yarn.lock file not found"
fi

# Check for package-lock.json (should not exist)
if [ -f "package-lock.json" ]; then
    echo "❌ package-lock.json file found (should be removed)"
else
    echo "✅ package-lock.json not found (correct)"
fi

echo "Verification complete!" 