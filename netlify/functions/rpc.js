// netlify/functions/rpc.js
const ethers = require('ethers');

// Initialize providers
const realBSCProvider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');

// In-memory storage for demo balances (reset on cold start)
let demoBalances = {};
let demoTokens = {};
let fakeBlockchain = {
    blockNumber: 12345678,
    transactions: {}
};

// Initialize demo data
function initDemoData() {
    // Demo BNB balances
    demoBalances = {};
    
    // Demo tokens
    demoTokens = {
        // Mock USDT (same address as real for compatibility)
        '0x55d398326f99059ff775485246999027b3197955': {
            name: 'Tether USD',
            symbol: 'USDT',
            decimals: 18,
            totalSupply: ethers.parseUnits('1000000', 18).toString(),
            balances: {}
        },
        // Custom token
        '0x1234567890123456789012345678901234567890': {
            name: 'OffChain Token',
            symbol: 'OCH',
            decimals: 18,
            totalSupply: ethers.parseUnits('1000000', 18).toString(),
            balances: {}
        }
    };
}

// Helper function to get combined balance
async function getCombinedBalance(address) {
    try {
        // Get real BNB balance
        let realBalance = 0n;
        try {
            realBalance = await realBSCProvider.getBalance(address);
        } catch (e) {
            console.log('Could not fetch real BNB:', e.message);
        }

        // Get demo BNB balance
        let demoBalance = 0n;
        if (demoBalances[address.toLowerCase()]) {
            demoBalance = BigInt(demoBalances[address.toLowerCase()]);
        }

        // Combine
        const combined = realBalance + demoBalance;
        return '0x' + combined.toString(16);
    } catch (error) {
        console.error('Error in getCombinedBalance:', error);
        return '0x0';
    }
}

// Handle token balance calls
function handleTokenCall(contractAddress, data, callerAddress) {
    const token = demoTokens[contractAddress.toLowerCase()];
    if (!token) {
        return '0x'; // Empty response for unknown contracts
    }

    const functionSig = data.substring(0, 10);
    
    switch(functionSig) {
        case '0x70a08231': // balanceOf(address)
            const address = '0x' + data.substring(34);
            const balance = token.balances[address.toLowerCase()] || 0n;
            return '0x' + balance.toString(16).padStart(64, '0');
            
        case '0x06fdde03': // name()
            return encodeString(token.name);
            
        case '0x95d89b41': // symbol()
            return encodeString(token.symbol);
            
        case '0x313ce567': // decimals()
            return '0x' + token.decimals.toString(16).padStart(64, '0');
            
        case '0x18160ddd': // totalSupply()
            return '0x' + BigInt(token.totalSupply).toString(16).padStart(64, '0');
            
        case '0xa9059cbb': // transfer(to, amount)
            // For demo purposes, return success
            return '0x' + '1'.padStart(64, '0');
            
        default:
            return '0x';
    }
}

function encodeString(str) {
    const hex = Buffer.from(str).toString('hex');
    const lengthHex = (str.length).toString(16).padStart(64, '0');
    const stringHex = hex.padEnd(64, '0');
    return '0x' + lengthHex + stringHex;
}

// Main RPC handler
exports.handler = async function(event, context) {
    // Initialize demo data on cold start
    if (Object.keys(demoBalances).length === 0) {
        initDemoData();
    }
    
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
        const body = JSON.parse(event.body);
        const { jsonrpc, id, method, params } = body;
        
        console.log('RPC Call:', method, params);
        
        let result;
        
        switch(method) {
            // Network info
            case 'net_version':
                result = '56';
                break;
                
            case 'eth_chainId':
                result = '0x38';
                break;
                
            case 'eth_gasPrice':
                result = '0x0'; // Zero gas
                break;
                
            case 'eth_blockNumber':
                result = '0x' + fakeBlockchain.blockNumber.toString(16);
                break;
                
            // Balance endpoints
            case 'eth_getBalance':
                const [address] = params;
                result = await getCombinedBalance(address);
                break;
                
            case 'eth_call':
                const [txObj] = params;
                if (txObj.to && txObj.data) {
                    result = handleTokenCall(txObj.to, txObj.data, txObj.from);
                } else {
                    result = '0x';
                }
                break;
                
            // Transaction simulation
            case 'eth_sendTransaction':
                const tx = params[0];
                const txHash = '0x' + Math.random().toString(16).substr(2, 64);
                
                // Store fake transaction
                fakeBlockchain.transactions[txHash] = {
                    hash: txHash,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value || '0x0',
                    status: '0x1'
                };
                fakeBlockchain.blockNumber += 1;
                
                result = txHash;
                break;
                
            case 'eth_getTransactionReceipt':
                const [hash] = params;
                result = fakeBlockchain.transactions[hash] || null;
                break;
                
            // Account methods
            case 'eth_accounts':
                result = params || [];
                break;
                
            case 'eth_getTransactionCount':
                result = '0x0';
                break;
                
            // Faucet endpoint (custom method)
            case 'demo_faucet':
                const [faucetAddress] = params;
                const addr = faucetAddress.toLowerCase();
                
                // Give demo BNB
                demoBalances[addr] = ethers.parseUnits('10', 18).toString();
                
                // Give demo tokens
                Object.values(demoTokens).forEach(token => {
                    const amount = token.symbol === 'USDT' 
                        ? ethers.parseUnits('1000', 18).toString()
                        : ethers.parseUnits('5000', 18).toString();
                    token.balances[addr] = amount;
                });
                
                result = {
                    bnb: '10',
                    usdt: '1000',
                    och: '5000'
                };
                break;
                
            // Get demo balance breakdown
            case 'demo_getBalances':
                const [targetAddress] = params;
                const targetAddr = targetAddress.toLowerCase();
                
                // Get real balances
                let realBNB = '0';
                try {
                    realBNB = (await realBSCProvider.getBalance(targetAddr)).toString();
                } catch (e) {}
                
                let realUSDT = '0';
                try {
                    const usdtContract = new ethers.Contract(
                        '0x55d398326f99059fF775485246999027B3197955',
                        ['function balanceOf(address) view returns (uint256)'],
                        realBSCProvider
                    );
                    realUSDT = (await usdtContract.balanceOf(targetAddr)).toString();
                } catch (e) {}
                
                result = {
                    real: {
                        bnb: ethers.formatEther(realBNB),
                        usdt: ethers.formatEther(realUSDT)
                    },
                    demo: {
                        bnb: demoBalances[targetAddr] 
                            ? ethers.formatEther(demoBalances[targetAddr])
                            : '0',
                        usdt: demoTokens['0x55d398326f99059ff775485246999027b3197955']?.balances[targetAddr]
                            ? ethers.formatEther(demoTokens['0x55d398326f99059ff775485246999027b3197955'].balances[targetAddr])
                            : '0',
                        och: demoTokens['0x1234567890123456789012345678901234567890']?.balances[targetAddr]
                            ? ethers.formatEther(demoTokens['0x1234567890123456789012345678901234567890'].balances[targetAddr])
                            : '0'
                    }
                };
                break;
                
            default:
                // For unsupported methods, try real BSC
                try {
                    result = await realBSCProvider.send(method, params);
                } catch (error) {
                    throw new Error(`Method ${method} not supported`);
                }
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ jsonrpc, id, result })
        };
        
    } catch (error) {
        console.error('RPC Error:', error);
        
        const { jsonrpc, id } = JSON.parse(event.body);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                jsonrpc,
                id,
                error: {
                    code: -32603,
                    message: error.message
                }
            })
        };
    }
};