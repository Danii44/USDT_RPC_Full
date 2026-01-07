// public/script.js - COMPLETE WORKING VERSION
let web3;
let currentAccount = null;
let isDemoNetwork = false;

// Real BSC RPC for fetching actual balances
const REAL_BSC_RPC = 'https://bsc-dataseed.binance.org/';
const realWeb3 = new Web3(REAL_BSC_RPC);

// Netlify RPC for demo functions
const RPC_URL = window.location.origin + '/.netlify/functions/rpc';

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing OffChain RPC Demo...');
    console.log('Demo RPC:', RPC_URL);
    console.log('Real BSC RPC:', REAL_BSC_RPC);
    
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
    document.querySelector('[onclick="getFaucet()"]').addEventListener('click', getFaucet);
    document.querySelector('[onclick="sendTokens()"]').addEventListener('click', sendTokens);
    document.querySelector('[onclick="clearForm()"]').addEventListener('click', clearForm);
    document.querySelector('[onclick="refreshBalances()"]').addEventListener('click', refreshBalances);
    document.querySelector('[onclick="testRPC()"]').addEventListener('click', testRPC);
    document.querySelector('[onclick="showHelp()"]').addEventListener('click', showHelp);
    document.querySelector('[onclick="addNetworkToWallet()"]').addEventListener('click', addNetworkToWallet);
    document.querySelector('[onclick="addUSDTToken()"]').addEventListener('click', addUSDTToken);
    document.querySelector('[onclick="addOCHToken()"]').addEventListener('click', addOCHToken);
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

// Update UI when connected - ADDED THIS FUNCTION
function updateConnectedUI() {
    document.getElementById('connectionStatus').innerHTML = 
        `<i class="fas fa-check-circle"></i> Connected`;
    document.getElementById('connectionStatus').className = 'status connected';
    document.getElementById('connectBtn').style.display = 'none';
    document.getElementById('disconnectBtn').style.display = 'inline-flex';
    
    // Show wallet info if exists
    const walletInfo = document.getElementById('walletInfo');
    if (walletInfo) {
        walletInfo.style.display = 'block';
        const addressEl = document.getElementById('walletAddress');
        if (addressEl && currentAccount) {
            addressEl.textContent = formatAddress(currentAccount);
        }
    }
}

// Format address for display
function formatAddress(address) {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

// Switch to demo network (Chain ID 56 - BSC)
async function switchToDemoNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        
        if (chainId !== '0x38') { // Not on BSC
            // First try to switch to BSC
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x38' }]
                });
            } catch (switchError) {
                // If network not added, add it with our RPC
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x38',
                            chainName: 'BSC with Demo Tokens',
                            nativeCurrency: {
                                name: 'BNB',
                                symbol: 'BNB',
                                decimals: 18
                            },
                            rpcUrls: [RPC_URL], // Use our demo RPC
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
        showNotification('Note: Using current network', 'warning');
        isDemoNetwork = false;
        updateNetworkStatus();
    }
}

// Update network status
function updateNetworkStatus() {
    const statusEl = document.getElementById('networkStatus');
    
    if (isDemoNetwork) {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--success)"></i> BSC with Demo Tokens';
    } else {
        statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--warning)"></i> Not on BSC';
    }
}

// Load balances - Fetch real + demo
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
        
        if (!demoData.result) {
            throw new Error('No demo balances returned');
        }
        
        // Get real balances from BSC
        let realBNB = '0';
        let realUSDT = '0';
        
        try {
            // Get real BNB balance
            realBNB = await realWeb3.eth.getBalance(currentAccount);
            realBNB = web3.utils.fromWei(realBNB, 'ether');
            
            // Get real USDT balance
            try {
                const usdtContract = new realWeb3.eth.Contract(
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
                console.log('USDT error:', usdtError.message);
            }
        } catch (realError) {
            console.log('Real balance error:', realError.message);
        }
        
        // Display combined balances with real prices
        displayBalances({
            real: {
                bnb: realBNB,
                usdt: realUSDT
            },
            demo: demoData.result.demo,
            prices: demoData.result.prices || { bnb: 350.50, usdt: 1.00, och: 0.25 }
        });
        
    } catch (error) {
        console.error('Error loading balances:', error);
        showNotification('Failed to load balances: ' + error.message, 'error');
        
        // Show fallback
        displayBalances({
            real: { bnb: '0', usdt: '0' },
            demo: { bnb: '0', usdt: '0', och: '0' },
            prices: { bnb: 350.50, usdt: 1.00, och: 0.25 }
        });
    } finally {
        hideLoading();
    }
}

