// public/script.js - WORKING WITH NETLIFY RPC
let web3;
let currentAccount = null;
let isDemoNetwork = false;

// Get RPC URL - Netlify Functions
const RPC_URL = window.location.origin + '/.netlify/functions/rpc';

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing OffChain RPC Demo...');
    console.log('RPC URL:', RPC_URL);
    
    // Update display
    document.getElementById('rpcUrl').textContent = RPC_URL;
    
    // Check wallet connection
    await checkWalletConnection();
    
    // Test RPC connection
    await testRPCConnection();
});

// Test RPC connection
async function testRPCConnection() {
    try {
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'net_version',
                params: [],
                id: 1
            })
        });
        
        const data = await response.json();
        if (data.result === '56') {
            console.log('✅ RPC connection successful');
            document.getElementById('networkStatus').innerHTML = 
                '<i class="fas fa-circle" style="color: var(--success)"></i> RPC Online';
        } else {
            console.warn('⚠️ RPC returned unexpected result:', data);
        }
    } catch (error) {
        console.error('❌ RPC connection failed:', error);
        document.getElementById('networkStatus').innerHTML = 
            '<i class="fas fa-circle" style="color: var(--danger)"></i> RPC Offline';
    }
}

// Check wallet connection
async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        console.log('Web3 initialized');
        
        // Check if already connected
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                currentAccount = accounts[0];
                updateConnectedUI();
                await switchToDemoNetwork();
                await loadBalances();
            }
        } catch (error) {
            console.log('No existing connection:', error);
        }
        
        // Set up event listeners
        setupEventListeners();
        
    } else {
        showNotification('Please install MetaMask to use this demo', 'warning');
        document.getElementById('connectionStatus').innerHTML = 
            '<i class="fas fa-exclamation-triangle"></i> MetaMask Required';
        document.getElementById('connectBtn').disabled = true;
        document.getElementById('connectBtn').innerHTML = 
            '<i class="fas fa-download"></i> Install MetaMask';
        document.getElementById('connectBtn').onclick = () => {
            window.open('https://metamask.io/download/', '_blank');
        };
    }
}

// Connect wallet
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showNotification('Please install MetaMask first', 'error');
        return;
    }
    
    showLoading('Requesting wallet connection...');
    
    try {
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        currentAccount = accounts[0];
        web3 = new Web3(window.ethereum);
        
        updateConnectedUI();
        await switchToDemoNetwork();
        await loadBalances();
        
        showNotification('Wallet connected successfully!', 'success');
        
    } catch (error) {
        console.error('Connection error:', error);
        
        let errorMessage = error.message;
        if (error.code === 4001) {
            errorMessage = 'Connection rejected. Please approve in MetaMask.';
            alert('⚠️ Please approve the connection in MetaMask!');
        }
        
        showNotification('Connection failed: ' + errorMessage, 'error');
    } finally {
        hideLoading();
    }
}

// Update UI when connected
function updateConnectedUI() {
    document.getElementById('connectionStatus').innerHTML = 
        `<i class="fas fa-check-circle"></i> Connected`;
    document.getElementById('connectionStatus').className = 'status connected';
    document.getElementById('connectBtn').style.display = 'none';
    document.getElementById('disconnectBtn').style.display = 'inline-flex';
}

// Switch to demo network (using custom Chain ID)
async function switchToDemoNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        
        // Use custom Chain ID to avoid conflicts
        const DEMO_CHAIN_ID = '0x13881'; // 80001 - Polygon Mumbai
        
        if (chainId !== DEMO_CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: DEMO_CHAIN_ID }]
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: DEMO_CHAIN_ID,
                            chainName: 'OffChain Demo Network',
                            nativeCurrency: {
                                name: 'Demo BNB',
                                symbol: 'dBNB',
                                decimals: 18
                            },
                            rpcUrls: [RPC_URL],
                            blockExplorerUrls: ['https://mumbai.polygonscan.com/']
                        }]
                    });
                }
            }
        }
        
        isDemoNetwork = true;
        updateNetworkStatus();
        
    } catch (error) {
        console.log('Network switch note:', error.message);
        isDemoNetwork = false;
        updateNetworkStatus();
    }
}

