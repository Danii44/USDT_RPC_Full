// public/script.js - COMPLETE FRONTEND SOLUTION
let web3;
let currentAccount = null;
let isDemoNetwork = false;

// Demo balances stored in localStorage
const demoBalances = {
    bnb: '0',
    usdt: '0',
    och: '0'
};

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing OffChain RPC Demo...');
    
    // Load demo balances from localStorage
    loadDemoBalancesFromStorage();
    
    // Set RPC URL (we don't need a backend!)
    document.getElementById('rpcUrl').textContent = 'Frontend Only - No RPC Required';
    
    // Check wallet connection
    await checkWalletConnection();
    
    // Update UI
    updateNetworkStatus();
});

// Load demo balances from localStorage
function loadDemoBalancesFromStorage() {
    const saved = localStorage.getItem('demoBalances');
    if (saved) {
        Object.assign(demoBalances, JSON.parse(saved));
    }
}

// Save demo balances to localStorage
function saveDemoBalancesToStorage() {
    localStorage.setItem('demoBalances', JSON.stringify(demoBalances));
}

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
        window.open('https://metamask.io/download/', '_blank');
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
            alert('⚠️ Please approve the connection in MetaMask popup!');
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
        
        if (chainId !== '0x38') {
            // Create a fake RPC URL that doesn't actually exist
            // MetaMask will show it as a custom network but won't validate
            const fakeRPC = window.location.origin + '/api/rpc'; // This doesn't need to exist
            
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
                    rpcUrls: [fakeRPC],
                    blockExplorerUrls: ['https://bscscan.com']
                }]
            });
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
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--warning)"></i> Real Network';
    }
}

// Load balances - FRONTEND ONLY VERSION
async function loadBalances() {
    if (!currentAccount) return;
    
    showLoading('Loading balances...');
    
    try {
        // Get real BNB balance
        let realBNB = '0';
        let realUSDT = '0';
        
        try {
            // Use public BSC RPC directly from frontend
            const bscWeb3 = new Web3('https://bsc-dataseed.binance.org/');
            realBNB = await bscWeb3.eth.getBalance(currentAccount);
            realBNB = web3.utils.fromWei(realBNB, 'ether');
            
            // Try to get USDT balance
            try {
                const usdtContract = new bscWeb3.eth.Contract(
                    [{
                        constant: true,
                        inputs: [{ name: '_owner', type: 'address' }],
                        name: 'balanceOf',
                        outputs: [{ name: 'balance', type: 'uint256' }],
                        type: 'function'
                    }],
                    '0x55d398326f99059fF775485246999027B3197955'
                );
                const usdtBalance = await usdtContract.methods.balanceOf(currentAccount).call();
                realUSDT = web3.utils.fromWei(usdtBalance, 'ether');
            } catch (usdtError) {
                console.log('USDT balance error:', usdtError.message);
            }
        } catch (bscError) {
            console.log('BSC RPC error:', bscError.message);
        }
        
        // Display combined balances
        displayBalances({
            real: {
                bnb: realBNB,
                usdt: realUSDT
            },
            demo: {
                bnb: demoBalances.bnb,
                usdt: demoBalances.usdt,
                och: demoBalances.och
            }
        });
        
    } catch (error) {
        console.error('Error loading balances:', error);
        
        // Show demo balances only
        displayBalances({
            real: { bnb: '0', usdt: '0' },
            demo: demoBalances
        });
        
        showNotification('Showing demo balances only', 'warning');
    } finally {
        hideLoading();
    }
}

// Display balances (same function, works with our data)
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

// Get faucet tokens - FRONTEND ONLY
async function getFaucet() {
    if (!currentAccount) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    // Update demo balances
    demoBalances.bnb = '10';
    demoBalances.usdt = '1000';
    demoBalances.och = '5000';
    
    // Save to localStorage
    saveDemoBalancesToStorage();
    
    // Update display
    await loadBalances();
    
    showNotification(
        `🎉 Received demo tokens! BNB: 10, USDT: 1000, OCH: 5000`,
        'success'
    );
}