// Display balances with value calculations
function displayBalances(data) {
    const container = document.getElementById('balancesGrid');
    
    // Calculate values
    const realBnbValue = parseFloat(data.real.bnb) * data.prices.bnb;
    const demoBnbValue = parseFloat(data.demo.bnb) * data.prices.bnb;
    const demoUsdtValue = parseFloat(data.demo.usdt) * data.prices.usdt;
    const demoOchValue = parseFloat(data.demo.och) * data.prices.och;
    
    const totalBnb = parseFloat(data.real.bnb) + parseFloat(data.demo.bnb);
    const totalBnbValue = realBnbValue + demoBnbValue;
    const totalValue = totalBnbValue + demoUsdtValue + demoOchValue;
    
    // Update total value display
    const totalValueEl = document.getElementById('totalValue');
    if (totalValueEl) {
        totalValueEl.textContent = `$${totalValue.toFixed(2)}`;
    }
    
    const balanceData = [
        {
            symbol: 'BNB',
            icon: 'bnb',
            name: 'Binance Coin',
            real: data.real.bnb,
            demo: data.demo.bnb,
            price: `$${data.prices.bnb.toFixed(2)}`,
            realValue: `$${realBnbValue.toFixed(2)}`,
            demoValue: `$${demoBnbValue.toFixed(2)}`,
            totalValue: `$${totalBnbValue.toFixed(2)}`,
            color: 'bnb'
        },
        {
            symbol: 'USDT',
            icon: 'usdt',
            name: 'Tether USD',
            real: data.real.usdt,
            demo: data.demo.usdt,
            price: `$${data.prices.usdt.toFixed(2)}`,
            realValue: `$${(parseFloat(data.real.usdt) * data.prices.usdt).toFixed(2)}`,
            demoValue: `$${demoUsdtValue.toFixed(2)}`,
            totalValue: `$${demoUsdtValue.toFixed(2)}`,
            color: 'usdt'
        },
        {
            symbol: 'OCH',
            icon: 'och',
            name: 'OffChain Token',
            real: '0',
            demo: data.demo.och,
            price: `$${data.prices.och.toFixed(2)}`,
            realValue: '$0.00',
            demoValue: `$${demoOchValue.toFixed(2)}`,
            totalValue: `$${demoOchValue.toFixed(2)}`,
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
                    <h3>${token.symbol} <span class="price">${token.price}</span></h3>
                    <div class="token-symbol">${token.name}</div>
                </div>
            </div>
            
            <div class="balance-total">
                ${(parseFloat(token.real) + parseFloat(token.demo)).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4
                })}
                <div class="value">${token.totalValue}</div>
            </div>
            
            <div class="balance-breakdown">
                <div class="breakdown-item">
                    <span class="breakdown-label">Real (BSC):</span>
                    <span class="breakdown-value">
                        ${parseFloat(token.real).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4
                        })}
                        <small>${token.realValue}</small>
                    </span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">Demo (Added):</span>
                    <span class="breakdown-value">
                        ${parseFloat(token.demo).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4
                        })}
                        <small>${token.demoValue}</small>
                    </span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">Total Display:</span>
                    <span class="breakdown-value" style="color: var(--primary); font-weight: bold;">
                        ${(parseFloat(token.real) + parseFloat(token.demo)).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4
                        })}
                        <small style="color: var(--primary);">${token.totalValue}</small>
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
                `🎉 ${data.result.message}<br>Total Value: ${data.result.values.total}`,
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
                    <small>Gas Used: ${data.result.gasUsed} (Free!)</small>
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

// Add network to wallet
async function addNetworkToWallet() {
    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: '0x38',
                chainName: 'BSC with Demo Tokens',
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
    alert(`🎮 BSC Demo Network Help
    
✅ **Chain ID 56 - Real BSC Network**
✅ **Real BNB Price Displayed** ($350.50)
✅ **Demo Tokens Added on Top**
✅ **Wallet Shows Real Dollar Value**
✅ **Persistent Storage on Netlify**

**Features:**
1. Connect wallet (MetaMask/Trust Wallet)
2. Switch to BSC Network (Chain ID 56)
3. Get demo tokens from faucet
4. Send demo transactions
5. See real + demo balances combined
6. Real-time price calculations

**Demo Tokens You Get:**
• 10 Demo BNB = $3,505.00
• 1,000 Demo USDT = $1,000.00
• 5,000 Demo OCH = $1,250.00
• **Total: $5,755.00**

**Note:** Demo balances persist until Netlify function resets.`);
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
    
    // Hide wallet info
    const walletInfo = document.getElementById('walletInfo');
    if (walletInfo) {
        walletInfo.style.display = 'none';
    }
    
    // Clear balances display
    const balancesGrid = document.getElementById('balancesGrid');
    if (balancesGrid) {
        balancesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet"></i>
                <p>Connect wallet to see balances</p>
            </div>
        `;
    }
    
    // Clear total value
    const totalValueEl = document.getElementById('totalValue');
    if (totalValueEl) {
        totalValueEl.textContent = '$0.00';
    }
    
    updateNetworkStatus();
    showNotification('Wallet disconnected', 'warning');
}

// Copy address to clipboard
function copyAddress() {
    if (!currentAccount) {
        showNotification('No wallet connected', 'error');
        return;
    }
    
    navigator.clipboard.writeText(currentAccount).then(() => {
        showNotification('Address copied to clipboard!', 'success');
    });
}

// Copy RPC URL
function copyRPC() {
    navigator.clipboard.writeText(RPC_URL).then(() => {
        showNotification('RPC URL copied to clipboard!', 'success');
    });
}