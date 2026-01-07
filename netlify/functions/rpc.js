// netlify/functions/rpc.js - REAL BNB PRICE VERSION
// No external dependencies to avoid 502 errors

// Simple in-memory storage with real price fetching
let demoStorage = {
    balances: {},
    tokens: {},
    prices: {
        bnb: null, // Will be fetched from Binance
        usdt: 1.00
    },
    lastPriceUpdate: 0,
    priceCacheDuration: 60000 // 1 minute cache
};

// Fetch real BNB price from Binance
async function fetchRealBNBPrice() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
        const data = await response.json();
        const bnbPrice = parseFloat(data.price);
        demoStorage.prices.bnb = bnbPrice;
        demoStorage.lastPriceUpdate = Date.now();
        console.log(`Updated BNB price: $${bnbPrice}`);
        return bnbPrice;
    } catch (error) {
        console.error('Failed to fetch BNB price:', error);
        // Fallback to last known price or default
        if (!demoStorage.prices.bnb) {
            demoStorage.prices.bnb = 350.50;
        }
        return demoStorage.prices.bnb;
    }
}

// Initialize or get BNB price (with caching)
async function getBNBPrice() {
    const now = Date.now();
    
    // Fetch new price if cache expired or no price yet
    if (!demoStorage.prices.bnb || now - demoStorage.lastPriceUpdate > demoStorage.priceCacheDuration) {
        await fetchRealBNBPrice();
    }
    
    return demoStorage.prices.bnb;
}

// Initialize address
function initAddress(address) {
    const addr = address.toLowerCase();
    
    if (!demoStorage.balances[addr]) {
        demoStorage.balances[addr] = {
            bnb: '0.1', // Starting with 0.1 BNB for demo
            timestamp: Date.now()
        };
    }
    
    if (!demoStorage.tokens[addr]) {
        demoStorage.tokens[addr] = {
            usdt: '100' // Starting with 100 USDT for demo
        };
    }
    
    return { balances: demoStorage.balances[addr], tokens: demoStorage.tokens[addr] };
}

// Convert decimal to wei (18 decimals)
function decimalToWei(amount) {
    return BigInt(Math.floor(parseFloat(amount) * 10**18));
}

// Convert wei to decimal
function weiToDecimal(wei) {
    return (Number(wei) / 10**18).toString();
}

// Get USD value of BNB balance
function getUSDValue(bnbAmount, bnbPrice) {
    return (parseFloat(bnbAmount) * bnbPrice).toFixed(2);
}

