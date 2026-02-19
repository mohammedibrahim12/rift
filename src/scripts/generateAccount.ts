/**
 * Generate a new Algorand account for testing
 * Run with: npx ts-node src/scripts/generateAccount.ts
 */

import algosdk from 'algosdk';

// Generate a new random account
const account = algosdk.generateAccount();

console.log('\n=== NEW ALGORAND TESTNET ACCOUNT ===\n');
console.log('Address:', account.addr);
console.log('Mnemonic (24 words):');
console.log(algosdk.secretKeyToMnemonic(account.sk));
console.log('\n======================================\n');
console.log('⚠️  IMPORTANT: Save these words securely!');
console.log('⚠️  This is for TESTNET only - do not use with real funds!');
console.log('\n');
