// script.js
let web3;
let currentAccount = null;
let currentNetwork = null;
let isDemoNetwork = false;

// RPC URL - Will be auto-detected
let RPC_URL = window.location.origin + '/rpc';

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing OffChain RPC Demo...');
    
    // Set RPC URL
    document.getElementById('rpcUrl').textContent = RPC_URL;
    
    // Check MetaMask
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        console.log('Web3 initialized');
        
        // Try to auto-connect
        const accounts = await web3.eth.getAccounts();
        if (accounts.length > 0) {
            await connectWallet();
        }
    } else {
        showNotification('Please install MetaMask to use this demo', 'warning');
        document.getElementById('connectionStatus').innerHTML = 
            '<i class="fas fa-exclamation-triangle"></i> MetaMask Required';
    }
    
    // Update network status
    updateNetworkStatus();
});

// Connect wallet
async function connectWallet() {
    try {
        showLoading('Connecting wallet...');
        
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        currentAccount = accounts[0];
        
        // Update UI
        document.getElementById('connectionStatus').innerHTML = 
            `<i class="fas fa-check-circle"></i> Connected`;
        document.getElementById('connectionStatus').className = 'status connected';
        document.getElementById('connectBtn').style.display = 'none';
        document.getElementById('disconnectBtn').style.display = 'inline-flex';
        
        // Switch to demo network
        await switchToDemoNetwork();
        
        // Load balances
        await loadBalances();
        
        showNotification('Wallet connected successfully!', 'success');
        
        // Set up listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Connection error:', error);
        showNotification('Failed to connect wallet: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Disconnect wallet
function disconnectWallet() {
    currentAccount = null;
    
    document.getElementById('connectionStatus').innerHTML = 
        '<i class="fas fa-plug"></i> Disconnected';
    document.getElementById('connectionStatus').className = 'status disconnected';
    document.getElementById('connectBtn').style.display = 'inline-flex';
    document.getElementById('disconnectBtn').style.display = 'none';
    
    // Clear balances
    document.getElementById('balancesGrid').innerHTML = '';
    
    showNotification('Wallet disconnected', 'warning');
}

// Switch to demo network
async function switchToDemoNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        
        if (chainId !== '0x38') { // Not on our network
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
                    blockExplorerUrls: []
                }]
            });
        }
        
        isDemoNetwork = true;
        updateNetworkStatus();
        
    } catch (error) {
        console.error('Network switch error:', error);
        showNotification('Could not switch to demo network', 'warning');
    }
}

// Update network status
function updateNetworkStatus() {
    const statusEl = document.getElementById('networkStatus');
    
    if (isDemoNetwork) {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--success)"></i> Connected to Demo Network';
        statusEl.className = 'value status-indicator';
    } else {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--warning)"></i> Not on Demo Network';
        statusEl.className = 'value status-indicator';
    }
}

// Load balances
async function loadBalances() {
    if (!currentAccount) return;
    
    showLoading('Loading balances...');
    
    try {
        // Get balance breakdown from our RPC
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
        
        const data = await response.json();
        
        if (data.result) {
            displayBalances(data.result);
        }
        
    } catch (error) {
        console.error('Error loading balances:', error);
        showNotification('Failed to load balances', 'error');
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
            real: '0', // OCH is demo-only
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
                `Received demo tokens! BNB: ${data.result.bnb}, USDT: ${data.result.usdt}, OCH: ${data.result.och}`,
                'success'
            );
            await loadBalances();
        }
        
    } catch (error) {
        console.error('Faucet error:', error);
        showNotification('Failed to get demo tokens', 'error');
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
    
    if (!recipient || !amount || amount <= 0) {
        showNotification('Please fill all fields correctly', 'error');
        return;
    }
    
    showLoading(`Sending ${amount} ${token}...`);
    
    try {
        // For demo, we'll simulate a transaction
        const txHash = '0x' + Math.random().toString(16).substr(2, 64);
        
        // Show success
        document.getElementById('sendResult').innerHTML = `
            <div style="color: var(--success);">
                <i class="fas fa-check-circle"></i>
                <strong>Demo Transaction Successful!</strong><br>
                Sent ${amount} ${token} to ${recipient.substring(0, 10)}...<br>
                Transaction Hash: ${txHash.substring(0, 20)}...<br>
                <small>Gas Used: 0 (Free!)</small>
            </div>
        `;
        document.getElementById('sendResult').style.display = 'block';
        
        showNotification(`Demo transaction sent successfully!`, 'success');
        
        // Refresh balances
        setTimeout(() => {
            loadBalances();
        }, 2000);
        
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
                blockExplorerUrls: []
            }]
        });
        
        showNotification('Demo network added to wallet!', 'success');
        
    } catch (error) {
        console.error('Add network error:', error);
        showNotification('Failed to add network: ' + error.message, 'error');
    }
}

