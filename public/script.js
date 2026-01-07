// public/script.js - FIXED FOR METAMASK USD DISPLAY
let web3;
let currentAccount = null;
let isDemoNetwork = false;
let currentBNBPrice = 350.50; // Default price

// Netlify RPC for demo functions
const RPC_URL = window.location.origin + '/.netlify/functions/rpc';

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing BSC Demo Network...');
    console.log('Demo RPC:', RPC_URL);
    
    // Update display
    document.getElementById('rpcUrl').textContent = RPC_URL;
    
    // Check wallet
    await checkWalletConnection();
    
    // Set up button listeners
    setupButtonListeners();
});

// Set up all button listeners
function setupButtonListeners() {
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', connectWallet);
    
    // Disconnect button
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);
    
    // Other buttons
    document.querySelectorAll('.btn').forEach(btn => {
        if (btn.textContent.includes('Refresh') || btn.innerHTML.includes('sync-alt')) {
            btn.addEventListener('click', refreshBalances);
        } else if (btn.textContent.includes('Get Demo Tokens') || btn.innerHTML.includes('faucet')) {
            btn.addEventListener('click', getFaucet);
        } else if (btn.textContent.includes('Send Tokens') || btn.innerHTML.includes('paper-plane')) {
            btn.addEventListener('click', sendTokens);
        } else if (btn.textContent.includes('Clear') || btn.innerHTML.includes('times')) {
            btn.addEventListener('click', clearForm);
        }
    });
    
    // Add to wallet buttons
    document.querySelectorAll('[onclick*="addNetworkToWallet"]').forEach(btn => {
        btn.addEventListener('click', addNetworkToWallet);
    });
    document.querySelectorAll('[onclick*="addUSDTToken"]').forEach(btn => {
        btn.addEventListener('click', addUSDTToken);
    });
    
    // Quick actions
    document.querySelectorAll('.action-btn').forEach(btn => {
        if (btn.textContent.includes('Switch to Real BSC')) {
            btn.addEventListener('click', switchToRealBSC);
        } else if (btn.textContent.includes('View on BscScan')) {
            btn.addEventListener('click', viewOnBscScan);
        } else if (btn.textContent.includes('Help')) {
            btn.addEventListener('click', showHelp);
        } else if (btn.textContent.includes('Test RPC')) {
            btn.addEventListener('click', testRPC);
        }
    });
}

// Check wallet connection
async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        console.log('Web3 initialized');
        
        // Check existing connection
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

// Switch to demo network
async function switchToDemoNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        
        if (chainId !== '0x38') { // Not on BSC
            // Try to switch to BSC
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x38' }]
                });
                isDemoNetwork = true;
            } catch (switchError) {
                // If network not added, add it
                if (switchError.code === 4902) {
                    await addNetworkToWallet();
                    isDemoNetwork = true;
                } else {
                    throw switchError;
                }
            }
        } else {
            isDemoNetwork = true;
        }
        
        updateNetworkStatus();
        
    } catch (error) {
        console.error('Network switch error:', error);
        showNotification('Note: Using current network', 'warning');
        isDemoNetwork = false;
        updateNetworkStatus();
    }
}

// Add network to wallet
async function addNetworkToWallet() {
    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: '0x38',
                chainName: 'BSC Demo Network',
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
        isDemoNetwork = true;
        updateNetworkStatus();
        
    } catch (error) {
        console.error('Add network error:', error);
        showNotification('Failed to add network: ' + error.message, 'error');
    }
}

// Switch to real BSC network
async function switchToRealBSC() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }]
        });
        showNotification('Switched to real BSC network', 'success');
    } catch (error) {
        showNotification('Failed to switch network: ' + error.message, 'error');
    }
}

// View on BscScan
function viewOnBscScan() {
    if (currentAccount) {
        window.open(`https://bscscan.com/address/${currentAccount}`, '_blank');
    } else {
        window.open('https://bscscan.com', '_blank');
    }
}

