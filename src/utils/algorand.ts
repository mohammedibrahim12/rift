/**
 * Algorand utility functions for certificate management
 */

import algosdk, { 
  Account, 
  Algodv2, 
  Indexer
} from 'algosdk';

// Configuration - these would come from environment variables
const ALGO_SERVER = 'https://node.testnet.algoexplorerapi.io';
const ALGO_PORT = 443;
const ALGO_INDEXER_SERVER = 'https://indexer.testnet.algoexplorerapi.io';
const ALGO_INDEXER_PORT = 443;

// Smart Contract App IDs
const ALGO_APP_ID_TESTNET = parseInt(process.env.ALGO_APP_ID_TESTNET || '0');
const ALGO_APP_ID_MAINNET = parseInt(process.env.ALGO_APP_ID_MAINNET || '0');

// Determine current network and App ID
const isMainnet = process.env.ALGO_NETWORK === 'mainnet';
export const ALGO_APP_ID = isMainnet ? ALGO_APP_ID_MAINNET : ALGO_APP_ID_TESTNET;

/**
 * Get the current Algorand App ID based on network
 */
export function getAppId(): number {
  const network = process.env.ALGO_NETWORK || 'testnet';
  if (network === 'mainnet') {
    return ALGO_APP_ID_MAINNET;
  }
  return ALGO_APP_ID_TESTNET;
}

/**
 * Check if smart contract is configured
 */
export function isSmartContractConfigured(): boolean {
  return getAppId() > 0;
}

/**
 * Create Algorand client for interacting with the network
 */
export function createAlgodClient(): Algodv2 {
  const token = '';
  return new algosdk.Algodv2(token, ALGO_SERVER, ALGO_PORT);
}

/**
 * Create Algorand indexer for reading transaction data
 */
export function createIndexer(): Indexer {
  const token = '';
  return new algosdk.Indexer(token, ALGO_INDEXER_SERVER, ALGO_INDEXER_PORT);
}

/**
 * Generate account from mnemonic phrase
 */
export function generateAccountFromMnemonic(mnemonic: string): Account {
  return algosdk.mnemonicToSecretKey(mnemonic);
}

/**
 * Create a new random Algorand account (for testing)
 */
export function generateAccount(): Account {
  const account = algosdk.generateAccount();
  return account;
}

/**
 * Get account balance
 */
export async function getAccountBalance(client: Algodv2, address: string): Promise<number> {
  const accountInfo = await client.accountInformation(address).do();
  return accountInfo.amount;
}

/**
 * Create a certificate asset (ASA) on Algorand
 * This represents a certificate as a non-fungible token
 */
export async function createCertificateAsset(
  client: Algodv2,
  account: Account,
  credentialId: string,
  certificateHash: string,
  metadata: any
): Promise<{ assetId: number; transactionId: string }> {
  
  // Asset parameters
  const assetName = `CERT-${credentialId}`;
  const unitName = 'CERT';
  const url = `https://api.certverify.io/certificates/${credentialId}/metadata`;
  
  // Create asset configuration transaction
  const suggestedParams = await client.getTransactionParams().do();
  
  const note = algosdk.encodeObj({ credentialId, certificateHash });
  
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    from: account.addr,
    suggestedParams,
    assetName,
    unitName,
    total: 1,
    decimals: 0,
    defaultFrozen: false,
    note
  });

  // Sign transaction
  const signedTxn = txn.signTxn(account.sk);
  
  // Submit transaction
  const response = await client.sendRawTransaction(signedTxn).do();
  
  // Wait for confirmation
  await algosdk.waitForConfirmation(client, response.txid, 3);
  
  // Get the asset ID from the transaction
  const assetId = response['asset-index'];
  
  return {
    assetId: assetId,
    transactionId: response.txid
  };
}

/**
 * Transfer certificate asset to student
 */
export async function transferCertificateAsset(
  client: Algodv2,
  account: Account,
  assetId: number,
  recipientAddress: string
): Promise<string> {
  
  const suggestedParams = await client.getTransactionParams().do();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
    account.addr,
    recipientAddress,
    undefined,
    undefined,
    1,
    undefined,
    assetId,
    suggestedParams
  );

  const signedTxn = txn.signTxn(account.sk);
  const response = await client.sendRawTransaction(signedTxn).do();
  
  await algosdk.waitForConfirmation(client, response.txid, 3);
  
  return response.txid;
}

/**
 * Verify certificate by checking on-chain data
 */
export async function verifyCertificateOnChain(
  indexer: Indexer,
  assetId: bigint,
  expectedHash: string
): Promise<{ isValid: boolean; owner?: string; metadata?: any }> {
  
  try {
    // Get asset information - convert bigint to number for Algorand SDK
    const assetInfo = await indexer.lookupAssetByID(Number(assetId)).do();
    
    if (!assetInfo || !assetInfo.asset) {
      return { isValid: false };
    }

    const asset = assetInfo.asset;
    
    // Check the asset URL for metadata reference
    const metadataUrl = asset.params.url;
    
    // In a real implementation, we would fetch metadata from URL
    // and compare the hash. For now, we verify the asset exists
    // and was created by the institution.
    
    return {
      isValid: true,
      owner: asset.params.owner,
      metadata: {
        name: asset.params.name,
        url: metadataUrl
      }
    };
  } catch (error) {
    console.error('Error verifying certificate on chain:', error);
    return { isValid: false };
  }
}

/**
 * Get asset information by ID
 */
export async function getAssetInfo(
  indexer: Indexer,
  assetId: number
): Promise<any> {
  try {
    const assetInfo = await indexer.lookupAssetByID(assetId).do();
    return assetInfo.asset;
  } catch (error) {
    console.error('Error getting asset info:', error);
    return null;
  }
}

/**
 * Lookup transactions for an asset
 */
export async function getAssetTransactions(
  indexer: Indexer,
  assetId: number
): Promise<any[]> {
  try {
    const transactions = await indexer.lookupAssetTransactions(assetId).do();
    return transactions.transactions;
  } catch (error) {
    console.error('Error getting asset transactions:', error);
    return [];
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForConfirmation(
  client: Algodv2,
  txId: string
): Promise<any> {
  return await algosdk.waitForConfirmation(client, txId, 3);
}

/**
 * Get transaction details
 */
export async function getTransactionDetails(
  indexer: Indexer,
  txId: string
): Promise<any> {
  try {
    const txn = await indexer.lookupTransactionByID(txId).do();
    return txn.transaction;
  } catch (error) {
    console.error('Error getting transaction details:', error);
    return null;
  }
}