// Update network status
function updateNetworkStatus() {
    const statusEl = document.getElementById('networkStatus');
    
    if (isDemoNetwork) {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--success)"></i> Demo Network';
    } else {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--warning)"></i> Not on Demo';
    }
}

// Load balances from RPC
async function loadBalances() {
    if (!currentAccount) return;
    
    showLoading('Loading balances...');
    
    try {
        console.log('Fetching balances for:', currentAccount);
        
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'demo_getBalances',
                params: [currentAccount],
                id: 1
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Balance response:', data);
        
        if (data.result) {
            displayBalances(data.result);
        } else if (data.error) {
            throw new Error(data.error.message);
        }
        
    } catch (error) {
        console.error('Error loading balances:', error);
        showNotification('Failed to load balances: ' + error.message, 'error');
        
        // Show fallback/empty balances
        displayBalances({
            real: { bnb: '0', usdt: '0' },
            demo: { bnb: '0', usdt: '0', och: '0' }
        });
    } finally {
        hideLoading();
    }
}

// Display balances
function displayBalances(balances) {
    const container = document.getElementById('balancesGrid');
    
    const balanceData = [
        {
            symbol: 'BNB',
            icon: 'bnb',
            name: 'Binance Coin',
            real: balances.real.bnb,
            demo: balances.demo.bnb,
            color: 'bnb'
        },
        {
            symbol: 'USDT',
            icon: 'usdt',
            name: 'Tether USD',
            real: balances.real.usdt,
            demo: balances.demo.usdt,
            color: 'usdt'
        },
        {
            symbol: 'OCH',
            icon: 'och',
            name: 'OffChain Token',
            real: '0',
            demo: balances.demo.och,
            color: 'och'
        }
    ];
    
    container.innerHTML = balanceData.map(token => `
        <div class="balance-item ${token.color}">
            <div class="token-header">
                <div class="token-icon ${token.icon}">
                    <i class="${token.icon === 'bnb' ? 'fab fa-btc' : 
                              token.icon === 'usdt' ? 'fas fa-dollar-sign' : 
                              'fas fa-coins'}"></i>
                </div>
                <div class="token-name">
                    <h3>${token.symbol}</h3>
                    <div class="token-symbol">${token.name}</div>
                </div>
            </div>
            
            <div class="balance-total">
                ${(parseFloat(token.real) + parseFloat(token.demo)).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4
                })}
            </div>
            
            <div class="balance-breakdown">
                <div class="breakdown-item">
                    <span class="breakdown-label">Real Balance:</span>
                    <span class="breakdown-value">${parseFloat(token.real).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4
                    })}</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">Demo Balance:</span>
                    <span class="breakdown-value">${parseFloat(token.demo).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4
                    })}</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">Total:</span>
                    <span class="breakdown-value" style="color: var(--primary); font-weight: bold;">
                        ${(parseFloat(token.real) + parseFloat(token.demo)).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4
                        })}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

// Get faucet tokens
async function getFaucet() {
    if (!currentAccount) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    showLoading('Getting demo tokens...');
    
    try {
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'demo_faucet',
                params: [currentAccount],
                id: 1
            })
        });
        
        const data = await response.json();
        
        if (data.result && data.result.success) {
            showNotification(
                `🎉 ${data.result.message} BNB: ${data.result.balances.bnb}, USDT: ${data.result.balances.usdt}, OCH: ${data.result.balances.och}`,
                'success'
            );
            await loadBalances();
        } else if (data.error) {
            throw new Error(data.error.message);
        }
        
    } catch (error) {
        console.error('Faucet error:', error);
        showNotification('Failed to get demo tokens: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Send tokens
async function sendTokens() {
    const recipient = document.getElementById('recipientAddress').value;
    const amount = document.getElementById('sendAmount').value;
    const token = document.getElementById('tokenSelect').value;
    
    if (!currentAccount) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
        showNotification('Please enter a valid recipient address', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }
    
    showLoading(`Sending ${amount} ${token}...`);
    
    try {
        // Use RPC for demo transaction
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'demo_send',
                params: [currentAccount, recipient, token, amount],
                id: 1
            })
        });
        
        const data = await response.json();
        
        if (data.result && data.result.success) {
            document.getElementById('sendResult').innerHTML = `
                <div style="color: var(--success);">
                    <i class="fas fa-check-circle"></i>
                    <strong>✅ ${data.result.message}</strong><br>
                    Transaction Hash: ${data.result.transactionHash}<br>
                    <small>Gas Used: 0 (Free!)</small>
                </div>
            `;
            document.getElementById('sendResult').style.display = 'block';
            
            showNotification('Demo transaction successful!', 'success');
            
            // Refresh balances
            setTimeout(() => {
                loadBalances();
            }, 1000);
            
        } else if (data.error) {
            throw new Error(data.error.message);
        }
        
    } catch (error) {
        console.error('Send error:', error);
        document.getElementById('sendResult').innerHTML = `
            <div style="color: var(--danger);">
                <i class="fas fa-times-circle"></i>
                <strong>Error:</strong> ${error.message}
            </div>
        `;
        document.getElementById('sendResult').style.display = 'block';
        showNotification('Transaction failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Utility functions
function showLoading(message) {
    document.getElementById('loadingText').textContent = message;
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification ' + type;
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Set up event listeners
function setupEventListeners() {
    if (!window.ethereum) return;
    
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            disconnectWallet();
        } else {
            currentAccount = accounts[0];
            loadBalances();
        }
    });
    
    window.ethereum.on('chainChanged', () => {
        window.location.reload();
    });
}

// Disconnect wallet
function disconnectWallet() {
    currentAccount = null;
    
    document.getElementById('connectionStatus').innerHTML = 
        '<i class="fas fa-plug"></i> Disconnected';
    document.getElementById('connectionStatus').className = 'status disconnected';
    document.getElementById('connectBtn').style.display = 'inline-flex';
    document.getElementById('disconnectBtn').style.display = 'none';
    
    document.getElementById('balancesGrid').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-wallet"></i>
            <p>Connect wallet to see balances</p>
        </div>
    `;
    
    showNotification('Wallet disconnected', 'warning');
}

// Set up button listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('connectBtn').addEventListener('click', connectWallet);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);
    
    // Other buttons
    document.querySelector('[onclick="getFaucet()"]').addEventListener('click', getFaucet);
    document.querySelector('[onclick="sendTokens()"]').addEventListener('click', sendTokens);
    document.querySelector('[onclick="clearForm()"]').addEventListener('click', clearForm);
    document.querySelector('[onclick="refreshBalances()"]').addEventListener('click', refreshBalances);
    document.querySelector('[onclick="testRPC()"]').addEventListener('click', testRPC);
    document.querySelector('[onclick="showHelp()"]').addEventListener('click', showHelp);
});

// Other functions
function clearForm() {
    document.getElementById('recipientAddress').value = '';
    document.getElementById('sendAmount').value = '';
    document.getElementById('sendResult').style.display = 'none';
}

function refreshBalances() {
    if (currentAccount) {
        loadBalances();
    } else {
        showNotification('Please connect wallet first', 'warning');
    }
}

async function testRPC() {
    showLoading('Testing RPC...');
    await testRPCConnection();
    hideLoading();
}

function showHelp() {
    alert(`🎮 OffChain RPC Demo Help
    
✅ **Netlify RPC Backend** - Data persists
✅ **Demo Network** - Custom Chain ID 80001
✅ **Real + Demo Balances**
✅ **Persistent storage** (not just localStorage)

**Features:**
1. Connect wallet
2. Switch to demo network (optional)
3. Get demo tokens from faucet
4. Send demo transactions
5. Balances stored on Netlify

**Note:** Data resets after 24 hours (Netlify Functions limitation)`);
}