// Update network status
function updateNetworkStatus() {
    const statusEl = document.getElementById('networkStatus');
    
    if (isDemoNetwork) {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: #4CAF50"></i> BSC Demo Network';
    } else {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: #FF9800"></i> Not on BSC Demo';
    }
}

// Load balances from RPC
async function loadBalances() {
    if (!currentAccount) return;
    
    showLoading('Loading balances...');
    
    try {
        // Get demo balances from our RPC
        const demoResponse = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'demo_getBalances',
                params: [currentAccount],
                id: 1
            })
        });
        
        const demoData = await demoResponse.json();
        
        if (demoData.result) {
            currentBNBPrice = demoData.result.prices?.bnb || 350.50;
            displayBalances(demoData.result);
            
            // Update BNB price display
            const bnbPriceEl = document.getElementById('bnbPrice');
            if (bnbPriceEl) {
                bnbPriceEl.textContent = `$${currentBNBPrice.toFixed(2)}`;
            }
        } else {
            throw new Error('No demo balances returned');
        }
        
    } catch (error) {
        console.error('Error loading balances:', error);
        showNotification('Failed to load balances: ' + error.message, 'error');
        
        // Show fallback
        displayBalances({
            balances: { bnb: '0', usdt: '0' },
            prices: { bnb: currentBNBPrice, usdt: 1.00 },
            usdValues: { bnb: '0', usdt: '0', total: '0' }
        });
    } finally {
        hideLoading();
    }
}