// Add USDT token to wallet
async function addUSDTToken() {
    try {
        await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: '0x55d398326f99059fF775485246999027B3197955',
                    symbol: 'USDT',
                    decimals: 18,
                    name: 'Tether USD',
                    image: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
                }
            }
        });
        
        showNotification('USDT token added to wallet!', 'success');
        
    } catch (error) {
        console.error('Add token error:', error);
        showNotification('Failed to add token: ' + error.message, 'error');
    }
}

// Add OCH token to wallet
async function addOCHToken() {
    try {
        await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: '0x1234567890123456789012345678901234567890',
                    symbol: 'OCH',
                    decimals: 18,
                    name: 'OffChain Token',
                    image: 'https://via.placeholder.com/32/3a86ff/ffffff?text=OCH'
                }
            }
        });
        
        showNotification('OCH token added to wallet!', 'success');
        
    } catch (error) {
        console.error('Add token error:', error);
        showNotification('Failed to add token: ' + error.message, 'error');
    }
}

// Switch to real BSC
async function switchToRealBSC() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }] // Real BSC
        });
        
        showNotification('Switched to real BSC network', 'info');
        isDemoNetwork = false;
        updateNetworkStatus();
        
    } catch (error) {
        console.error('Switch error:', error);
        showNotification('Failed to switch network', 'error');
    }
}

// View on BscScan
function viewOnBscScan() {
    if (currentAccount) {
        window.open(`https://bscscan.com/address/${currentAccount}`, '_blank');
    } else {
        showNotification('Please connect wallet first', 'warning');
    }
}

// Test RPC connection
async function testRPC() {
    showLoading('Testing RPC connection...');
    
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
            showNotification('RPC connection successful! Chain ID: 56', 'success');
        } else {
            showNotification('RPC returned unexpected result', 'warning');
        }
        
    } catch (error) {
        showNotification('RPC test failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Clear form
function clearForm() {
    document.getElementById('recipientAddress').value = '';
    document.getElementById('sendAmount').value = '';
    document.getElementById('sendResult').style.display = 'none';
}

// Refresh balances
function refreshBalances() {
    if (currentAccount) {
        loadBalances();
    } else {
        showNotification('Please connect wallet first', 'warning');
    }
}

// Show help
function showHelp() {
    alert(`🎮 OffChain RPC Demo Help:
    
1. **Connect Wallet** - Connect your MetaMask/Trust Wallet
2. **Switch Network** - Auto-switches to demo network
3. **Get Demo Tokens** - Click faucet button for free demo tokens
4. **See Combined Balances** - View Real + Demo balances
5. **Send Tokens** - Try demo transactions with zero gas
6. **Add to Wallet** - Add demo network and tokens to wallet

⚠️ **Important Notes:**
- Demo tokens exist only on this network
- Real balances are fetched from BSC
- Transactions are simulated (no real transfers)
- Zero gas fees for all transactions

Enjoy testing! 🚀`);
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
    
    window.ethereum.on('chainChanged', (chainId) => {
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
}

// Set up disconnect button
document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);