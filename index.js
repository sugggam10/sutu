const WebSocket = require("ws");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

const botToken = "7413428941:AAEdovhmw2f8G6luu0IkRR8E6OdAasFRkvw";
const bot = new TelegramBot(botToken);

const wsUrl = `wss://atlas-mainnet.helius-rpc.com/?api-key=c494140b-df3a-46f8-b293-eb1988458351`;
let ws;
let keepAliveInterval;

// Function to establish WebSocket connection
function connectWebSocket() {
  ws = new WebSocket(wsUrl);

  ws.on("open", function open() {
    console.log("WebSocket is open");
    sendRequest(ws);

    // Set up keep-alive dummy message
    keepAliveDummyMessage();
  });

  ws.on("message", async function incoming(data) {
    const messageStr = data.toString("utf8");
    try {
      const messageObj = JSON.parse(messageStr);
      if (messageObj.method === "transactionNotification") {
        processTransactionNotification(messageObj);
      }
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      console.error("Original message:", messageStr);
    }
  });

  ws.on("error", function error(err) {
    console.error("WebSocket error:", err);
    logToFile(`WebSocket error: ${err.message}`);
  });

  ws.on("close", function close() {
    console.log("WebSocket is closed");
    logToFile("WebSocket is closed");

    // Clear the keep-alive interval when the connection is closed
    clearInterval(keepAliveInterval);

    // Attempt to reconnect after a delay
    setTimeout(connectWebSocket, 5000);
  });
}

// Function to send a request to the WebSocket server
function sendRequest(ws) {
  const accountAddresses = ["11111111111111111111111111111111"];
  const request = {
    jsonrpc: "2.0",
    id: 420,
    method: "transactionSubscribe",
    params: [
      {
        accountInclude: accountAddresses,
      },
      {
        commitment: "processed",
        encoding: "jsonParsed",
        transactionDetails: "full",
        showRewards: true,
        maxSupportedTransactionVersion: 0,
      },
    ],
  };
  ws.send(JSON.stringify(request));
}

// Function to keep the WebSocket connection alive with dummy messages
function keepAliveDummyMessage() {
  const dummyInterval = 30000; // Send a dummy message every 30 seconds

  keepAliveInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const dummyMessage = {
        jsonrpc: "2.0",
        id: 0,
        method: "keepAlive",
        params: [],
      };
      ws.send(JSON.stringify(dummyMessage));
    }
  }, dummyInterval);
}

// Function to get the current time in IST and format it
function getCurrentIST() {
  const date = new Date();
  const options = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const formattedDate = new Intl.DateTimeFormat("en-IN", options).format(date);
  const [datePart, timePart] = formattedDate.split(", ");
  let [hour, minute, second] = timePart.split(":").map(Number);
  if (hour === 24) {
    hour = 0;
  }
  const formattedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  return `${datePart} at ${formattedTime}`;
}

// Function to log messages to a text file
function logToFile(message) {
  const logFilePath = "transaction_logs.txt";
  const timestamp = getCurrentIST();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error("Failed to write to log file:", err);
    }
  });
}

// Function to process transaction notifications
function processTransactionNotification(messageObj) {
  const params = messageObj.params;
  const transaction = params.result.transaction.transaction;
  const instructions = transaction.message.instructions;
  const transactionTimeIST = getCurrentIST();

  const blockedAddresses = [
    "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
    "2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm",
    "CRCMGeGh1Pv9Gvo1uiUL7T3g315axD5ouKR8hxG6kHvg",
    "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2",
    "BmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6",
    "ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ",
    "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS",
    "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE",
    "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD",
  ];

  for (const instruction of instructions) {
    const parsed = instruction.parsed;
    if (parsed && parsed.type === "transfer") {
      const source = parsed.info.source;
      const lamports = parsed.info.lamports;
      const destination = parsed.info.destination;
      const lamportsToSol = lamports / 1000000000;

      if (lamportsToSol > 11.98 && lamportsToSol < 12.02) {
        const logMessage = `Transaction Time (IST): ${transactionTimeIST}\nSource: ${source}\nDestination: ${destination}\nLamports: ${lamportsToSol}\n===========================================`;
        bot.sendMessage('-1002198383573', logMessage);
        //console.log(logMessage);
      }

      if (blockedAddresses.includes(source)) {
        const blockedMessage = "Source address is blocked. Skipping fetching token transactions.";
        //logToFile(`${transactionTimeIST} - ${blockedMessage}`);
        return;
      }
    }
  }
}

// Start WebSocket connection
connectWebSocket();

