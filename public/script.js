// public/script.js - UPDATED VERSION
let web3;
let currentAccount = null;
let currentNetwork = null;
let isDemoNetwork = false;

// Get the correct RPC URL based on environment
const getRPCUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8888/.netlify/functions/rpc';
    }
    return window.location.origin + '/.netlify/functions/rpc';
};

const RPC_URL = getRPCUrl();

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing OffChain RPC Demo...');
    console.log('RPC URL:', RPC_URL);
    
    // Set RPC URL
    document.getElementById('rpcUrl').textContent = RPC_URL;
    
    // Check for wallet
    await checkWalletConnection();
    
    // Update network status
    updateNetworkStatus();
    
    // Add click listener to connect button
    document.getElementById('connectBtn').addEventListener('click', connectWallet);
});

// Check wallet connection
async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        console.log('Web3 initialized with MetaMask');
        
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
        console.log('MetaMask not detected');
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

// Connect wallet - SIMPLIFIED VERSION
async function connectWallet() {
    console.log('Connect button clicked');
    
    if (typeof window.ethereum === 'undefined') {
        showNotification('Please install MetaMask first', 'error');
        window.open('https://metamask.io/download/', '_blank');
        return;
    }
    
    showLoading('Requesting wallet connection...');
    
    try {
        // Request accounts
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        console.log('Accounts received:', accounts);
        
        if (accounts.length === 0) {
            throw new Error('No accounts found');
        }
        
        currentAccount = accounts[0];
        web3 = new Web3(window.ethereum);
        
        updateConnectedUI();
        
        // Switch to demo network
        await switchToDemoNetwork();
        
        // Load balances
        await loadBalances();
        
        showNotification('Wallet connected successfully!', 'success');
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        
        let errorMessage = error.message;
        
        // Handle specific error codes
        if (error.code === 4001) {
            errorMessage = 'Connection rejected by user. Please approve the connection in MetaMask.';
        } else if (error.code === -32002) {
            errorMessage = 'MetaMask is already processing a request. Please check MetaMask.';
        }
        
        showNotification('Connection failed: ' + errorMessage, 'error');
        
        // If user rejected, show helpful message
        if (error.code === 4001) {
            alert('⚠️ Connection Rejected\n\n' +
                  'You need to approve the connection in MetaMask to continue.\n\n' +
                  '1. Look for the MetaMask popup\n' +
                  '2. Click "Connect"\n' +
                  '3. Or check the MetaMask extension icon');
        }
        
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

// Switch to demo network
async function switchToDemoNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        console.log('Current chain ID:', chainId);
        
        if (chainId !== '0x38') {
            console.log('Switching to demo network...');
            
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x38' }]
                });
            } catch (switchError) {
                // If network not added, add it
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x38',
                            chainName: 'OffChain Demo Network',
                            nativeCurrency: {
                                name: 'BNB',
                                symbol: 'BNB',
                                decimals: 18
                            },
                            rpcUrls: [RPC_URL],
                            blockExplorerUrls: ['https://bscscan.com']
                        }]
                    });
                } else {
                    throw switchError;
                }
            }
        }
        
        isDemoNetwork = true;
        updateNetworkStatus();
        
    } catch (error) {
        console.error('Network switch error:', error);
        showNotification('Note: Using current network (not demo)', 'warning');
        isDemoNetwork = false;
        updateNetworkStatus();
    }
}

// Update network status
function updateNetworkStatus() {
    const statusEl = document.getElementById('networkStatus');
    
    if (isDemoNetwork) {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--success)"></i> Connected to Demo Network';
    } else {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--warning)"></i> Not on Demo Network';
    }
}

// Load balances
async function loadBalances() {
    if (!currentAccount) {
        console.log('No account to load balances for');
        return;
    }
    
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
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Balance data:', data);
        
        if (data.result) {
            displayBalances(data.result);
        } else if (data.error) {
            throw new Error(data.error.message);
        }
        
    } catch (error) {
        console.error('Error loading balances:', error);
        showNotification('Failed to load balances: ' + error.message, 'error');
        
        // Show fallback balances
        displayBalances({
            real: { bnb: '0', usdt: '0' },
            demo: { bnb: '0', usdt: '0', och: '0' }
        });
    } finally {
        hideLoading();
    }
}

