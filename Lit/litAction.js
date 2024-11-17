
(async () => {
  const go = async () => {
    console.log('Incoming messagesRoles:', JSON.stringify(messagesRoles, null, 2));
    // Extract all messages from messagesRoles and format for Anthropic
    const messages = messagesRoles.map(([role, content]) => ({
      role: role.toLowerCase(),
      content: content[0][1]  // Assuming the content is always in this format
    }));

    const FHENIX_RPC_URL = "https://sepolia-rpc.scroll.io";
    const mnemonic = "";
    const provider = new ethers.providers.JsonRpcProvider(FHENIX_RPC_URL);
    const signer = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);

    const ORACLE_ADDRESS = "0x03d42AB95f54DEe5d3Ce7db984237b340f458988";
    // TODO: add full ABI
    const addResponseabi = [
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "promptId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "promptCallBackId",
            "type": "uint256"
          }
        ],
        "name": "getMessagesAndRoles",
        "outputs": [
          {
            "components": [
              {
                "internalType": "string",
                "name": "role",
                "type": "string"
              },
              {
                "components": [
                  {
                    "internalType": "string",
                    "name": "contentType",
                    "type": "string"
                  },
                  {
                    "internalType": "string",
                    "name": "value",
                    "type": "string"
                  }
                ],
                "internalType": "struct IOracle.Content[]",
                "name": "content",
                "type": "tuple[]"
              }
            ],
            "internalType": "struct IOracle.Message[]",
            "name": "",
            "type": "tuple[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "promptId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "promptCallBackId",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "string",
                "name": "id",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "content",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "functionName",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "functionArguments",
                "type": "string"
              },
              {
                "internalType": "uint64",
                "name": "created",
                "type": "uint64"
              },
              {
                "internalType": "string",
                "name": "model",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "systemFingerprint",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "object",
                "type": "string"
              },
              {
                "internalType": "uint32",
                "name": "completionTokens",
                "type": "uint32"
              },
              {
                "internalType": "uint32",
                "name": "promptTokens",
                "type": "uint32"
              },
              {
                "internalType": "uint32",
                "name": "totalTokens",
                "type": "uint32"
              }
            ],
            "internalType": "struct IOracle.LlmResponse",
            "name": "response",
            "type": "tuple"
          },
          {
            "internalType": "string",
            "name": "errorMessage",
            "type": "string"
          }
        ],
        "name": "addResponse",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];

    // Make a call to AI API and contract call within the same runOnce
    let result = await Lit.Actions.runOnce({ waitForResponse: true, name: "aiCallerAndContractCall" }, async () => {
      // Anthropic API call TODO: configure api calls for other ais
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '', // Replace with your Anthropic API key
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: "claude-3-sonnet-20240229",
          max_tokens: 1000,
          messages: messages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          }))
        })
      });
      
      const aiResponse = await response.json();
      console.log('AI Response:', aiResponse);

      // Contract call
      const contractCaller = new ethers.Contract(ORACLE_ADDRESS, addResponseabi, signer);
      let id = promptId.toNumber ? promptId.toNumber() : parseInt(promptId.hex, 16);
      let callbackId = promptCallbackId.toNumber ? promptCallbackId.toNumber() : parseInt(promptCallbackId.hex, 16);

       // TODO: get prompttype and execute based on prompt type
       //let promptType = await contractCaller.promptType(callbackId);
       // "Groq" "default" or "OpenAi"
       // default is just addResponse as it is already implemented
       // OpenAi: addOpenAiResponse(promptId, promptCallbackId, ["chatcmpl-123xyz789", "This is a sample response content", "", "", 1699084800, "gpt-4", "fp_12345", "chat.completion", 42, 15, 57], "")
       // Groq: addGroqResponse (same but tuple is ["groq-123xyz789", "This is a sample Groq API response", 1699084800, "mixtral-8x7b", "fp_groq_12345", "chat.completion", 42, 15, 57], "")
      try {
        await contractCaller.addResponse(id, callbackId, {
            id: aiResponse.id,
            content: aiResponse.content[0].text,
            functionName: "",
            functionArguments: "",
            created: Math.floor(Date.now() / 1000),
            model: aiResponse.model,
            systemFingerprint: aiResponse.system_fingerprint || "",
            object: "chat.completion",
            completionTokens: aiResponse.usage.output_tokens || 0,
            promptTokens: aiResponse.usage.input_tokens || 0,
            totalTokens: (aiResponse.usage.output_tokens || 0) + (aiResponse.usage.input_tokens || 0)
        }, "");
        console.log("Contract call successful");
      } catch (e) {
        console.error("Error calling addResponse:", e);
        console.error("Error name:", e.name);
        console.error("Error message:", e.message);
        if (e.stack) console.error("Stack trace:", e.stack);
      }

      return aiResponse;
    });

    console.log("Lit Action execution completed");
    return result;
  };

  // Run the async function
  const result = await go();
  
  // Set the response from the action
  Lit.Actions.setResponse({ response: result });
})();
