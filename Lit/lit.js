/**
 * @fileoverview LitNode Event Listener implementation for processing PromptAdded events
 * and executing Lit Actions based on blockchain events.
 * @requires @lit-protocol/lit-node-client
 * @requires @lit-protocol/constants
 * @requires @lit-protocol/auth-helpers
 * @requires ethers
 * @requires dotenv
 */

const { LitNodeClient } = require("@lit-protocol/lit-node-client");
const { LIT_RPC, LitNetwork } = require("@lit-protocol/constants");
const fs = require('fs');
const {
  createSiweMessageWithRecaps,
  generateAuthSig,
  LitAbility,
  LitActionResource,
} = require("@lit-protocol/auth-helpers");
const ethers = require("ethers");
const { HDNodeWallet } = require('ethers');

require("dotenv").config();

const { FHENIX_RPC_URL, ORACLE_ADDRESS, ORACLE_ABI } = require('./constants');

/** @type {Object} Current session signatures */
let currentSessionSigs = null;
/** @type {number} Timestamp when current session expires */
let sessionExpirationTime = null;
/** @type {number} Time in milliseconds before expiration to renew session */
const SESSION_RENEWAL_THRESHOLD = 10 * 60 * 1000; // 10 minutes before expiration
/** @type {boolean} Flag indicating if the system is initialized */
let isInitialized = false;

/**
 * Generates new session signatures for Lit Protocol interactions
 * @param {LitNodeClient} litNodeClient - The initialized Lit Protocol client
 * @param {HDNodeWallet} ethersSigner - Ethereum signer for authentication
 * @returns {Promise<Object>} Session signatures object
 * @throws {Error} When signature generation fails
 */
async function getNewSessionSigs(litNodeClient, ethersSigner) {
  console.log("Getting new session signatures...");
  const expiration = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hours
  
  const sessionSigs = await litNodeClient.getSessionSigs({
    chain: "ethereum",
    expiration: expiration,
    resourceAbilityRequests: [
      {
        resource: new LitActionResource("*"),
        ability: LitAbility.LitActionExecution,
      },
    ],
    authNeededCallback: async ({ resourceAbilityRequests, expiration, uri }) => {
      console.log("Generating auth signature...");
      const toSign = await createSiweMessageWithRecaps({
        uri: uri,
        expiration: expiration,
        resources: resourceAbilityRequests,
        walletAddress: ethersSigner.address,
        nonce: await litNodeClient.getLatestBlockhash(),
        litNodeClient,
      });
      return await generateAuthSig({
        signer: ethersSigner,
        toSign,
      });
    },
  });

  currentSessionSigs = sessionSigs;
  sessionExpirationTime = new Date(expiration).getTime();
  console.log("New session signatures obtained successfully. Expires:", expiration);
  return sessionSigs;
}

/**
 * Ensures a valid session exists, renewing if necessary
 * @param {LitNodeClient} litNodeClient - The initialized Lit Protocol client
 * @param {HDNodeWallet} ethersSigner - Ethereum signer for authentication
 * @returns {Promise<Object>} Valid session signatures
 */
async function ensureValidSession(litNodeClient, ethersSigner) {
  const now = Date.now();
  if (!currentSessionSigs || !sessionExpirationTime || 
      now + SESSION_RENEWAL_THRESHOLD >= sessionExpirationTime) {
    return await getNewSessionSigs(litNodeClient, ethersSigner);
  }
  return currentSessionSigs;
}

/**
 * Processes a PromptAdded event by executing a Lit Action
 * @param {Object} event - The blockchain event object
 * @param {Array} messagesRoles - Array of messages and roles for processing
 * @param {LitNodeClient} litNodeClient - The initialized Lit Protocol client
 * @param {HDNodeWallet} ethersSigner - Ethereum signer for authentication
 * @throws {Error} When Lit Action execution fails
 */
