# claircent
https://claircent.com/

# How to Build an Agent with LAW (Lit Agent Wallet) and ElizaOS

This guide will walk you through building an agent using LAW (Lit Agent Wallet) and integrating it with the ElizaOS plugin. Follow these steps to get started.

For the most up-to-date and detailed instructions, always refer to the official [ElizaOS Documentation](https://elizaos.github.io/eliza/docs/quickstart/).

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js v23.3** (required for ElizaOS compatibility)
- **pnpm** (package manager)
- **Git**

- ## Step 1: Download the ElizaOS Repository

Clone the ElizaOS repository to your local machine:

```bash
git clone https://github.com/elizaOS/eliza.git
cd eliza
```
---

### Step 2: Install Dependencies

Install the dependencies using `pnpm`. Since the project moves quickly, we recommend using the `--no-frozen-lockfile` flag to avoid issues with outdated dependencies:

```bash
pnpm install --no-frozen-lockfile
```

## Step 3: Add the `litPlugin` to Your Agent

The `litPlugin` is located in the ElizaOS repository under the `develop` branch. You can find it here:  
[`litPlugin` Repository Location](https://github.com/elizaOS/eliza/tree/develop/packages/plugin-lit)

If the `litPlugin` is not included in your current branch, follow these steps:

### Option 1: Use the Latest Stable Release
If you’re having issues with the main branch, check out the latest stable release:

```bash
git checkout $(git describe --tags --abbrev=0)
```
Option 2: Download the litPlugin Manually

If the litPlugin is not included in the stable release, download it manually from the develop branch and place it in the appropriate directory. You can then integrate it into your agent.

Once the litPlugin is available, integrate it into your agent by editing the agent/src/index.ts file. Simply add litPlugin to the list of plugins:
```bash
import { litPlugin } from 'lit-agent-wallet';

// Other imports and configurations

const agent = new Agent({
  plugins: [
    // Other plugins
    litPlugin, // Add litPlugin here
    // Other plugins
  ],
});

// Start your agent
agent.start();
```
## Step 5: Configure Your `.env` File

For LAW integration, you’ll need a private key in your `.env` file. Ensure the private key starts with `0x`:

```env
PRIVATE_KEY=0xYourPrivateKeyHere
```
## Step 6: Run Your Agent

Once everything is set up, you can start your agent with a specific character configuration. For example, to run the agent with the "Trump" character:

```bash
pnpm start --character="characters/trump.character.json"
```

## Additional Resources

- **Lit Agent Wallet Repository**:  
  [Lit Agent Wallet on GitHub](https://github.com/LIT-Protocol/agent-wallet/tree/main)
- **Lit Faucet**:  
  [Chronicle Yellowstone Faucet](https://chronicle-yellowstone-faucet.getlit.dev/)
- **ElizaOS Documentation**:  
  [ElizaOS Quickstart Guide](https://elizaos.github.io/eliza/docs/quickstart/)

  ## Troubleshooting

### Issues Running the Agent
If you encounter issues running the agent:
1. Ensure you’re using **Node.js v23.3**.
2. Verify that the `litPlugin` is correctly installed and configured.
3. Check the `.env` file to ensure the private key is formatted correctly (starts with `0x`).
4. If the project has changed significantly, refer to the [ElizaOS Quickstart Guide](https://elizaos.github.io/eliza/docs/quickstart/) for the latest instructions.

### Outdated Dependencies
If you encounter dependency issues, try cleaning and reinstalling the dependencies:

```bash
pnpm clean
pnpm install --no-frozen-lockfile
```
## Conclusion

You’ve successfully built an agent with LAW and integrated it with ElizaOS! You can now extend your agent’s functionality by adding more plugins or customizing its behavior.

For further reading, refer to the official documentation:
- [ElizaOS Documentation](https://elizaos.github.io/eliza/docs/quickstart/)
- [Lit Agent Wallet Repository](https://github.com/LIT-Protocol/agent-wallet/tree/main)
