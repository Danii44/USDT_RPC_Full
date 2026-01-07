// netlify/functions/rpc.js
const { ethers } = require('ethers');

// Initialize providers with timeout
const realBSCProvider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/', {
    timeout: 5000,
    staticNetwork: true
});

// In-memory storage
let demoBalances = {};
let demoTokens = {};
let fakeBlockchain = {
    blockNumber: 12345678,
    transactions: {}
};

// Initialize demo data
function initDemoData() {
    demoBalances = {};
    
    demoTokens = {
        '0x55d398326f99059ff775485246999027b3197955': {
            name: 'Tether USD',
            symbol: 'USDT',
            decimals: 18,
            totalSupply: ethers.parseUnits('1000000', 18).toString(),
            balances: {}
        },
        '0x1234567890123456789012345678901234567890': {
            name: 'OffChain Token',
            symbol: 'OCH',
            decimals: 18,
            totalSupply: ethers.parseUnits('1000000', 18).toString(),
            balances: {}
        }
    };
}

// Get combined balance
async function getCombinedBalance(address) {
    try {
        let realBalance = 0n;
        try {
            realBalance = await realBSCProvider.getBalance(address);
        } catch (e) {
            console.log('Could not fetch real BNB:', e.message);
        }

        let demoBalance = 0n;
        if (demoBalances[address.toLowerCase()]) {
            demoBalance = BigInt(demoBalances[address.toLowerCase()]);
        }

        const combined = realBalance + demoBalance;
        return '0x' + combined.toString(16);
    } catch (error) {
        console.error('Error in getCombinedBalance:', error);
        return '0x0';
    }
}

// Handle token calls
function handleTokenCall(contractAddress, data) {
    const token = demoTokens[contractAddress.toLowerCase()];
    if (!token) return '0x';

    const functionSig = data.substring(0, 10);
    
    switch(functionSig) {
        case '0x70a08231': // balanceOf
            const address = '0x' + data.substring(34);
            const balance = token.balances[address.toLowerCase()] || 0n;
            return '0x' + balance.toString(16).padStart(64, '0');
            
        case '0x06fdde03': // name
            return encodeString(token.name);
            
        case '0x95d89b41': // symbol
            return encodeString(token.symbol);
            
        case '0x313ce567': // decimals
            return '0x' + token.decimals.toString(16).padStart(64, '0');
            
        case '0x18160ddd': // totalSupply
            return '0x' + BigInt(token.totalSupply).toString(16).padStart(64, '0');
            
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

// Main handler
exports.handler = async function(event, context) {
    // Initialize demo data
    if (Object.keys(demoBalances).length === 0) {
        initDemoData();
    }
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
        const body = JSON.parse(event.body);
        const { jsonrpc, id, method, params } = body;
        
        console.log('RPC Call:', method);
        
        let result;
        
        switch(method) {
            case 'net_version':
                result = '56';
                break;
                
            case 'eth_chainId':
                result = '0x38';
                break;
                
            case 'eth_gasPrice':
                result = '0x0';
                break;
                
            case 'eth_blockNumber':
                fakeBlockchain.blockNumber++;
                result = '0x' + fakeBlockchain.blockNumber.toString(16);
                break;
                
            case 'eth_getBalance':
                const [address] = params || [];
                if (!address) throw new Error('Address required');
                result = await getCombinedBalance(address);
                break;
                
            case 'eth_call':
                const [txObj] = params || [];
                if (txObj && txObj.to && txObj.data) {
                    result = handleTokenCall(txObj.to, txObj.data);
                } else {
                    result = '0x';
                }
                break;
                
            case 'eth_sendTransaction':
                const tx = params[0];
                const txHash = '0x' + Math.random().toString(16).substr(2, 64);
                
                fakeBlockchain.transactions[txHash] = {
                    hash: txHash,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value || '0x0',
                    status: '0x1'
                };
                
                result = txHash;
                break;
                
            case 'eth_getTransactionReceipt':
                const [hash] = params || [];
                result = fakeBlockchain.transactions[hash] || null;
                break;
                
            case 'eth_accounts':
                result = [];
                break;
                
            case 'eth_getTransactionCount':
                result = '0x0';
                break;
                
            case 'demo_faucet':
                const [faucetAddress] = params || [];
                if (!faucetAddress) throw new Error('Address required');
                
                const addr = faucetAddress.toLowerCase();
                
                // Give demo BNB (10 BNB)
                demoBalances[addr] = ethers.parseUnits('10', 18).toString();
                
                // Give demo tokens
                Object.values(demoTokens).forEach(token => {
                    const amount = token.symbol === 'USDT' 
                        ? ethers.parseUnits('1000', 18).toString()
                        : ethers.parseUnits('5000', 18).toString();
                    token.balances[addr] = amount;
                });
                
                result = {
                    success: true,
                    bnb: '10',
                    usdt: '1000',
                    och: '5000'
                };
                break;
                
            case 'demo_getBalances':
                const [targetAddress] = params || [];
                if (!targetAddress) throw new Error('Address required');
                
                const targetAddr = targetAddress.toLowerCase();
                
                // Get real balances
                let realBNB = '0';
                let realUSDT = '0';
                
                try {
                    realBNB = (await realBSCProvider.getBalance(targetAddr)).toString();
                    
                    // Try to get USDT balance
                    const usdtContract = new ethers.Contract(
                        '0x55d398326f99059fF775485246999027B3197955',
                        ['function balanceOf(address) view returns (uint256)'],
                        realBSCProvider
                    );
                    realUSDT = (await usdtContract.balanceOf(targetAddr)).toString();
                } catch (e) {
                    console.log('Error fetching real balances:', e.message);
                }
                
                result = {
                    real: {
                        bnb: ethers.formatEther(realBNB || '0'),
                        usdt: ethers.formatEther(realUSDT || '0')
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
                // Try real BSC for other methods
                try {
                    result = await realBSCProvider.send(method, params || []);
                } catch (error) {
                    console.error('Method not supported:', method, error);
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
        
        // Try to parse request for error response
        let jsonrpc = '2.0';
        let id = 1;
        
        try {
            const body = JSON.parse(event.body);
            jsonrpc = body.jsonrpc || '2.0';
            id = body.id || 1;
        } catch (e) {
            // Ignore parsing errors
        }
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                jsonrpc,
                id,
                error: {
                    code: -32603,
                    message: error.message || 'Internal server error'
                }
            })
        };
    }
};