async function processPromptAddedEvent(event, messagesRoles, litNodeClient, ethersSigner) {
  console.log("New PromptAdded event detected!");
  console.log(`Prompt ID: ${event.args.promptId}`);
  console.log(`Prompt Callback ID: ${event.args.promptCallbackId}`);
  console.log(`Sender: ${event.args.sender}`);
  console.log(`Block number: ${event.blockNumber}`);

  try {
    const sessionSigs = await ensureValidSession(litNodeClient, ethersSigner);
    
    console.log("Executing Lit Action...");
    const litActionCode = fs.readFileSync('litAction.js', 'utf8');
    const result = await litNodeClient.executeJs({
      sessionSigs,
      code: litActionCode,
      jsParams: {
        messagesRoles: messagesRoles,
        promptId: event.args.promptId,
        promptCallbackId: event.args.promptCallbackId,
      },
    });
    console.log("Lit Action executed successfully. Result:", result);

    if (result.response) {
      console.log("Lit Action response:");
      console.log(JSON.stringify(result.response, null, 2));
    }
  } catch (error) {
    console.error("Error during Lit Action execution:", error);
    if (error.message && error.message.includes("Invalid sessionSigs")) {
      console.log("Session signature error detected, attempting to renew...");
      await getNewSessionSigs(litNodeClient, ethersSigner);
      // Retry the operation once with new session
      await processPromptAddedEvent(event, messagesRoles, litNodeClient, ethersSigner);
    }
  }
}

/**
 * Initializes and starts the blockchain event listener
 * @param {ethers.Contract} contract - The initialized contract instance
 * @param {ethers.providers.Provider} provider - The blockchain provider
 * @param {LitNodeClient} litNodeClient - The initialized Lit Protocol client
 * @param {HDNodeWallet} ethersSigner - Ethereum signer for authentication
 * @returns {Promise<void>}
 */
async function startEventListener(contract, provider, litNodeClient, ethersSigner) {
  console.log("Starting event listener...");
  const latestBlock = await provider.getBlockNumber();
  console.log(`Current block number: ${latestBlock}`);

  contract.on("PromptAdded", async (promptId, promptCallbackId, sender, event) => {
    if (event.blockNumber > latestBlock) {
      try {
        console.log("Attempting to get messages...");
        let messagesRoles = await contract.getMessagesAndRoles(promptId, promptCallbackId);
        console.log("Messages retrieved successfully:", messagesRoles);
        await processPromptAddedEvent(event, messagesRoles, litNodeClient, ethersSigner);
      } catch (error) {
        console.error("Error processing PromptAdded event:", error);
      }
    } else {
      console.log(`Skipping old event from block ${event.blockNumber}`);
    }
  });

  // Set up periodic session renewal check
  setInterval(async () => {
    try {
      await ensureValidSession(litNodeClient, ethersSigner);
    } catch (error) {
      console.error("Error during periodic session renewal:", error);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  console.log("Event listener is now active and waiting for new PromptAdded events...");
}

/**
 * Initializes the entire system, setting up connections and starting the event listener
 * @throws {Error} When initialization fails or required environment variables are missing
 * @returns {Promise<void>}
 */
async function initialize() {
  if (isInitialized) {
    console.log("Already initialized, skipping...");
    return;
  }

  console.log("Starting the process...");
  
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error("WALLET_MNEMONIC is not set in the .env file");
  }

  console.log("Creating wallet from mnemonic...");
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  const fhenixProvider = new ethers.providers.JsonRpcProvider(FHENIX_RPC_URL);
  const ethersSigner = wallet.connect(fhenixProvider);
  console.log("Wallet created successfully. Address:", ethersSigner.address);

  const contract = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, fhenixProvider);

  console.log("Initializing LitNodeClient...");
  const litNodeClient = new LitNodeClient({
    litNetwork: LitNetwork.DatilDev,
    debug: false,
  });

  try {
    console.log("Connecting to LitNodeClient...");
    await litNodeClient.connect();
    console.log("Connected to LitNodeClient successfully.");

    // Get initial session
    await getNewSessionSigs(litNodeClient, ethersSigner);

    await startEventListener(contract, fhenixProvider, litNodeClient, ethersSigner);

    isInitialized = true;
    console.log("Script is now running continuously. Press Ctrl+C to stop.");
  } catch (error) {
    console.error("An error occurred during the setup process:", error);
    process.exit(1);
  }
}

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// Only call initialize once
initialize().catch((error) => {
  console.error("An unhandled error occurred:", error);
  process.exit(1);
});
