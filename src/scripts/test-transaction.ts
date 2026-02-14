/**
 * Test real MON transaction on Monad testnet
 */

import 'dotenv/config';
import { checkBalance, transferMON, createAgentWallet } from '../blockchain/transactions.js';

async function testTransaction() {
  const platformKey = process.env.PRIVATE_KEY;
  
  if (!platformKey) {
    console.log('❌ No PRIVATE_KEY in .env');
    return;
  }
  
  const { account } = createAgentWallet(platformKey);
  
  console.log('═══════════════════════════════════════════');
  console.log('🧪 MONAD TESTNET TRANSACTION TEST');
  console.log('═══════════════════════════════════════════');
  console.log('Platform Wallet:', account.address);
  
  // Check balance before
  const balanceBefore = await checkBalance(account.address);
  console.log('Balance before:', balanceBefore, 'MON');
  
  // Send 0.001 MON to self (to test without losing funds)
  console.log('\n📤 Sending 0.001 MON to self (test transaction)...');
  const result = await transferMON(platformKey, account.address, '0.001');
  
  if (result.success) {
    console.log('\n✅ TRANSACTION SUCCESSFUL!');
    console.log('TX Hash:', result.txHash);
    console.log('Explorer: https://testnet.monadvision.com/tx/' + result.txHash);
  } else {
    console.log('\n❌ Transaction failed:', result.error);
    return;
  }
  
  // Check balance after
  const balanceAfter = await checkBalance(account.address);
  console.log('\nBalance after:', balanceAfter, 'MON');
  
  const gasUsed = parseFloat(balanceBefore) - parseFloat(balanceAfter);
  console.log('Gas cost:', gasUsed.toFixed(6), 'MON');
  console.log('═══════════════════════════════════════════');
}

testTransaction().catch(console.error);
