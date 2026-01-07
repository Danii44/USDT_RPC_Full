// netlify/functions/rpc.js - WORKING VERSION
// Minimal dependencies - No external calls that might fail

// Simple in-memory storage (will reset on cold start)
let demoStorage = {
    balances: {},
    tokens: {},
    lastCleanup: Date.now()
};

// Clean up old data periodically
function cleanupOldData() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (now - demoStorage.lastCleanup > oneHour) {
        // Keep only data from last 24 hours
        const oneDay = 24 * 60 * 60 * 1000;
        for (const address in demoStorage.balances) {
            if (demoStorage.balances[address].timestamp < now - oneDay) {
                delete demoStorage.balances[address];
            }
        }
        demoStorage.lastCleanup = now;
    }
}

// Initialize demo balances for an address
function initAddress(address) {
    const addr = address.toLowerCase();
    
    if (!demoStorage.balances[addr]) {
        demoStorage.balances[addr] = {
            bnb: '0',
            timestamp: Date.now()
        };
    }
    
    if (!demoStorage.tokens[addr]) {
        demoStorage.tokens[addr] = {
            usdt: '0',
            och: '0'
        };
    }
    
    return { balances: demoStorage.balances[addr], tokens: demoStorage.tokens[addr] };
}

exports.handler = async function(event, context) {
    console.log('RPC function called:', event.httpMethod);
    
    // Clean up old data
    cleanupOldData();
    
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
        
        // Handle RPC methods
        if (method === 'net_version') {
            result = '56';
            
        } else if (method === 'eth_chainId') {
            result = '0x38';
            
        } else if (method === 'eth_gasPrice') {
            result = '0x0'; // Zero gas for demo
            
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
            
            // Convert demo BNB to wei (18 decimals)
            const demoBNBWei = BigInt(Math.floor(parseFloat(demoData.balances.bnb) * 10**18));
            result = '0x' + demoBNBWei.toString(16);
            
        } else if (method === 'demo_getBalances') {
            const [address] = params;
            if (!address) {
                throw new Error('Address required');
            }
            
            const addr = address.toLowerCase();
            const demoData = initAddress(addr);
            
            // For demo, we'll use fixed real balances
            // In production, you'd fetch these from BSC
            const realBNB = '0.5'; // Example real balance
            const realUSDT = '100'; // Example real balance
            
            result = {
                real: {
                    bnb: realBNB,
                    usdt: realUSDT
                },
                demo: {
                    bnb: demoData.balances.bnb,
                    usdt: demoData.tokens.usdt,
                    och: demoData.tokens.och
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
            demoData.balances.bnb = '10';
            demoData.tokens.usdt = '1000';
            demoData.tokens.och = '5000';
            
            result = {
                success: true,
                message: 'Demo tokens received!',
                balances: {
                    bnb: '10',
                    usdt: '1000',
                    och: '5000'
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
            
            // Check balance
            const tokenKey = token.toLowerCase();
            let senderBalance;
            
            if (tokenKey === 'bnb') {
                senderBalance = parseFloat(senderData.balances.bnb);
            } else {
                senderBalance = parseFloat(senderData.tokens[tokenKey] || '0');
            }
            
            if (senderBalance < parseFloat(amount)) {
                throw new Error(`Insufficient ${token} balance`);
            }
            
            // Transfer
            if (tokenKey === 'bnb') {
                senderData.balances.bnb = (senderBalance - parseFloat(amount)).toString();
                const receiverBalance = parseFloat(receiverData.balances.bnb || '0');
                receiverData.balances.bnb = (receiverBalance + parseFloat(amount)).toString();
            } else {
                senderData.tokens[tokenKey] = (senderBalance - parseFloat(amount)).toString();
                const receiverBalance = parseFloat(receiverData.tokens[tokenKey] || '0');
                receiverData.tokens[tokenKey] = (receiverBalance + parseFloat(amount)).toString();
            }
            
            // Create fake transaction hash
            const txHash = '0x' + Math.random().toString(16).substr(2, 64);
            
            result = {
                success: true,
                transactionHash: txHash,
                message: `Sent ${amount} ${token} to ${to.substring(0, 10)}...`
            };
            
        } else if (method === 'eth_call') {
            // Handle token balance queries
            const [txObj] = params;
            
            if (txObj && txObj.data && txObj.data.startsWith('0x70a08231')) {
                // balanceOf call - extract address
                const address = '0x' + txObj.data.substring(34);
                const addr = address.toLowerCase();
                const demoData = initAddress(addr);
                
                // Check which token
                let balance;
                if (txObj.to && txObj.to.toLowerCase() === '0x1234567890123456789012345678901234567890') {
                    // OCH token
                    balance = BigInt(Math.floor(parseFloat(demoData.tokens.och) * 10**18));
                } else {
                    // USDT or other
                    balance = BigInt(Math.floor(parseFloat(demoData.tokens.usdt) * 10**18));
                }
                
                result = '0x' + balance.toString(16).padStart(64, '0');
            } else {
                result = '0x';
            }
            
        } else {
            // For other methods, return success
            result = '0x0';
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ jsonrpc, id, result })
        };
        
    } catch (error) {
        console.error('RPC Error:', error);
        
        return {
            statusCode: 200, // Still return 200 for JSON-RPC errors
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