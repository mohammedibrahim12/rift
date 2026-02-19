/**
 * Algorand Smart Contract Deployment Script
 * 
 * Deploys the certificate verification smart contract to Algorand Testnet
 * and saves the App ID to environment configuration.
 * 
 * Usage: npx ts-node src/scripts/deployContract.ts
 */

import algosdk, { makeApplicationCreateTxnFromObject } from 'algosdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ALGO_SERVER = process.env.ALGO_SERVER || 'https://testnet-api.algonode.cloud';
const ALGO_PORT = 443;
const MNEMONIC = process.env.INSTITUTION_MNEMONIC || '';

async function deployContract() {
  if (!MNEMONIC) {
    console.error('Error: INSTITUTION_MNEMONIC not configured in .env');
    console.log('\nPlease add your Algorand wallet mnemonic to .env:');
    console.log('INSTITUTION_MNEMONIC="your 25-word mnemonic here"');
    process.exit(1);
  }

  console.log('🚀 Deploying Certificate Verification Smart Contract...\n');

  // Create client with API key
  const apiKey = process.env.ALGO_API_KEY || '';
  const client = new algosdk.Algodv2({ 'x-api-key': apiKey }, ALGO_SERVER, ALGO_PORT);
  
  // Get account from mnemonic
  const account = algosdk.mnemonicToSecretKey(MNEMONIC);
  console.log(`👤 Account: ${account.addr}`);

  // Function to wait between retries
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Check account balance with retry logic
  let accountInfo;
  const maxRetries = 10;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      accountInfo = await client.accountInformation(account.addr).do();
      break;
    } catch (error: any) {
      retryCount++;
      if (error.rawResponse && error.rawResponse.includes('Daily free API quota exceeded')) {
        console.log(`⚠️  Rate limit exceeded (attempt ${retryCount}/${maxRetries})`);
        console.log('💤 Waiting 120 seconds before retrying...');
        await wait(120000);
      } else if (retryCount >= maxRetries) {
        console.error('❌ Failed to connect to Algorand after multiple attempts');
        console.error('Error:', error.message || error);
        process.exit(1);
      } else {
        console.log(`⚠️  Connection error (attempt ${retryCount}/${maxRetries}):`, error.message || error);
        await wait(10000);
      }
    }
  }

  if (accountInfo) {
    console.log(`💰 Balance: ${algosdk.microalgosToAlgos(accountInfo.amount)} ALGO\n`);
  };

  // Read TEAL contract
  const contractPath = path.join(__dirname, '../../contracts/certificate.teal');
  const tealSource = fs.readFileSync(contractPath, 'utf8');
  console.log('📄 TEAL Contract loaded from:', contractPath);

  // Compile TEAL
  console.log('⚙️  Compiling TEAL contract...');
  const compileResponse = await client.compile(tealSource).do();
  const program = new Uint8Array(Buffer.from(compileResponse.result, 'base64'));
  const clearProgram = program; // Use same program for clear state
  console.log('✅ Contract compiled successfully');

  // Get suggested parameters
  const suggestedParams = await client.getTransactionParams().do();
  suggestedParams.fee = 1000;
  suggestedParams.flatFee = true;

  // Build the application create transaction using object-based approach
  const txn = makeApplicationCreateTxnFromObject({
    from: account.addr,
    suggestedParams: suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC as any,
    approvalProgram: program,
    clearProgram: clearProgram,
    globalSchema: { numByteSlice: 1, numUint: 0 },
    localSchema: { numByteSlice: 0, numUint: 0 }
  } as any);

  // Sign transaction
  const signedTxn = txn.signTxn(account.sk);

  // Submit transaction
  console.log('📤 Deploying to Algorand Testnet...');
  const { txId } = await client.sendRawTransaction(signedTxn).do();

  // Wait for confirmation
  console.log(`⏳ Transaction ID: ${txId}`);
  const confirmation = await algosdk.waitForConfirmation(client, txId, 3);
  
  // Get the new App ID
  const appCreated = confirmation['application-index'];
  console.log(`\n✅ Smart Contract Deployed Successfully!`);
  console.log(`   App ID: ${appCreated}`);
  console.log(`   Transaction ID: ${txId}`);

  // Update .env file with App ID
  const envPath = path.join(__dirname, '../../.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Update or add ALGO_APP_ID_TESTNET
  if (envContent.includes('ALGO_APP_ID_TESTNET=')) {
    envContent = envContent.replace(
      /ALGO_APP_ID_TESTNET=\d+/,
      `ALGO_APP_ID_TESTNET=${appCreated}`
    );
  } else {
    envContent += `\nALGO_APP_ID_TESTNET=${appCreated}`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`\n📝 Updated .env with App ID: ALGO_APP_ID_TESTNET=${appCreated}`);

  // Print next steps
  console.log('\n' + '='.repeat(50));
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('='.repeat(50));
  console.log('\nNext steps:');
  console.log(`1. App ID ${appCreated} has been saved to .env`);
  console.log('2. Restart your application: npm run dev');
  console.log('3. Certificate approval will now record to the smart contract');
  console.log('\nTo verify on Mainnet, deploy again and update ALGO_APP_ID_MAINNET');
}

deployContract().catch(console.error);
