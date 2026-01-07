// netlify/functions/rpc.js - FIXED FOR METAMASK USD DISPLAY
let demoStorage = {
    balances: {},
    tokens: {},
    prices: {
        bnb: null,
        usdt: 1.00
    },
    lastPriceUpdate: 0
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

// Initialize or get BNB price
async function getBNBPrice() {
    const now = Date.now();
    
    // Fetch new price if cache expired or no price yet
    if (!demoStorage.prices.bnb || now - demoStorage.lastPriceUpdate > 60000) {
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
            usdt: '100'
        };
    }
    
    return { balances: demoStorage.balances[addr], tokens: demoStorage.tokens[addr] };
}

// Convert decimal to wei
function decimalToWei(amount) {
    return BigInt(Math.floor(parseFloat(amount) * 10**18));
}

// Main handler
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
        return { statusCode: 200, headers, body: '' };
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
        
        // Get current BNB price
        const currentBNBPrice = await getBNBPrice();
        
        // Handle RPC methods
        if (method === 'net_version') {
            result = '56';
            
        } else if (method === 'eth_chainId') {
            result = '0x38'; // BSC Chain ID 56
            
        } else if (method === 'eth_gasPrice') {
            // Return realistic gas price for MetaMask USD calculation
            // 3 gwei = 3000000000 wei (normal BSC gas price)
            result = '0xb2d05e00'; // 3 gwei in hex
            
        } else if (method === 'eth_blockNumber') {
            // Return increasing block number
            result = '0x' + (10000000 + Math.floor(Date.now() / 10000)).toString(16);
            
        } else if (method === 'eth_getBalance') {
            const [address] = params;
            if (!address) {
                throw new Error('Address required');
            }
            
            const addr = address.toLowerCase();
            const demoData = initAddress(addr);
            
            // Convert BNB balance to wei (MetaMask expects wei)
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
            
            // Calculate USD values
            const bnbValue = parseFloat(demoData.balances.bnb) * currentBNBPrice;
            const usdtValue = parseFloat(demoData.tokens.usdt) * 1.00;
            const totalValue = bnbValue + usdtValue;
            
            result = {
                balances: {
                    bnb: demoData.balances.bnb,
                    usdt: demoData.tokens.usdt
                },
                prices: {
                    bnb: currentBNBPrice,
                    usdt: 1.00
                },
                usdValues: {
                    bnb: bnbValue.toFixed(2),
                    usdt: usdtValue.toFixed(2),
                    total: totalValue.toFixed(2)
                }
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
            const usdtValue = 500 * 1.00;
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
                }
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
            
            // Check balance and transfer
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
            
            // Calculate USD value
            const usdValue = tokenKey === 'bnb' 
                ? (parseFloat(amount) * currentBNBPrice).toFixed(2)
                : (parseFloat(amount) * 1.00).toFixed(2);
            
            result = {
                success: true,
                transactionHash: txHash,
                message: `Sent ${amount} ${token.toUpperCase()} ($${usdValue})`,
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
                result = '0x';
            }
            
        } else if (method === 'eth_estimateGas') {
            // Return standard gas estimate
            result = '0x5208'; // 21000 gas
            
        } else if (method === 'eth_sendRawTransaction') {
            // Handle signed transactions
            const txHash = '0x' + Math.random().toString(16).substr(2, 64);
            result = txHash;
            
        } else if (method === 'eth_sendTransaction') {
            const txHash = '0x' + Math.random().toString(16).substr(2, 64);
            result = txHash;
            
        } else if (method === 'eth_getTransactionReceipt') {
            const txHash = params[0] || '0x' + Math.random().toString(16).substr(2, 64);
            
            result = {
                transactionHash: txHash,
                status: '0x1',
                blockNumber: '0x' + (10000000 + Math.floor(Date.now() / 10000)).toString(16),
                gasUsed: '0x5208',
                cumulativeGasUsed: '0x5208',
                effectiveGasPrice: '0xb2d05e00', // 3 gwei
                logs: [],
                logsBloom: '0x' + '0'.repeat(512)
            };
            
        } else if (method === 'eth_getTransactionByHash') {
            const txHash = params[0] || '0x' + Math.random().toString(16).substr(2, 64);
            
            // Simulate a BNB transfer
            const valueWei = decimalToWei((Math.random() * 0.1).toFixed(4));
            
            result = {
                hash: txHash,
                blockNumber: '0x' + (10000000 + Math.floor(Date.now() / 10000)).toString(16),
                from: '0x' + Math.random().toString(16).substr(2, 40),
                to: '0x' + Math.random().toString(16).substr(2, 40),
                value: '0x' + valueWei.toString(16),
                gasPrice: '0xb2d05e00', // 3 gwei - IMPORTANT FOR METAMASK USD CALCULATION
                input: '0x'
            };
            
        } else if (method === 'eth_getBlockByNumber') {
            result = {
                number: params[0] || '0x' + (10000000 + Math.floor(Date.now() / 10000)).toString(16),
                baseFeePerGas: '0xb2d05e00', // 3 gwei base fee
                gasLimit: '0x' + (30000000).toString(16),
                gasUsed: '0x' + (21000).toString(16),
                timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16)
            };
            
        } else if (method === 'eth_feeHistory') {
            // Return fee history for MetaMask gas estimation
            result = {
                oldestBlock: '0x' + (10000000).toString(16),
                reward: [
                    ['0xb2d05e00', '0xb2d05e00', '0xb2d05e00'] // 3 gwei fees
                ],
                baseFeePerGas: ['0xb2d05e00', '0xb2d05e00'],
                gasUsedRatio: [0.1]
            };
            
        } else if (method === 'eth_maxPriorityFeePerGas') {
            // Return priority fee for EIP-1559
            result = '0xb2d05e00'; // 3 gwei
            
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
                    result = 'BSC-Demo/v1.0.0';
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