exports.handler = async function(event, context) {
    console.log('RPC function called:', event.httpMethod);
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only accept POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse request
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    jsonrpc: '2.0',
                    id: null,
                    error: { code: -32700, message: 'Parse error' }
                })
            };
        }

        const { jsonrpc = '2.0', id = 1, method, params = [] } = body;
        
        console.log('Method:', method);
        
        let result;
        
        // Get current BNB price for USD calculations
        const currentBNBPrice = await getBNBPrice();
        
        // Handle RPC methods
        if (method === 'net_version') {
            result = '56';
            
        } else if (method === 'eth_chainId') {
            result = '0x38'; // BSC Chain ID 56
            
        } else if (method === 'eth_gasPrice') {
            // Return very low gas price (0.1 gwei) to show almost 0 fees in MetaMask
            result = '0x5d21dba00'; // 0.25 gwei in hex
            
        } else if (method === 'eth_blockNumber') {
            // Return increasing block number
            result = '0x' + (10000000 + Math.floor(Date.now() / 10000)).toString(16);
            
        } else if (method === 'eth_getBalance') {
            const [address, blockTag = 'latest'] = params;
            if (!address) {
                throw new Error('Address required');
            }
            
            const addr = address.toLowerCase();
            const demoData = initAddress(addr);
            
            // Convert BNB balance to wei
            const bnbBalanceWei = decimalToWei(demoData.balances.bnb);
            
            // Return BNB balance in wei
            result = '0x' + bnbBalanceWei.toString(16);
            
        } else if (method === 'demo_getBalances') {
            const [address] = params;
            if (!address) {
                throw new Error('Address required');
            }
            
            const addr = address.toLowerCase();
            const demoData = initAddress(addr);
            
            // Calculate total value based on real prices
            const bnbValue = parseFloat(demoData.balances.bnb) * currentBNBPrice;
            const usdtValue = parseFloat(demoData.tokens.usdt) * demoStorage.prices.usdt;
            const totalValue = bnbValue + usdtValue;
            
            result = {
                balances: {
                    bnb: demoData.balances.bnb,
                    usdt: demoData.tokens.usdt
                },
                usdValues: {
                    bnb: bnbValue.toFixed(2),
                    usdt: usdtValue.toFixed(2),
                    total: totalValue.toFixed(2)
                },
                prices: {
                    bnb: currentBNBPrice,
                    usdt: demoStorage.prices.usdt
                },
                lastUpdated: new Date().toISOString()
            };
            
        } else if (method === 'demo_faucet') {
            const [address] = params;
            if (!address) {
                throw new Error('Address required');
            }
            
            const addr = address.toLowerCase();
            const demoData = initAddress(addr);
            
            // Give demo tokens
            demoData.balances.bnb = '5'; // 5 BNB demo
            demoData.tokens.usdt = '500'; // 500 USDT demo
            
            // Calculate USD values
            const bnbValue = 5 * currentBNBPrice;
            const usdtValue = 500 * demoStorage.prices.usdt;
            const totalValue = bnbValue + usdtValue;
            
            result = {
                success: true,
                message: 'Demo tokens received!',
                balances: {
                    bnb: '5',
                    usdt: '500'
                },
                usdValues: {
                    bnb: `$${bnbValue.toFixed(2)}`,
                    usdt: `$${usdtValue.toFixed(2)}`,
                    total: `$${totalValue.toFixed(2)}`
                },
                transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
            };
            
        } else if (method === 'demo_send') {
            const [from, to, token, amount] = params;
            
            if (!from || !to || !token || !amount) {
                throw new Error('Missing parameters');
            }
            
            const fromAddr = from.toLowerCase();
            const toAddr = to.toLowerCase();
            
            const senderData = initAddress(fromAddr);
            const receiverData = initAddress(toAddr);
            
            // Check balance
            const tokenKey = token.toLowerCase();
            let senderBalance;
            
            if (tokenKey === 'bnb') {
                senderBalance = parseFloat(senderData.balances.bnb);
                if (senderBalance < parseFloat(amount)) {
                    throw new Error(`Insufficient BNB balance`);
                }
                
                // Transfer BNB
                senderData.balances.bnb = (senderBalance - parseFloat(amount)).toString();
                const receiverBalance = parseFloat(receiverData.balances.bnb || '0');
                receiverData.balances.bnb = (receiverBalance + parseFloat(amount)).toString();
            } else if (tokenKey === 'usdt') {
                senderBalance = parseFloat(senderData.tokens.usdt || '0');
                if (senderBalance < parseFloat(amount)) {
                    throw new Error(`Insufficient USDT balance`);
                }
                
                // Transfer USDT
                senderData.tokens.usdt = (senderBalance - parseFloat(amount)).toString();
                const receiverBalance = parseFloat(receiverData.tokens.usdt || '0');
                receiverData.tokens.usdt = (receiverBalance + parseFloat(amount)).toString();
            } else {
                throw new Error(`Unsupported token: ${token}`);
            }
            
            // Create fake transaction hash
            const txHash = '0x' + Math.random().toString(16).substr(2, 64);
            
            // Calculate USD value of transfer
            const usdValue = tokenKey === 'bnb' 
                ? (parseFloat(amount) * currentBNBPrice).toFixed(2)
                : (parseFloat(amount) * demoStorage.prices.usdt).toFixed(2);
            
            result = {
                success: true,
                transactionHash: txHash,
                message: `Sent ${amount} ${token.toUpperCase()} ($${usdValue})`,
                gasUsed: '0x5208', // 21000 gas
                gasPrice: '0x5d21dba00', // 0.25 gwei
                usdValue: `$${usdValue}`
            };
            
        } else if (method === 'eth_call') {
            // Handle token balance queries
            const [txObj] = params;
            
            if (txObj && txObj.data && txObj.data.startsWith('0x70a08231')) {
                // balanceOf call for ERC20 tokens
                const address = '0x' + txObj.data.substring(34);
                const addr = address.toLowerCase();
                const demoData = initAddress(addr);
                
                // Check which token contract
                let balance;
                if (txObj.to && txObj.to.toLowerCase() === '0x55d398326f99059ff775485246999027b3197955') {
                    // USDT token contract on BSC
                    balance = decimalToWei(demoData.tokens.usdt);
                } else {
                    // Unknown token, return 0
                    balance = 0n;
                }
                
                result = '0x' + balance.toString(16).padStart(64, '0');
            } else if (txObj && txObj.data && txObj.data.startsWith('0x313ce567')) {
                // decimals() call - return 18 decimals for USDT
                result = '0x' + (18).toString(16).padStart(64, '0');
            } else if (txObj && txObj.data && txObj.data.startsWith('0x95d89b41')) {
                // symbol() call - return "USDT"
                result = '0x' + Buffer.from('USDT').toString('hex').padEnd(64, '0');
            } else if (txObj && txObj.data && txObj.data.startsWith('0x06fdde03')) {
                // name() call - return "Tether USD"
                result = '0x' + Buffer.from('Tether USD').toString('hex').padEnd(64, '0');
            } else {
                // Default empty response
                result = '0x';
            }
            
        } else if (method === 'eth_estimateGas') {
            // Return standard gas estimate for BNB transfers
            result = '0x5208'; // 21000 gas for simple transfers
            
        } else if (method === 'eth_sendRawTransaction') {
            // Handle signed transactions (MetaMask sends raw transactions)
            const [signedTx] = params;
            
            // Parse transaction to get recipient and value
            // This is a simplified version - in real implementation you'd decode the RLP
            const txHash = '0x' + Math.random().toString(16).substr(2, 64);
            
            result = txHash;
            
        } else if (method === 'eth_sendTransaction') {
            // For direct transaction sending (less common with MetaMask)
            const tx = params[0];
            const txHash = '0x' + Math.random().toString(16).substr(2, 64);
            result = txHash;
            
        } else if (method === 'eth_getTransactionReceipt') {
            // Return fake receipt with successful status
            const txHash = params[0] || '0x' + Math.random().toString(16).substr(2, 64);
            
            // Calculate USD value for the transaction
            let usdValue = '0.00';
            if (Math.random() > 0.5) { // Simulate BNB transfer
                usdValue = (Math.random() * 0.5 * currentBNBPrice).toFixed(2);
            }
            
            result = {
                transactionHash: txHash,
                status: '0x1', // Success
                blockNumber: '0x' + (10000000 + Math.floor(Date.now() / 10000)).toString(16),
                blockHash: '0x' + Math.random().toString(16).substr(2, 64),
                from: '0x' + Math.random().toString(16).substr(2, 40),
                to: '0x' + Math.random().toString(16).substr(2, 40),
                gasUsed: '0x5208',
                cumulativeGasUsed: '0x5208',
                effectiveGasPrice: '0x5d21dba00', // 0.25 gwei
                logs: [],
                logsBloom: '0x' + '0'.repeat(512),
                transactionIndex: '0x0',
                contractAddress: null,
                type: '0x0',
                usdValue: `$${usdValue}`
            };
            
        } else if (method === 'eth_getTransactionByHash') {
            // Return transaction details
            const txHash = params[0] || '0x' + Math.random().toString(16).substr(2, 64);
            
            // Simulate a BNB transfer
            const valueWei = decimalToWei((Math.random() * 0.1).toFixed(4));
            
            result = {
                hash: txHash,
                nonce: '0x0',
                blockHash: '0x' + Math.random().toString(16).substr(2, 64),
                blockNumber: '0x' + (10000000 + Math.floor(Date.now() / 10000)).toString(16),
                transactionIndex: '0x0',
                from: '0x' + Math.random().toString(16).substr(2, 40),
                to: '0x' + Math.random().toString(16).substr(2, 40),
                value: '0x' + valueWei.toString(16),
                gas: '0x5208',
                gasPrice: '0x5d21dba00', // 0.25 gwei = very low fee
                input: '0x',
                v: '0x25',
                r: '0x' + Math.random().toString(16).substr(2, 64),
                s: '0x' + Math.random().toString(16).substr(2, 64)
            };
            
        } else if (method === 'eth_getBlockByNumber') {
            // Return block information
            const [blockNumber, fullTransactions] = params;
            
            result = {
                number: blockNumber || '0x' + (10000000 + Math.floor(Date.now() / 10000)).toString(16),
                hash: '0x' + Math.random().toString(16).substr(2, 64),
                parentHash: '0x' + Math.random().toString(16).substr(2, 64),
                nonce: '0x0000000000000000',
                sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
                logsBloom: '0x' + '0'.repeat(512),
                transactionsRoot: '0x' + Math.random().toString(16).substr(2, 64),
                stateRoot: '0x' + Math.random().toString(16).substr(2, 64),
                receiptsRoot: '0x' + Math.random().toString(16).substr(2, 64),
                miner: '0x0000000000000000000000000000000000000000',
                difficulty: '0x2',
                totalDifficulty: '0x2',
                extraData: '0x',
                size: '0x3e8',
                gasLimit: '0x' + (30000000).toString(16),
                gasUsed: '0x' + (21000).toString(16),
                timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
                transactions: [],
                uncles: [],
                baseFeePerGas: '0x5d21dba00' // 0.25 gwei base fee
            };
            
        } else if (method === 'eth_feeHistory') {
            // Return fee history for MetaMask gas estimation
            result = {
                oldestBlock: '0x' + (10000000).toString(16),
                reward: [
                    ['0x5d21dba00', '0x5d21dba00', '0x5d21dba00'] // Very low fees
                ],
                baseFeePerGas: ['0x5d21dba00', '0x5d21dba00'],
                gasUsedRatio: [0.1]
            };
            
        } else {
            // For other methods, return success or default
            switch(method) {
                case 'eth_getTransactionCount':
                    result = '0x0';
                    break;
                case 'eth_getCode':
                    result = '0x';
                    break;
                case 'web3_clientVersion':
                    result = 'DemoBSC/v1.0.0';
                    break;
                case 'eth_maxPriorityFeePerGas':
                    result = '0x3b9aca00'; // 1 gwei
                    break;
                default:
                    result = null;
            }
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ jsonrpc, id, result })
        };
        
    } catch (error) {
        console.error('RPC Error:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                error: {
                    code: -32603,
                    message: error.message || 'Internal error'
                }
            })
        };
    }
};