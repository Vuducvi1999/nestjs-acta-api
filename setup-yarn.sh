#!/bin/bash

# Simple setup script for Yarn in the Wonder CRM monorepo

echo "Setting up Yarn for ACTA E-Commerce..."

# Check Node.js version
NODE_VERSION=$(node -v)
if [[ ! $NODE_VERSION == *"v20."* ]]; then
    echo "Warning: You are using Node.js $NODE_VERSION. This project requires Node.js v20.18.0."
    echo "Consider using nvm to switch to the correct version:"
    echo "nvm use"
fi

# Check Yarn version
YARN_VERSION=$(yarn --version)
echo "Current Yarn version: $YARN_VERSION"

if [[ "$YARN_VERSION" != "1.22.22" ]]; then
    echo "Installing Yarn 1.22.22 globally..."
    npm install -g yarn@1.22.22
    YARN_VERSION=$(yarn --version)
    echo "Updated Yarn version: $YARN_VERSION"
fi

# Remove package-lock.json if it exists
if [ -f "package-lock.json" ]; then
    echo "Removing package-lock.json..."
    rm package-lock.json
fi

# Install dependencies
echo "Installing dependencies with Yarn..."
yarn install

echo "Yarn setup complete!"
echo "You can now run 'turbo dev' to start the development server." 