// Send tokens - FRONTEND ONLY
async function sendTokens() {
    const recipient = document.getElementById('recipientAddress').value;
    const amount = parseFloat(document.getElementById('sendAmount').value);
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
        // Check if user has enough demo balance
        const tokenKey = token.toLowerCase();
        const currentBalance = parseFloat(demoBalances[tokenKey] || '0');
        
        if (currentBalance < amount) {
            throw new Error(`Insufficient demo ${token} balance`);
        }
        
        // Deduct from sender's demo balance
        demoBalances[tokenKey] = (currentBalance - amount).toString();
        
        // Save to localStorage
        saveDemoBalancesToStorage();
        
        // Show success
        const txHash = '0x' + Math.random().toString(16).substr(2, 64);
        
        document.getElementById('sendResult').innerHTML = `
            <div style="color: var(--success);">
                <i class="fas fa-check-circle"></i>
                <strong>✅ Demo Transaction Successful!</strong><br>
                Sent ${amount} ${token} to ${recipient.substring(0, 10)}...<br>
                Transaction Hash: ${txHash}<br>
                <small>Note: This is a demo transaction only</small>
            </div>
        `;
        document.getElementById('sendResult').style.display = 'block';
        
        showNotification(`Demo transaction sent!`, 'success');
        
        // Refresh balances
        await loadBalances();
        
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
        // Create a simple network config
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
                rpcUrls: ['https://bsc-dataseed.binance.org/'], // Use real BSC RPC
                blockExplorerUrls: ['https://bscscan.com']
            }]
        });
        
        showNotification('Demo network added to wallet!', 'success');
        
    } catch (error) {
        console.error('Add network error:', error);
        showNotification('Note: ' + error.message, 'warning');
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
                    name: 'OffChain Token'
                }
            }
        });
        
        showNotification('OCH token added to wallet!', 'success');
        
    } catch (error) {
        console.error('Add token error:', error);
        showNotification('Failed to add token: ' + error.message, 'error');
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
        // Reload page on network change
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
    
    // Clear balances display
    document.getElementById('balancesGrid').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-wallet"></i>
            <p>Connect wallet to see balances</p>
        </div>
    `;
    
    showNotification('Wallet disconnected', 'warning');
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

// Test RPC - Modified for frontend
async function testRPC() {
    showLoading('Testing connection...');
    
    try {
        const bscWeb3 = new Web3('https://bsc-dataseed.binance.org/');
        const blockNumber = await bscWeb3.eth.getBlockNumber();
        
        showNotification(`Connected to BSC! Block: ${blockNumber}`, 'success');
    } catch (error) {
        showNotification('BSC connection failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Set up button listeners
document.addEventListener('DOMContentLoaded', function() {
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', connectWallet);
    
    // Disconnect button
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);
    
    // Other buttons
    document.querySelector('[onclick="getFaucet()"]').addEventListener('click', getFaucet);
    document.querySelector('[onclick="sendTokens()"]').addEventListener('click', sendTokens);
    document.querySelector('[onclick="addNetworkToWallet()"]').addEventListener('click', addNetworkToWallet);
    document.querySelector('[onclick="addUSDTToken()"]').addEventListener('click', addUSDTToken);
    document.querySelector('[onclick="addOCHToken()"]').addEventListener('click', addOCHToken);
    document.querySelector('[onclick="clearForm()"]').addEventListener('click', clearForm);
    document.querySelector('[onclick="refreshBalances()"]').addEventListener('click', refreshBalances);
    document.querySelector('[onclick="testRPC()"]').addEventListener('click', testRPC);
    document.querySelector('[onclick="showHelp()"]').addEventListener('click', showHelp);
});

// Show help
function showHelp() {
    alert(`🎮 OffChain Demo Help:
    
✅ **NO RPC SERVER NEEDED!**
✅ **Everything works in browser**

**Features:**
1. Connect wallet (MetaMask/Trust Wallet)
2. See Real BNB/USDT balances from BSC
3. Get Demo tokens (stored in browser)
4. Send Demo transactions (frontend only)
5. Add Demo network to wallet

**How it works:**
- Real balances: Fetched directly from BSC RPC
- Demo balances: Stored in your browser (localStorage)
- Transactions: Simulated in frontend only

**No server = No 502 errors!** 🎉`);
}