// Display balances
function displayBalances(data) {
    const container = document.getElementById('balancesGrid');
    
    if (!container) return;
    
    // Safely get data
    const bnbPrice = data.prices?.bnb || currentBNBPrice;
    const bnbBalance = parseFloat(data.balances?.bnb || 0);
    const usdtBalance = parseFloat(data.balances?.usdt || 0);
    
    // Calculate USD values
    const bnbValue = bnbBalance * bnbPrice;
    const usdtValue = usdtBalance * 1.00;
    const totalValue = bnbValue + usdtValue;
    
    // Update total value display
    const totalValueEl = document.getElementById('totalValue');
    if (totalValueEl) {
        totalValueEl.textContent = `$${totalValue.toFixed(2)}`;
    }
    
    const balanceData = [
        {
            symbol: 'BNB',
            icon: 'fab fa-btc',
            name: 'Binance Coin',
            balance: bnbBalance,
            price: bnbPrice,
            value: bnbValue,
            color: 'bnb'
        },
        {
            symbol: 'USDT',
            icon: 'fas fa-dollar-sign',
            name: 'Tether USD',
            balance: usdtBalance,
            price: 1.00,
            value: usdtValue,
            color: 'usdt'
        }
    ];
    
    container.innerHTML = balanceData.map(token => `
        <div class="balance-item ${token.color}">
            <div class="token-header">
                <div class="token-icon">
                    <i class="${token.icon}"></i>
                </div>
                <div class="token-name">
                    <h3>${token.symbol} <span class="price">$${token.price.toFixed(2)}</span></h3>
                    <div class="token-symbol">${token.name}</div>
                </div>
            </div>
            
            <div class="balance-total">
                ${token.balance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6
                })}
                <div class="value">$${token.value.toFixed(2)}</div>
            </div>
            
            <div class="balance-info">
                <div class="info-row">
                    <span>Price:</span>
                    <span>$${token.price.toFixed(2)}</span>
                </div>
                <div class="info-row">
                    <span>Balance:</span>
                    <span>${token.balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                    })}</span>
                </div>
                <div class="info-row">
                    <span>USD Value:</span>
                    <span class="usd-value">$${token.value.toFixed(2)}</span>
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
                `🎉 ${data.result.message}<br>Total Value: ${data.result.usdValues?.total || '$0.00'}`,
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
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'demo_send',
                params: [currentAccount, recipient, token.toLowerCase(), amount],
                id: 1
            })
        });
        
        const data = await response.json();
        
        if (data.result && data.result.success) {
            const sendResultEl = document.getElementById('sendResult');
            if (sendResultEl) {
                sendResultEl.innerHTML = `
                    <div class="success-result">
                        <i class="fas fa-check-circle"></i>
                        <strong>✅ ${data.result.message}</strong><br>
                        Transaction Hash: ${data.result.transactionHash}<br>
                        <small>USD Value: ${data.result.usdValue || '$0.00'}</small>
                    </div>
                `;
                sendResultEl.style.display = 'block';
            }
            
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
        const sendResultEl = document.getElementById('sendResult');
        if (sendResultEl) {
            sendResultEl.innerHTML = `
                <div class="error-result">
                    <i class="fas fa-times-circle"></i>
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
            sendResultEl.style.display = 'block';
        }
        showNotification('Transaction failed: ' + error.message, 'error');
    } finally {
        hideLoading();
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
                    name: 'Tether USD'
                }
            }
        });
        
        showNotification('USDT token added to wallet!', 'success');
        
    } catch (error) {
        console.error('Add token error:', error);
        showNotification('Failed to add token: ' + error.message, 'error');
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
            showNotification('✅ RPC connection successful! Chain ID: 56', 'success');
        } else {
            showNotification('⚠️ RPC returned: ' + data.result, 'warning');
        }
        
    } catch (error) {
        showNotification('❌ RPC test failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Clear form
function clearForm() {
    const recipientInput = document.getElementById('recipientAddress');
    const amountInput = document.getElementById('sendAmount');
    const resultDiv = document.getElementById('sendResult');
    
    if (recipientInput) recipientInput.value = '';
    if (amountInput) amountInput.value = '';
    if (resultDiv) {
        resultDiv.style.display = 'none';
        resultDiv.innerHTML = '';
    }
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
    alert(`🎮 BSC Demo Network - How It Works

✅ **Real BNB Prices:** Live from Binance API
✅ **USD in MetaMask:** Shows dollar values automatically
✅ **Real Gas Prices:** MetaMask calculates USD fees correctly
✅ **Demo Tokens:** Get free BNB & USDT to test with

**To see USD values in MetaMask:**
1. Connect your wallet
2. Add the "BSC Demo Network" to MetaMask
3. Switch to the demo network
4. Your balance will show USD conversion

**Network Settings:**
• Chain ID: 56 (Same as real BSC)
• RPC URL: ${RPC_URL}
• Gas Price: 3 gwei (realistic for USD calculation)
• BNB Price: Updates every minute from Binance

**Demo Tokens You Get:**
• 5 BNB = ~$${(5 * currentBNBPrice).toFixed(2)} (at current price)
• 500 USDT = $500.00
• Total: ~$${(5 * currentBNBPrice + 500).toFixed(2)}`);
}

// Utility functions
function showLoading(message) {
    const loadingEl = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingEl && loadingText) {
        loadingText.textContent = message;
        loadingEl.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.innerHTML = message;
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
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0) {
            disconnectWallet();
        } else {
            currentAccount = accounts[0];
            updateConnectedUI();
            loadBalances();
        }
    });
    
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
    
    // Clear balances display
    const balancesGrid = document.getElementById('balancesGrid');
    if (balancesGrid) {
        balancesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet"></i>
                <p>Connect wallet to see BNB and USDT balances</p>
            </div>
        `;
    }
    
    // Clear total value
    const totalValueEl = document.getElementById('totalValue');
    if (totalValueEl) {
        totalValueEl.textContent = '$0.00';
    }
    
    // Clear BNB price
    const bnbPriceEl = document.getElementById('bnbPrice');
    if (bnbPriceEl) {
        bnbPriceEl.textContent = '$--.--';
    }
    
    updateNetworkStatus();
    showNotification('Wallet disconnected', 'warning');
}

// Copy RPC URL
function copyRPC() {
    navigator.clipboard.writeText(RPC_URL).then(() => {
        showNotification('RPC URL copied to clipboard!', 'success');
    });
}