// Display balances (same as before)
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
        
        if (data.result) {
            showNotification(
                `🎉 Received demo tokens! BNB: ${data.result.bnb}, USDT: ${data.result.usdt}, OCH: ${data.result.och}`,
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
        // For demo, simulate transaction
        const txHash = '0x' + Math.random().toString(16).substr(2, 64);
        
        document.getElementById('sendResult').innerHTML = `
            <div style="color: var(--success);">
                <i class="fas fa-check-circle"></i>
                <strong>✅ Demo Transaction Successful!</strong><br>
                Sent ${amount} ${token} to ${recipient.substring(0, 10)}...<br>
                Transaction Hash: ${txHash}<br>
                <small>Gas Used: 0 (Free!)</small>
            </div>
        `;
        document.getElementById('sendResult').style.display = 'block';
        
        showNotification(`Demo transaction sent successfully!`, 'success');
        
        // Refresh balances
        setTimeout(() => {
            loadBalances();
        }, 1000);
        
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

// Add network to wallet
async function addNetworkToWallet() {
    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: '0x38',
                chainName: 'OffChain Demo Network',
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18
                },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ['https://bscscan.com']
            }]
        });
        
        showNotification('Demo network added to wallet!', 'success');
        
    } catch (error) {
        console.error('Add network error:', error);
        showNotification('Failed to add network: ' + error.message, 'error');
    }
}

// Set up event listeners
function setupEventListeners() {
    if (!window.ethereum) return;
    
    // Handle account changes
    window.ethereum.on('accountsChanged', (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0) {
            disconnectWallet();
        } else {
            currentAccount = accounts[0];
            loadBalances();
        }
    });
    
    // Handle chain changes
    window.ethereum.on('chainChanged', (chainId) => {
        console.log('Chain changed to:', chainId);
        if (chainId === '0x38') {
            isDemoNetwork = true;
        } else {
            isDemoNetwork = false;
        }
        updateNetworkStatus();
        
        if (currentAccount) {
            loadBalances();
        }
    });
    
    // Handle disconnect
    window.ethereum.on('disconnect', (error) => {
        console.log('Wallet disconnected:', error);
        disconnectWallet();
    });
}

// Disconnect wallet
function disconnectWallet() {
    currentAccount = null;
    isDemoNetwork = false;
    
    document.getElementById('connectionStatus').innerHTML = 
        '<i class="fas fa-plug"></i> Disconnected';
    document.getElementById('connectionStatus').className = 'status disconnected';
    document.getElementById('connectBtn').style.display = 'inline-flex';
    document.getElementById('disconnectBtn').style.display = 'none';
    
    // Clear balances
    document.getElementById('balancesGrid').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-wallet"></i>
            <p>Connect wallet to see balances</p>
        </div>
    `;
    
    updateNetworkStatus();
    showNotification('Wallet disconnected', 'warning');
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

function copyRPC() {
    navigator.clipboard.writeText(RPC_URL).then(() => {
        showNotification('RPC URL copied to clipboard!', 'success');
    });
}

// Other functions remain the same as before...
// (clearForm, refreshBalances, testRPC, showHelp, etc.)

// Set up disconnect button
document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);

// Set up other button listeners
document.getElementById('connectBtn').addEventListener('click', connectWallet);
document.querySelector('[onclick="getFaucet()"]').addEventListener('click', getFaucet);
document.querySelector('[onclick="sendTokens()"]').addEventListener('click', sendTokens);
document.querySelector('[onclick="addNetworkToWallet()"]').addEventListener('click', addNetworkToWallet);
document.querySelector('[onclick="clearForm()"]').addEventListener('click', clearForm);
document.querySelector('[onclick="refreshBalances()"]').addEventListener('click', refreshBalances);
document.querySelector('[onclick="testRPC()"]').addEventListener('click', testRPC);
document.querySelector('[onclick="showHelp()"]').addEventListener('click', showHelp);